import { Component, NgZone, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

interface CashMovement {
  date: string; // YYYY-MM-DD
  direction: 'IN' | 'OUT';
  amount: number;
  source: 'INVOICE_PAYMENT' | 'EXPENSE_PAYMENT' | 'EXPENSE_PAID';
  reference: string;
  description: string;
  method: 'cash';
}

interface CashboxTxn {
  id: string;
  created_at: string;
  movement_date: string;      // date
  description: string | null;
  in: number | null;
  out: number | null;
  category: string | null;    // CASHBOX
  code: number | null;

  payment_method: string | null; // cash
  source_type: string | null;    // OPENING / COUNTED / ADJUSTMENT_*
  source_ref: string | null;
}

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './banking.component.html',
  styleUrls: ['./banking.component.scss'],
})
export class BankingComponent implements OnInit {
  // Movimientos calculados (automáticos)
  cashMovements: CashMovement[] = [];
  filteredMovements: CashMovement[] = [];

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedBanking: CashMovement[] = [];

  // Filtros
  startDate: string = '';
  endDate: string = '';

  // Totales (del rango filtrado)
  totalCashIn = 0;
  totalCashOut = 0;
  cashBalance = 0;

  // Cuadre (guardable en transactions)
  movementDate: string = new Date().toISOString().split('T')[0]; // día de caja
  openingCash: number = 0;   // OPENING
  countedCash: number = 0;   // COUNTED
  theoreticalCash: number = 0;
  cashDifference: number = 0;

  // Estado
  loading = true;
  notificationMessage: string | null = null;
  notificationType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private readonly router: Router,
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.initCashbox();
        });
      }
    });
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.notificationMessage = message;
    this.notificationType = type;
    setTimeout(() => (this.notificationMessage = null), 2500);
  }

  private ymd(d: any): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString().split('T')[0];
  }

  private isCash(v?: string | null): boolean {
    return (v ?? '').trim().toLowerCase() === 'cash';
  }

  async initCashbox(): Promise<void> {
    // Por defecto, el rango es el mismo día de caja
    this.startDate = this.movementDate;
    this.endDate = this.movementDate;

    await this.loadCashboxManualForDate(this.movementDate);
    await this.loadCashMovements();
  }

  // ===== 1) Movimientos automáticos (invoices/expenses) =====

  async loadCashMovements(): Promise<void> {
    this.loading = true;

    // ENTRADAS: payments cash
    const { data: cashPayments, error: payErr } = await this.supabase
      .from('payments')
      .select(`
        id_payment,
        id_order,
        amount,
        payment_date,
        payment_method,
        orders:orders (
          code,
          clients:clients ( name )
        )
      `)
      .eq('payment_method', 'cash');

    if (payErr) {
      console.error('Error cargando payments cash:', payErr);
      this.showNotification('Error cargando entradas de caja.', 'error');
      this.loading = false;
      return;
    }

    const inMoves: CashMovement[] = (cashPayments ?? []).map((p: any) => ({
      date: this.ymd(p.payment_date ?? new Date()),
      direction: 'IN',
      amount: Number(p.amount) || 0,
      source: 'INVOICE_PAYMENT',
      reference: p.orders?.code ? `Factura ${p.orders.code}` : String(p.id_order ?? ''),
      description: p.orders?.clients?.name
        ? `Pago efectivo - ${p.orders.clients.name}`
        : 'Pago efectivo',
      method: 'cash',
    }));

    // SALIDAS: abonos cash de egresos
    const { data: expensePays, error: expPayErr } = await this.supabase
      .from('expense_payments')
      .select(`
        id_expense_payment,
        id_expenses,
        amount,
        payment_date,
        payment_method,
        expenses:expenses ( code, description )
      `)
      .eq('payment_method', 'cash');

    if (expPayErr) {
      console.error('Error cargando expense_payments cash:', expPayErr);
      this.showNotification('Error cargando salidas de caja (abonos).', 'error');
      this.loading = false;
      return;
    }

    const outMovesFromPayments: CashMovement[] = (expensePays ?? []).map((p: any) => ({
      date: this.ymd(p.payment_date ?? new Date()),
      direction: 'OUT',
      amount: Number(p.amount) || 0,
      source: 'EXPENSE_PAYMENT',
      reference: `Egreso ${String(p.code ?? '')}`,
      description: p.expenses?.description
        ? `Abono efectivo - ${p.expenses.description}`
        : 'Abono efectivo egreso',
      method: 'cash',
    }));

    // SALIDAS: egresos PAID cash SIN abonos
    const { data: paidExpenses, error: expErr } = await this.supabase
      .from('expenses')
      .select(`
        id_expenses,
        code,
        cost,
        paid_at,
        payment_status,
        type,
        description,
        expense_payments:expense_payments(id_expense_payment)
      `)
      .eq('payment_status', 'PAID')
      .eq('type', 'cash');

    if (expErr) {
      console.error('Error cargando egresos PAID cash:', expErr);
      this.showNotification('Error cargando salidas de caja (pagos).', 'error');
      this.loading = false;
      return;
    }

    const outMovesPaidNoPayments: CashMovement[] = (paidExpenses ?? [])
      .filter((e: any) => (e.expense_payments?.length ?? 0) === 0)
      .map((e: any) => ({
        date: this.ymd(e.paid_at ?? new Date()),
        direction: 'OUT',
        amount: Number(e.cost) || 0,
        source: 'EXPENSE_PAID',
        reference: `Egreso ${String(e.code ?? '')}`,
        description: e.description ? `Efectivo - ${e.description}` : 'Egreso efectivo',
        method: 'cash',
      }));

    // Merge y ordenar
    this.cashMovements = [...inMoves, ...outMovesFromPayments, ...outMovesPaidNoPayments]
      .filter(m => m.amount > 0 && !!m.date);

    this.cashMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    this.applyCashFilters();
    this.loading = false;
  }

  applyCashFilters(): void {
    this.filteredMovements = this.cashMovements.filter(m => {
      const d = new Date(m.date);
      const okStart = this.startDate ? d >= new Date(this.startDate) : true;
      const okEnd = this.endDate ? d <= new Date(this.endDate + 'T23:59:59') : true;
      return okStart && okEnd;
    });

    this.currentPage = 1;
    this.sumTotals();
    this.updatePaginatedBanking();
  }

  private sumTotals(): void {
    const list = this.filteredMovements;

    this.totalCashIn = list
      .filter(m => m.direction === 'IN')
      .reduce((s, m) => s + (Number(m.amount) || 0), 0);

    this.totalCashOut = list
      .filter(m => m.direction === 'OUT')
      .reduce((s, m) => s + (Number(m.amount) || 0), 0);

    this.cashBalance = this.totalCashIn - this.totalCashOut;

    // Cuadre
    this.theoreticalCash = Number(this.openingCash || 0) + this.cashBalance;
    this.cashDifference = Number(this.countedCash || 0) - this.theoreticalCash;
  }

  // ===== 2) Ledger manual guardado en transactions =====

  async loadCashboxManualForDate(date: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('category', 'CASHBOX')
      .eq('payment_method', 'cash')
      .eq('movement_date', date)
      .in('source_type', ['OPENING', 'COUNTED'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando cashbox manual:', error);
      this.openingCash = 0;
      this.countedCash = 0;
      return;
    }

    const rows = (data ?? []) as CashboxTxn[];

    const opening = rows.find(r => (r.source_type ?? '').toUpperCase() === 'OPENING');
    const counted = rows.find(r => (r.source_type ?? '').toUpperCase() === 'COUNTED');

    this.openingCash = Number(opening?.in ?? 0) || 0;
    this.countedCash = Number(counted?.in ?? 0) || 0;
  }

  async saveOpeningCash(): Promise<void> {
    await this.upsertCashboxTxn('OPENING', this.openingCash, `Saldo inicial caja ${this.movementDate}`);
    this.sumTotals();
  }

  async saveCountedCash(): Promise<void> {
    await this.upsertCashboxTxn('COUNTED', this.countedCash, `Arqueo contado ${this.movementDate}`);
    this.sumTotals();
  }

  private async upsertCashboxTxn(sourceType: 'OPENING' | 'COUNTED', amount: number, desc: string): Promise<void> {
    const movementDate = this.movementDate;
    const cleanAmount = Number(amount || 0);

    // Buscar si ya existe uno para ese día y tipo
    const { data: existing, error: findErr } = await this.supabase
      .from('transactions')
      .select('id')
      .eq('category', 'CASHBOX')
      .eq('payment_method', 'cash')
      .eq('movement_date', movementDate)
      .eq('source_type', sourceType)
      .maybeSingle();

    if (findErr) {
      console.error('Error buscando txn existente:', findErr);
      this.showNotification('Error consultando transacción de caja.', 'error');
      return;
    }

    const payload: any = {
      description: desc,
      in: cleanAmount,
      out: 0,
      category: 'CASHBOX',
      payment_method: 'cash',
      movement_date: movementDate,
      source_type: sourceType,
      source_ref: `Caja ${movementDate}`,
    };

    if (existing?.id) {
      const { error: updErr } = await this.supabase
        .from('transactions')
        .update(payload)
        .eq('id', existing.id);

      if (updErr) {
        console.error('Error actualizando txn caja:', updErr);
        this.showNotification('Error guardando caja.', 'error');
        return;
      }
    } else {
      const { error: insErr } = await this.supabase
        .from('transactions')
        .insert([payload]);

      if (insErr) {
        console.error('Error insertando txn caja:', insErr);
        this.showNotification('Error guardando caja.', 'error');
        return;
      }
    }

    this.showNotification('Caja guardada correctamente.', 'success');
  }

  async onMovementDateChange(): Promise<void> {
    // sincroniza filtros al día elegido
    this.startDate = this.movementDate;
    this.endDate = this.movementDate;

    await this.loadCashboxManualForDate(this.movementDate);
    this.applyCashFilters();
  }

  clearFilters(): void {
    this.startDate = this.movementDate;
    this.endDate = this.movementDate;
    this.applyCashFilters();
  }

  // Paginación
  updatePaginatedBanking(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredMovements.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedBanking = this.filteredMovements.slice(startIndex, endIndex);
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }
}
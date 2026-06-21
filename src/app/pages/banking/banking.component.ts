import { Component, NgZone, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

interface CashMovement {
  date: string; // YYYY-MM-DD
  occurred_at: string;
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
  movement_date: string;
  description: string | null;
  in: number | null;
  out: number | null;
  category: string | null;
  code: number | null;
  payment_method: string | null;
  source_type: string | null;
  source_ref: string | null;
}

type CashboxCountType =
  | 'OPENING_COUNT'
  | 'CHECKPOINT_COUNT'
  | 'CLOSING_COUNT';

type CashboxCountTypeWithLegacy =
  | CashboxCountType
  | 'COUNTED';

@Component({
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './banking.component.html',
  styleUrls: ['./banking.component.scss'],
})
export class BankingComponent implements OnInit {
  // Movimientos automáticos
  cashMovements: CashMovement[] = [];
  filteredMovements: CashMovement[] = [];

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  paginatedBanking: CashMovement[] = [];

  // Filtros
  startDate = '';
  endDate = '';
  movementTypeFilter: 'ALL' | 'IN' | 'OUT' = 'ALL';

  // Totales
  totalCashIn = 0;
  totalCashOut = 0;
  cashBalance = 0;

  // Caja
  movementDate: string = new Date().toISOString().split('T')[0];
  openingCash = 0;   // automático desde base + histórico
  countedCash = 0;   // manual
  theoreticalCash = 0;
  cashDifference = 0;

  // Apertura
  openingCountedCash = 0;
  openingDifference = 0;
  openingCountSaved = false;

  // Conteo intermedio
  checkpointCountedCash = 0;
  checkpointCreatedAt = '';
  checkpointCountSaved = false;

  checkpointInAfter = 0;
  checkpointOutAfter = 0;
  checkpointNetAfter = 0;
  checkpointProjectedCash = 0;
  checkpointVsClosingDifference = 0;

  // Cierre
  closingCountedCash = 0;
  closingCountSaved = false;

  dayTotalCashIn = 0;
  dayTotalCashOut = 0;
  dayCashBalance = 0;
  closingTheoreticalCash = 0;
  closingDifference = 0;

  // Configuración base caja
  baseCashDate = '';
  baseCashAmount = 0;

  // Estado UI
  loading = true;
  savingBaseConfig = false;
  showCashboxConfig = false;

  notificationMessage: string | null = null;
  notificationType: 'success' | 'error' | 'info' = 'info';

  private baseDateRowId: string | null = null;
  private baseAmountRowId: string | null = null;

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

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ): void {
    this.notificationMessage = message;
    this.notificationType = type;
    setTimeout(() => (this.notificationMessage = null), 2500);
  }

  private round2(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private ymd(value: any): string {
    if (!value) return '';

    const raw = String(value).trim();
    if (!raw) return '';

    const prefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    const datePrefix = prefixMatch ? prefixMatch[1] : '';

    // Si viene solo fecha: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    // Caso legacy: fechas que antes eran DATE y quedaron como medianoche UTC
    // Ejemplo: 2026-06-18T00:00:00+00:00
    // Si se convierte con new Date(), Colombia lo pasa al día anterior.
    if (
      /^\d{4}-\d{2}-\d{2}[T\s]00:00:00(?:\.0+)?(?:Z|\+00:00)?$/.test(raw)
    ) {
      return datePrefix;
    }

    // Timestamp sin zona horaria: se respeta la fecha escrita
    // Ejemplo: 2026-06-18 14:41:53
    if (
      /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)
    ) {
      return datePrefix;
    }

    // Timestamp real con zona horaria: calcular fecha de negocio en Colombia
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) {
      return datePrefix;
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(dt);

    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';

    return `${year}-${month}-${day}`;
  }

  private toDateTimeValue(value: any): string {
    if (!value) return '';

    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value).trim();
  }

  private combineDateWithCreatedTime(paymentDate: any, createdAt: any): string {
    const businessDate = this.ymd(paymentDate);

    if (!businessDate) {
      return this.toDateTimeValue(createdAt || paymentDate);
    }

    if (!createdAt) {
      return `${businessDate}T00:00:00-05:00`;
    }

    const created = new Date(createdAt);

    if (isNaN(created.getTime())) {
      return `${businessDate}T00:00:00-05:00`;
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(created);

    let hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    const second = parts.find(p => p.type === 'second')?.value ?? '00';

    if (hour === '24') {
      hour = '00';
    }

    return `${businessDate}T${hour}:${minute}:${second}-05:00`;
  }

  private timeMs(value: string): number {
    if (!value) return 0;

    const ms = new Date(value).getTime();
    return isNaN(ms) ? 0 : ms;
  }

  formatTime(value: string): string {
    if (!value) return '';

    const dt = new Date(value);
    if (isNaN(dt.getTime())) return '';

    return dt.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private toDateOnly(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  private isBeforeDate(dateA: string, dateB: string): boolean {
    return this.toDateOnly(dateA).getTime() < this.toDateOnly(dateB).getTime();
  }

  private isOnOrAfterBase(dateStr: string): boolean {
    if (!this.baseCashDate) return false;
    return this.toDateOnly(dateStr).getTime() >= this.toDateOnly(this.baseCashDate).getTime();
  }

  formatYmdToDisplay(dateStr: string): string {
    if (!dateStr || dateStr.length < 10) return '';
    const [year, month, day] = dateStr.slice(0, 10).split('-');
    return `${day}-${month}-${year}`;
  }

  async initCashbox(): Promise<void> {
    this.loading = true;

    this.startDate = this.movementDate;
    this.endDate = this.movementDate;
    this.movementTypeFilter = 'ALL';

    await this.loadCashboxBaseConfig();
    await this.loadCashMovements(false);
    await this.loadAutomaticOpeningCashFromHistory(this.movementDate);
    await this.loadCashboxCountsForDate(this.movementDate);
    this.applyCashFilters();

    this.loading = false;
  }

  // ===== 1) CONFIG BASE DE CAJA =====

  async loadCashboxBaseConfig(): Promise<void> {
    const { data, error } = await this.supabase
      .from('variables')
      .select('id, name, value, value_text, label')
      .eq('category', 'CASHBOX')
      .in('name', ['CASHBOX_BASE_DATE', 'CASHBOX_BASE_AMOUNT']);

    if (error) {
      console.error('Error cargando configuración base de caja:', error);
      this.baseCashDate = '';
      this.baseCashAmount = 0;
      this.baseDateRowId = null;
      this.baseAmountRowId = null;
      this.showNotification('Error cargando configuración base de caja.', 'error');
      return;
    }

    const rows = data ?? [];

    const baseDateRow = rows.find((r: any) => r.name === 'CASHBOX_BASE_DATE');
    const baseAmountRow = rows.find((r: any) => r.name === 'CASHBOX_BASE_AMOUNT');

    this.baseDateRowId = baseDateRow?.id ?? null;
    this.baseAmountRowId = baseAmountRow?.id ?? null;

    this.baseCashDate = String(baseDateRow?.value_text ?? '').trim();
    this.baseCashAmount = Number(baseAmountRow?.value ?? 0) || 0;
  }

  async saveCashboxBaseConfig(): Promise<void> {
    if (!this.baseCashDate) {
      this.showNotification('La fecha base de caja es obligatoria.', 'error');
      return;
    }

    if (this.baseCashAmount < 0) {
      this.showNotification('El saldo base de caja no puede ser negativo.', 'error');
      return;
    }

    this.savingBaseConfig = true;

    const baseDatePayload = {
      name: 'CASHBOX_BASE_DATE',
      category: 'CASHBOX',
      value: null,
      value_text: this.baseCashDate,
      label: 'Fecha base de caja',
    };

    const baseAmountPayload = {
      name: 'CASHBOX_BASE_AMOUNT',
      category: 'CASHBOX',
      value: this.round2(Number(this.baseCashAmount || 0)),
      value_text: null,
      label: 'Saldo base de caja',
    };

    if (this.baseDateRowId) {
      const { error } = await this.supabase
        .from('variables')
        .update(baseDatePayload)
        .eq('id', this.baseDateRowId);

      if (error) {
        console.error('Error actualizando fecha base de caja:', error);
        this.showNotification('Error guardando fecha base de caja.', 'error');
        this.savingBaseConfig = false;
        return;
      }
    } else {
      const { data, error } = await this.supabase
        .from('variables')
        .insert([baseDatePayload])
        .select('id')
        .single();

      if (error) {
        console.error('Error insertando fecha base de caja:', error);
        this.showNotification('Error guardando fecha base de caja.', 'error');
        this.savingBaseConfig = false;
        return;
      }

      this.baseDateRowId = data?.id ?? null;
    }

    if (this.baseAmountRowId) {
      const { error } = await this.supabase
        .from('variables')
        .update(baseAmountPayload)
        .eq('id', this.baseAmountRowId);

      if (error) {
        console.error('Error actualizando saldo base de caja:', error);
        this.showNotification('Error guardando saldo base de caja.', 'error');
        this.savingBaseConfig = false;
        return;
      }
    } else {
      const { data, error } = await this.supabase
        .from('variables')
        .insert([baseAmountPayload])
        .select('id')
        .single();

      if (error) {
        console.error('Error insertando saldo base de caja:', error);
        this.showNotification('Error guardando saldo base de caja.', 'error');
        this.savingBaseConfig = false;
        return;
      }

      this.baseAmountRowId = data?.id ?? null;
    }

    await this.loadCashboxBaseConfig();
    await this.loadAutomaticOpeningCashFromHistory(this.movementDate);
    this.applyCashFilters();

    this.showNotification('Configuración base de caja guardada correctamente.', 'success');
    this.savingBaseConfig = false;
  }

  toggleCashboxConfig(): void {
    this.showCashboxConfig = !this.showCashboxConfig;
  }

  // ===== 2) MOVIMIENTOS AUTOMÁTICOS =====

  async loadCashMovements(applyFilters: boolean = true): Promise<void> {
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
      date: this.ymd(p.payment_date),
      occurred_at: this.toDateTimeValue(p.payment_date),
      direction: 'IN',
      amount: this.round2(Number(p.amount) || 0),
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
        created_at,
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
      date: this.ymd(p.payment_date),
      occurred_at: this.combineDateWithCreatedTime(p.payment_date, p.created_at),
      direction: 'OUT',
      amount: this.round2(Number(p.amount) || 0),
      source: 'EXPENSE_PAYMENT',
      reference: p.expenses?.code ? `Egreso ${p.expenses.code}` : String(p.id_expenses ?? ''),
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
        date: this.ymd(e.paid_at),
        occurred_at: this.toDateTimeValue(e.paid_at),
        direction: 'OUT',
        amount: this.round2(Number(e.cost) || 0),
        source: 'EXPENSE_PAID',
        reference: e.code ? `Egreso ${e.code}` : String(e.id_expenses ?? ''),
        description: e.description ? `Efectivo - ${e.description}` : 'Egreso efectivo',
        method: 'cash',
      }));

    this.cashMovements = [...inMoves, ...outMovesFromPayments, ...outMovesPaidNoPayments]
      .filter((m) => m.amount > 0 && !!m.date);

    this.cashMovements.sort(
      (a, b) => this.timeMs(b.occurred_at) - this.timeMs(a.occurred_at)
    );

    if (applyFilters) {
      this.applyCashFilters();
    }

    this.loading = false;
  }

  // ===== 3) SALDO INICIAL AUTOMÁTICO =====

  async loadAutomaticOpeningCashFromHistory(date: string): Promise<void> {
    if (!this.baseCashDate) {
      this.openingCash = 0;
      return;
    }

    if (!this.isOnOrAfterBase(date)) {
      this.openingCash = this.round2(Number(this.baseCashAmount || 0));
      return;
    }

    const previousMovements = this.cashMovements.filter(
      (m) => !!m.date && this.isOnOrAfterBase(m.date) && this.isBeforeDate(m.date, date)
    );

    const totalInBefore = previousMovements
      .filter((m) => m.direction === 'IN')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const totalOutBefore = previousMovements
      .filter((m) => m.direction === 'OUT')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    this.openingCash = this.round2(Number(this.baseCashAmount || 0) + totalInBefore - totalOutBefore);
  }

  // ===== 4) ARQUEOS DE CAJA =====

  async loadCashboxCountsForDate(date: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('category', 'CASHBOX')
      .eq('payment_method', 'cash')
      .eq('movement_date', date)
      .in('source_type', [
        'OPENING_COUNT',
        'CHECKPOINT_COUNT',
        'CLOSING_COUNT',
        'COUNTED',
      ])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando arqueos de caja:', error);

      this.openingCountedCash = 0;
      this.checkpointCountedCash = 0;
      this.closingCountedCash = 0;

      this.openingCountSaved = false;
      this.checkpointCountSaved = false;
      this.closingCountSaved = false;

      this.checkpointCreatedAt = '';
      return;
    }

    const rows = (data ?? []) as CashboxTxn[];

    const getLatest = (type: CashboxCountTypeWithLegacy): CashboxTxn | null => {
      return rows.find((r) => r.source_type === type) ?? null;
    };

    const openingRow = getLatest('OPENING_COUNT');
    const checkpointRow = getLatest('CHECKPOINT_COUNT');

    // COUNTED queda como compatibilidad vieja y se toma como cierre
    const closingRow = getLatest('CLOSING_COUNT') ?? getLatest('COUNTED');

    this.openingCountSaved = !!openingRow;
    this.checkpointCountSaved = !!checkpointRow;
    this.closingCountSaved = !!closingRow;

    this.openingCountedCash = this.round2(Number(openingRow?.in ?? 0) || 0);

    this.checkpointCountedCash = this.round2(Number(checkpointRow?.in ?? 0) || 0);
    this.checkpointCreatedAt = checkpointRow?.created_at ?? '';

    this.closingCountedCash = this.round2(Number(closingRow?.in ?? 0) || 0);

    // Compatibilidad con campos antiguos
    this.countedCash = this.closingCountedCash;
  }

  async saveOpeningCount(): Promise<void> {
    await this.upsertCashboxTxn(
      'OPENING_COUNT',
      this.openingCountedCash,
      `Conteo apertura ${this.movementDate}`
    );

    await this.loadCashboxCountsForDate(this.movementDate);
    this.sumTotals();
  }

  async saveCheckpointCount(): Promise<void> {
    await this.upsertCashboxTxn(
      'CHECKPOINT_COUNT',
      this.checkpointCountedCash,
      `Conteo intermedio ${this.movementDate}`
    );

    await this.loadCashboxCountsForDate(this.movementDate);
    this.sumTotals();
  }

  async saveClosingCount(): Promise<void> {
    await this.upsertCashboxTxn(
      'CLOSING_COUNT',
      this.closingCountedCash,
      `Conteo cierre ${this.movementDate}`
    );

    await this.loadCashboxCountsForDate(this.movementDate);
    this.sumTotals();
  }

  private async upsertCashboxTxn(
    sourceType: CashboxCountType,
    amount: number,
    desc: string
  ): Promise<void> {
    const movementDate = this.movementDate;
    const cleanAmount = this.round2(Number(amount || 0));

    const { data: existing, error: findErr } = await this.supabase
      .from('transactions')
      .select('id')
      .eq('category', 'CASHBOX')
      .eq('payment_method', 'cash')
      .eq('movement_date', movementDate)
      .eq('source_type', sourceType)
      .maybeSingle();

    if (findErr) {
      console.error('Error buscando transacción existente:', findErr);
      this.showNotification('Error consultando transacción de caja.', 'error');
      return;
    }

    const payload: any = {
      created_at: new Date().toISOString(),
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
        console.error('Error actualizando arqueo de caja:', updErr);
        this.showNotification('Error guardando arqueo.', 'error');
        return;
      }
    } else {
      const { error: insErr } = await this.supabase
        .from('transactions')
        .insert([payload]);

      if (insErr) {
        console.error('Error insertando arqueo de caja:', insErr);
        this.showNotification('Error guardando arqueo.', 'error');
        return;
      }
    }

    this.showNotification('Arqueo guardado correctamente.', 'success');
  }

  // ===== 5) FILTROS / TOTALES =====

  applyCashFilters(): void {
    this.filteredMovements = this.cashMovements.filter((m) => {
      const movementDate = m.date;

      const okStart = this.startDate ? movementDate >= this.startDate : true;
      const okEnd = this.endDate ? movementDate <= this.endDate : true;

      const okType =
        this.movementTypeFilter === 'ALL'
          ? true
          : m.direction === this.movementTypeFilter;

      return okStart && okEnd && okType;
    });

    this.currentPage = 1;
    this.sumTotals();
    this.updatePaginatedBanking();
  }

  private sumTotals(): void {
    const list = this.filteredMovements;

    // Totales del rango filtrado
    this.totalCashIn = this.round2(
      list
        .filter((m) => m.direction === 'IN')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.totalCashOut = this.round2(
      list
        .filter((m) => m.direction === 'OUT')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.cashBalance = this.round2(this.totalCashIn - this.totalCashOut);
    this.theoreticalCash = this.round2(Number(this.openingCash || 0) + this.cashBalance);

    // Totales reales del día seleccionado, independientes de los filtros
    this.calculateDailyCashboxTotals();
  }

  private calculateDailyCashboxTotals(): void {
    const dayList = this.cashMovements.filter(
      (m) => m.date === this.movementDate
    );

    this.dayTotalCashIn = this.round2(
      dayList
        .filter((m) => m.direction === 'IN')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.dayTotalCashOut = this.round2(
      dayList
        .filter((m) => m.direction === 'OUT')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.dayCashBalance = this.round2(this.dayTotalCashIn - this.dayTotalCashOut);

    this.closingTheoreticalCash = this.round2(
      Number(this.openingCash || 0) + this.dayCashBalance
    );

    this.openingDifference = this.openingCountSaved
      ? this.round2(Number(this.openingCountedCash || 0) - Number(this.openingCash || 0))
      : 0;

    this.closingDifference = this.closingCountSaved
      ? this.round2(Number(this.closingCountedCash || 0) - this.closingTheoreticalCash)
      : 0;

    // Compatibilidad con campos antiguos
    this.countedCash = this.closingCountedCash;
    this.cashDifference = this.closingDifference;

    this.calculateCheckpointTotals();
  }

  private calculateCheckpointTotals(): void {
    this.checkpointInAfter = 0;
    this.checkpointOutAfter = 0;
    this.checkpointNetAfter = 0;
    this.checkpointProjectedCash = 0;
    this.checkpointVsClosingDifference = 0;

    if (!this.checkpointCountSaved || !this.checkpointCreatedAt) {
      return;
    }

    const checkpointTime = this.timeMs(this.checkpointCreatedAt);

    const afterCheckpoint = this.cashMovements.filter((m) => {
      return (
        m.date === this.movementDate &&
        this.timeMs(m.occurred_at) > checkpointTime
      );
    });

    this.checkpointInAfter = this.round2(
      afterCheckpoint
        .filter((m) => m.direction === 'IN')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.checkpointOutAfter = this.round2(
      afterCheckpoint
        .filter((m) => m.direction === 'OUT')
        .reduce((s, m) => s + (Number(m.amount) || 0), 0)
    );

    this.checkpointNetAfter = this.round2(
      this.checkpointInAfter - this.checkpointOutAfter
    );

    this.checkpointProjectedCash = this.round2(
      Number(this.checkpointCountedCash || 0) + this.checkpointNetAfter
    );

    this.checkpointVsClosingDifference = this.closingCountSaved
      ? this.round2(Number(this.closingCountedCash || 0) - this.checkpointProjectedCash)
      : 0;
  }

  async onMovementDateChange(): Promise<void> {
    this.startDate = this.movementDate;
    this.endDate = this.movementDate;

    await this.loadAutomaticOpeningCashFromHistory(this.movementDate);
    await this.loadCashboxCountsForDate(this.movementDate);
    this.applyCashFilters();
  }

  clearFilters(): void {
    this.startDate = this.movementDate;
    this.endDate = this.movementDate;
    this.movementTypeFilter = 'ALL';
    this.applyCashFilters();
  }

  // ===== 6) PAGINACIÓN =====

  updatePaginatedBanking(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredMovements.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedBanking = this.filteredMovements.slice(startIndex, endIndex);
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }
}
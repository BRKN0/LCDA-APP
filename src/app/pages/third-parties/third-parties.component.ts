import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import * as XLSX from 'xlsx';

type PaymentMethod =
  | 'cash'
  | 'nequi'
  | 'bancolombia'
  | 'davivienda'
  | 'transfer';

type LoanStatus =
  | 'PENDING'
  | 'PARTIAL'
  | 'PAID';

interface LoanPayment {
  id: string;
  loan_id: string;
  payment_at: string;
  amount: number;
  payment_method: PaymentMethod;
  created_at?: string;
}

interface Loan {
  id: string;
  code?: number;

  loan_at: string;
  amount: number;
  disbursement_method: PaymentMethod;

  borrower_name: string;
  status: LoanStatus;

  description?: string | null;

  created_at?: string;
  updated_at?: string;

  loan_payments?: LoanPayment[];
}

@Component({
  selector: 'app-third-parties',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './third-parties.component.html',
  styleUrl: './third-parties.component.scss',
})
export class ThirdPartiesComponent implements OnInit {
  loading = false;
  isSaving = false;

  loans: Loan[] = [];
  filteredLoans: Loan[] = [];
  paginatedLoans: Loan[] = [];

  selectedLoanDetails: Loan | null = null;
  selectedLoanForPayment: Loan | null = null;
  selectedPayment: LoanPayment | null = null;

  loanForm!: FormGroup;
  paymentForm!: FormGroup;

  showLoanModal = false;
  showDetailsModal = false;
  showPaymentModal = false;
  showEditPaymentModal = false;

  isEditingLoan = false;

  searchQuery = '';
  filterStatus: LoanStatus | '' = '';
  startDate = '';
  endDate = '';
  paymentStartDate = '';
  paymentEndDate = '';
  filterPaymentMethod: PaymentMethod | '' = ''
  filterDisbursementMethod: PaymentMethod | '' = '';

  //filter for borrower name search
  borrowerFilterSearch = '';
  selectedBorrowerFilter = '';
  borrowerFilterSuggestions: string[] = [];
  showBorrowerFilterSuggestions = false;
  borrowerFormSuggestions: string[] = [];
  showBorrowerFormSuggestions = false;

  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 10;

  totalLoaned = 0;
  totalRecovered = 0;
  totalPending = 0;
  activeLoans = 0;

  paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'EFECTIVO' },
    { value: 'nequi', label: 'NEQUI' },
    { value: 'bancolombia', label: 'BANCOLOMBIA' },
    { value: 'davivienda', label: 'DAVIVIENDA' },
    { value: 'transfer', label: 'TRANSFERENCIA' },
  ];

  statusOptions: { value: LoanStatus; label: string }[] = [
    { value: 'PENDING', label: 'PENDIENTE' },
    { value: 'PARTIAL', label: 'PARCIAL' },
    { value: 'PAID', label: 'PAGADO' },
  ];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initLoanForm();
    this.initPaymentForm();
    this.getLoans();
  }

  // =========================
  // FORMULARIOS
  // =========================

  initLoanForm(loan?: Loan): void {
    this.loanForm = this.fb.group({
      id: [loan?.id ?? null],

      loan_at: [
        loan?.loan_at
          ? this.fromDbTimestampToInput(loan.loan_at)
          : this.getLocalDateInputValue(),
        Validators.required,
      ],

      amount: [
        loan?.amount ?? 0,
        [Validators.required, Validators.min(1)],
      ],

      disbursement_method: [
        loan?.disbursement_method ?? 'cash',
        Validators.required,
      ],

      borrower_name: [
        loan?.borrower_name ?? '',
        Validators.required,
      ],

      description: [
        loan?.description ?? '',
      ],
    });
  }

  initPaymentForm(payment?: LoanPayment): void {
    this.paymentForm = this.fb.group({
      id: [payment?.id ?? null],

      payment_at: [
        payment?.payment_at
          ? this.fromDbTimestampToInput(payment.payment_at)
          : this.getLocalDateInputValue(),
        Validators.required,
      ],

      amount: [
        payment?.amount ?? 0,
        [Validators.required, Validators.min(1)],
      ],

      payment_method: [
        payment?.payment_method ?? 'cash',
        Validators.required,
      ],
    });
  }

  // =========================
  // FECHAS LOCALES
  // =========================

  private getLocalDateInputValue(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    return `${year}-${month}-${day}`;
  }

  private toDbTimestampFromDateOnly(
    dateValue: string,
    existingTimestamp?: string | null
  ): string {
    const [year, month, day] = dateValue.split('-').map(Number);

    const baseTime = existingTimestamp
      ? new Date(existingTimestamp)
      : new Date();

    const localDate = new Date(
      year,
      month - 1,
      day,
      baseTime.getHours(),
      baseTime.getMinutes(),
      baseTime.getSeconds(),
      baseTime.getMilliseconds()
    );

    return localDate.toISOString();
  }

  private fromDbTimestampToInput(value?: string | null): string {
    if (!value) return this.getLocalDateInputValue();
    return this.getLocalDateInputValue(new Date(value));
  }

  private getLocalStartOfDay(dateValue: string): Date {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private getLocalEndOfDay(dateValue: string): Date {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  // =========================
  // CONSULTA PRINCIPAL
  // =========================

  async getLoans(): Promise<void> {
    this.loading = true;

    const { data, error } = await this.supabase
      .from('loans')
      .select('*, loan_payments(*)')
      .order('loan_at', { ascending: false })
      .order('code', { ascending: false });

    this.loading = false;

    if (error) {
      console.error('Error cargando préstamos:', error);
      alert('Error cargando préstamos.');
      return;
    }

    this.loans = (data || []).map((loan: any) => ({
      ...loan,
      amount: Number(loan.amount) || 0,
      borrower_name: loan.borrower_name?.toUpperCase() || '',
      description: loan.description?.toUpperCase() || '',
      loan_payments: (loan.loan_payments || [])
        .map((payment: any) => ({
          ...payment,
          amount: Number(payment.amount) || 0,
        }))
        .sort((a: LoanPayment, b: LoanPayment) => {
          return new Date(b.payment_at).getTime() - new Date(a.payment_at).getTime();
        }),
    }));

    await this.syncAllLoanStatusesLocally();

    this.applyFilters();
  }

  // =========================
  // CREAR / EDITAR PRÉSTAMO
  // =========================

  addLoan(): void {
    this.isEditingLoan = false;
    this.initLoanForm();
    this.showLoanModal = true;
    this.borrowerFormSuggestions = [];
    this.showBorrowerFormSuggestions = false;
  }

  editLoan(loan: Loan): void {
    this.isEditingLoan = true;
    this.initLoanForm(loan);
    this.showLoanModal = true;
    this.borrowerFormSuggestions = [];
    this.showBorrowerFormSuggestions = false;
  }

  async saveLoan(): Promise<void> {
    if (this.isSaving) return;

    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      alert('Complete los campos obligatorios.');
      return;
    }

    this.isSaving = true;

    try {
      const formValue = this.loanForm.value;

      const payload: any = {
        loan_at: this.toDbTimestampFromDateOnly(
          formValue.loan_at,
          formValue.id
            ? this.loans.find(l => l.id === formValue.id)?.loan_at
            : null
        ),
        amount: Number(formValue.amount),
        disbursement_method: formValue.disbursement_method,
        borrower_name: String(formValue.borrower_name).trim().toUpperCase(),
        description: formValue.description
          ? String(formValue.description).trim().toUpperCase()
          : null,
        updated_at: new Date().toISOString(),
      };

      if (!payload.borrower_name) {
        alert('Debe ingresar la persona que recibió el dinero.');
        return;
      }

      if (!payload.amount || payload.amount <= 0) {
        alert('El valor prestado debe ser mayor a cero.');
        return;
      }

      if (this.isEditingLoan && formValue.id) {
        const currentLoan = this.loans.find(l => l.id === formValue.id);

        if (currentLoan) {
          const totalRecovered = this.getTotalRecovered(currentLoan);

          if (payload.amount < totalRecovered) {
            alert(
              `No puede colocar un valor prestado menor a lo ya devuelto. Ya se han recuperado $${this.formatCurrency(totalRecovered)}.`
            );
            return;
          }
        }

        const { error } = await this.supabase
          .from('loans')
          .update(payload)
          .eq('id', formValue.id);

        if (error) throw error;

        await this.refreshLoanStatus(formValue.id);
      } else {
        payload.status = 'PENDING';
        payload.created_at = new Date().toISOString();

        const { error } = await this.supabase
          .from('loans')
          .insert([payload]);

        if (error) throw error;
      }

      this.closeLoanModal();
      await this.getLoans();

      alert(this.isEditingLoan ? 'Préstamo actualizado.' : 'Préstamo registrado.');
    } catch (error: any) {
      console.error('Error guardando préstamo:', error);
      alert('Error guardando préstamo: ' + error.message);
    } finally {
      this.isSaving = false;
    }
  }

  async deleteLoan(loan: Loan): Promise<void> {
    const confirmed = confirm(
      `¿Eliminar el préstamo de ${loan.borrower_name} por $${this.formatCurrency(loan.amount)}?`
    );

    if (!confirmed) return;

    const { error } = await this.supabase
      .from('loans')
      .delete()
      .eq('id', loan.id);

    if (error) {
      console.error('Error eliminando préstamo:', error);
      alert('Error eliminando préstamo.');
      return;
    }

    await this.getLoans();
    alert('Préstamo eliminado.');
  }

  closeLoanModal(): void {
    this.showLoanModal = false;
    this.isEditingLoan = false;
    this.initLoanForm();
  }

  onBorrowerFormInput(): void {
    const control = this.loanForm.get('borrower_name');
    if (!control) return;

    const rawValue = String(control.value || '').toUpperCase();

    control.setValue(rawValue, { emitEvent: false });

    const search = this.normalizeText(rawValue);

    if (!search) {
      this.borrowerFormSuggestions = this.getUniqueBorrowerNames();
      this.showBorrowerFormSuggestions = true;
      return;
    }

    this.borrowerFormSuggestions = this.getUniqueBorrowerNames()
      .filter(name => this.normalizeText(name).includes(search))
      .slice(0, 20);

    this.showBorrowerFormSuggestions = true;
  }

  selectBorrowerForForm(name: string): void {
    this.loanForm.patchValue({
      borrower_name: name,
    });

    this.borrowerFormSuggestions = [];
    this.showBorrowerFormSuggestions = false;
  }

  hideBorrowerFormSuggestions(): void {
    setTimeout(() => {
      this.showBorrowerFormSuggestions = false;
    }, 150);
  }

  // =========================
  // DETALLES
  // =========================

  viewLoanDetails(loan: Loan): void {
    this.selectedLoanDetails = loan;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.selectedLoanDetails = null;
    this.showDetailsModal = false;
  }

  // =========================
  // DEVOLUCIONES
  // =========================

  openPaymentModal(loan: Loan): void {

    const pending = this.getPendingBalance(loan);

    if (pending <= 0) {
      alert('Este préstamo ya está completamente pagado.');
      return;
    }

    this.selectedLoanForPayment = loan;
    this.initPaymentForm();
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.selectedLoanForPayment = null;
    this.showPaymentModal = false;
    this.initPaymentForm();
  }

  async addPayment(): Promise<void> {
    if (!this.selectedLoanForPayment) {
      alert('No hay préstamo seleccionado.');
      return;
    }

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      alert('Complete los campos obligatorios de la devolución.');
      return;
    }

    const loan = this.selectedLoanForPayment;
    const formValue = this.paymentForm.value;

    const amount = Number(formValue.amount);
    const pending = this.getPendingBalance(loan);

    if (amount <= 0) {
      alert('La devolución debe ser mayor a cero.');
      return;
    }

    if (amount > pending) {
      alert(
        `La devolución no puede superar el saldo pendiente de $${this.formatCurrency(pending)}.`
      );
      return;
    }

    const payload = {
      loan_id: loan.id,
      payment_at: this.toDbTimestampFromDateOnly(formValue.payment_at),
      amount,
      payment_method: formValue.payment_method,
      created_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('loan_payments')
      .insert([payload]);

    if (error) {
      console.error('Error registrando devolución:', error);
      alert('Error registrando devolución.');
      return;
    }

    await this.refreshLoanStatus(loan.id);
    this.closePaymentModal();
    await this.getLoans();
  }

  openEditPaymentModal(payment: LoanPayment): void {
    this.selectedPayment = payment;
    this.initPaymentForm(payment);
    this.showEditPaymentModal = true;
  }

  closeEditPaymentModal(): void {
    this.selectedPayment = null;
    this.showEditPaymentModal = false;
    this.initPaymentForm();
  }

  async updatePayment(): Promise<void> {
    if (!this.selectedPayment) {
      alert('No hay devolución seleccionada.');
      return;
    }

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      alert('Complete los campos obligatorios.');
      return;
    }

    const formValue = this.paymentForm.value;
    const amount = Number(formValue.amount);

    if (amount <= 0) {
      alert('La devolución debe ser mayor a cero.');
      return;
    }

    const loan = this.loans.find(l =>
      l.loan_payments?.some(p => p.id === this.selectedPayment?.id)
    );

    if (!loan) {
      alert('No se encontró el préstamo relacionado.');
      return;
    }

    const recoveredWithoutCurrent = this.getTotalRecovered(loan) - Number(this.selectedPayment.amount || 0);
    const maxAllowed = Number(loan.amount) - recoveredWithoutCurrent;

    if (amount > maxAllowed) {
      alert(
        `La devolución no puede superar el saldo permitido de $${this.formatCurrency(maxAllowed)}.`
      );
      return;
    }

    const payload = {
      payment_at: this.toDbTimestampFromDateOnly(
        formValue.payment_at,
        this.selectedPayment.payment_at
      ),
      amount,
      payment_method: formValue.payment_method,
    };

    const { error } = await this.supabase
      .from('loan_payments')
      .update(payload)
      .eq('id', this.selectedPayment.id);

    if (error) {
      console.error('Error actualizando devolución:', error);
      alert('Error actualizando devolución.');
      return;
    }

    await this.refreshLoanStatus(loan.id);
    this.closeEditPaymentModal();
    await this.getLoans();

    alert('Devolución actualizada.');
  }

  async deletePayment(payment: LoanPayment): Promise<void> {
    const confirmed = confirm(
      `¿Eliminar esta devolución por $${this.formatCurrency(payment.amount)}?`
    );

    if (!confirmed) return;

    const loanId = payment.loan_id;

    const { error } = await this.supabase
      .from('loan_payments')
      .delete()
      .eq('id', payment.id);

    if (error) {
      console.error('Error eliminando devolución:', error);
      alert('Error eliminando devolución.');
      return;
    }

    await this.refreshLoanStatus(loanId);
    await this.getLoans();

    alert('Devolución eliminada.');
  }

  // =========================
  // ESTADOS Y CÁLCULOS
  // =========================

  getTotalRecovered(loan: Loan): number {
    return (loan.loan_payments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }

  getPendingBalance(loan: Loan): number {
    const amount = Number(loan.amount) || 0;
    const recovered = this.getTotalRecovered(loan);

    return Math.max(amount - recovered, 0);
  }

  getCalculatedStatus(loan: Loan): LoanStatus {

    const amount = Number(loan.amount) || 0;
    const recovered = this.getTotalRecovered(loan);

    if (recovered >= amount) return 'PAID';
    if (recovered > 0) return 'PARTIAL';

    return 'PENDING';
  }

  async refreshLoanStatus(loanId: string): Promise<void> {
    const { data: loanData, error: loanError } = await this.supabase
      .from('loans')
      .select('id, amount, status')
      .eq('id', loanId)
      .single();

    if (loanError || !loanData) {
      console.error('Error consultando préstamo para actualizar estado:', loanError);
      return;
    }

    const { data: paymentsData, error: paymentsError } = await this.supabase
      .from('loan_payments')
      .select('amount')
      .eq('loan_id', loanId);

    if (paymentsError) {
      console.error('Error consultando devoluciones:', paymentsError);
      return;
    }

    const total = Number(loanData.amount) || 0;
    const recovered = (paymentsData || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    let newStatus: LoanStatus = 'PENDING';

    if (recovered >= total) {
      newStatus = 'PAID';
    } else if (recovered > 0) {
      newStatus = 'PARTIAL';
    }

    const { error: updateError } = await this.supabase
      .from('loans')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId);

    if (updateError) {
      console.error('Error actualizando estado del préstamo:', updateError);
    }
  }

  private async syncAllLoanStatusesLocally(): Promise<void> {
    for (const loan of this.loans) {
      const calculatedStatus = this.getCalculatedStatus(loan);

      if (loan.status !== calculatedStatus) {
        loan.status = calculatedStatus;

        await this.supabase
          .from('loans')
          .update({
            status: calculatedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loan.id);
      }
    }
  }

  calculateTotals(): void {
    let totalLoaned = 0;
    let totalRecovered = 0;
    let totalPending = 0;
    let activeLoans = 0;

    this.filteredLoans.forEach((loan) => {

      const amount = Number(loan.amount) || 0;
      const recovered = this.getRecoveredForView(loan);
      const pending = this.getPendingBalance(loan);

      totalLoaned += amount;
      totalRecovered += recovered;
      totalPending += pending;

      if (pending > 0) {
        activeLoans++;
      }
    });

    this.totalLoaned = totalLoaned;
    this.totalRecovered = totalRecovered;
    this.totalPending = totalPending;
    this.activeLoans = activeLoans;
  }

  // =========================
  // FILTROS Y PAGINACIÓN
  // =========================

  hasPaymentFilters(): boolean {
    return !!this.paymentStartDate || !!this.paymentEndDate || !!this.filterPaymentMethod;
  }

  getPaymentsMatchingActiveFilters(loan: Loan): LoanPayment[] {
    let payments = loan.loan_payments || [];

    if (this.paymentStartDate) {
      const start = this.getLocalStartOfDay(this.paymentStartDate);
      payments = payments.filter(payment => new Date(payment.payment_at) >= start);
    }

    if (this.paymentEndDate) {
      const end = this.getLocalEndOfDay(this.paymentEndDate);
      payments = payments.filter(payment => new Date(payment.payment_at) <= end);
    }

    if (this.filterPaymentMethod) {
      payments = payments.filter(payment => payment.payment_method === this.filterPaymentMethod);
    }

    return payments;
  }

  getRecoveredForView(loan: Loan): number {
    if (!this.hasPaymentFilters()) {
      return this.getTotalRecovered(loan);
    }

    return this.getPaymentsMatchingActiveFilters(loan).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }

  //filter by borrower name
  getUniqueBorrowerNames(): string[] {
    return Array.from(
      new Set(
        this.loans
          .map(loan => loan.borrower_name)
          .filter((name): name is string => !!name && name.trim() !== '')
      )
    ).sort();
  }

  onBorrowerFilterInput(): void {
    const search = this.normalizeText(this.borrowerFilterSearch);

    this.selectedBorrowerFilter = '';

    if (!search) {
      this.borrowerFilterSuggestions = this.getUniqueBorrowerNames();
      this.showBorrowerFilterSuggestions = true;
      return;
    }

    this.borrowerFilterSuggestions = this.getUniqueBorrowerNames()
      .filter(name => this.normalizeText(name).includes(search))
      .slice(0, 20);

    this.showBorrowerFilterSuggestions = true;
  }

  selectBorrowerFilter(name: string): void {
    this.selectedBorrowerFilter = name;
    this.borrowerFilterSearch = name;
    this.borrowerFilterSuggestions = [];
    this.showBorrowerFilterSuggestions = false;

    this.applyFilters();
  }

  clearBorrowerFilter(): void {
    this.borrowerFilterSearch = '';
    this.selectedBorrowerFilter = '';
    this.borrowerFilterSuggestions = [];
    this.showBorrowerFilterSuggestions = false;

    this.applyFilters();
  }

  hideBorrowerFilterSuggestions(): void {
    setTimeout(() => {
      this.showBorrowerFilterSuggestions = false;
    }, 150);
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchQuery);

    this.filteredLoans = this.loans.filter((loan) => {
      if (this.selectedBorrowerFilter) {
        if (loan.borrower_name !== this.selectedBorrowerFilter) {
          return false;
        }
      }

      if (search) {
        const description = this.normalizeText(loan.description || '');
        const code = String(loan.code || '');

        const matchesSearch =
          description.includes(search) ||
          code.includes(search);

        if (!matchesSearch) return false;
      }

      if (this.filterStatus && loan.status !== this.filterStatus) {
        return false;
      }

      if (
        this.filterDisbursementMethod &&
        loan.disbursement_method !== this.filterDisbursementMethod
      ) {
        return false;
      }

      if (this.startDate || this.endDate) {
        const loanDate = new Date(loan.loan_at);

        if (this.startDate) {
          const start = this.getLocalStartOfDay(this.startDate);
          if (loanDate < start) return false;
        }

        if (this.endDate) {
          const end = this.getLocalEndOfDay(this.endDate);
          if (loanDate > end) return false;
        }
      }

      if (this.hasPaymentFilters()) {
        const matchingPayments = this.getPaymentsMatchingActiveFilters(loan);

        if (matchingPayments.length === 0) {
          return false;
        }
      }

      return true;
    });

    this.calculateTotals();
    this.updatePaginatedLoans();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';

    this.borrowerFilterSearch = '';
    this.selectedBorrowerFilter = '';
    this.borrowerFilterSuggestions = [];
    this.showBorrowerFilterSuggestions = false;

    this.startDate = '';
    this.endDate = '';

    this.paymentStartDate = '';
    this.paymentEndDate = '';
    this.filterPaymentMethod = '';
    this.filterDisbursementMethod = '';

    this.applyFilters();
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return items.slice(startIndex, endIndex);
  }

  updatePaginatedLoans(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredLoans.length / this.itemsPerPage)
    );

    this.currentPage = Math.min(
      Math.max(this.currentPage, 1),
      this.totalPages
    );

    this.paginatedLoans = this.paginateItems(
      this.filteredLoans,
      this.currentPage,
      Number(this.itemsPerPage)
    );
  }

  // =========================
  // EXCEL
  // =========================

  exportToExcel(): void {
    const exportData = this.filteredLoans.map((loan) => ({
      Codigo: loan.code || '',
      Persona: loan.borrower_name,
      FechaPrestamo: this.formatDateTime(loan.loan_at),
      ValorPrestado: loan.amount,
      MetodoSalida: this.getReadablePaymentMethod(loan.disbursement_method),
      Recuperado: this.getTotalRecovered(loan),
      SaldoPendiente: this.getPendingBalance(loan),
      Estado: this.getReadableStatus(loan.status),
      Descripcion: loan.description || '',
      FechaCreacion: loan.created_at
        ? this.formatDateTime(loan.created_at)
        : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prestamos');
    XLSX.writeFile(workbook, 'prestamos.xlsx');
  }

  // =========================
  // UTILIDADES
  // =========================

  getReadablePaymentMethod(method?: string | null): string {
    if (!method) return 'NO DEFINIDO';

    switch (method.toLowerCase()) {
      case 'cash':
        return 'EFECTIVO';
      case 'nequi':
        return 'NEQUI';
      case 'bancolombia':
        return 'BANCOLOMBIA';
      case 'davivienda':
        return 'DAVIVIENDA';
      case 'transfer':
        return 'TRANSFERENCIA';
      default:
        return method.toUpperCase();
    }
  }

  getReadableStatus(status?: string | null): string {
    switch (status) {
      case 'PENDING':
        return 'PENDIENTE';
      case 'PARTIAL':
        return 'PARCIAL';
      case 'PAID':
        return 'PAGADO';
      default:
        return 'NO DEFINIDO';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '';

    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  }

  private normalizeText(value?: string | null): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
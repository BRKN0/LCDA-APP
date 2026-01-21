import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

interface ExpensesItem {
  id_expenses: string;
  created_at: Date;
  payment_date: string;
  category: string;
  type: string;
  description: string;
  cost: number;
  code: number;
  service_type?: string | null;
  id_provider?: string;
  provider_name?: string | null;
  payment_due_date?: string | null;
  payment_status: 'PAID' | 'PENDING' | 'PARTIAL';
  invoice_file_path?: string | null;
  proof_of_payment_path?: string | null;
  payments?: ExpensePayment[];
}

interface ExpensePayment {
  id_expense_payment?: number;
  id_expenses: string;
  amount: number;
  payment_date?: string;
  payment_method?: string;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
})
export class ExpensesComponent implements OnInit {
  // Expenses data
  expenses: ExpensesItem[] = [];
  filteredExpenses: ExpensesItem[] = [];
  selectedExpense: ExpensesItem = {
    id_expenses: '',
    payment_date: '',
    category: '',
    service_type: '',
    type: '',
    description: '',
    cost: 0,
    code: 0,
    created_at: new Date(),
    id_provider: '',
    provider_name: '',
    payment_due_date: null,
    payment_status: 'PAID',
    invoice_file_path: null,
    proof_of_payment_path: null,
  };
  // helpers for modal
  loading: boolean = false;
  showModal: boolean = false;
  isEditing: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isSaving: boolean = false;
  showDetailsModal: boolean = false;

  // File Paths
  invoice_file_path?: string | null;
  proof_of_payment_path?: string | null;

  // File Upload State
  selectedInvoiceFile: File | null = null;
  selectedProofFile: File | null = null;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedExpenses: ExpensesItem[] = []; // Lista paginada

  // Filters
  filterCategory: string | null = null;
  filterServiceType: string | null = null;
  onlyPending: boolean = false;
  filterProviderName: string | null = null;

  // Categories
  categoryCheckboxes: { [key: string]: boolean } = {};
  showOtherCategoryInput: boolean = false;
  otherCategory: string = '';
  uniqueCategories: string[] = [];
  selectedCategory: string = '';
  isNewCategoryMode: boolean = false;
  newCategory: string = '';
  categoryJustAdded: boolean = false;
  standardCategories = [
    { value: 'SUPPLIES', label: 'Compra de Insumos / Proveedores' },
    { value: 'RENT', label: 'Arriendo' },
    { value: 'UTILITIES', label: 'Servicios Públicos' },
    { value: 'PAYROLL', label: 'Nómina' },
    { value: 'MAINTENANCE', label: 'Mantenimiento' },
    { value: 'TAXES', label: 'Impuestos' },
    { value: 'MARKETING', label: 'Publicidad' },
  ];
  baseCategories = [
    'SUPPLIES',
    'RENT',
    'UTILITIES',
    'PAYROLL',
    'MAINTENANCE',
    'TAXES',
    'MARKETING',
  ];

  // Service categories
  isServiceCategory: boolean = false;
  availableServiceTypes: string[] = [];
  newServiceType: string = '';

  // Providers
  providersList: any[] = [];
  isNewProviderMode: boolean = false;
  newProviderData = {
    company_name: '',
    name: '',
    document_number: '',
    phone_number: '',
  };

  thirdPartySuggestions: string[] = [];
  isSupplierCategory: boolean = false;
  payeeSearch: string = '';
  payeeSearchResults: string[] = [];
  payeeTypedButNotSelected: boolean = false;
  payeeJustSelected: boolean = false;

  //
  totalPaid: number = 0;
  totalPending: number = 0;
  totalExpenses: number = 0;

  // Propiedades para la gestión de abonos
  selectedExpenseForPayment: ExpensesItem | null = null;
  showPaymentModal: boolean = false;
  newPaymentAmount: number = 0;
  newPaymentMethod: string = '';
  showEditPaymentModal: boolean = false;
  selectedPayment: ExpensePayment | null = null;
  notificationMessage: string | null = null;


  constructor(private readonly supabase: SupabaseService) { }

  ngOnInit(): void {
    this.getExpenses();
    this.getProviders();
    this.initializeCategoryCheckboxes();
  }

  async getProviders() {
    const { data, error } = await this.supabase
      .from('providers')
      .select('id_provider, company_name, name, document_number');

    if (!error && data) {
      this.providersList = data;
    }
  }
  resetExpense(): ExpensesItem {
    return {
      id_expenses: '',
      payment_date: new Date().toISOString().split('T')[0],
      category: '',
      service_type: null,
      type: '',
      description: '',
      cost: 0,
      code: 0,
      created_at: new Date(),
      id_provider: '',
      provider_name: '',
      payment_due_date: null,
      payment_status: 'PAID',
      invoice_file_path: null,
      proof_of_payment_path: null,
    };
  }
  getCategoryLabel(value: string): string {
    const found = this.standardCategories.find((c) => c.value === value);
    return found ? found.label : value;
  }
  getAllCategories(): string[] {
    return Array.from(
      new Set([
        ...this.baseCategories,
        ...this.expenses.map((e) => e.category).filter(Boolean),
      ])
    ).sort();
  }
  getServiceTypes(): string[] {
    return Array.from(
      new Set(
        this.expenses
          .filter((e) => e.category === 'UTILITIES' && e.service_type)
          .map((e) => e.service_type!)
      )
    ).sort();
  }
  getFilterCategories(): string[] {
    return Array.from(
      new Set(this.expenses.map((e) => e.category).filter(Boolean))
    ).sort();
  }
  confirmNewCategory(): void {
    if (!this.newCategory) return;

    const normalized = this.newCategory.trim().toUpperCase();

    this.selectedExpense.category = normalized;
    this.newCategory = '';
    this.isNewCategoryMode = false;
    this.categoryJustAdded = true;
  }
  confirmNewServiceType(): void {
    if (!this.newServiceType) return;

    const normalized = this.newServiceType.trim().toUpperCase();

    this.selectedExpense.service_type = normalized;
    this.newServiceType = '';
  }
  getFilterServiceTypes(): string[] {
    return Array.from(
      new Set(
        this.expenses
          .filter((e) => e.category === 'UTILITIES' && e.service_type)
          .map((e) => e.service_type!)
      )
    ).sort();
  }
  onFilterCategoryChange(): void {
    if (this.filterCategory !== 'UTILITIES') {
      this.filterServiceType = null;
    }
    this.applyFilters();
  }
  initializeCategoryCheckboxes(): void {
    this.uniqueCategories.forEach((category) => {
      this.categoryCheckboxes[category] = true;
    });
  }

  // Handle dropdown changes
  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value === 'NEW_CATEGORY_OPTION') {
      this.isNewCategoryMode = true;
      this.selectedExpense.category = '';
      return;
    }

    this.isNewCategoryMode = false;
    this.selectedExpense.category = value;

    this.isServiceCategory = value === 'UTILITIES';
    if (!this.isServiceCategory) {
      this.selectedExpense.service_type = null;
      this.newServiceType = '';
    }

    this.isSupplierCategory = value === 'SUPPLIES';

    if (this.isSupplierCategory) {
      // estamos en compras → NO texto libre
      this.selectedExpense.provider_name = null;
    } else {
      // NO es proveedor → NO id_provider
      this.selectedExpense.id_provider = undefined;
      this.isNewProviderMode = false;
    }
  }
  // Handle Status Change
  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as
      | 'PAID'
      | 'PENDING';
    this.selectedExpense.payment_status = value;
  }
  onProviderChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'NEW_PROVIDER_OPTION') {
      this.isNewProviderMode = true;
      this.selectedExpense.id_provider = '';
    } else {
      this.isNewProviderMode = false;
      this.selectedExpense.id_provider = value;
    }
  }

  private normalizeProviderName(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  getUniqueProviderNames(): string[] {
    return Array.from(
      new Set(
        this.expenses
          .map(e => e.provider_name)
          .filter((name): name is string => !!name)
      )
    ).sort();
  }

  onProviderInput(value: string): void {
    this.payeeSearch = value;
    this.payeeJustSelected = false;

    const normalized = this.normalizeProviderName(value);

    if (!normalized) {
      this.payeeSearchResults = [];
      return;
    }

    this.payeeSearchResults = this.getUniqueProviderNames().filter(name =>
      name.includes(normalized)
    );

    this.payeeTypedButNotSelected =
      this.payeeSearchResults.length > 0 &&
      !this.payeeSearchResults.includes(normalized);
  }

  selectProviderName(name: string): void {
    this.payeeSearch = name;
    this.selectedExpense.provider_name = name;
    this.payeeSearchResults = [];
    this.payeeTypedButNotSelected = false;
    this.payeeJustSelected = true;
  }

  onProviderBlur(): void {
    if (this.payeeJustSelected) return;

    if (this.payeeSearch) {
      this.selectedExpense.provider_name =
        this.normalizeProviderName(this.payeeSearch);
    }

    this.payeeSearchResults = [];
    this.payeeTypedButNotSelected = false;
  }

  // Save expenses and update checkboxes
  async saveExpense() {
    if (this.isSaving) return;
    this.isSaving = true;

    let rollbackProviderId: string | null = null;

    try {
      // Validations
      if (!this.selectedExpense.payment_date) {
        alert('Por favor, seleccione una fecha.');
        return;
      }

      if (!this.selectedExpense.category) {
        alert('Por favor, seleccione una categoría.');
        return;
      }

      if (
        this.selectedExpense.payment_status === 'PENDING' &&
        !this.selectedExpense.payment_due_date
      ) {
        alert(
          'Si el estado es "Pendiente", debe seleccionar una Fecha Límite de Pago.'
        );
        return;
      }

      let finalProviderId = this.selectedExpense.id_provider;
      let finalProviderName =
        this.selectedExpense.provider_name
          ? this.normalizeProviderName(this.selectedExpense.provider_name)
          : null;

      // Create New Provider
      if (this.isNewProviderMode) {
        if (!this.newProviderData.company_name && !this.newProviderData.name) {
          throw new Error(
            'Debe ingresar Nombre o Empresa para el nuevo proveedor'
          );
        }

        finalProviderName =
          this.newProviderData.company_name || this.newProviderData.name;

        this.normalizeThirdPartyName();

        const { data: provData, error: provError } = await this.supabase
          .from('providers')
          .insert([
            {
              company_name: this.newProviderData.company_name,
              name: this.newProviderData.name,
              document_number: this.newProviderData.document_number,
              phone_number: this.newProviderData.phone_number,
              created_at: new Date(),
            },
          ])
          .select()
          .single();

        if (provError) throw provError;

        finalProviderId = provData.id_provider;
        rollbackProviderId = provData.id_provider;
      } else if (finalProviderId) {
        const selectedProv = this.providersList.find(
          (p) => p.id_provider === finalProviderId
        );
        if (selectedProv) {
          finalProviderName = selectedProv.company_name || selectedProv.name;
        }
      }

      if (
        this.selectedExpense.category === 'UTILITIES' &&
        !this.selectedExpense.service_type
      ) {
        alert('Debe seleccionar el tipo de servicio.');
        return;
      }

      const expenseToSave: any = {
        payment_date: this.selectedExpense.payment_date,
        category: this.selectedExpense.category,
        service_type:
          this.selectedExpense.category === 'UTILITIES'
            ? this.selectedExpense.service_type
            : null,
        type: this.selectedExpense.type,
        description: this.selectedExpense.description,
        cost: this.selectedExpense.cost,
        code: this.selectedExpense.code,
        id_provider: finalProviderId || null,
        provider_name: finalProviderName || null,
        payment_status: this.selectedExpense.payment_status,
        payment_due_date:
          this.selectedExpense.payment_status === 'PENDING'
            ? this.selectedExpense.payment_due_date
            : null,
      };

      let savedExpenseId: string | null = null;

      if (this.isEditing) {
        const { error } = await this.supabase
          .from('expenses')
          .update(expenseToSave)
          .eq('id_expenses', this.selectedExpense.id_expenses)
          .select()
          .single();
        if (error) throw error;
        savedExpenseId = this.selectedExpense.id_expenses;
      } else {
        const { data: newExpense, error } = await this.supabase
          .from('expenses')
          .insert([expenseToSave])
          .select()
          .single();
        if (error) throw error;
        savedExpenseId = newExpense.id_expenses;
      }

      if (!savedExpenseId) {
        throw new Error('No se pudo obtener el ID del registro guardado.');
      }

      const uploadResults = await this.handleFileUploadForExpense(savedExpenseId);

      if (uploadResults.invoicePath || uploadResults.proofPath) {
        const finalUpdate: any = {};
        if (uploadResults.invoicePath)
          finalUpdate.invoice_file_path = uploadResults.invoicePath;
        if (uploadResults.proofPath)
          finalUpdate.proof_of_payment_path = uploadResults.proofPath;

        const { error: finalError } = await this.supabase
          .from('expenses')
          .update(finalUpdate)
          .eq('id_expenses', savedExpenseId);

        if (finalError) throw finalError;
      }

      alert(this.isEditing ? 'Egreso actualizado' : 'Egreso añadido');

      this.selectedInvoiceFile = null;
      this.selectedProofFile = null;

      if (rollbackProviderId) await this.getProviders();

      this.getExpenses();
      this.closeModal();
    } catch (err: any) {
      console.error(err);

      if (rollbackProviderId) {
        await this.supabase
          .from('providers')
          .delete()
          .eq('id_provider', rollbackProviderId);
      }

      alert('Error: ' + err.message);
    } finally {
      this.isSaving = false;
    }
  }

  async getExpenses(): Promise<void> {
    this.loading = true;

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*, expense_payments(*)');

    this.loading = false;

    if (error) {
      console.error('Error al cargar los egresos:', error);
      return;
    }

    this.expenses = (data || []).map((item: any) => ({
      ...item,
      payment_date: item.payment_date
        ? new Date(item.payment_date).toISOString().split('T')[0]
        : '',
      created_at: item.created_at
        ? new Date(item.created_at)
        : new Date(),
      payments: item.expense_payments || [],
    })) as ExpensesItem[];

    // Sorting orders by code
    let n = this.expenses.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.expenses[i].code < this.expenses[i + 1].code) {
          [this.expenses[i], this.expenses[i + 1]] = [
            this.expenses[i + 1],
            this.expenses[i],
          ];
          swapped = true;
        }
      }
      n--;
    } while (swapped);

    this.uniqueCategories = [
      ...new Set(this.expenses.map((e) => e.category || '')),
    ].sort();

    this.initializeCategoryCheckboxes();

    this.filteredExpenses = [...this.expenses];

    this.applyFilters();
  }


  // Genererate Expenses Kardex
  generateExpensesKardex(): void {
    console.log('Botón Generar Kardex clicado');
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      console.log('Fecha actual:', currentDate);

      const csvHeader = [
        'ID Egreso',
        'Código',
        'Fecha de Pago',
        'Categoría',
        'Tipo',
        'Descripción',
        'Costo',
        'Fecha de Creación',
      ];

      console.log('filteredExpenses:', this.filteredExpenses);
      if (!this.filteredExpenses || this.filteredExpenses.length === 0) {
        console.warn('No hay egresos para exportar');
        alert('No hay egresos para generar el kardex');
        return;
      }

      const csvRows = this.filteredExpenses.map((expense) => {
        console.log('Procesando egreso:', expense);
        const costValue =
          typeof expense.cost === 'number'
            ? expense.cost
            : parseFloat(expense.cost || '0');
        const formattedCost = isNaN(costValue) ? '0.00' : costValue.toFixed(2);

        return [
          expense.id_expenses,
          expense.code,
          expense.payment_date || 'Sin Fecha',
          expense.category || 'Sin Categoría',
          expense.type || 'Sin Tipo',
          expense.description || 'Sin Descripción',
          formattedCost,
          expense.created_at.toISOString().split('T')[0] || currentDate,
        ].map((value) => `"${value}"`);
      });

      const csvContent = [csvHeader, ...csvRows]
        .map((row) => row.join(';'))
        .join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${currentDate}.csv`;
      document.body.appendChild(a);
      a.click();
      console.log('Archivo generado y clic simulado');
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error en generateExpensesKardex:', error);
      alert('Ocurrió un error al generar el kardex');
    }
  }

  getThirdParties(): string[] {
    return Array.from(
      new Set(
        this.expenses
          .map(e => e.provider_name)
          .filter((name): name is string => !!name && name.trim() !== '')
      )
    ).sort();
  }

  onThirdPartyInput(): void {
    const value = this.selectedExpense.provider_name?.toLowerCase().trim();

    if (!value || value.length < 2) {
      this.thirdPartySuggestions = [];
      return;
    }

    this.thirdPartySuggestions = this.getThirdParties()
      .filter(name =>
        name.toLowerCase().includes(value)
      )
      .slice(0, 10);
  }

  selectThirdParty(name: string): void {
    this.selectedExpense.provider_name = name;
    this.thirdPartySuggestions = [];
  }

  normalizeThirdPartyName(): void {
    if (!this.selectedExpense.provider_name) return;

    const input = this.selectedExpense.provider_name.trim().toUpperCase();

    const existing = this.getThirdParties().find(
      name => name.toUpperCase() === input
    );

    this.selectedExpense.provider_name = existing ?? input;
  }

  applyFilters(): void {
    this.filteredExpenses = this.expenses.filter((e) => {
      // Date range
      const expenseDate = new Date(e.payment_date);
      if (this.startDate && expenseDate < new Date(this.startDate))
        return false;
      if (this.endDate && expenseDate > new Date(this.endDate))
        return false;

      // Category
      if (this.filterCategory && e.category !== this.filterCategory) {
        return false;
      }

      // Provider filter
      if (this.filterProviderName &&
        !e.provider_name?.toLowerCase().includes(
          this.filterProviderName.toLowerCase()
        )
      ) {
        return false;
      }

      // Service Type (if applicable)
      if (
        this.filterCategory === 'UTILITIES' &&
        this.filterServiceType &&
        e.service_type !== this.filterServiceType
      ) {
        return false;
      }

      // Only Pending
      if (this.onlyPending && e.payment_status === 'PAID') {
        return false;
      }

      return true;
    });

    // Update paginated expenses after filtering
    this.calculateTotals();
    this.updatePaginatedExpenses();
  }


  private calculateTotals(): void {

  let totalPaid = 0;
  let totalPending = 0;

  this.filteredExpenses.forEach((expense, index) => {
    const expenseCost = Number(expense.cost) || 0;
    const paymentsTotal = this.getTotalPayments(expense);

    // CALCULAMOS EL ESTADO DINÁMICAMENTE SEGÚN ABONOS
    if (paymentsTotal >= expenseCost) {
      // Está completamente pagado (con abonos o checkbox)
      totalPaid += expenseCost;
    } else if (paymentsTotal > 0) {
      // Tiene abonos parciales
      totalPaid += paymentsTotal;
      totalPending += (expenseCost - paymentsTotal);
    } else {
      // No tiene abonos, verificar si fue marcado como pagado con checkbox
      if (expense.payment_status === 'PAID') {
        totalPaid += expenseCost;
      } else {
        totalPending += expenseCost;
      }
    }
  });

  this.totalPaid = totalPaid;
  this.totalPending = totalPending;
  this.totalExpenses = totalPaid + totalPending;
}

  // Verify if at least one category checkbox is checked
  isAnyCategoryChecked(): boolean {
    return Object.values(this.categoryCheckboxes).some((checked) => checked);
  }

  onCheckboxChange(category: string): void {
    // Alternate the checkbox state
    this.categoryCheckboxes[category] = !this.categoryCheckboxes[category];

    // Apply filters after checkbox state change
    this.applyFilters();
  }

  addNewExpense(): void {
    this.thirdPartySuggestions = [];
    this.selectedExpense = {
      id_expenses: '',
      payment_date: '',
      category: '',
      service_type: null,
      type: '',
      description: '',
      cost: 0,
      code: 0,
      created_at: new Date(),
      id_provider: '',
      provider_name: '',
      payment_due_date: null,
      payment_status: 'PAID',
      invoice_file_path: null,
      proof_of_payment_path: null,
    };
    this.isServiceCategory = false;
    this.isSupplierCategory = false;
    this.newServiceType = '';
    this.showOtherCategoryInput = false;
    this.otherCategory = '';
    this.isNewCategoryMode = false;
    this.categoryJustAdded = false;
    this.isEditing = false;
    this.showModal = true;
  }

  editExpense(expense: ExpensesItem): void {
    this.selectedExpense = { ...expense }; // copia limpia
    this.isServiceCategory = expense.category === 'UTILITIES';
    this.isNewProviderMode = false;
    this.isEditing = true;
    this.showModal = true;
  }
  viewExpenseDetails(expense: ExpensesItem) {
    this.selectedExpense = { ...expense };
    this.showDetailsModal = true;
  }
  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedExpense = this.resetExpense();
  }
  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.showOtherCategoryInput = false;
    this.otherCategory = '';
    this.isServiceCategory = false;
    this.isSupplierCategory = false;
    this.isNewCategoryMode = false;
    this.categoryJustAdded = false;
    this.newServiceType = '';

    this.selectedExpense = {
      id_expenses: '',
      payment_date: '',
      category: '',
      service_type: null,
      type: '',
      description: '',
      cost: 0,
      code: 0,
      created_at: new Date(),
      id_provider: '',
      provider_name: '',
      payment_due_date: null,
      payment_status: 'PAID',
      invoice_file_path: null,
      proof_of_payment_path: null,
    };
  }
  deletingExpenseId: string | null = null;

  async deleteExpense(expense: ExpensesItem): Promise<void> {

    if (this.deletingExpenseId === expense.id_expenses) return;

    const confirmed = confirm(
      `¿Eliminar el egreso de categoría ${expense.category || 'sin categoría'
      }?`
    );

    if (!confirmed) return;

    this.deletingExpenseId = expense.id_expenses;

    try {
      const { error } = await this.supabase
        .from('expenses')
        .delete()
        .eq('id_expenses', expense.id_expenses);

      if (error) {
        console.error('Error eliminando:', error);
        return;
      }

      alert('Egreso eliminado');
      this.getExpenses();
    } catch (error) {
      console.error('Error inesperado al eliminar:', error);
    } finally {
      this.deletingExpenseId = null;
    }
  }


  // Pagination Methods
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedExpenses(): void {
    // Calculate total pages
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredExpenses.length / this.itemsPerPage)
    );
    // Ensure currentPage is not less than 1 or greater than totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calculate start and end indexes
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    // Obtain items for the current page
    this.paginatedExpenses = this.filteredExpenses.slice(startIndex, endIndex);
  }

  clearFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.filterCategory = null;
    this.filterServiceType = null;
    this.filterProviderName = null;
    this.onlyPending = false;

    this.applyFilters();
  }

  async toggleExpenseStatus(expense: ExpensesItem) {
  if (expense.payments && expense.payments.length > 0) {
    this.showNotification('Este egreso tiene abonos registrados. Use el botón "Abonos" para gestionar pagos.');
    return;
  }

  const oldStatus = expense.payment_status;
  const newStatus = oldStatus === 'PAID' ? 'PENDING' : 'PAID';

  const { error } = await this.supabase
    .from('expenses')
    .update({ payment_status: newStatus })
    .eq('id_expenses', expense.id_expenses);

  if (error) {
    console.error('Error updating status:', error);
    alert('Hubo un error al actualizar el estado.');
    return;
  }

  await this.reloadAllData();
}

  // File Handlers
  onInvoiceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedInvoiceFile = input.files[0];
    }
  }

  onProofFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedProofFile = input.files[0];
    }
  }

  async uploadExpenseFileToStorage(filePath: string, file: File) {
    const { error } = await this.supabase.uploadFile(
      filePath,
      file,
      'expenses-files'
    );
    if (error) throw error;
  }
  // decomposes combined characters, removes accent, replaces spaces with underscores, and removes special characters
  private normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
  }
  private async handleFileUploadForExpense(
    expenseId: string
  ): Promise<{ invoicePath?: string; proofPath?: string }> {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
    let results: { invoicePath?: string; proofPath?: string } = {};

    // invoice
    if (this.selectedInvoiceFile) {
      const file = this.selectedInvoiceFile;
      const safeName = this.normalizeFileName(file.name);
      const filePath = `${expenseId}/invoice/${Date.now()}_${sanitize(
        safeName
      )}`;
      await this.uploadExpenseFileToStorage(filePath, file);
      results.invoicePath = filePath;
    }

    // proof of payment
    if (this.selectedProofFile) {
      const file = this.selectedProofFile;
      const safeName = this.normalizeFileName(file.name);
      const filePath = `${expenseId}/proof/${Date.now()}_${sanitize(
        safeName
      )}`;
      await this.uploadExpenseFileToStorage(filePath, file);
      results.proofPath = filePath;
    }

    return results;
  }

  async downloadFile(filePath: string) {
    if (!filePath) return;

    const { data, error } = await this.supabase.downloadFile(
      filePath,
      'expenses-files'
    );

    if (error || !data?.signedUrl) {
      console.error('Error getting signed URL:', error);
      alert('Error al generar enlace seguro de descarga.');
      return;
    }
    // get the file name from the path
    const fileName = filePath.split('/').pop() || 'archivo';
    const downloadUrl = `${data.signedUrl}&download=${encodeURIComponent(
      fileName
    )}`;

    // trigger the download
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.setAttribute('download', fileName);

    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  get submitButtonText(): string {
    if (this.isSaving) return 'Guardando...';
    return this.isEditing ? 'Actualizar' : 'Guardar';
  }

  // ============================================
  // MÉTODOS PARA GESTIÓN DE ABONOS
  // ============================================

  // Método para obtener el total de pagos realizados
  getTotalPayments(expense: ExpensesItem): number {
    return expense.payments && Array.isArray(expense.payments)
      ? expense.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
  }

  // Método para calcular el saldo pendiente
  getRemainingBalance(expense: ExpensesItem): number {
    const total = Number(expense.cost) || 0;
    const paid = this.getTotalPayments(expense);
    return total - paid;
  }

  // Mostrar notificación temporal
  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000);
  }

  // Abrir modal de pago
  openPaymentModal(expense: ExpensesItem) {
    this.selectedExpenseForPayment = expense;
    this.newPaymentAmount = 0;
    this.newPaymentMethod = '';
    this.showPaymentModal = true;
  }

  // Cerrar modal de pago
  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedExpenseForPayment = null;
    this.newPaymentAmount = 0;
    this.newPaymentMethod = '';
  }

  // Agregar un abono
  async addPayment(expense: ExpensesItem, amount: number): Promise<void> {
  if (!expense || !expense.id_expenses || amount <= 0) {
    this.showNotification('Por favor, ingrese un monto válido.');
    return;
  }

  if (expense.payment_status === 'PAID' && (!expense.payments || expense.payments.length === 0)) {
    this.showNotification('Este egreso ya está pagado completamente. No se pueden agregar abonos.');
    return;
  }

  const total = Number(expense.cost) || 0;
  const totalPaid = this.getTotalPayments(expense);
  const remainingBalance = total - totalPaid;

  if (amount > remainingBalance) {
    this.showNotification(
      `El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(2)}.`
    );
    return;
  }

  try {
    // 1. Insertar el pago
    const { data: insertedPayment, error: insertError } = await this.supabase
      .from('expense_payments')
      .insert([{
        id_expenses: expense.id_expenses,
        amount: amount,
        payment_method: this.newPaymentMethod,
      }])
      .select()
      .single();

    if (insertError || !insertedPayment) {
      console.error('Error al insertar pago:', insertError);
      this.showNotification('Error al añadir el abono.');
      return;
    }

    // 2. Calcular nuevo estado
    const newTotalPaid = totalPaid + amount;
    let newStatus: 'PAID' | 'PENDING' | 'PARTIAL';

    if (newTotalPaid >= total) {
      newStatus = 'PAID';
    } else if (newTotalPaid > 0) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'PENDING';
    }

    // 3. Actualizar el estado en la base de datos
    const { error: updateError } = await this.supabase
      .from('expenses')
      .update({ payment_status: newStatus })
      .eq('id_expenses', expense.id_expenses);

    if (updateError) {
      console.error('Error al actualizar estado:', updateError);
    }

    // 4. Recargar datos
    await this.reloadAllData();

    this.closePaymentModal();
    this.showNotification('Abono añadido correctamente.');
  } catch (error) {
    console.error('Error inesperado:', error);
    this.showNotification('Ocurrió un error inesperado.');
  }
}

  // Abrir modal para editar pago
  openEditPaymentModal(payment: ExpensePayment) {
    this.selectedPayment = { ...payment };
    this.showEditPaymentModal = true;
  }

  // Cerrar modal de edición
  closeEditPaymentModal() {
    this.showEditPaymentModal = false;
    this.selectedPayment = null;
  }

  // Actualizar un abono existente
  async updatePayment(): Promise<void> {
  if (!this.selectedPayment || !this.selectedPayment.id_expense_payment) {
    this.showNotification('No se ha seleccionado un abono válido.');
    return;
  }

  const expense = this.expenses.find(e =>
    e.payments?.some(p => p.id_expense_payment === this.selectedPayment?.id_expense_payment)
  );

  if (!expense) {
    this.showNotification('No se encontró el egreso asociado.');
    return;
  }

  try {
    // 1. Actualizar el pago
    const { error: updateError } = await this.supabase
      .from('expense_payments')
      .update({
        amount: this.selectedPayment.amount,
        payment_method: this.selectedPayment.payment_method
      })
      .eq('id_expense_payment', this.selectedPayment.id_expense_payment);

    if (updateError) {
      console.error('Error al actualizar pago:', updateError);
      this.showNotification('Error al actualizar el abono.');
      return;
    }

    // 2. Esperar confirmación
    await new Promise(resolve => setTimeout(resolve, 150));

    if (this.selectedExpenseForPayment && this.selectedPayment) {
      const paymentIndex = this.selectedExpenseForPayment.payments?.findIndex(
        p => p.id_expense_payment === this.selectedPayment!.id_expense_payment
      );

      if (paymentIndex !== undefined && paymentIndex !== -1 && this.selectedExpenseForPayment.payments) {
        this.selectedExpenseForPayment.payments[paymentIndex] = {
          ...this.selectedExpenseForPayment.payments[paymentIndex],
          amount: this.selectedPayment.amount,
          payment_method: this.selectedPayment.payment_method
        };
      }
    }

    // 3. Obtener todos los pagos actualizados
    const { data: updatedPayments } = await this.supabase
      .from('expense_payments')
      .select('amount')
      .eq('id_expenses', expense.id_expenses);

    const totalPaid = (updatedPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(expense.cost) || 0;

    // 4. Calcular nuevo estado
    let newStatus: 'PAID' | 'PENDING' | 'PARTIAL';
    if (totalPaid >= total) {
      newStatus = 'PAID';
    } else if (totalPaid > 0) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'PENDING';
    }

    // 5. Actualizar estado
    const { error: statusError } = await this.supabase
      .from('expenses')
      .update({ payment_status: newStatus })
      .eq('id_expenses', expense.id_expenses);

    if (statusError) {
      console.error('Error al actualizar estado:', statusError);
    }

    // 6. Recargar datos
    await this.reloadAllData();

    this.closeEditPaymentModal();
    this.showNotification('Abono actualizado correctamente.');
  } catch (error) {
    console.error('Error inesperado:', error);
    this.showNotification('Ocurrió un error inesperado.');
  }
}

  // Eliminar un abono
  async deletePayment(paymentId: number, expenseId: string): Promise<void> {
  const confirmed = confirm('¿Eliminar este abono?');
  if (!confirmed) return;

  try {
    // 1. Eliminar el pago
    const { error: deleteError } = await this.supabase
      .from('expense_payments')
      .delete()
      .eq('id_expense_payment', paymentId);

    if (deleteError) {
      console.error('❌ Error al eliminar:', deleteError);
      this.showNotification('Error al eliminar el abono.');
      return;
    }

    if (this.selectedExpenseForPayment) {
      this.selectedExpenseForPayment.payments =
        this.selectedExpenseForPayment.payments?.filter(
          p => p.id_expense_payment !== paymentId
        ) || [];
    }

    // 2. Esperar a que se confirme la eliminación
    await new Promise(resolve => setTimeout(resolve, 200));

    // 3. Obtener los pagos restantes
    const { data: remainingPayments, error: paymentsError } = await this.supabase
      .from('expense_payments')
      .select('amount')
      .eq('id_expenses', expenseId);

    // 4. Obtener el costo del egreso
    const { data: expenseData, error: expenseError } = await this.supabase
      .from('expenses')
      .select('cost, payment_status')
      .eq('id_expenses', expenseId)
      .single();

    if (expenseData) {
      const total = Number(expenseData.cost) || 0;
      const totalPaid = (remainingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // 5. Calcular nuevo estado
      let newStatus: 'PAID' | 'PENDING' | 'PARTIAL';
      if (totalPaid >= total) {
        newStatus = 'PAID';
      } else if (totalPaid > 0) {
        newStatus = 'PARTIAL';
      } else {
        newStatus = 'PENDING';
      }

      // 6. INTENTO DE ACTUALIZAR EL ESTADO
      const { error: updateError } = await this.supabase
        .from('expenses')
        .update({ payment_status: newStatus })
        .eq('id_expenses', expenseId);

      if (updateError) {
        console.error('Error al actualizar estado:', updateError);
      }
    }

    // 7. Recargar datos
    await this.reloadAllData();

    this.showNotification('Abono eliminado correctamente.');
  } catch (error) {
    console.error('💥 Error inesperado:', error);
    this.showNotification('Ocurrió un error inesperado.');
  }
}

  private async reloadAllData(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*, expense_payments(*)')
      .order('code', { ascending: false }); // Ordenar en el query

    if (error) {
      console.error('Error al recargar:', error);
      return;
    }

    // Mapear datos
    this.expenses = (data || []).map((item: any) => ({
      ...item,
      payment_date: item.payment_date
        ? new Date(item.payment_date).toISOString().split('T')[0]
        : '',
      created_at: item.created_at ? new Date(item.created_at) : new Date(),
      payments: item.expense_payments || [],
    })) as ExpensesItem[];

    // Actualizar categorías
    this.uniqueCategories = [
      ...new Set(this.expenses.map((e) => e.category || '')),
    ].sort();

    this.initializeCategoryCheckboxes();

    this.filteredExpenses = this.expenses.map(e => ({...e}));

    // Aplicar filtros (esto recalcula totales)
    this.applyFilters();;
  }
}

import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import * as XLSX from 'xlsx';
interface ExpensesItem {
  id_expenses: string;
  created_at: Date;
  payment_date: string;
  paid_at?: string | null;
  mainCategory:
    | 'OPERATIVO'
    | 'MATERIALES'
    | 'TITULAR'
    | 'IMPUESTO'
    | 'PILA'
    | 'PRESTACIONES'
    | 'BANCO'
    | 'RESERVA'
    | 'INVERSION';
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
  invoice_number?: string | null;
  is_electronic_invoice?: boolean;
}

interface ExpensePayment {
  id_expense_payment?: number;
  id_expenses: string;
  amount: number;
  payment_date?: string;
  payment_method?: string;
}

interface BudgetVariable {
  id: string;
  name: string;
  category:
    | 'OPERATIVO'
    | 'MATERIALES'
    | 'TITULAR'
    | 'IMPUESTO'
    | 'PILA'
    | 'PRESTACIONES'
    | 'BANCO'
    | 'RESERVA'
    | 'INVERSION';
  value: number;
  label?: string;
}

interface BudgetSummaryRow {
  category: string;
  percentBudgeted: number;
  editedPercentBudgeted: number;
  amountBudgeted: number;
  percentReal: number;
  amountReal: number;
  differenceAmount: number;
}

const BUDGET_CATEGORIES = [
  'OPERATIVO',
  'MATERIALES',
  'TITULAR',
  'IMPUESTO',
  'PILA',
  'PRESTACIONES',
  'BANCO',
  'RESERVA',
  'INVERSION',
] as const;

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
    mainCategory: 'OPERATIVO',
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
    invoice_number: '',
    is_electronic_invoice: false,
  };
  // helpers for modal
  loading: boolean = false;
  showModal: boolean = false;
  isEditing: boolean = false;
  startDate: string = '';
  endDate: string = '';
  PaidStartDate: string = '';
  PaidEndDate: string = '';
  dueStartDate: string = '';
  dueEndDate: string = '';

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
  filterMainCategory: string | null = null;
  filterInvoiceNumber: string = '';
  filterCodeSearch: string = '';
  filterElectronicInvoice: boolean = false;

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
    { value: 'SUPPLIES', label: 'COMPRA DE INSUMOS / PROVEEDORES' },
    { value: 'ARRIENDO', label: 'ARRIENDO' },
    { value: 'UTILITIES', label: 'SERVICIOS PUBLICOS' },
    { value: 'NOMINA', label: 'NOMINA' },
    { value: 'MANTENIMIENTO', label: 'MANTENIMIENTO' },
    { value: 'IMPUESTOS', label: 'IMPUESTOS' },
    { value: 'PUBLICIDAD', label: 'PUBLICIDAD' },
  ];
  baseCategories = [
    'SUPPLIES',
    'ARRIENDO',
    'UTILITIES',
    'NOMINA',
    'MANTENIMIENTO',
    'IMPUESTOS',
    'PUBLICIDAD',
  ];

  // Service categories
  isServiceCategory: boolean = false;
  availableServiceTypes: string[] = [];
  newServiceType: string = '';
  serviceTypeJustCreated: boolean = false;

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
  newPaymentDate: string = '';
  showEditPaymentModal: boolean = false;
  selectedPayment: ExpensePayment | null = null;
  notificationMessage: string | null = null;
  notificationType: 'success' | 'error' | 'info' = 'info';

  // Tipos de categoría
  categoryMode: 'UTILITIES' | 'SUPPLIES' | 'OTHER' | null = null;

  mainCategory:
  | 'OPERATIVO'
  | 'MATERIALES'
  | 'TITULAR'
  | 'IMPUESTO'
  | 'PILA'
  | 'PRESTACIONES'
  | 'BANCO'
  | 'RESERVA'
  | 'INVERSION'
  | null = null;

  // Autocompletado para FILTROS
  filterCategorySearch: string = '';
  filterCategorySuggestions: string[] = [];
  showFilterCategorySuggestions: boolean = false;

  filterServiceTypeSearch: string = '';
  filterServiceTypeSuggestions: string[] = [];
  showFilterServiceTypeSuggestions: boolean = false;

  filterProviderNameSearch: string = '';
  filterProviderSuggestions: string[] = [];
  showFilterProviderSuggestions: boolean = false;

  filterMainCategorySearch: string = '';
  filterMainCategorySuggestions: string[] = [];
  showFilterMainCategorySuggestions: boolean = false;

  // Autocompletado para MODAL - Tipo de Servicio (UTILITIES)
  serviceTypeSearch: string = '';
  serviceTypeSuggestions: string[] = [];
  showServiceTypeSuggestions: boolean = false;

  // Autocompletado para MODAL - Proveedores (SUPPLIES)
  providerSearch: string = '';
  providerSuggestions: any[] = [];
  showProviderSuggestions: boolean = false;

  // Autocompletado para MODAL - Otras Categorías (OTHER)
  categorySearch: string = '';
  categorySuggestions: string[] = [];
  showCategorySuggestions: boolean = false;
  categoryJustSelected: boolean = false;

  // ===== PRESUPUESTO =====
  totalRecibido: number = 0;

  budgetVariables: BudgetVariable[] = [];
  budgetSummary: BudgetSummaryRow[] = [];

  showBudgetModal: boolean = false;


  @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
      const target = event.target as HTMLElement;

      // Cerrar dropdowns de filtros si se hace clic fuera
      if (!target.closest('.relative')) {
        this.showFilterCategorySuggestions = false;
        this.showFilterServiceTypeSuggestions = false;
        this.showFilterProviderSuggestions = false;
        this.showFilterMainCategorySuggestions = false;

        // Cerrar dropdowns del modal
        this.showServiceTypeSuggestions = false;
        this.showProviderSuggestions = false;
        this.showCategorySuggestions = false;
        this.thirdPartySuggestions = [];
      }
    }

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
      mainCategory: 'OPERATIVO',
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
      invoice_number: '',
      is_electronic_invoice: false,
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
  getFilterCategoriesByMainCategory(): string[] {
    let filtered = this.expenses;

    // Si hay categoría principal seleccionada, filtrar
    if (this.filterMainCategory) {
      filtered = filtered.filter(
        e => e.mainCategory === this.filterMainCategory
      );
    }

    return Array.from(
      new Set(filtered.map(e => e.category).filter(Boolean))
    ).sort();
  }
  getCategorySuggestionsByMainCategory(): string[] {
    if (!this.selectedExpense.mainCategory) {
      return this.getAllCategorySuggestions();
    }

    return Array.from(
      new Set(
        this.expenses
          .filter(
            e =>
              e.mainCategory === this.selectedExpense.mainCategory &&
              e.category &&
              e.category !== 'UTILITIES' &&
              e.category !== 'SUPPLIES'
          )
          .map(e => e.category)
      )
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
    if (!this.serviceTypeSearch) return;

    const normalized = this.serviceTypeSearch.trim().toUpperCase();

    this.selectedExpense.service_type = normalized;
    this.serviceTypeSearch = normalized;
    this.showServiceTypeSuggestions = false;
    this.serviceTypeSuggestions = [];

    this.serviceTypeJustCreated = true;
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

  getMainCategories(): string[] {
    return [
      'OPERATIVO',
      'MATERIALES',
      'TITULAR',
      'IMPUESTO',
      'PILA',
      'PRESTACIONES',
      'BANCO',
      'RESERVA',
      'INVERSION',
    ];
  }

  onFilterMainCategoryInput(): void {
    const search = this.normalizeText(this.filterMainCategorySearch);

    if (!search) {
      this.filterMainCategory = null;
      this.filterMainCategorySuggestions = this.getMainCategories();
      this.showFilterMainCategorySuggestions = true;
      this.applyFilters();
      return;
    }

    this.filterMainCategorySuggestions = this.getMainCategories().filter(cat =>
      this.normalizeText(cat).includes(search)
    );

    this.showFilterMainCategorySuggestions = true;
  }

  selectFilterMainCategory(category: string): void {
    if (!category) {
      this.filterMainCategory = null;
      this.filterMainCategorySearch = '';
    } else {
      this.filterMainCategory = category;
      this.filterMainCategorySearch = category;
    }

    this.filterCategory = null;
    this.filterCategorySearch = '';
    this.filterServiceType = null;
    this.filterServiceTypeSearch = '';

    this.showFilterMainCategorySuggestions = false;
    this.filterMainCategorySuggestions = [];

    this.applyFilters();
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

  onMainCategoryChange(): void {
    // Regla base: siempre OTHER al cambiar categoría principal
    this.categoryMode = 'OTHER';

    // Reset de datos dependientes
    this.selectedExpense.service_type = null;
    this.selectedExpense.id_provider = '';
    this.selectedExpense.provider_name = null;

    // Reset de búsquedas
    this.serviceTypeSearch = '';
    this.providerSearch = '';
    this.categorySearch = '';

    // Cerrar sugerencias
    this.showServiceTypeSuggestions = false;
    this.showProviderSuggestions = false;
    this.showCategorySuggestions = false;
    this.thirdPartySuggestions = [];
  }

  private normalizeProviderName(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private toUpper(value?: string | null): string | null {
    return value ? value.trim().toUpperCase() : null;
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

  onProviderInput(): void {
    const search = this.normalizeText(this.providerSearch);

    // Si está vacío, mostrar todos los proveedores
    if (!search) {
      this.showProviderSuggestions = true;
      this.providerSuggestions = this.providersList;
      return;
    }

    this.showProviderSuggestions = true;

    this.providerSuggestions = this.providersList.filter(provider => {
      const companyName = this.normalizeText(provider.company_name || '');
      const name = this.normalizeText(provider.name || '');
      const docNumber = this.normalizeText(provider.document_number || '');

      return companyName.includes(search) ||
            name.includes(search) ||
            docNumber.includes(search);
    });
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

  formErrors = {
    payment_date: false,
    categoryMode: false,
    description: false,
    cost: false,
    type: false,
  };

  resetFormErrors(): void {
    Object.keys(this.formErrors).forEach(
      key => (this.formErrors[key as keyof typeof this.formErrors] = false)
    );
  }

  async getBudgetVariables(): Promise<void> {
    const { data, error } = await this.supabase
      .from('variables')
      .select('*')
      .in('category', BUDGET_CATEGORIES);

    if (error) {
      console.error('Error cargando variables presupuestales:', error);
      return;
    }

    this.budgetVariables = (data || []) as BudgetVariable[];
  }

  // Save expenses and update checkboxes
  async saveExpense() {
    if (this.isSaving) return;
    this.isSaving = true;

    let rollbackProviderId: string | null = null;

    try {
      // ===== VALIDACIONES GENERALES =====
      this.resetFormErrors();

      let hasError = false;

      // Fecha de egreso
      if (!this.selectedExpense.payment_date) {
        this.formErrors.payment_date = true;
        hasError = true;
      }

      // Tipo de categoría
      if (!this.categoryMode) {
        this.formErrors.categoryMode = true;
        hasError = true;
      }

      // Costo
      if (!this.selectedExpense.cost || this.selectedExpense.cost <= 0) {
        this.formErrors.cost = true;
        hasError = true;
      }

      if (!this.selectedExpense.mainCategory) {
        this.showNotification('Debe seleccionar una categoría principal.', 'info');
        return;
      }

      if (hasError) {
        this.showNotification('Por favor complete los campos obligatorios.', 'info');
        return;
      }

      if (this.categoryMode !== 'SUPPLIES' && this.isNewProviderMode) {
        console.warn('isNewProviderMode estaba activo en una categoría incorrecta. Corrigiendo...');
        this.isNewProviderMode = false;
        this.newProviderData = {
          company_name: '',
          name: '',
          document_number: '',
          phone_number: '',
        };
      }

      // ===== VALIDACIONES ESPECÍFICAS POR TIPO =====

      // UTILITIES: Debe tener tipo de servicio
      if (this.categoryMode === 'UTILITIES') {
        if (!this.serviceTypeSearch) {
          alert('Por favor, seleccione o escriba el tipo de servicio público.');
          return;
        }
        this.selectedExpense.category = 'UTILITIES';
        this.selectedExpense.service_type = this.serviceTypeSearch.trim().toUpperCase();
      }

      // SUPPLIES: Debe tener proveedor
      if (this.categoryMode === 'SUPPLIES') {
        this.selectedExpense.category = 'SUPPLIES';

        if (this.isNewProviderMode) {
          if (!this.newProviderData.company_name && !this.newProviderData.name) {
            alert('Debe ingresar Nombre o Empresa para el nuevo proveedor');
            return;
          }
        } else {
          if (!this.selectedExpense.id_provider) {
            alert('Por favor, seleccione un proveedor o cree uno nuevo.');
            return;
          }
        }
      }

      // OTHER: Debe tener categoría escrita
      if (this.categoryMode === 'OTHER') {
        if (!this.categorySearch) {
          alert('Por favor, escriba el nombre de la categoría.');
          return;
        }
        this.selectedExpense.category = this.categorySearch.trim().toUpperCase();
      }

      if (
        (this.selectedExpense.payment_status === 'PAID' ||
        this.selectedExpense.payment_status === 'PARTIAL') &&
        !this.selectedExpense.paid_at
      ) {
        this.showNotification(
          'Debe seleccionar la fecha de pago.',
          'info'
        );
        return;
      }

      if (
        this.selectedExpense.payment_status === 'PENDING' &&
        !this.selectedExpense.payment_due_date
      ) {
        this.formErrors.type = true;
        this.showNotification(
          'Debe seleccionar un método de pago cuando el egreso no está pendiente.', 'info'
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

      let paidAt: string | null = this.selectedExpense.paid_at ?? null;

      if (this.selectedExpense.payment_status !== 'PAID') {
        paidAt = null;
      }

      const expenseToSave: any = {
        payment_date: this.selectedExpense.payment_date,
        mainCategory: this.selectedExpense.mainCategory,
        category: this.selectedExpense.category?.trim().toUpperCase(),
        service_type:
          this.selectedExpense.category === 'UTILITIES'
            ? this.toUpper(this.selectedExpense.service_type)
            : null,
        type: this.selectedExpense.type,
        description: this.toUpper(this.selectedExpense.description),
        cost: this.selectedExpense.cost,
        code: this.selectedExpense.code,
        id_provider: finalProviderId || null,
        provider_name: this.toUpper(finalProviderName),
        payment_status: this.selectedExpense.payment_status,
        payment_due_date:
          this.selectedExpense.payment_status === 'PENDING'
            ? this.selectedExpense.payment_due_date
            : null,
        paid_at:
          this.selectedExpense.payment_status === 'PAID' ||
          this.selectedExpense.payment_status === 'PARTIAL'
            ? this.selectedExpense.paid_at
            : null,
        invoice_number: this.selectedExpense.invoice_number,
        is_electronic_invoice: this.selectedExpense.is_electronic_invoice ?? false,
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
      .select('*, expense_payments(*)')
      .order('payment_date', { ascending: false })
      .order('code', { ascending: false });

    this.loading = false;

    if (error) {
      console.error('Error al cargar los egresos:', error);
      return;
    }

    this.expenses = (data || []).map((item: any) => ({
      ...item,
      category: item.category?.toUpperCase() || '',
      mainCategory: item.mainCategory,
      description: item.description?.toUpperCase() || '',
      payment_date: item.payment_date
        ? new Date(item.payment_date).toISOString().split('T')[0]
        : '',
      created_at: item.created_at
        ? new Date(item.created_at)
        : new Date(),
      paid_at: item.paid_at ?? null,
      service_type: this.toUpper(item.service_type),
      provider_name: this.toUpper(item.provider_name),
      payments: item.expense_payments || [],
      invoice_number: this.toUpper(item.invoice_number),
      is_electronic_invoice: item.is_electronic_invoice ?? false,
    })) as ExpensesItem[];

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
          expense.invoice_number || 'Sin Factura',
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
    const value = this.selectedExpense.provider_name?.trim() || '';

    // Si está vacío, mostrar todos los terceros disponibles
    if (!value) {
      this.thirdPartySuggestions = this.getThirdParties().slice(0, 50);
      return;
    }

    const normalizedValue = this.normalizeText(value);

    this.thirdPartySuggestions = this.getThirdParties()
      .filter(name => {
        const nameNormalized = this.normalizeText(name);
        return nameNormalized.includes(normalizedValue);
      })
      .slice(0, 50);
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
      if (this.filterMainCategory && e.mainCategory !== this.filterMainCategory) {
        return false;
      }

      // invoice number
      if (this.filterInvoiceNumber) {
        const search = this.filterInvoiceNumber.toLowerCase();
        if (!e.invoice_number?.toLowerCase().includes(search)) {
          return false;
        }
      }

      // expenses code
      if (this.filterCodeSearch) {
        const search = this.filterCodeSearch.trim();

        if (!/^\d+$/.test(search)) {
          return false;
        }

        if (!e.code || e.code !== Number(search)) {
          return false;
        }
      }
      
      // Date range
      const expenseDate = new Date(e.payment_date);
      if (this.startDate && expenseDate < new Date(this.startDate))
        return false;
      if (this.endDate && expenseDate > new Date(this.endDate))
        return false;

      // paid_at range
      if (this.PaidStartDate || this.PaidEndDate) {
        const start = this.PaidStartDate
          ? new Date(this.PaidStartDate)
          : null;

        const end = this.PaidEndDate
          ? new Date(this.PaidEndDate)
          : null;

        let matchesPaymentDate = false;

        if (e.paid_at) {
          const paidAtDate = new Date(e.paid_at);

          const afterStart = !start || paidAtDate >= start;
          const beforeEnd = !end || paidAtDate <= end;

          if (afterStart && beforeEnd) {
            matchesPaymentDate = true;
          }
        }

        if (!matchesPaymentDate && e.payments?.length) {
          matchesPaymentDate = e.payments.some(p => {
            if (!p.payment_date) return false;

            const paymentDate = new Date(p.payment_date);

            const afterStart = !start || paymentDate >= start;
            const beforeEnd = !end || paymentDate <= end;

            return afterStart && beforeEnd;
          });
        }

        if (!matchesPaymentDate) return false;
      }

      // payment_due_date range
      if (this.dueStartDate || this.dueEndDate) {

        if (!e.payment_due_date) return false;

        const dueDate = new Date(e.payment_due_date);

        if (this.dueStartDate &&
            dueDate < new Date(this.dueStartDate)) {
          return false;
        }

        if (this.dueEndDate &&
            dueDate > new Date(this.dueEndDate)) {
          return false;
        }
      }

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

      // Electronic Invoice
      if (this.filterElectronicInvoice && !e.is_electronic_invoice) {
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
      mainCategory: 'OPERATIVO',
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
      invoice_number: '',
      is_electronic_invoice: false,
    };
    this.categoryMode = 'OTHER';
    // Resetear estados de categoría
    this.isServiceCategory = false;
    this.isSupplierCategory = false;
    this.isNewProviderMode = false;
    this.isNewCategoryMode = false;
    this.categoryJustAdded = false;

    // Resetear campos de búsqueda del MODAL
    this.serviceTypeSearch = '';
    this.providerSearch = '';
    this.categorySearch = '';
    this.newServiceType = '';
    this.otherCategory = '';

    // Cerrar sugerencias del MODAL
    this.showServiceTypeSuggestions = false;
    this.showProviderSuggestions = false;
    this.showCategorySuggestions = false;
    this.thirdPartySuggestions = [];

    // Resetear datos de nuevo proveedor
    this.newProviderData = {
      company_name: '',
      name: '',
      document_number: '',
      phone_number: '',
    };
    this.showOtherCategoryInput = false;

    // Abrir modal en modo creación
    this.isEditing = false;
    this.showModal = true;
  }

  editExpense(expense: ExpensesItem): void {
    this.selectedExpense = { ...expense };

    this.categoryMode = 'OTHER';
    this.serviceTypeSearch = '';
    this.providerSearch = '';
    this.categorySearch = '';
    this.isNewProviderMode = false;

    // Detectar el modo según la categoría
    if (expense.category === 'UTILITIES') {
      this.categoryMode = 'UTILITIES';
      this.selectedExpense.category = 'UTILITIES';
      this.serviceTypeSearch = expense.service_type || '';
    } else if (expense.category === 'SUPPLIES') {
      this.categoryMode = 'SUPPLIES';
      this.selectedExpense.category = 'SUPPLIES';

      if (expense.id_provider) {
        const provider = this.providersList.find(
          p => p.id_provider === expense.id_provider
        );
        this.providerSearch =
          provider?.company_name || provider?.name || '';
      }
    } else {
      this.categoryMode = 'OTHER';
      this.selectedExpense.category = expense.category || '';
      this.categorySearch = this.getCategoryLabel(expense.category);
    }

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
    this.serviceTypeJustCreated = false;
    this.newServiceType = '';

    this.selectedExpense = {
      id_expenses: '',
      payment_date: '',
      mainCategory: 'OPERATIVO',
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
      invoice_number: '',
      is_electronic_invoice: false,
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
    this.PaidStartDate = '';
    this.PaidEndDate = '';
    this.dueStartDate = '';
    this.dueEndDate = '';
    this.filterCategory = null;
    this.filterServiceType = null;
    this.filterProviderName = null;
    this.onlyPending = false;
    this.filterMainCategory = null;
    this.filterInvoiceNumber = '';
    this.filterCodeSearch = '';
    this.filterElectronicInvoice = false;

    // Limpiar campos de búsqueda
    this.filterCategorySearch = '';
    this.filterServiceTypeSearch = '';
    this.filterProviderNameSearch = '';
    this.filterMainCategorySearch = '';

    // Limpiar sugerencias
    this.filterCategorySuggestions = [];
    this.filterServiceTypeSuggestions = [];
    this.filterProviderSuggestions = [];
    this.filterMainCategorySuggestions = [];

    // Ocultar dropdowns
    this.showFilterCategorySuggestions = false;
    this.showFilterServiceTypeSuggestions = false;
    this.showFilterProviderSuggestions = false;
    this.showFilterMainCategorySuggestions = false;

    this.applyFilters();
  }

  getPaymentTypeLabel(expense: ExpensesItem): string {

    const hasPayments = expense.payments && expense.payments.length > 0;

    if (!hasPayments && expense.payment_status === 'PENDING') {
      return 'NINGUNO';
    }

    if (hasPayments && expense.payment_status === 'PARTIAL') {
      return 'ABONO';
    }

    if (expense.payment_status === 'PAID') {
      switch (expense.type) {
        case 'cash': return 'EFECTIVO';
        case 'nequi': return 'NEQUI';
        case 'bancolombia': return 'BANCOLOMBIA';
        case 'davivienda': return 'DAVIVIENDA';
        case 'transfer': return 'TRANSFERENCIA';
        default: return 'Pagado';
      }
    }

    return 'Pendiente';
  }

  async toggleExpenseStatus(expense: ExpensesItem) {
    if (expense.payments && expense.payments.length > 0) {
      this.showNotification('Este egreso tiene abonos registrados. Use el botón "Abonos" para gestionar pagos.', 'info');
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
    // Si tiene abonos registrados, sumarlos
    if (expense.payments && Array.isArray(expense.payments) && expense.payments.length > 0) {
      return expense.payments.reduce((sum, p) => sum + p.amount, 0);
    }

    // Si NO tiene abonos pero está marcado como PAID, considerar el costo total como pagado
    if (expense.payment_status === 'PAID') {
      return Number(expense.cost) || 0;
    }

    // Si no tiene abonos ni está pagado, retornar 0
    return 0;
  }


  // Método para calcular el saldo pendiente
  getRemainingBalance(expense: ExpensesItem): number {
    const total = Number(expense.cost) || 0;
    const paid = this.getTotalPayments(expense);
    return total - paid;
  }

  // Mostrar notificación temporal
  showNotification(message: string,
    type: 'success' | 'error' | 'info' = 'info') {

    this.notificationMessage = message;
    this.notificationType = type;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000);
  }

  // Abrir modal de pago
  openPaymentModal(expense: ExpensesItem) {
    this.selectedExpenseForPayment = expense;
    this.newPaymentAmount = 0;
    this.newPaymentMethod = '';
    this.newPaymentDate = new Date().toISOString().split('T')[0];
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
      this.showNotification('Por favor, ingrese un monto válido.', 'info');
      return;
    }

    if (expense.payment_status === 'PAID' && (!expense.payments || expense.payments.length === 0)) {
      this.showNotification('Este egreso ya está pagado completamente. No se pueden agregar abonos.', 'info');
      return;
    }

    if (!this.newPaymentDate) {
      this.showNotification('Por favor, seleccione la fecha del abono.', 'info');
      return;
    }

    const total = Number(expense.cost) || 0;
    const totalPaid = this.getTotalPayments(expense);
    const remainingBalance = total - totalPaid;

    if (amount > remainingBalance) {
      this.showNotification(
        `El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(2)}.`, 'info'
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
          payment_date: this.newPaymentDate
        }])
        .select()
        .single();

      if (insertError || !insertedPayment) {
        console.error('Error al insertar pago:', insertError);
        this.showNotification('Error al añadir el abono.', 'error');
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

      const updatePayload: any = {
        payment_status: newStatus,
      };

      updatePayload.paid_at =
        newStatus === 'PAID'
          ? new Date().toISOString().split('T')[0]
          : null;


      // 3. Actualizar el estado en la base de datos
      const { error: updateError } = await this.supabase
        .from('expenses')
        .update(updatePayload)
        .eq('id_expenses', expense.id_expenses);

      if (updateError) {
        console.error('Error al actualizar estado:', updateError);
      }

      // 4. Recargar datos
      await this.reloadAllData();

      this.closePaymentModal();
      this.showNotification('Abono añadido correctamente.', 'success');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.', 'error');
    }
  }

  // Abrir modal para editar pago
  openEditPaymentModal(payment: ExpensePayment) {
    this.selectedPayment = {
      ...payment,
      payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : new Date().toISOString().split('T')[0]
    };
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
      this.showNotification('No se ha seleccionado un abono válido.', 'info');
      return;
    }
    if (!this.selectedPayment!.payment_date) {
      this.showNotification('Por favor, seleccione la fecha del abono.', 'info');
      return;
    }

    const expense = this.expenses.find(e =>
      e.payments?.some(p => p.id_expense_payment === this.selectedPayment?.id_expense_payment)
    );

    if (!expense) {
      this.showNotification('No se encontró el egreso asociado.', 'info');
      return;
    }

    try {
      // 1. Actualizar el pago
      const { error: updateError } = await this.supabase
        .from('expense_payments')
        .update({
          amount: this.selectedPayment.amount,
          payment_method: this.selectedPayment.payment_method,
          payment_date: this.selectedPayment!.payment_date
        })
        .eq('id_expense_payment', this.selectedPayment.id_expense_payment);

      if (updateError) {
        console.error('Error al actualizar pago:', updateError);
        this.showNotification('Error al actualizar el abono.', 'error');
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

      const updatePayload: any = {
        payment_status: newStatus,
      };

      updatePayload.paid_at =
        newStatus === 'PAID'
          ? new Date().toISOString().split('T')[0]
          : null;


      // 5. Actualizar estado
      const { error: statusError } = await this.supabase
        .from('expenses')
        .update(updatePayload)
        .eq('id_expenses', expense.id_expenses);

      if (statusError) {
        console.error('Error al actualizar estado:', statusError);
      }

      // 6. Recargar datos
      await this.reloadAllData();

      this.closeEditPaymentModal();
      this.showNotification('Abono actualizado correctamente.', 'success');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.', 'error');
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
        console.error('Error al eliminar:', deleteError);
        this.showNotification('Error al eliminar el abono.', 'error');
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

        const updatePayload: any = {
          payment_status: newStatus,
        };

        updatePayload.paid_at =
          newStatus === 'PAID'
            ? new Date().toISOString().split('T')[0]
            : null;

        // 6. INTENTO DE ACTUALIZAR EL ESTADO
        const { error: updateError } = await this.supabase
          .from('expenses')
          .update(updatePayload)
          .eq('id_expenses', expenseId);

        if (updateError) {
          console.error('Error al actualizar estado:', updateError);
        }
      }

      // 7. Recargar datos
      await this.reloadAllData();

      this.showNotification('Abono eliminado correctamente.', 'success');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.', 'error');
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')                    // Descompone caracteres con acento
      .replace(/[\u0300-\u036f]/g, '')    // Elimina diacríticos (acentos)
      .trim();
  }

  onFilterCategoryInput(): void {
    const search = this.normalizeText(this.filterCategorySearch);

    // Si está vacío, mostrar todas las categorías
    if (!search) {
      this.filterCategory = null;
      this.filterCategorySuggestions = this.getFilterCategoriesByMainCategory();
      this.showFilterCategorySuggestions = true;
      this.applyFilters();
      return;
    }

    this.filterCategorySuggestions = this.getFilterCategoriesByMainCategory().filter(cat => {
      const labelNormalized = this.normalizeText(this.getCategoryLabel(cat));
      return labelNormalized.includes(search);
    });

    this.showFilterCategorySuggestions = true;
  }

  selectFilterCategory(category: string): void {
    if (category === '') {
      // "Todas las categorías"
      this.filterCategory = null;
      this.filterCategorySearch = '';
    } else {
      this.filterCategory = category;
      this.filterCategorySearch = this.getCategoryLabel(category);
    }

    this.showFilterCategorySuggestions = false;
    this.filterCategorySuggestions = [];

    // Limpiar tipo de servicio si no es UTILITIES
    if (this.filterCategory !== 'UTILITIES') {
      this.filterServiceType = null;
      this.filterServiceTypeSearch = '';
    }

    this.applyFilters();
  }

  onFilterServiceTypeInput(): void {
    const search = this.normalizeText(this.filterServiceTypeSearch);

    // Si está vacío, limpiar filtro Y mostrar todos
    if (!search) {
      this.filterServiceType = null;
      this.filterServiceTypeSuggestions = this.getFilterServiceTypes();
      this.showFilterServiceTypeSuggestions = true;
      this.applyFilters();
      return;
    }

    this.filterServiceTypeSuggestions = this.getFilterServiceTypes().filter(type => {
      const typeNormalized = this.normalizeText(type);
      return typeNormalized.includes(search);
    });

    this.showFilterServiceTypeSuggestions = true;
  }

  selectFilterServiceType(type: string): void {
    if (type === '') {
      // "Todos los tipos"
      this.filterServiceType = null;
      this.filterServiceTypeSearch = '';
    } else {
      this.filterServiceType = type;
      this.filterServiceTypeSearch = type;
    }

    this.showFilterServiceTypeSuggestions = false;
    this.filterServiceTypeSuggestions = [];
    this.applyFilters();
  }

  onFilterProviderInput(): void {
    const search = this.normalizeText(this.filterProviderNameSearch);

    // Si está vacío, limpiar filtro Y mostrar todos
    if (!search) {
      this.filterProviderName = null;
      this.filterProviderSuggestions = this.getThirdParties();
      this.showFilterProviderSuggestions = true;
      this.applyFilters();
      return;
    }

    this.filterProviderSuggestions = this.getThirdParties().filter(name => {
      const nameNormalized = this.normalizeText(name);
      return nameNormalized.includes(search);
    });

    this.showFilterProviderSuggestions = true;
  }

  selectFilterProvider(name: string): void {
    if (name === '') {
      // "Todos los terceros"
      this.filterProviderName = null;
      this.filterProviderNameSearch = '';
    } else {
      this.filterProviderName = name;
      this.filterProviderNameSearch = name;
    }

    this.showFilterProviderSuggestions = false;
    this.filterProviderSuggestions = [];
    this.applyFilters();
  }

  onServiceTypeInput(): void {
    const search = this.normalizeText(this.serviceTypeSearch);

    // Si está vacío, mostrar todas las opciones
    if (!search) {
      this.serviceTypeSuggestions = this.getServiceTypes();
      this.showServiceTypeSuggestions = true;
      return;
    }

    this.serviceTypeSuggestions = this.getServiceTypes().filter(type => {
      const typeNormalized = this.normalizeText(type);
      return typeNormalized.includes(search);
    });

    this.showServiceTypeSuggestions = true;

    // Si encuentra una coincidencia exacta, autocompletar
    const exactMatch = this.getServiceTypes().find(type => {
      return this.normalizeText(type) === search;
    });

    if (exactMatch) {
      this.selectedExpense.service_type = exactMatch;
    }
  }

  selectServiceType(type: string): void {
    this.selectedExpense.service_type = type;
    this.serviceTypeSearch = type;
    this.showServiceTypeSuggestions = false;
    this.serviceTypeSuggestions = [];
  }

  // ============================================
  // MÉTODOS PARA MODAL - PROVEEDORES (SUPPLIES)
  // ============================================

  onProviderSearchInput(): void {
    const search = this.normalizeText(this.providerSearch);

    if (!search) {
      this.providerSuggestions = this.providersList;
      return;
    }

    this.providerSuggestions = this.providersList.filter(prov => {
      const companyNormalized = this.normalizeText(prov.company_name || '');
      const nameNormalized = this.normalizeText(prov.name || '');
      const docNormalized = this.normalizeText(prov.document_number || '');

      return companyNormalized.includes(search) ||
            nameNormalized.includes(search) ||
            docNormalized.includes(search);
    });
  }

  selectProvider(provider: any): void {
    this.selectedExpense.id_provider = provider.id_provider;
    this.providerSearch = provider.company_name || provider.name;
    this.showProviderSuggestions = false;
    this.providerSuggestions = [];
    this.isNewProviderMode = false;
  }

  openNewProviderMode(): void {
    this.isNewProviderMode = true;
    this.showProviderSuggestions = false;
    this.providerSearch = '';
    this.selectedExpense.id_provider = '';
  }

  // ============================================
  // MÉTODOS PARA MODAL - OTRAS CATEGORÍAS (OTHER)
  // ============================================

  getAllCategorySuggestions(): string[] {
    return Array.from(
      new Set(
        this.expenses
          .map(e => e.category)
          .filter(c => c && c !== 'UTILITIES' && c !== 'SUPPLIES')
      )
    ).sort();
  }

  onCategoryInput(): void {
    const search = this.normalizeText(this.categorySearch);

    const baseSuggestions =
      this.getCategorySuggestionsByMainCategory();

    // Si está vacío, mostrar todas las categorías
    if (!search) {
      this.categorySuggestions = baseSuggestions;
      this.showCategorySuggestions = true;
      return;
    }

    this.categorySuggestions = baseSuggestions.filter(cat => {
      return this.normalizeText(cat).includes(search)
    });

    this.showCategorySuggestions = true;
  }

  selectCategory(value: string): void {
    const normalized = value.trim().toUpperCase();
    this.selectedExpense.category = normalized;
    this.categorySearch = value;
    this.categorySuggestions = [];
    this.showCategorySuggestions = false;
    this.categoryJustSelected = true;
  }

  onCategoryBlur(): void {
    if (this.categoryJustSelected) return;

    if (!this.categorySearch) return;

    const normalized = this.normalizeText(this.categorySearch);
    this.selectedExpense.category = normalized.toUpperCase();
    this.categorySearch = normalized.toUpperCase();
    this.categorySuggestions = [];
  }

  // ============================================
  // MÉTODOS PARA MANEJO DE MODOS DE CATEGORÍA
  // ============================================

  setCategoryMode(mode: 'UTILITIES' | 'SUPPLIES' | 'OTHER'): void {
    this.categoryMode = mode;

    // Resetear campos según el modo
    this.selectedExpense.service_type = null;
    this.selectedExpense.id_provider = '';
    this.selectedExpense.provider_name = null;
    this.selectedExpense.category = '';

    // Resetear búsquedas
    this.serviceTypeSearch = '';
    this.providerSearch = '';
    this.categorySearch = '';

    // Cerrar sugerencias
    this.showServiceTypeSuggestions = false;
    this.showProviderSuggestions = false;
    this.showCategorySuggestions = false;
    this.thirdPartySuggestions = [];

    this.isNewProviderMode = false;
    this.newProviderData = {
      company_name: '',
      name: '',
      document_number: '',
      phone_number: '',
    };

    if (mode === 'UTILITIES') {
      this.selectedExpense.category = 'UTILITIES';
      this.isServiceCategory = true;
      this.isSupplierCategory = false;
    }

    if (mode === 'SUPPLIES') {
      this.selectedExpense.category = 'SUPPLIES';
      this.isSupplierCategory = true;
      this.isServiceCategory = false;
    }

    if (mode === 'OTHER') {
      this.isServiceCategory = false;
      this.isSupplierCategory = false;
    }
  }

    /**
   * Verifica si un tipo de servicio ya existe (ignora mayúsculas y acentos)
   */
  isExistingServiceType(searchText: string): boolean {
    if (!searchText) return false;

    const normalizedSearch = this.normalizeText(searchText);

    return this.getServiceTypes().some(type => {
      const normalizedType = this.normalizeText(type);
      return normalizedType === normalizedSearch;
    });
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
      mainCategory: item.mainCategory,
      paid_at: item.paid_at ?? null,
      payments: item.expense_payments || [],
      is_electronic_invoice: item.is_electronic_invoice ?? false,
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

  calculateBudgetSummary(): void {
    if (!this.totalRecibido || this.totalRecibido <= 0) {
      this.budgetSummary = [];
      return;
    }

    this.budgetSummary = BUDGET_CATEGORIES.map(category => {
      const variable = this.budgetVariables.find(
        v => v.category === category
      );

      const percentBudgeted = variable?.value ?? 0;

      const amountBudgeted = this.totalRecibido * percentBudgeted;

      const amountReal = this.filteredExpenses
        .filter(e => e.mainCategory === category)
        .reduce((sum, e) => sum + this.getTotalPayments(e), 0);

      const percentReal =
        this.totalRecibido > 0
          ? amountReal / this.totalRecibido
          : 0;

      const diff = amountBudgeted - amountReal;

      return {
        category,
        percentBudgeted,
        editedPercentBudgeted: percentBudgeted,
        amountBudgeted,
        percentReal,
        amountReal,
        differenceAmount: diff,
      };
    });
  }

  async saveBudgetPercentages(): Promise<void> {
    const updates = this.budgetSummary.filter(
      row => row.editedPercentBudgeted !== row.percentBudgeted
    );

    if (!updates.length) {
      this.showNotification('No hay cambios para guardar.', 'info');
      return;
    }

    try {
      for (const row of updates) {
        const { error } = await this.supabase
          .from('variables')
          .update({ value: row.editedPercentBudgeted })
          .eq('category', row.category);

        if (error) throw error;
      }

      this.showNotification('Porcentajes actualizados correctamente.', 'success');

      // Recargar variables y recalcular
      await this.getBudgetVariables();
      this.calculateBudgetSummary();

    } catch (error) {
      console.error(error);
      this.showNotification('Error al guardar los porcentajes.', 'error');
    }
  }

  async openBudgetSummary(): Promise<void> {
    if (!this.budgetVariables.length) {
      await this.getBudgetVariables();
    }

    this.calculateBudgetSummary();
    this.showBudgetModal = true;
  }

  onTotalRecibidoChange(): void {
    this.calculateBudgetSummary();
  }

  closeBudgetSummary(): void {
    this.showBudgetModal = false;
    this.totalRecibido = 0;
  }

  formatDateEs(date: string | Date): string {
    if (!date) return '';

    const parsedDate = typeof date === 'string'
      ? new Date(date)
      : date;

    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(parsedDate);
  }

  exportBudgetSummaryToExcel(): void {
    if (!this.budgetSummary || this.budgetSummary.length === 0) {
      this.showNotification('No hay datos para exportar.', 'info');
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        ['Total Recibido', this.totalRecibido],
        [] // fila en blanco
      ],
      { origin: 'A1' }
    );

    const worksheetData = this.budgetSummary.map(row => ({
      'Categoría': row.category,
      '% Presupuestado': row.editedPercentBudgeted,
      'Presupuesto ($)': row.amountBudgeted,
      '% Real': row.percentReal,
      'Gasto Real ($)': row.amountReal,
      'Diferencia ($)': row.differenceAmount
    }));

    XLSX.utils.sheet_add_json(
      worksheet,
      worksheetData,
      { origin: 'A3' }
    );

    worksheet['!cols'] = [
      { wch: 20 }, // Categoría
      { wch: 18 }, // % Presupuestado
      { wch: 20 }, // Presupuesto $
      { wch: 12 }, // % Real
      { wch: 20 }  // Gasto Real $
    ];

    const workbook: XLSX.WorkBook = {
      Sheets: { 'Presupuesto vs Real': worksheet },
      SheetNames: ['Presupuesto vs Real']
    };

    const fileName = `presupuesto_vs_real_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    this.showNotification('Archivo Excel generado correctamente.', 'success');
  }
}

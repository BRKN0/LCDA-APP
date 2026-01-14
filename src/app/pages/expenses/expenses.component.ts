import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { MainBannerComponent } from '../main-banner/main-banner.component';
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
  payment_status: 'PAID' | 'PENDING';
  invoice_file_path?: string | null;
  proof_of_payment_path?: string | null;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent, RouterOutlet],
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
  filterProviderId: string | null = null;

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

  constructor(private readonly supabase: SupabaseService) {}

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
  }
  // Handle Status Change
  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as
      | 'PAID'
      | 'PENDING';
    this.selectedExpense.payment_status = value;

    if (value === 'PAID') {
      this.selectedExpense.payment_due_date = null;
    }
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
  // Save expenses and update checkboxes
  async saveExpense() {
    if (this.isSaving) return;
    this.isSaving = true;

    // Validations
    if (!this.selectedExpense.payment_date) {
      alert('Por favor, seleccione una fecha.');
      this.isSaving = false;
      return;
    }
    if (!this.selectedExpense.category) {
      alert('Por favor, seleccione una categoría.');
      this.isSaving = false;
      return;
    }
    if (
      this.selectedExpense.payment_status === 'PENDING' &&
      !this.selectedExpense.payment_due_date
    ) {
      alert(
        'Si el estado es "Pendiente", debe seleccionar una Fecha Límite de Pago.'
      );
      this.isSaving = false;
      return;
    }

    let rollbackProviderId: string | null = null;

    try {
      let finalProviderId = this.selectedExpense.id_provider;
      let finalProviderName = '';

      // Create New Provider
      if (this.isNewProviderMode) {
        if (!this.newProviderData.company_name && !this.newProviderData.name) {
          throw new Error(
            'Debe ingresar Nombre o Empresa para el nuevo proveedor'
          );
        }

        // Determine the name to save immediately
        finalProviderName =
          this.newProviderData.company_name || this.newProviderData.name;

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
        // Find the selected provider in the list to get the name
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
        this.isSaving = false;
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

        // Link ID (can be null if deleted later)
        id_provider: finalProviderId || null,
        // Snapshot Name
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
      const uploadResults = await this.handleFileUploadForExpense(
        savedExpenseId
      );
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

        if (finalError) {
          console.error('Error saving file paths to DB:', finalError);
          throw new Error(
            'Gasto guardado pero no se pudieron registrar los archivos en la BD.'
          );
        }
      }
      alert(this.isEditing ? 'Egreso actualizado' : 'Egreso añadido');
      this.selectedInvoiceFile = null;
      this.selectedProofFile = null;
      if (rollbackProviderId) await this.getProviders();

      this.getExpenses();
      this.closeModal();
    } catch (err: any) {
      console.error(err);
      // Rollback orphaned provider
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

  getExpenses(): void {
    this.loading = true;
    this.supabase
      .from('expenses')
      .select('*')
      .then(({ data, error }) => {
        this.loading = false;
        if (error) {
          console.error('Error al cargar los egresos:', error);
        } else {
          this.expenses = (data || []).map((item: any) => ({
            ...item,
            payment_date: item.payment_date
              ? new Date(item.payment_date).toISOString().split('T')[0]
              : '',
            created_at: item.created_at
              ? new Date(item.created_at)
              : new Date(),
          })) as ExpensesItem[];
          // sorting orders by code
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
          this.filteredExpenses = [...this.expenses];

          this.uniqueCategories = [
            ...new Set(this.expenses.map((e) => e.category || '')),
          ].sort();

          this.initializeCategoryCheckboxes();

          this.applyFilters();
        }
      });
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

  applyFilters(): void {
    this.filteredExpenses = this.expenses.filter((e) => {
      // Date range
      const expenseDate = new Date(e.payment_date);
      if (this.startDate && expenseDate < new Date(this.startDate))
        return false;
      if (this.endDate && expenseDate > new Date(this.endDate)) return false;

      // Category
      if (this.filterCategory && e.category !== this.filterCategory) {
        return false;
      }

      // Provider filter
      if (this.filterProviderId && e.id_provider !== this.filterProviderId) {
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
      if (this.onlyPending && e.payment_status !== 'PENDING') {
        return false;
      }

      return true;
    });

    // Update paginated expenses after filtering
    this.updatePaginatedExpenses();
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

  deleteExpense(expense: ExpensesItem): void {
    if (
      confirm(
        `¿Eliminar el egreso de categoría ${
          expense.category || 'sin categoría'
        }?`
      )
    ) {
      this.supabase
        .from('expenses')
        .delete()
        .eq('id_expenses', expense.id_expenses)
        .then(({ error }) => {
          if (error) {
            console.error('Error eliminando:', error);
          } else {
            alert('Egreso eliminado');
            this.getExpenses();
          }
        });
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
    this.filterProviderId = null;
    this.onlyPending = false;

    this.applyFilters();
  }
  async toggleExpenseStatus(expense: ExpensesItem) {
    const oldStatus = expense.payment_status;
    const newStatus = oldStatus === 'PAID' ? 'PENDING' : 'PAID';
    expense.payment_status = newStatus;

    const updateData: any = { payment_status: newStatus };

    if (newStatus === 'PAID') {
      updateData.payment_due_date = null;
      expense.payment_due_date = null;
    }

    const { error } = await this.supabase
      .from('expenses')
      .update(updateData)
      .eq('id_expenses', expense.id_expenses);

    if (error) {
      console.error('Error updating status:', error);
      expense.payment_status = oldStatus; // Revert UI
      alert('Hubo un error al actualizar el estado.');
    }
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

  private async handleFileUploadForExpense(
    expenseId: string
  ): Promise<{ invoicePath?: string; proofPath?: string }> {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
    let results: { invoicePath?: string; proofPath?: string } = {};

    // 1. Invoice
    if (this.selectedInvoiceFile) {
      const file = this.selectedInvoiceFile;
      const filePath = `${expenseId}/invoice/${Date.now()}_${sanitize(
        file.name
      )}`;
      await this.uploadExpenseFileToStorage(filePath, file);
      results.invoicePath = filePath;
    }

    // 2. Proof of Payment
    if (this.selectedProofFile) {
      const file = this.selectedProofFile;
      const filePath = `${expenseId}/proof/${Date.now()}_${sanitize(
        file.name
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


}

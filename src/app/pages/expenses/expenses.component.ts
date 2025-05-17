import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { MainBannerComponent } from '../main-banner/main-banner.component';

interface ExpensesItem {
  id_expenses: string;
  created_at: Date;
  payment_date: string;
  category: string;
  type: string;
  description: string;
  cost: number;
  code: number;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
})
export class ExpensesComponent implements OnInit {
  // Variables existentes
  expenses: ExpensesItem[] = [];
  filteredExpenses: ExpensesItem[] = [];
  uniqueCategories: string[] = [];
  selectedCategory: string = '';
  loading: boolean = false;
  showModal: boolean = false;
  selectedExpense: ExpensesItem = {
    id_expenses: '',
    payment_date: '',
    category: '',
    type: '',
    description: '',
    cost: 0,
    code: 0,
    created_at: new Date(),
  }; // Inicializado con valores por defecto
  isEditing: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isSaving: boolean = false; // Variable to prevent multiple clicks

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedExpenses: ExpensesItem[] = []; // Lista paginada

  // Nuevas variables para los checkboxes de categorías
  categoryCheckboxes: { [key: string]: boolean } = {};
  showOtherCategoryInput: boolean = false;
  otherCategory: string = '';

  constructor(private readonly supabase: SupabaseService) {}

  ngOnInit(): void {
    this.getExpenses();
    this.initializeCategoryCheckboxes(); // Inicializar los checkboxes
  }

  // Inicializar los checkboxes con las categorías únicas
  initializeCategoryCheckboxes(): void {
    this.uniqueCategories.forEach((category) => {
      this.categoryCheckboxes[category] = true; // Por defecto, todos los checkboxes están activos
    });
  }

  // Método para manejar el cambio en la selección de categoría en el dropdown
  onCategoryChange(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    this.showOtherCategoryInput = selectedValue === 'Otros';
    if (!this.showOtherCategoryInput) {
      this.otherCategory = ''; // Limpiar el campo si no se selecciona "Otros"
    }
    if (selectedValue && selectedValue !== 'Otros') {
      this.selectedExpense.category = selectedValue; // Actualizar la categoría seleccionada
    }
  }

  // Método para guardar el egreso y actualizar los checkboxes
  saveExpense(): void {
    if (this.isSaving) return; // Evitar múltiples clics
    this.isSaving = true;

    if (!this.selectedExpense.payment_date) {
      alert('Por favor, seleccione una fecha.');
      return;
    }

    if (!this.selectedExpense.category) {
      alert('Por favor, seleccione una categoria.');
      return;
    }

    // Asegurarse de que selectedExpense no sea null
    if (!this.selectedExpense) {
      this.selectedExpense = {
        id_expenses: '',
        payment_date: '',
        category: '',
        type: '',
        description: '',
        cost: 0,
        code: 0,
        created_at: new Date(),
      };
    }

    // Determinar la categoría final
    const finalCategory = this.showOtherCategoryInput
      ? this.otherCategory
      : this.selectedExpense.category;

    const expenseToSave: Partial<ExpensesItem> = {
      payment_date: this.selectedExpense.payment_date || '',
      category: finalCategory || '', // Usar la categoría final
      type: this.selectedExpense.type || '',
      description: this.selectedExpense.description || '',
      cost: this.selectedExpense.cost || 0,
      code: this.selectedExpense.code || 0,
    };

    if (this.selectedExpense.id_expenses) {
      // Actualizar egreso existente
      this.supabase
        .from('expenses')
        .update(expenseToSave)
        .eq('id_expenses', this.selectedExpense.id_expenses)
        .then(({ error }) => {
          if (error) {
            console.error('Error al actualizar:', error);
            alert(`Error al actualizar: ${error.message}`);
          } else {
            alert('Egreso actualizado correctamente');
            this.getExpenses();
          }
          this.closeModal();
        });
    } else {
      // Añadir nuevo egreso
      this.supabase
        .from('expenses')
        .insert([expenseToSave])
        .then(({ error }) => {
          if (error) {
            console.error('Error al añadir:', error);
            alert(`Error al añadir: ${error.message}`);
          } else {
            alert('Egreso añadido correctamente');
            this.getExpenses();
          }
          this.closeModal();
        });
    }
  }

  // Métodos existentes ajustados
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

          // Obtener categorías únicas y ordenarlas
          this.uniqueCategories = [
            ...new Set(this.expenses.map((e) => e.category || '')),
          ].sort();

          // Inicializar los checkboxes con las categorías existentes
          this.initializeCategoryCheckboxes();

          // Aplicar filtros iniciales
          this.applyFilters();
        }
      });
  }

  // Nueva función para generar el kardex de egresos
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
        const costValue = typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost || '0');
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

      const csvContent = [csvHeader, ...csvRows].map((row) => row.join(';')).join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
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
      const matchesCategory = this.isAnyCategoryChecked()
        ? Object.entries(this.categoryCheckboxes)
            .filter(([_, checked]) => checked)
            .some(([category]) => e.category === category)
        : true; // Si no hay checkboxes activos, mostrar todos

      const expenseDate = new Date(e.payment_date);
      const isWithinDateRange =
        (!this.startDate || expenseDate >= new Date(this.startDate)) &&
        (!this.endDate || expenseDate <= new Date(this.endDate));

      return matchesCategory && isWithinDateRange;
    });

    // Actualizar la paginación después de aplicar los filtros
    this.updatePaginatedExpenses();
  }

  // Verificar si hay al menos un checkbox de categoría activado
  isAnyCategoryChecked(): boolean {
    return Object.values(this.categoryCheckboxes).some((checked) => checked);
  }

  onCheckboxChange(category: string): void {
    // Alternar el estado del checkbox
    this.categoryCheckboxes[category] = !this.categoryCheckboxes[category];

    // Aplicar filtros después de cambiar el estado del checkbox
    this.applyFilters();
  }

  addNewExpense(): void {
    this.selectedExpense = {
      id_expenses: '',
      payment_date: '',
      category: '',
      type: '',
      description: '',
      cost: 0,
      code: 0,
      created_at: new Date(),
    };
    this.showOtherCategoryInput = false; // Ocultar el campo "Otros" al añadir un nuevo egreso
    this.otherCategory = ''; // Limpiar el campo "Otros"
    this.isEditing = false;
    this.showModal = true;
  }

  editExpense(expense: ExpensesItem): void {
    this.selectedExpense = { ...expense };
    this.showOtherCategoryInput = expense.category === 'Otros'; // Mostrar el campo "Otros" si es necesario
    this.otherCategory = expense.category === 'Otros' ? expense.category : ''; // Prellenar el campo "Otros" si es necesario
    this.isEditing = true;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.showOtherCategoryInput = false; // Ocultar el campo "Otros" al cerrar el modal
    this.otherCategory = ''; // Limpiar el campo "Otros"
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

  // Paginación
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedExpenses(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredExpenses.length / this.itemsPerPage)
    );

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedExpenses = this.filteredExpenses.slice(startIndex, endIndex);
  }
}

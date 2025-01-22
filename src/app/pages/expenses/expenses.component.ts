import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { MainBannerComponent } from '../main-banner/main-banner.component';

interface ExpensesItem {
  id_expenses: string;
  created_at: Date;
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
  styleUrl: './expenses.component.scss'
})


export class ExpensesComponent implements OnInit {
  // Variables existentes
  expenses: any[] = [];
  filteredExpenses: any[] = [];
  uniqueCategories: string[] = [];
  selectedCategory: string = '';
  selectedDate: string = '';
  loading: boolean = false;
  showModal: boolean = false;
  selectedExpense: any = null;
  isEditing: boolean = false;

  // Nuevas variables
  showOtherCategoryInput: boolean = false;
  otherCategory: string = '';

  constructor(private readonly supabase: SupabaseService) {}

  ngOnInit(): void {
    this.getExpenses();
  }

  // Método para manejar el cambio en la selección de categoría
  onCategoryChange(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    this.showOtherCategoryInput = selectedValue === 'Otros';
    if (!this.showOtherCategoryInput) {
      this.otherCategory = ''; // Limpiar el campo si no se selecciona "Otros"
    }
  }

  // Método para guardar el egreso
  saveExpense(): void {
    if (!this.selectedExpense) return;

    // Determinar la categoría final
    const finalCategory = this.showOtherCategoryInput ? this.otherCategory : this.selectedExpense.category;

    const expenseToSave = {
      payment_date: this.selectedExpense.payment_date,
      category: finalCategory, // Usar la categoría final
      type: this.selectedExpense.type,
      description: this.selectedExpense.description,
      cost: this.selectedExpense.cost,
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

            // Actualizar uniqueCategories si la categoría es nueva
            if (!this.uniqueCategories.includes(finalCategory)) {
              this.uniqueCategories.push(finalCategory);
            }
          }
          this.closeModal();
        });
    }
  }

  // Métodos existentes
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
          this.expenses = data || [];
          this.filteredExpenses = [...this.expenses];
          this.uniqueCategories = [...new Set(this.expenses.map((e) => e.category))];
        }
      });
  }

  applyFilters(): void {
    this.filteredExpenses = this.expenses.filter((e) => {
      return (
        (!this.selectedCategory || e.category === this.selectedCategory) &&
        (!this.selectedDate || e.payment_date === this.selectedDate)
      );
    });
  }

  addNewExpense(): void {
    this.selectedExpense = {
      id_expenses: '',
      payment_date: '',
      category: '',
      type: '',
      description: '',
      cost: 0,
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
    if (confirm(`¿Eliminar el egreso de categoría ${expense.category}?`)) {
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
}

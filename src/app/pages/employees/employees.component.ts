import { Component, OnInit, NgZone} from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

interface Employee {
  id_employee: string;
  created_at: string;
  name: string;
  id_number: string;
  code: number;
  email: string;
  phone: number;
  address: string;
  neighborhood: string;
  city: string;
  department: string;
  postal_code: number;
  employee_type: string;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss'
})

export class EmployeesComponent implements OnInit {

  Employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  selectedEmployee: Partial<Employee> = {};
  loading = true;
  searchQuery: string = '';
  noResultsFound: boolean = false;
  showModal: boolean = false;
  isEditing: boolean = false;
  

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session){
        this.zone.run(() => {
          this.getEmployees();
        })
      }
    });
  }

  async getEmployees(){
    this.loading = true;
    const { data, error } = await this.supabase
      .from('employees')
      .select(`*`);
    
    if (error) {
      return;
    }

    this.Employees = data as Employee[];
    this.searchEmployee();
    this.loading = false;
  }

  searchEmployee() {
    //Filt the names of the clients
    if (!this.searchQuery.trim()) {
      this.filteredEmployees = this.Employees;
    } else {
      this.filteredEmployees = this.Employees.filter(emp =>
        emp.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }
    this.noResultsFound = this.filteredEmployees.length === 0;
    
  }

  addNewEmployee(): void {
    this.selectedEmployee = {
      id_employee: '',
      created_at: new Date().toISOString(),
      name: '',
      id_number: '',
      code: 0,
      email: '',
      phone: 0,
      address: '',
      neighborhood: '',
      city: '',
      department: '',
      postal_code: 0,
      employee_type: '',
    };

    this.isEditing = false;
    this.showModal = true;
  }

  /** Editar un empleado existente */
  editEmployee(employee: Employee): void {
    this.selectedEmployee = { ...employee };
    this.isEditing = true;
    this.showModal = true;
  }

  saveEmployee(): void {
    if (!this.selectedEmployee) return;

    const employeeToSave = {
      name: this.selectedEmployee.name,
      id_number: this.selectedEmployee.id_number,
      code: this.selectedEmployee.code || 0,
      email: this.selectedEmployee.email,
      phone: this.selectedEmployee.phone || 0,
      address: this.selectedEmployee.address,
      neighborhood: this.selectedEmployee.neighborhood,
      city: this.selectedEmployee.city,
      department: this.selectedEmployee.department,
      postal_code: this.selectedEmployee.postal_code || 0,
      employee_type: this.selectedEmployee.employee_type,
    };

    if (this.isEditing && this.selectedEmployee.id_employee) {
      // **Actualizar empleado existente**
      this.supabase
        .from('employees')
        .update(employeeToSave)
        .eq('id_employee', this.selectedEmployee.id_employee)
        .then(({ error }) => {
          if (error) {
            console.error('Error actualizando empleado:', error);
          } else {
            alert('Empleado actualizado');
            this.getEmployees(); // Recargar la lista filtrada
          }
          this.closeModal();
        });
    } else {
      // **Crear nuevo empleado**
      this.supabase
        .from('employees')
        .insert([employeeToSave])
        .then(({ error }) => {
          if (error) {
            console.error('Error añadiendo empleado:', error);
          } else {
            alert('Empleado añadido');
            this.getEmployees(); // Recargar la lista filtrada
          }
          this.closeModal();
        });
    }
  }

  /** Eliminar un empleado */
  deleteEmployee(employee: Employee): void {
    if (confirm(`¿Eliminar el empleado ${employee.name}?`)) {
      this.supabase
        .from('employees')
        .delete()
        .eq('id_employee', employee.id_employee)
        .then(({ error }) => {
          if (error) {
            console.error('Error eliminando empleado:', error);
          } else {
            alert('Empleado eliminado');
            this.getEmployees(); // Recargar la lista filtrada
          }
        });
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false; // Resetear el estado de edición
    this.selectedEmployee = {};
  }
  

}

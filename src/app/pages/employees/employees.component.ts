import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';

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
  employee_type: string | null;
  salary: number;
  employee_liquidations?: Employee_liquidations[];
  employee_benefits?: Employee_benefits[];
  id_user: string;
}

interface Employee_liquidations {
  id: string;
  code: string;
  id_employee: string;
  liquidation_date: Date;
  total_amount: number;
  notes: string;
  created_at: string;
}

interface Employee_benefits {
  id: string;
  code: string;
  id_employee: string;
  benefit_type: string;
  period: string;
  amount: number;
  status: string;
  payment_date: string;
  created_at: string;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
})
export class EmployeesComponent implements OnInit {
  userId: string | null = null;
  userRole: string | null = null;
  employeeRole: string | null = null;
  availableEmployeeRoles = [
    { value: 'cuts_employee', label: 'Empleado de cortes' },
    { value: 'prints_employee', label: 'Empleado de impresiones' },
    { value: 'counter_employee', label: 'Contador' },
    { value: 'seller_employee', label: 'Vendedor' },
    { value: 'scheduled_employee', label: 'Agendador' }
  ];
  userEmail: string | undefined = '';
  showDetailsModal = false;
  showDetails = false;
  showBenefits = false;
  showLiquidations = false;
  currentBenefitPage: number = 1;
  currentLiquidationPage: number = 1;
  Employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  selectedEmployee: Partial<Employee> = {};
  selectedEmployeeDetails: Employee | null = null;
  loading = true;
  searchQuery: string = '';
  noResultsFound: boolean = false;
  showModal: boolean = false;
  isEditing: boolean = false;
  startDate: string = '';
  endDate: string = '';
  // Paginacion
  currentPage: number = 1;
  itemsPerPage: number = 10; // Elementos por página
  itemsPerBenefitPage: number = 3;
  itemsPerLiquidationPage: number = 3;
  totalPages: number = 1; // Total de páginas
  totalLiquidationPages: number = 1;
  totalBenefitPages: number = 1;
  paginatedLiquidations: Employee_liquidations[] = [];
  paginatedBenefits: Employee_benefits[] = [];
  paginatedEmployees: Employee[] = []; // Lista paginada

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.roleService.fetchAndSetUserRole(this.userId);
          this.roleService.role$.subscribe((role) => {
            this.userRole = role;
          });
          this.getEmployees();
        });
      }
    });
  }
  async getEmployees() {
    this.loading = true;
    const { data, error } = await this.supabase.from('employees').select(`*,
        employee_liquidations(*),
        employee_benefits(*)`);

    if (error) {
      console.log(error);
      return;
    }
    this.Employees = [...data].map((employee) => ({
      ...employee,
      employee_liquidations: Array.isArray(employee.employee_liquidations)
        ? employee.employee_liquidations
        : employee.employee_liquidations
        ? [employee.employee_liquidations]
        : [],
    })) as Employee[];
    // Making sure that employee type is the same as the related user role in case of desync
    for (let index = 0; index < this.Employees.length; index++) {
      if (this.Employees[index].id_user) {
        this.roleService.fetchAndSetUserRole(this.Employees[index].id_user);
        this.roleService.role$.subscribe((role) => {
          this.Employees[index].employee_type = role;
        });
      }
    }
    console.log(this.Employees);
    this.searchEmployee();
    this.loading = false;
  }
  getEmployeeTypeLabel(type: string | null): string {
    const found = this.availableEmployeeRoles.find(r => r.value === type);
    if (found) return found.label;
    if (type === 'admin') return 'Administrador';
    return 'Desconocido';
  }
  // This changes both employee_type and user_role to match
  async toggleEmployeeType(employee: Employee) {
    const { error: empError } = await this.supabase
      .from('employees')
      .update({ employee_type: employee.employee_type })
      .eq('id_employee', employee.id_employee);

    if (empError) {
      console.error('Error actualizando el tipo de empleado:', empError);
      return;
    }

    if (employee.id_user) {
      const { data: roleData, error: roleError } = await this.supabase
        .from('roles')
        .select('id')
        .eq('name', employee.employee_type)
        .single();

      if (roleError) {
        console.error('Error obteniendo el rol:', roleError);
        return;
      }

      const userToUpdate = {
        id: employee.id_user,
        id_role: roleData.id,
      };

      const { error: userError } = await this.supabase
        .from('users')
        .update(userToUpdate)
        .eq('id', userToUpdate.id);

      if (userError) {
        console.error('Error actualizando el rol del usuario:', userError);
        return;
      }
    }
  }

  //Filtros
  searchEmployee() {
    //Filt only by date
    if (!this.searchQuery.trim()) {
      this.filteredEmployees = this.Employees.filter((emp) => {
        const employeeDate = new Date(emp.created_at);
        const isWithinDateRange =
          (!this.startDate || employeeDate >= new Date(this.startDate)) &&
          (!this.endDate ||
            employeeDate <= new Date(this.endDate + 'T23:59:59'));
        return isWithinDateRange;
      });
    } else {
      // Filtrar por nombre, email y fecha
      this.filteredEmployees = this.Employees.filter((emp) => {
        const matchesQuery =
          emp.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          emp.email.toLowerCase().includes(this.searchQuery.toLowerCase());

        const employeeDate = new Date(emp.created_at);
        const isWithinDateRange =
          (!this.startDate || employeeDate >= new Date(this.startDate)) &&
          (!this.endDate ||
            employeeDate <= new Date(this.endDate + 'T23:59:59'));

        return matchesQuery && isWithinDateRange;
      });
    }
    this.noResultsFound = this.filteredEmployees.length === 0;
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedEmployees(); // Actualizar la lista paginada
  }
  openDetailsModal(employee: Employee) {
    this.selectedEmployeeDetails = employee;
    this.showDetailsModal = true;
  }
  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedEmployeeDetails = null;
  }

  toggleLiquidations(employee: Employee | null) {
    if (employee) {
      if (!Array.isArray(employee.employee_liquidations)) {
        console.error('liquidations is not an array');
        return;
      }
      this.selectedEmployeeDetails = employee;
      this.showLiquidations = true;
      this.currentLiquidationPage = 1;
      this.updatePaginatedLiquidations();
    } else {
      this.showLiquidations = false;
    }
  }
  toggleBenefits(employee: Employee | null) {
    if (employee) {
      if (!Array.isArray(employee.employee_benefits)) {
        console.error('benefits is not an array');
        return;
      }
      this.selectedEmployeeDetails = employee;
      this.showBenefits = true;
      this.currentBenefitPage = 1;
      this.updatePaginatedBenefits();
    } else {
      this.showBenefits = false;
    }
  }
  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  updatePaginatedLiquidations(): void {
    if (this.selectedEmployeeDetails?.employee_liquidations?.length) {
      const startIndex = Number(
        (this.currentLiquidationPage - 1) * this.itemsPerLiquidationPage
      );
      const endIndex = startIndex + Number(this.itemsPerLiquidationPage);
      this.paginatedLiquidations =
        this.selectedEmployeeDetails?.employee_liquidations.slice(
          startIndex,
          endIndex
        ) || [];
      this.totalLiquidationPages = Math.ceil(
        (this.selectedEmployeeDetails?.employee_liquidations.length || 0) /
          this.itemsPerLiquidationPage
      );
    } else {
      this.totalPages = 0;
    }
  }
  updatePaginatedBenefits(): void {
    if (this.selectedEmployeeDetails?.employee_benefits?.length) {
      const startIndex = Number(
        (this.currentBenefitPage - 1) * this.itemsPerBenefitPage
      );
      const endIndex = startIndex + Number(this.itemsPerBenefitPage);
      this.paginatedBenefits =
        this.selectedEmployeeDetails?.employee_benefits.slice(
          startIndex,
          endIndex
        ) || [];
      this.totalBenefitPages = Math.ceil(
        (this.selectedEmployeeDetails?.employee_benefits.length || 0) /
          this.itemsPerLiquidationPage
      );
    } else {
      this.totalPages = 0;
    }
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
      salary: 0,
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
      salary: this.selectedEmployee.salary,
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

  //Paginacion
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedEmployees(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredEmployees.length / this.itemsPerPage)
    );

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedEmployees = this.filteredEmployees.slice(
      startIndex,
      endIndex
    );
  }
}

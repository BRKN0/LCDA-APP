import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface User {
  id: string;
  email: string;
  user_name: string;
  id_role: string;
}
interface InvoiceCard {
  id_invoice: string;
  code: string;
  order_type: string;
  secondary_process: boolean;
  client_name: string;
}
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
  //total_amount: number;
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
  imports: [CommonModule, FormsModule, RouterOutlet],
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
    //{ value: 'counter_employee', label: 'Contador' },
    //{ value: 'seller_employee', label: 'Vendedor' },
    { value: 'scheduler', label: 'Agendador' },
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
  modalExpanded = false;
  showAddLiquidation = false;
  showAddBenefit = false;
  liquidationForm: Partial<Employee_liquidations> = {};
  benefitForm: Partial<Employee_benefits> = {};
  isEditingLiquidation = false;
  isEditingBenefit = false;
  editingLiquId: string | null = null;
  editingBenefitId: string | null = null;
  availableUsers: User[] = [];

  // permissions variables
  showPermissionsModal: boolean = false;
  employeePermissions: InvoiceCard[] = [];

  // search variables for invoices
  invoiceSearchQuery: string = '';
  invoiceSearchResults: InvoiceCard[] = [];
  isSearchingInvoices: boolean = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
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
          this.getUsers();
        });
      }
    });
  }
  async getUsers() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, user_name, id_role');

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      this.availableUsers = data || [];
    }
  }

  // Handle selection of a user in the modal
  onUserSelect(event: any) {
    const userId = event.target.value;
    const user = this.availableUsers.find((u) => u.id === userId);

    if (user) {
      this.selectedEmployee.id_user = user.id;
      this.selectedEmployee.email = user.email; // Auto-sync email
      this.selectedEmployee.name = user.user_name; // Auto-sync name
    }
  }
  async getEmployees() {
    this.loading = true;

    const { data, error } = await this.supabase.from('employees').select(`
        *,
        employee_liquidations(*),
        employee_benefits(*),
        users:id_user (
          email,
          roles (
            name
          )
        )
      `);

    if (error) {
      console.log(error);
      this.loading = false;
      return;
    }

    this.Employees = (data || []).map((employee: any) => {
      const linkedRole = employee.users?.roles?.name;

      return {
        ...employee,
        employee_type: linkedRole || employee.employee_type,

        employee_liquidations: Array.isArray(employee.employee_liquidations)
          ? employee.employee_liquidations
          : employee.employee_liquidations
            ? [employee.employee_liquidations]
            : [],
      };
    }) as Employee[];

    console.log(this.Employees);
    this.searchEmployee();
    this.loading = false;
  }
  getEmployeeTypeLabel(type: string | null): string {
    const found = this.availableEmployeeRoles.find((r) => r.value === type);
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
    this.modalExpanded = !this.modalExpanded;
  }

  updatePaginatedLiquidations(): void {
    const all = this.selectedEmployeeDetails?.employee_liquidations || [];
    const startIndex =
      (this.currentLiquidationPage - 1) * this.itemsPerLiquidationPage;
    const endIndex = startIndex + this.itemsPerLiquidationPage;
    this.paginatedLiquidations = all.slice(startIndex, endIndex);
    this.totalLiquidationPages = Math.ceil(
      all.length / this.itemsPerLiquidationPage,
    );
  }

  updatePaginatedBenefits(): void {
    const all = this.selectedEmployeeDetails?.employee_benefits || [];
    const startIndex = (this.currentBenefitPage - 1) * this.itemsPerBenefitPage;
    const endIndex = startIndex + this.itemsPerBenefitPage;
    this.paginatedBenefits = all.slice(startIndex, endIndex);
    this.totalBenefitPages = Math.ceil(all.length / this.itemsPerBenefitPage);
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

  async saveEmployee() {
    if (!this.selectedEmployee) return;

    // Validation
    if (!this.selectedEmployee.name || !this.selectedEmployee.employee_type) {
      alert('Por favor, complete nombre y tipo de empleado.');
      return;
    }

    if (!this.selectedEmployee.id_user) {
      alert('Es obligatorio vincular un Usuario del Sistema.');
      return;
    }

    this.loading = true; // Add a loading state if you have one available globally

    try {
      // Get the Role ID based on the selected employee_type string
      const { data: roleData, error: roleError } = await this.supabase
        .from('roles')
        .select('id')
        .eq('name', this.selectedEmployee.employee_type)
        .single();

      if (roleError || !roleData) {
        console.log(this.selectedEmployee.employee_type);
        throw new Error(
          'No se encontró el rol especificado en la base de datos.',
        );
      }

      // Update the User's Role in public.users
      const { error: userUpdateError } = await this.supabase
        .from('users')
        .update({ id_role: roleData.id })
        .eq('id', this.selectedEmployee.id_user);

      if (userUpdateError) {
        throw new Error(
          'Error actualizando el rol del usuario: ' + userUpdateError.message,
        );
      }

      // Prepare Employee Payload
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
        id_user: this.selectedEmployee.id_user,
      };

      // Insert or Update Employee
      let error;
      if (this.isEditing && this.selectedEmployee.id_employee) {
        const res = await this.supabase
          .from('employees')
          .update(employeeToSave)
          .eq('id_employee', this.selectedEmployee.id_employee);
        error = res.error;
      } else {
        const res = await this.supabase
          .from('employees')
          .insert([employeeToSave]);
        error = res.error;
      }

      if (error) throw error;

      alert(this.isEditing ? 'Empleado actualizado' : 'Empleado añadido');
      this.closeModal();
      this.getEmployees();
    } catch (err: any) {
      console.error('Error saving:', err);
      alert(err.message || 'Ocurrió un error al guardar.');
    } finally {
      this.loading = false;
    }
  }

  /** Eliminar un empleado */
  async deleteEmployee(employee: Employee): Promise<void> {
    if (!confirm(`¿Eliminar el empleado ${employee.name}?`)) return;

    try {
      // 1. Borrar liquidaciones
      await this.supabase
        .from('employee_liquidations')
        .delete()
        .eq('id_employee', employee.id_employee);

      // 2. Borrar beneficios
      await this.supabase
        .from('employee_benefits')
        .delete()
        .eq('id_employee', employee.id_employee);

      // 3. Borrar empleado
      const { error } = await this.supabase
        .from('employees')
        .delete()
        .eq('id_employee', employee.id_employee);

      if (error) throw error;

      alert('Empleado eliminado correctamente');
      this.getEmployees();
    } catch (err) {
      console.error('Error eliminando empleado:', err);
      alert('No se pudo eliminar el empleado');
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
      Math.ceil(this.filteredEmployees.length / this.itemsPerPage),
    );

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedEmployees = this.filteredEmployees.slice(
      startIndex,
      endIndex,
    );
  }
  openAddLiquidationForm() {
    this.liquidationForm = {};
    this.isEditingLiquidation = false;
    this.editingLiquId = null;
    this.showAddLiquidation = true;
  }

  openAddBenefitForm() {
    this.benefitForm = {};
    this.isEditingBenefit = false;
    this.editingBenefitId = null;
    this.showAddBenefit = true;
  }

  editLiquidation(l: Employee_liquidations) {
    this.liquidationForm = { ...l };
    this.isEditingLiquidation = true;
    this.editingLiquId = l.id;
    this.showAddLiquidation = true;
  }

  editBenefit(b: Employee_benefits) {
    this.benefitForm = { ...b };
    this.isEditingBenefit = true;
    this.editingBenefitId = b.id;
    this.showAddBenefit = true;
  }

  async deleteLiquidation(l: Employee_liquidations) {
    if (!confirm('¿Eliminar esta liquidación?')) return;

    await this.supabase.from('employee_liquidations').delete().eq('id', l.id);

    // Elimina localmente
    const index =
      this.selectedEmployeeDetails?.employee_liquidations?.findIndex(
        (liq) => liq.id === l.id,
      );
    if (index !== undefined && index !== -1) {
      this.selectedEmployeeDetails?.employee_liquidations?.splice(index, 1);
    }

    this.updatePaginatedLiquidations();
  }

  async deleteBenefit(b: Employee_benefits) {
    if (!confirm('¿Eliminar esta prestación?')) return;

    await this.supabase.from('employee_benefits').delete().eq('id', b.id);

    const index = this.selectedEmployeeDetails?.employee_benefits?.findIndex(
      (ben) => ben.id === b.id,
    );
    if (index !== undefined && index !== -1) {
      this.selectedEmployeeDetails?.employee_benefits?.splice(index, 1);
    }

    this.updatePaginatedBenefits();
  }

  async saveLiquidation() {
    if (!this.selectedEmployeeDetails?.id_employee) return;

    const payload = {
      ...this.liquidationForm,
      id_employee: this.selectedEmployeeDetails.id_employee,
    };

    let saved: any;

    if (this.isEditingLiquidation && this.editingLiquId) {
      const { data } = await this.supabase
        .from('employee_liquidations')
        .update(payload)
        .eq('id', this.editingLiquId)
        .select()
        .single();
      saved = data;
    } else {
      const { data } = await this.supabase
        .from('employee_liquidations')
        .insert([payload])
        .select()
        .single();
      saved = data;
    }

    // Actualiza localmente
    if (!this.isEditingLiquidation) {
      this.selectedEmployeeDetails.employee_liquidations?.push(saved);
    } else {
      const index =
        this.selectedEmployeeDetails.employee_liquidations?.findIndex(
          (l) => l.id === this.editingLiquId,
        );
      if (index !== undefined && index !== -1) {
        this.selectedEmployeeDetails.employee_liquidations![index] = saved;
      }
    }

    this.showAddLiquidation = false;
    this.updatePaginatedLiquidations();
  }

  async saveBenefit() {
    if (!this.selectedEmployeeDetails?.id_employee) return;

    const payload = {
      ...this.benefitForm,
      id_employee: this.selectedEmployeeDetails.id_employee,
    };

    let saved: any;

    if (this.isEditingBenefit && this.editingBenefitId) {
      const { data } = await this.supabase
        .from('employee_benefits')
        .update(payload)
        .eq('id', this.editingBenefitId)
        .select()
        .single();
      saved = data;
    } else {
      const { data } = await this.supabase
        .from('employee_benefits')
        .insert([payload])
        .select()
        .single();
      saved = data;
    }

    if (!this.isEditingBenefit) {
      this.selectedEmployeeDetails.employee_benefits?.push(saved);
    } else {
      const index = this.selectedEmployeeDetails.employee_benefits?.findIndex(
        (b) => b.id === this.editingBenefitId,
      );
      if (index !== undefined && index !== -1) {
        this.selectedEmployeeDetails.employee_benefits![index] = saved;
      }
    }

    this.showAddBenefit = false;
    this.updatePaginatedBenefits();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.searchEmployee();
  }
  openPermissionsManagement(employee: Employee) {
    if (!employee.id_user) {
      alert(
        'Este empleado no tiene un usuario de sistema vinculado. Edite el empleado y vincule un usuario primero.',
      );
      return;
    }
    this.selectedEmployeeDetails = employee;
    this.showPermissionsModal = true;
    this.loadEmployeePermissions();
  }

  closePermissionsModal() {
    this.showPermissionsModal = false;
    this.invoiceSearchQuery = '';
    this.invoiceSearchResults = [];
  }
  async loadEmployeePermissions() {
    if (!this.selectedEmployeeDetails?.id_user) return;

    this.loading = true;
    const { data, error } = await this.supabase
      .from('invoice_permissions')
      .select(
        `
        id_invoice,
        invoices (
          code,
          orders (
            order_type,
            secondary_process,
            client:id_client ( name )
          )
        )
      `,
      )
      .eq('id_user', this.selectedEmployeeDetails.id_user);

    this.loading = false;

    if (error) {
      console.error('Error fetching permissions', error);
      return;
    }

    // map the complex join result for the card
    this.employeePermissions = (data || []).map((item: any) => ({
      id_invoice: item.id_invoice,
      code: item.invoices?.code || 'N/A',
      order_type: item.invoices?.orders?.order_type || 'Unknown',
      secondary_process: item.invoices?.orders?.secondary_process || false,
      client_name: item.invoices?.orders?.client?.name || 'Cliente desconocido',
    }));
  }
  async revokePermission(invoiceId: string) {
    if (!confirm('¿Quitar acceso a esta factura?')) return;
    if (!this.selectedEmployeeDetails?.id_user) return;

    const { error } = await this.supabase
      .from('invoice_permissions')
      .delete()
      .eq('id_invoice', invoiceId)
      .eq('id_user', this.selectedEmployeeDetails.id_user);

    if (error) {
      console.error('Error revoking permission', error);
      alert('Error al revocar permiso');
    } else {
      // remove locally to update UI instantly
      this.employeePermissions = this.employeePermissions.filter(
        (p) => p.id_invoice !== invoiceId,
      );
    }
  }
  async searchInvoicesToAdd() {
    const query = this.invoiceSearchQuery.trim();
    if (query.length < 3) return;
    this.isSearchingInvoices = true;
    const searchTerm = `%${query}%`;
    const isNumeric = /^\d+$/.test(query);
    const selectQuery = `
      id_invoice,
      code,
      orders (
        order_type,
        secondary_process,
        client:id_client ( name )
      )
    `;
    const promises = [];

    const promiseByName = this.supabase
      .from('invoices')
      .select(
        `
        id_invoice,
        code,
        orders!inner (
          order_type,
          secondary_process,
          client:id_client!inner ( name )
        )
      `,
      )
      .ilike('orders.client.name', searchTerm)
      .limit(5);

    promises.push(promiseByName);
    if (isNumeric) {
      const promiseByCode = this.supabase
        .from('invoices')
        .select(selectQuery)
        .eq('code', query)
        .limit(5);
      promises.push(promiseByCode);
    }
    const results = await Promise.all(promises);

    this.isSearchingInvoices = false;
    const allResults: any[] = [];
    results.forEach((res) => {
      if (res.data) allResults.push(...res.data);
      if (res.error) console.error('Search error:', res.error);
    });
    const uniqueInvoices = new Map();
    allResults.forEach((item: any) => {
      if (!uniqueInvoices.has(item.id_invoice)) {
        uniqueInvoices.set(item.id_invoice, {
          id_invoice: item.id_invoice,
          code: item.code,
          order_type: item.orders?.order_type,
          secondary_process: item.orders?.secondary_process,
          client_name: item.orders?.client?.name || 'Cliente desconocido',
        });
      }
    });

    this.invoiceSearchResults = Array.from(uniqueInvoices.values());
  }

  async grantPermission(invoice: InvoiceCard) {
    if (!this.selectedEmployeeDetails?.id_user) return;

    // check if already exists locally
    if (
      this.employeePermissions.some((p) => p.id_invoice === invoice.id_invoice)
    ) {
      alert('El empleado ya tiene acceso a esta factura.');
      return;
    }

    const { error } = await this.supabase.from('invoice_permissions').insert({
      id_invoice: invoice.id_invoice,
      id_user: this.selectedEmployeeDetails.id_user,
    });

    if (error) {
      console.error(error);
      alert('Error al asignar permiso.');
    } else {
      // local list
      this.employeePermissions.push(invoice);
      this.invoiceSearchQuery = '';
      this.invoiceSearchResults = [];
    }
  }

  // helper to format the type label
  formatOrderType(type: string, secondary: boolean): string {
    if (type === 'laser') return secondary ? 'Corte / Impresión' : 'Cortes';
    if (type === 'print')
      return secondary ? 'Impresión / Corte' : 'Impresiones';
    if (type === 'sales') return 'Ventas';
    return type;
  }
}

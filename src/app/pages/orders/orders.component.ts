import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface Orders {
  id_order: string;
  order_type: string;
  is_vitrine?: boolean;
  name: string;
  client_type: string;
  code: number;
  description: string;
  order_payment_status: string;
  order_completion_status: string;
  order_confirmed_status: string;
  order_delivery_status: string;
  notes: string;
  created_at: string;
  created_time?: string;
  delivery_date: string;
  order_quantity: string;
  unitary_value: string | number;
  iva: string | number;
  subtotal: string | number;
  total: string | number;
  amount: string | number;
  id_client: string;
  payments?: Payment[];
  file_path: string;
  invoice_file: string;
  scheduler: string;
  requires_e_invoice: boolean;
  cutting_time?: number;
  extra_charges?: {
    description: string;
    amount: number;
    type?: 'fixed' | 'percentage';
  }[];
  base_total?: number;
  pending_quantity?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
}

interface Client {
  id_client: string;
  name: string;
  document_type: string;
  document_number: string;
  cellphone: string;
  nit: string;
  company_name: string;
  email: string;
  status: string;
  debt: number;
  address: string;
  city: string;
  province: string;
  postal_code: string;
}

interface Notifications {
  id_notification: string;
  created_at: string;
  type: string;
  description: string;
  id_invoice: string;
  id_order: string;
  id_expenses: string;
  id_material: string;
  due_date: string;
  id_user: string | null;
}

interface Cuts {
  id: string;
  category: string;
  material_type: string;
  color: string;
  caliber: string;
  height: string;
  width: string;
  quantity: string;
  cutting_time: string;
  unit_price?: number;
  id_order: string;
}

interface Prints {
  id: string;
  material_type: string;
  category: string;
  caliber: string;
  color: string;
  laminating: boolean;
  die_cutting: boolean;
  assembly: boolean;
  printing: boolean;
  product_number: string;
  quantity: string;
  damaged_material: string;
  notes: string;
  id_order: string;
}

interface Payment {
  id_payment?: number;
  id_order: string;
  amount: number;
  payment_date?: string;
}

interface VariableMap {
  iva: number;
  utility_margin: number;
  retefuente_bienes_declara: number;
  retefuente_bienes_no_declara: number;
  retefuente_servicios_declara: number;
  retefuente_servicios_no_declara: number;
  reteica_bienes: number;
  reteica_servicios: number;
  finalLaminationValue: number;
  finalPrintValue: number;
  finalStampingValue: number;
  finalAssembleValue: number;
  intermediaryLaminationValue: number;
  intermediaryPrintValue: number;
  intermediaryStampingValue: number;
  intermediaryAssembleValue: number;
  finalPerMinute: number;
  baseCutTimeValue: number;
  intermediaryPerMinute: number;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit {
  variables: VariableMap = {
    iva: 0,
    utility_margin: 0,
    retefuente_bienes_declara: 0,
    retefuente_bienes_no_declara: 0,
    retefuente_servicios_declara: 0,
    retefuente_servicios_no_declara: 0,
    reteica_bienes: 0,
    reteica_servicios: 0,
    finalLaminationValue: 0,
    finalPrintValue: 0,
    finalStampingValue: 0,
    finalAssembleValue: 0,
    intermediaryAssembleValue: 0,
    intermediaryLaminationValue: 0,
    intermediaryPrintValue: 0,
    intermediaryStampingValue: 0,
    baseCutTimeValue: 0,
    finalPerMinute: 0,
    intermediaryPerMinute: 0,
  };
  variablesMap: Record<string, number> = {};
  originalMap: Record<string, number> = {};
  clients: Client[] = [];
  notificationToInsert: Partial<Notifications> = {};
  orderToInsert: Partial<Orders> = {};
  notificationDesc: string = '';
  userId: string | null = null;
  userRole: string | null = null;
  showModal: boolean = false;
  order_role_filter: string = '';
  isEditing: boolean = false;
  orders: Orders[] = [];
  selectedOrderTypeDetail: any | null = null;
  order: Orders | null = null;
  filteredOrdersList: Orders[] = [];
  selectedOrder: Orders | null = null;
  selectedOrderDetails: Orders[] | null = null;
  noResultsFound: boolean = false;
  loading: boolean = true;
  loadingDetails: boolean = true;
  searchQuery: string = '';
  searchByNameQuery: string = '';
  startDate: string = '';
  endDate: string = '';
  showPrints: boolean = true;
  showCuts: boolean = true;
  showSales: boolean = true;
  showInProgress = true;
  showFinished = true;
  showDelivered = true;
  vitrineFilterMode: 'all' | 'only' | 'exclude' = 'all';
  requires_e_invoice: boolean = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedOrders: Orders[] = [];
  newPaymentAmount: number = 0;
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;
  private searchSubject = new Subject<void>();
  showAddClientModal = false;
  filteredClients: Client[] = [];
  newOrder: Partial<Orders> = {};
  newCut: Partial<Cuts> = {};
  newPrint: Partial<Prints> = {};
  allMaterials: any[] = [];
  selectedCategory: string = '';
  selectedType: string = '';
  selectedCaliber: string = '';
  selectedColor: string = '';
  selectedFile: File | null = null;
  uploadedFileName: string | null = null;
  uploadedFilePath: string | null = null;
  selectedInvoiceFile: File | null = null;
  showStockWarningModal = false;
  stockWarningMessage = '';
  selectedScheduler: string = '';
  extraChargeDescription: string = '';
  extraChargeAmount: number = 0;
  extraChargeType: 'fixed' | 'percentage' = 'fixed';
  initialPaymentType: 'none' | 'full' | 'partial' = 'none';
  initialPaymentAmount: number = 0;
  initialPaymentMethod: string = '';
  tempCutTime: number = 0;

  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '0',
    cellphone: '0',
    address: '',
    status: '',
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
    private readonly routerOutlet: RouterOutlet
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.roleService.fetchAndSetUserRole(this.userId);
          this.roleService.role$.subscribe((role) => {
            this.userRole = role;
            if (role) {
              this.getOrders();
            }
          });
          this.getClients();
          this.getMaterials();
          this.getVariables();
        });
      } else {
        console.error('Usuario no autenticado.');
        this.orders = [];
        this.filteredOrdersList = [];
      }
    });
  }
  async getVariables() {
    this.loading = true;
    const { data } = await this.supabase.from('variables').select('name,value');
    if (data) {
      for (const v of data) {
        if (v.name in this.variables) {
          this.variables[v.name as keyof VariableMap] = parseFloat(v.value);
        }
      }
    }
    this.loading = false;
  }
  async getOrders(): Promise<void> {
    this.loading = true;
    let query = this.supabase.from('orders').select('*, payments(*)');

    if (this.userRole !== 'admin' && this.userRole !== 'scheduler') {
      switch (this.userRole) {
        case 'prints_employee':
          this.order_role_filter = 'print';
          break;
        case 'cuts_employee':
          this.order_role_filter = 'laser';
          break;
        default:
          break;
      }
      query = query.eq('order_type', this.order_role_filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener los pedidos:', error);
      this.loading = false;
      return;
    }
    this.orders = data as Orders[];

    let n = this.orders.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.orders[i].code < this.orders[i + 1].code) {
          [this.orders[i], this.orders[i + 1]] = [
            this.orders[i + 1],
            this.orders[i],
          ];
          swapped = true;
        }
      }
      n--;
    } while (swapped);
    this.updateFilteredOrders();
    this.loading = false;
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }
    this.clients = data;
    this.filteredClients = [...this.clients];
  }

  async getMaterials(): Promise<void> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .neq('material_quantity', '0');

    if (error) {
      console.error('Error al cargar materiales:', error);
      return;
    }

    this.allMaterials = data || [];
  }

  private getCurrentTimeHHMM(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  openAddClientModal(): void {
    this.showAddClientModal = true;
  }

  closeAddClientModal(): void {
    this.showAddClientModal = false;
    this.newClient = {
      name: '',
      email: '',
      document_type: '',
      document_number: '',
      //company_name: '',
      cellphone: '',
      address: '',
      status: '',
    };
  }

  async saveNewClient(): Promise<void> {
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }

    const clientToSave = {
      ...this.newClient,
      name: this.newClient.name.toUpperCase().trim(),
    };

    //
    const { data, error } = await this.supabase
      .from('clients')
      .insert([clientToSave]);

    if (error) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
      return;
    }

    alert('Cliente añadido correctamente.');
    this.closeAddClientModal();
    await this.getClients();
  }

  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000);
  }

  getTotalPayments(order: Orders): number {
    return order.payments && Array.isArray(order.payments)
      ? order.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
  }

  async addPayment(order: Orders, amount: number): Promise<void> {
    if (!order || !order.id_order || amount <= 0) {
      this.showNotification('Por favor, ingrese un monto válido.');
      return;
    }

    const total = parseFloat(String(order.total)) || 0;
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    if (amount > remainingBalance) {
      this.showNotification(
        `El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(
          2
        )}.`
      );
      return;
    }

    const payment: Payment = {
      id_order: order.id_order,
      amount: amount,
    };

    try {
      const { data, error: insertError } = await this.supabase
        .from('payments')
        .insert([payment])
        .select();

      if (insertError || !data || data.length === 0) {
        console.error('Error al añadir el abono:', insertError);
        this.showNotification('Error al añadir el abono.');
        return;
      }

      const newPayment = data[0];
      newPayment.payment_date = new Date().toISOString();

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt - amount;

      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', order.id_client);

      if (updateError) {
        console.error('Error al actualizar la deuda:', updateError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push(newPayment);

      const updatedTotalPaid = this.getTotalPayments(order);
      const orderTotal = parseFloat(String(order.total)) || 0;
      const newStatus =
        updatedTotalPaid >= orderTotal && newDebt <= 0 ? 'upToDate' : 'overdue';

      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', order.id_order);

      await this.supabase
        .from('invoices')
        .update({ invoice_status: newStatus })
        .eq('id_order', order.id_order);

      await this.getOrders();

      this.newPaymentAmount = 0;
      this.showNotification('Abono añadido correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  async markClientAsUpToDate(clientId: string): Promise<void> {
    const { error: debtError } = await this.supabase
      .from('clients')
      .update({ debt: 0, status: 'upToDate' })
      .eq('id_client', clientId);

    if (debtError) {
      console.error('Error al actualizar el cliente:', debtError);
      this.showNotification('Error al marcar al cliente como "al día".');
    } else {
      this.showNotification('Cliente marcado como "al día". Deuda eliminada.');
    }
  }

  async updatePayment(): Promise<void> {
    if (!this.selectedPayment || !this.selectedPayment.id_payment) {
      this.showNotification('No se ha seleccionado un abono válido.');
      return;
    }

    try {
      const { data: originalPayment, error: fetchError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('id_payment', this.selectedPayment.id_payment)
        .single();

      if (fetchError || !originalPayment) {
        console.error('Error al obtener el abono original:', fetchError);
        this.showNotification('Error al obtener el abono original.');
        return;
      }

      const originalAmount = originalPayment.amount;
      const newAmount = this.selectedPayment.amount;
      const difference = newAmount - originalAmount;

      const { error: updateError } = await this.supabase
        .from('payments')
        .update({ amount: newAmount })
        .eq('id_payment', this.selectedPayment.id_payment);

      if (updateError) {
        console.error('Error al actualizar el abono:', updateError);
        this.showNotification('Error al actualizar el abono.');
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', this.selectedOrder!.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt + difference;

      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', this.selectedOrder!.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (this.selectedOrder && this.selectedOrder.payments) {
        const paymentIndex = this.selectedOrder.payments.findIndex(
          (p) => p.id_payment === this.selectedPayment!.id_payment
        );
        if (paymentIndex !== -1) {
          this.selectedOrder.payments[paymentIndex] = {
            ...this.selectedPayment,
          };
        }

        const totalPaid = this.getTotalPayments(this.selectedOrder);
        const orderTotal = parseFloat(String(this.selectedOrder.total)) || 0;
        const newStatus =
          totalPaid >= orderTotal && newDebt <= 0 ? 'upToDate' : 'overdue';

        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        await this.getOrders();
      }

      this.showEditPayment = false;
      this.selectedPayment = null;
      this.showNotification('Abono actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }
  /*
    Delete order and adjust client debt (handled in DB trigger)
    The database trigger will update the client's debt and cascade delete prints, cuts, sales, invoices, etc.
    Don't do that in here to avoid race conditions and lag PLEASE.
  */
  async deleteOrder(order: Orders): Promise<void> {
    if (!confirm(`¿Eliminar orden #${order.code}?`)) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('orders')
        .delete()
        .eq('id_order', order.id_order);

      if (error) {
        console.error('Error al eliminar el pedido:', error);
        this.showNotification('Error al eliminar el pedido.');
        return;
      }

      // Update local state
      this.orders = this.orders.filter((o) => o.id_order !== order.id_order);
      this.updateFilteredOrders();
      this.showNotification('Orden eliminada y deuda ajustada correctamente.');
    } catch (error) {
      console.error('Error inesperado al eliminar la orden:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  onSearchInputChange(): void {
    this.searchSubject.next();
  }

  async onSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      this.updateFilteredOrders();
      return;
    }

    const { data, error } = await this.supabase
      .from('orders')
      .select('*, payments(*)')
      .eq('code', this.searchQuery.trim());

    if (error) {
      console.error('Error al buscar la orden:', error);
      this.noResultsFound = true;
      this.filteredOrdersList = [];
      this.updatePaginatedOrder();
      return;
    }

    this.filteredOrdersList = data as Orders[];
    this.noResultsFound =
      this.searchQuery.trim() !== '' && (!data || data.length === 0);
    this.currentPage = 1;
    this.updatePaginatedOrder();
  }

  updateFilteredOrders(): void {
    if (
      !this.showPrints &&
      !this.showCuts &&
      !this.showSales &&
      this.vitrineFilterMode === 'all'
    ) {
      this.vitrineFilterMode = 'only';
    }
    const allTypeCheckboxesOff =
      !this.showPrints && !this.showCuts && !this.showSales && this.vitrineFilterMode !== 'only';

    this.filteredOrdersList = this.orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const matchesStartDate = this.startDate
        ? orderDate >= new Date(this.startDate)
        : true;
      const matchesEndDate = this.endDate
        ? orderDate <= new Date(this.endDate + 'T23:59:59')
        : true;
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesNameSearch =
        !this.searchByNameQuery ||
        order.name
          .toLowerCase()
          .includes(this.searchByNameQuery.toLowerCase().trim());

      const matchesScheduler =
        !this.selectedScheduler || order.scheduler === this.selectedScheduler;

      const isPrintsFilter = this.showPrints && order.order_type === 'print';
      const isCutsFilter = this.showCuts && order.order_type === 'laser';
      const isSalesFilter = this.showSales && order.order_type === 'sales';

      const matchesType =
        this.vitrineFilterMode === 'only'
          ? order.order_type === 'sales'
          : isPrintsFilter || isCutsFilter || isSalesFilter;

      const allStatusCheckboxesOff =
        !this.showInProgress && !this.showFinished && !this.showDelivered;

      const matchesStatus =
        allStatusCheckboxesOff ||
        (this.showInProgress && order.order_completion_status === 'inProgress') ||
        (this.showFinished && order.order_completion_status === 'finished') ||
        (this.showDelivered && order.order_completion_status === 'delivered');

      const matchesVitrine = (() => {
        switch (this.vitrineFilterMode) {
          case 'only':
            return order.order_type === 'sales' && order.is_vitrine === true;

          case 'exclude':
            return !(order.order_type === 'sales' && order.is_vitrine === true);

          case 'all':
          default:
            return true;
        }
      })();

      if (allTypeCheckboxesOff) {
        return (
          matchesDateRange &&
          matchesNameSearch &&
          matchesScheduler &&
          matchesStatus &&
          matchesVitrine
        );
      }

        return (
          matchesType && matchesDateRange && matchesNameSearch && matchesScheduler && matchesStatus && matchesVitrine
        );
    });

    this.noResultsFound =
      this.searchByNameQuery.trim() !== '' &&
      this.filteredOrdersList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedOrder();
  }

  getUniqueSchedulers(): string[] {
    const schedulers = this.orders.map((o) => o.scheduler).filter(Boolean);
    return Array.from(new Set(schedulers));
  }

  async selectOrder(order: Orders) {
    this.loadingDetails = true;
    this.selectedOrderTypeDetail = [];

    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data;
      }
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data;
      }
    } else if (
      order.order_type === 'venta' ||
      order.order_type === 'sale' ||
      order.order_type === 'sales'
    ) {
      const { data, error } = await this.supabase
        .from('sales')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data || [];
      }
    }

    this.selectedOrderDetails = [
      {
        ...order,
        extra_charges: order.extra_charges || [],
      },
    ];
    this.selectedOrder = order;
    this.loadingDetails = false;
  }

  getUniqueCategories(): string[] {
    return [...new Set(this.allMaterials.map((m) => m.category))];
  }

  getFilteredTypes(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter((m) => m.category === this.selectedCategory)
          .map((m) => m.type)
      ),
    ];
  }

  getFilteredCalibers(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter(
            (m) =>
              m.category === this.selectedCategory &&
              m.type === this.selectedType
          )
          .map((m) => m.caliber)
      ),
    ];
  }

  getFilteredColors(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter(
            (m) =>
              m.category === this.selectedCategory &&
              m.type === this.selectedType &&
              m.caliber === this.selectedCaliber
          )
          .map((m) => m.color)
      ),
    ];
  }

  async toggleOrderConfirmedStatus(order: Orders) {
    order.order_confirmed_status =
      order.order_confirmed_status === 'confirmed'
        ? 'notConfirmed'
        : 'confirmed';
    const { error } = await this.supabase
      .from('orders')
      .update({ order_confirmed_status: order.order_confirmed_status })
      .eq('id_order', order.id_order);
    if (error) {
      console.error(error);
    }
  }

  async toggleOrderCompletionStatus(order: Orders) {
    const newCompletionStatus = order.order_completion_status;
    const newDeliveryStatus =
      newCompletionStatus === 'finished' ? 'Completado' : 'toBeDelivered';

    const { error } = await this.supabase
      .from('orders')
      .update({
        order_completion_status: newCompletionStatus,
        order_delivery_status: newDeliveryStatus,
      })
      .eq('id_order', order.id_order);
    if (error) {
      console.error('Error actualizando estado:', error);
      order.order_completion_status =
        order.order_completion_status === 'finished'
          ? 'inProgress'
          : 'finished';
    } else {
      order.order_delivery_status = newDeliveryStatus;
    }
  }

  async toggleOrderPaymentStatus(order: Orders) {
    const { error } = await this.supabase
      .from('orders')
      .update({ order_payment_status: order.order_payment_status })
      .eq('id_order', order.id_order);
    if (error) {
      console.error('Error actualizando estado:', error);
    }
  }

  toggleAddOrderForm(): void {
    this.isEditing = false;
    if (!this.showModal) {
      this.newOrder = {
        id_order: '',
        order_type: '',
        is_vitrine: false,
        name: '',
        client_type: '',
        description: '',
        order_payment_status: 'overdue',
        created_at: new Date().toISOString(),
        created_time: this.getCurrentTimeHHMM(),
        delivery_date: '',
        order_quantity: '0',
        unitary_value: '',
        iva: '',
        subtotal: '',
        total: '0',
        extra_charges: [],
        amount: '',
        id_client: '',
        order_confirmed_status: 'notConfirmed',
        order_completion_status: 'inProgress',
        order_delivery_status: 'toBeDelivered',
        notes: '',
        file_path: '',
        invoice_file: '',
        scheduler: '',
        discount: 0,
        discount_type: 'fixed',
        requires_e_invoice: false,
      };
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.tempCutTime = 0;
    }
    this.showModal = !this.showModal;
    if (!this.showModal) {
      this.getOrders();
    }
  }

  toggleVitrineFilter(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;

    if (!checked) {
      this.vitrineFilterMode = 'exclude';
    } else if (this.vitrineFilterMode === 'exclude') {
      this.vitrineFilterMode = 'all';
    }

    this.updateFilteredOrders();
  }

  async editOrder(order: Orders): Promise<void> {
    this.isEditing = true;
    this.showModal = true;
    await this.getMaterials();

    this.newOrder = { ...order };

    // Normalize date
    this.newOrder.delivery_date = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : '';

    if (order.order_type === 'laser') {
      this.tempCutTime = Number(order.cutting_time) || 0;
    } else {
      this.tempCutTime = 0; // Limpiar para otros tipos
    }
    // in case extra_charges is not an array
    const extrasArray = Array.isArray(this.newOrder.extra_charges)
      ? this.newOrder.extra_charges
      : [];

    if (!this.newOrder.base_total || isNaN(Number(this.newOrder.base_total))) {
      if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
        this.newOrder.base_total = Number(this.newOrder.subtotal);
      } else {
        const extrasSum = extrasArray.reduce(
          (sum: number, c: any) => sum + (Number(c?.amount) || 0),
          0
        );
        this.newOrder.base_total = Number(this.newOrder.total || 0) - extrasSum;
      }
    }

    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
  }

  async getUserName(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('user_name')
      .eq('id', this.userId)
      .maybeSingle();

    return error || !data ? null : data.user_name;
  }

  async addOrder(newOrderForm: Partial<Orders>): Promise<void> {
    const selectedClient = this.clients.find(
      (client) => client.id_client === newOrderForm.id_client
    );
    newOrderForm.name = selectedClient ? selectedClient.name : '';

    const { data: clientData, error: clientError } = await this.supabase
      .from('clients')
      .select('debt, credit_limit')
      .eq('id_client', newOrderForm.id_client)
      .single();

    if (clientError || !clientData) {
      console.error('Error al obtener detalles del cliente:', clientError);
      alert('Error al verificar el cliente.');
      return;
    }

    const currentDebt = clientData.debt || 0;
    const creditLimit = clientData.credit_limit || 0;
    const orderAmount = parseFloat(newOrderForm.total as string) || 0;
    const newDebt = currentDebt + orderAmount;

    if (creditLimit > 0 && newDebt > creditLimit) {
      const confirmMessage = `El cliente ha excedido su límite de crédito por lo que su deuda actual aumentará en el caso de que el pedido sea autorizado.

      ¿Desea autorizar este pedido de todas formas?`;

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    const baseTotal = parseFloat(newOrderForm.unitary_value as string) || 0;
    const extras =
      newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const total = baseTotal + extras;

    this.newOrder = {
      order_type: newOrderForm.order_type,
      is_vitrine: newOrderForm.is_vitrine ?? false,
      name: newOrderForm.name,
      client_type: newOrderForm.client_type,
      description: newOrderForm.description,
      order_payment_status: newOrderForm.order_payment_status || 'overdue',
      created_at: new Date().toISOString(),
      created_time: this.getCurrentTimeHHMM(),
      delivery_date: newOrderForm.delivery_date,
      order_quantity: newOrderForm.order_quantity,
      unitary_value: baseTotal,
      iva: newOrderForm.iva || 0,
      subtotal: baseTotal,
      total: total,
      amount: newOrderForm.amount || 0,
      cutting_time: newOrderForm.cutting_time || 0,
      id_client: newOrderForm.id_client,
      order_confirmed_status: newOrderForm.order_confirmed_status,
      order_completion_status: newOrderForm.order_completion_status,
      order_delivery_status: newOrderForm.order_delivery_status,
      notes: newOrderForm.notes,
      file_path: newOrderForm.file_path,
      invoice_file: newOrderForm.file_path,
      extra_charges: newOrderForm.extra_charges || [],
      base_total: baseTotal,
      scheduler: (await this.getUserName()) || 'Desconocido',
      requires_e_invoice: newOrderForm.requires_e_invoice ?? false,
    };

    if (this.newOrder.order_type === 'laser') {
      this.newOrder.cutting_time = this.tempCutTime || 0;
    }

    const deliveryDate = newOrderForm.delivery_date
      ? new Date(newOrderForm.delivery_date)
      : new Date();
    const paymentTerm = 30;
    const currentDate = new Date();
    const dueDate = new Date(currentDate);
    dueDate.setDate(dueDate.getDate() + paymentTerm);

    if (this.isEditing) {
      if (!newOrderForm.id_order) {
        console.error('ID del pedido no definido para actualizar.');
        alert('Error: No se puede actualizar un pedido sin ID.');
        return;
      }

      this.newOrder.id_order = newOrderForm.id_order;

      if (this.newOrder.order_type === 'laser') {
        this.newOrder.cutting_time = this.tempCutTime || 0;
      }

      await this.handleFileUploadForOrder(this.newOrder.id_order!);
      this.selectedFile = null;
      this.uploadedFileName = null;

      const { error } = await this.supabase
        .from('orders')
        .update([this.newOrder])
        .eq('id_order', this.newOrder.id_order);

      if (error) {
        console.error('Error al actualizar el pedido:', error);
        alert('Error al actualizar el pedido.');
        return;
      }

      if (this.newOrder.order_type === 'laser') {
        const { data: existingCut } = await this.supabase
          .from('cuts')
          .select('id')
          .eq('id_order', this.newOrder.id_order)
          .maybeSingle();

        if (existingCut) {
          const { error: updateCutError } = await this.supabase
            .from('cuts')
            .update({
              cutting_time: this.tempCutTime,
              unit_price: Number(this.newOrder.unitary_value) || 0,
            })
            .eq('id_order', this.newOrder.id_order);

          if (updateCutError) {
            console.error('Error al actualizar tabla cuts:', updateCutError);
          } else {
            console.log('Registro actualizado en tabla cuts');
          }
        } else {
          const cutRecord = {
            id_order: this.newOrder.id_order,
            category: 'Corte Laser',
            material_type: 'General',
            color: null,
            caliber: null,
            height: null,
            width: null,
            quantity: 1,
            cutting_time: this.tempCutTime,
            unit_price: Number(this.newOrder.unitary_value) || 0,
          };

          const { error: insertCutError } = await this.supabase
            .from('cuts')
            .insert([cutRecord]);

          if (insertCutError) {
            console.error('Error al insertar en tabla cuts:', insertCutError);
          } else {
            console.log('Registro insertado en tabla cuts');
          }
        }
      }

      alert('Pedido actualizado correctamente.');
      this.showModal = false;
      await this.getOrders();
    } else {
      const { data: maxCodeData, error: maxCodeError } = await this.supabase
        .from('orders')
        .select('code')
        .order('code', { ascending: false })
        .limit(1);

      if (maxCodeError) {
        console.error('Error al obtener el código máximo:', maxCodeError);
        alert('Error al generar el código del pedido.');
        return;
      }

      const maxCode =
        maxCodeData && maxCodeData.length > 0 ? maxCodeData[0].code : 0;
      this.newOrder.code = maxCode + 1;

      const { data: insertedOrderData, error: insertError } =
        await this.supabase.from('orders').insert([this.newOrder]).select();

      if (insertError || !insertedOrderData || insertedOrderData.length === 0) {
        console.error('Error al insertar el pedido:', insertError);
        alert('Error al crear el pedido.');
        return;
      }

      const insertedOrder = insertedOrderData[0];

      await this.createInitialPaymentForOrder(insertedOrder, total);

      if (this.newOrder.order_type === 'laser' && this.tempCutTime > 0) {
        const cutRecord = {
          id_order: insertedOrder.id_order,
          category: 'Corte Laser',
          material_type: 'General',
          color: null,
          caliber: null,
          height: null,
          width: null,
          quantity: 1,
          cutting_time: this.tempCutTime,
          unit_price: Number(this.newOrder.unitary_value) || 0,
        };

        const { error: cutError } = await this.supabase
          .from('cuts')
          .insert([cutRecord]);

        if (cutError) {
          console.error('Error al insertar en tabla cuts:', cutError);
        } else {
          console.log('Registro insertado correctamente en tabla cuts');
        }
      }

      await this.handleFileUploadForOrder(insertedOrder.id_order);
      this.selectedFile = null;
      this.uploadedFileName = null;

      const newClientDebt = currentDebt + orderAmount;
      const { error: updateDebtError } = await this.supabase
        .from('clients')
        .update({
          debt: newClientDebt,
          status: newClientDebt > 0 ? 'overdue' : 'upToDate',
        })
        .eq('id_client', newOrderForm.id_client);

      if (updateDebtError) {
        console.error(
          'Error al actualizar la deuda del cliente:',
          updateDebtError
        );
      }

      this.notificationToInsert = {
        type: 'order',
        description: `Nuevo pedido creado: ${this.newOrder.code}`,
        id_order: insertedOrder.id_order,
        due_date: this.newOrder.delivery_date,
        id_user: this.userId,
      };

      const { error: notificationError } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);

      if (notificationError) {
        console.error('Error al crear la notificación:', notificationError);
      }

      const invoiceData = {
        id_order: insertedOrder.id_order,
        code: this.newOrder.code?.toString() || '',
        payment_term: paymentTerm,
        include_iva: false,
        due_date: dueDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        invoice_status: 'overdue',
      };

      const { error: invoiceError } = await this.supabase
        .from('invoices')
        .insert([invoiceData]);

      if (invoiceError) {
        console.error('Error al crear la factura:', invoiceError);
      }

      alert('Pedido creado correctamente.');
      this.showModal = false;
      await this.getOrders();
    }
  }

  async createInitialPaymentForOrder(
    order: Orders,
    totalOrderAmount: number
  ): Promise<void> {
    if (this.initialPaymentType === 'none') return;

    let amountToPay = 0;

    if (this.initialPaymentType === 'full') {
      amountToPay = totalOrderAmount;
    } else {
      amountToPay = this.initialPaymentAmount;
    }

    if (amountToPay <= 0) return;
    if (!this.initialPaymentMethod) return;

    const payment = {
      id_order: order.id_order,
      amount: amountToPay,
      payment_method: this.initialPaymentMethod,
    };

    // Insert payment record
    const { error: paymentError } = await this.supabase
      .from('payments')
      .insert([payment]);

    if (paymentError) {
      console.error('Error al registrar pago inicial:', paymentError);
      return;
    }

    // Update client debt
    const { data: clientData } = await this.supabase
      .from('clients')
      .select('debt')
      .eq('id_client', order.id_client)
      .single();

    const currentDebt = clientData?.debt || 0;
    const newDebt = Math.max(currentDebt - amountToPay, 0);

    await this.supabase
      .from('clients')
      .update({
        debt: newDebt,
        status: newDebt > 0 ? 'overdue' : 'upToDate',
      })
      .eq('id_client', order.id_client);

    // Update order payment status
    const remainingOrderBalance = totalOrderAmount - amountToPay;

    const paymentStatus = remainingOrderBalance <= 0 ? 'upToDate' : 'overdue';

    await this.supabase
      .from('orders')
      .update({ order_payment_status: paymentStatus })
      .eq('id_order', order.id_order);
    // Update invoice payment status
    await this.supabase
      .from('invoices')
      .update({ invoice_status: paymentStatus })
      .eq('id_order', order.id_order);
  }

  // Función para calcular el subtotal dinámicamente
  getCalculatedSubtotal(order: Orders): number {
    if (!order) return 0;

    if (typeof order.base_total === 'number' && !isNaN(order.base_total)) {
      return order.base_total;
    }

    // Si el subtotal ya está guardado correctamente (no es 0), úsalo
    const storedSubtotal = parseFloat(order.subtotal as string) || 0;
    if (!isNaN(storedSubtotal) && storedSubtotal > 0) {
      return storedSubtotal;
    }

    // Si el subtotal es 0, calcularlo: Total - Cargos Extras
    const total = parseFloat(order.total as string) || 0;
    const extras =
      order.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const base = total - extras;

    return base;
  }

  addExtraCharge(): void {
    if (this.extraChargeDescription && this.extraChargeAmount > 0) {
      if (!this.newOrder.extra_charges) {
        this.newOrder.extra_charges = [];
      }

      // Asegurarse de tener base_total correcto
      if (!this.newOrder.base_total || this.newOrder.base_total === 0) {
        // Primero intentar obtener desde subtotal
        if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
          this.newOrder.base_total = Number(this.newOrder.subtotal);
        }
        // Si no hay subtotal, calcular desde el total QUITANDO los extras existentes
        else {
          const currentTotal = parseFloat(this.newOrder.total as string) || 0;
          const existingExtras =
            this.newOrder.extra_charges?.reduce(
              (sum, c) => sum + c.amount,
              0
            ) || 0;

          // Fórmula: base_total = total - extras
          this.newOrder.base_total = currentTotal - existingExtras;
        }
      }

      // Calcular el monto del cargo según el tipo CON REDONDEO
      let chargeAmount = this.extraChargeAmount;

      if (this.extraChargeType === 'percentage') {
        const base = this.newOrder.base_total || 0;
        chargeAmount = Math.round((base * this.extraChargeAmount) / 100);
      } else {
        chargeAmount = Math.round(this.extraChargeAmount);
      }

      this.newOrder.extra_charges.push({
        description: this.extraChargeDescription,
        amount: chargeAmount,
        type: this.extraChargeType,
      });

      this.extraChargeDescription = '';
      this.extraChargeAmount = 0;
      this.extraChargeType = 'fixed';

      // Recalcular total con el nuevo cargo
      this.updateOrderTotalWithExtras();
    }
  }

  removeExtraCharge(index: number): void {
    this.newOrder.extra_charges?.splice(index, 1);
    this.updateOrderTotalWithExtras();
  }

  updateOrderTotalWithExtras(): void {
    const baseTotal = Number(this.newOrder.unitary_value) || 0;
    const extras =
      this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    this.newOrder.total = baseTotal + extras;
    this.newOrder.subtotal = baseTotal;
    this.newOrder.base_total = baseTotal;
  }

  async createNotification(addedOrder: Partial<Orders>) {
    this.notificationDesc =
      'Nuevo pedido: ' +
      addedOrder.description +
      '. Codigo: ' +
      addedOrder.code;
    if (addedOrder.order_type == 'print') {
      this.notificationToInsert = {
        id_user: null,
        id_order: addedOrder.id_order,
        description: this.notificationDesc,
        type: 'prints',
        due_date: addedOrder.created_at,
      };
      const { error } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);
      if (error) {
        console.error('Error creating notification', error);
        return;
      }
    } else if (addedOrder.order_type == 'laser') {
      this.notificationToInsert = {
        id_user: null,
        id_order: addedOrder.id_order,
        description: this.notificationDesc,
        type: 'cuts',
        due_date: addedOrder.created_at,
      };

      const { error } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);
      if (error) {
        console.error('Error creating notification', error);
        return;
      }
    }
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedOrder(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredOrdersList.length / this.itemsPerPage)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedOrders = this.filteredOrdersList.slice(startIndex, endIndex);
  }

  public getRemainingDeliveryDays(order: Orders): number {
    if (!order.delivery_date) return 0;

    const now = new Date();
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(23, 59, 59, 999);

    const diffTime = deliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysRemainingLabel(order: Orders): string {
    if (order.order_completion_status !== 'inProgress') {
      return 'Completo';
    }

    const days = this.getRemainingDeliveryDays(order);
    return days > 0 ? `${days} días` : 'Vencido';
  }

  getDaysRemainingClass(order: Orders): string {
    if (order.order_completion_status !== 'inProgress') {
      return 'text-green-600';
    }

    return this.getRemainingDeliveryDays(order) > 0
      ? 'text-blue-600'
      : 'text-red-600';
  }

  public getRemainingDeliveryHours(order: Orders): number {
    if (!order.delivery_date) return 0;

    const now = new Date();
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(23, 59, 59, 999);

    const diffTime = deliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }

  public getFormattedDeliveryTime(order: Orders): string {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);

    if (days <= 0 && hours <= 0) return 'Vencido';
    if (days === 1) return `${hours}h restantes`;
    return `${days} días`;
  }

  public isDeliveryOverdue(order: Orders): boolean {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);
    return days <= 0 && hours <= 0;
  }

  public isDeliveryLastDay(order: Orders): boolean {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);
    return days === 1 && hours > 0;
  }

  public hasMultipleDeliveryDays(order: Orders): boolean {
    return this.getRemainingDeliveryDays(order) > 1;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  onInvoiceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedInvoiceFile = input.files[0];
    }
  }

  async uploadOrderFile(orderId: string, filePath: string, file: File) {
    if (!this.selectedFile || !orderId) return;

    await this.supabase.uploadFile(filePath, file, 'order-files');

    this.uploadedFileName = file.name;
    this.selectedFile = null;
  }

async downloadFile(filePath: string) {
    if (!filePath) return;

    const { data, error } = await this.supabase.downloadFile(
      filePath,
      'order-files'
    );

    if (error || !data?.signedUrl) {
      console.error('error downloading image: ', error);
      return;
    }

    // get the file name from the path
    const fileName = filePath.split('/').pop() || 'archivo';
    const downloadUrl = `${data.signedUrl}&download=${encodeURIComponent(fileName)}`;

    // trigger the download
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.setAttribute('download', fileName);
    
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  getCategories(): string[] {
    const categories = this.allMaterials
      .map((m) => m.category)
      .filter((c) => c);
    return [...new Set(categories)];
  }

  getTypes(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    const types = filtered.map((m) => m.type).filter((t) => t);
    return [...new Set(types)];
  }

  getCalibers(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    if (this.selectedType) {
      filtered = filtered.filter((m) => m.type === this.selectedType);
    }

    const calibers = filtered.map((m) => m.caliber || '');
    return [...new Set(calibers)];
  }

  getColors(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    if (this.selectedType) {
      filtered = filtered.filter((m) => m.type === this.selectedType);
    }
    if (this.selectedCaliber !== undefined && this.selectedCaliber !== null) {
      filtered = filtered.filter((m) => {
        const matCaliber = m.caliber || '';
        return matCaliber === this.selectedCaliber;
      });
    }

    const colors = filtered.map((m) => m.color || '');
    return [...new Set(colors)];
  }

  getSelectedMaterial(): any | null {
    if (
      !this.selectedCategory ||
      !this.selectedType ||
      this.selectedCaliber === undefined ||
      this.selectedCaliber === null ||
      this.selectedColor === undefined ||
      this.selectedColor === null
    ) {
      return null;
    }

    return (
      this.allMaterials.find((m) => {
        const categoryMatch = m.category === this.selectedCategory;
        const typeMatch = m.type === this.selectedType;

        // Normalize strings to empty if null/undefined
        const matCaliber = m.caliber || '';
        const matColor = m.color || '';

        const caliberMatch = matCaliber === this.selectedCaliber;
        const colorMatch = matColor === this.selectedColor;

        return categoryMatch && typeMatch && caliberMatch && colorMatch;
      }) || null
    );
  }

  clearFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.searchByNameQuery = '';
    this.showPrints = true;
    this.showCuts = true;
    this.showSales = true;
    this.showInProgress = true;
    this.showFinished = true;
    this.showDelivered = true;
    this.vitrineFilterMode = 'all';
    this.searchQuery = '';
    this.selectedScheduler = '';
    this.updateFilteredOrders();
  }
  private async handleFileUploadForOrder(orderId: string): Promise<void> {
    if (this.selectedFile) {
      const file = this.selectedFile;
      const filePath = `${orderId}/work/${Date.now()}_${file.name}`;

      await this.uploadOrderFile(orderId, filePath, file);

      await this.supabase
        .from('orders')
        .update({ file_path: filePath })
        .eq('id_order', orderId);

      this.newOrder.file_path = filePath;
      this.selectedFile = null;
    }

    if (this.selectedInvoiceFile) {
      const file = this.selectedInvoiceFile;
      const filePath = `${orderId}/invoice/${Date.now()}_${file.name}`;

      await this.uploadOrderFile(orderId, filePath, file);

      await this.supabase
        .from('orders')
        .update({ invoice_file: filePath })
        .eq('id_order', orderId);

      this.newOrder.invoice_file = filePath;
      this.selectedInvoiceFile = null;
    }

    this.uploadedFileName = null;
  }
}

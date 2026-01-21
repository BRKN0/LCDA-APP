import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface Orders {
  id_order: string;
  order_type: string;
  secondary_process?: 'laser' | 'print' | null;
  is_vitrine?: boolean;
  name: string;
  client_type: string;
  code: number;
  description: string;
  order_payment_status: string;
  order_completion_status: string;
  secondary_completed?: boolean;
  order_confirmed_status: string;
  order_delivery_status: string;
  notes: string;
  created_at: string;
  created_time?: string;
  delivery_date: string;
  is_immediate?: boolean;
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
  second_file: string;
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
  include_iva?: boolean;
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

interface ClientSearchResult {
  id_client: string;
  name: string;
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
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit, OnDestroy {
  // finance and calculations
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

  // auth and user info
  userId: string | null = null;
  userRole: string | null = null;
  order_role_filter: string = ''; // Filter applied based on user role

  // data collections
  orders: Orders[] = []; // Master list
  filteredOrdersList: Orders[] = []; // List after filters applied
  paginatedOrders: Orders[] = []; // List currently shown on page
  clients: Client[] = [];
  filteredClients: Client[] = [];
  allMaterials: any[] = [];

  // selection and details
  selectedOrder: Orders | null = null;
  selectedOrderDetails: Orders[] | null = null; // Full details fetched on demand
  selectedOrderTypeDetail: any | null = null; // Specific details (Prints/Cuts/Sales)
  order: Orders | null = null; // Temp reference
  selectedPayment: Payment | null = null;

  // search and filters
  searchQuery: string = ''; // Search by Code
  searchByNameQuery: string = ''; // Search by Client Name
  startDate: string = '';
  endDate: string = '';
  selectedScheduler: string = '';
  clientSearch: string = '';
  clientSearchResults: ClientSearchResult[] = [];
  selectedClient: ClientSearchResult | null = null;
  isSearchingClients = false;
  clientTypedButNotSelected = false;
  clientInvalid = false;

  // checkbox filters
  showPrints: boolean = true;
  showCuts: boolean = true;
  showSales: boolean = true;
  vitrineFilterMode: 'all' | 'only' | 'exclude' = 'all';

  // status filters
  showInProgress = true;
  showFinished = true;
  showDelivered = true;

  noResultsFound: boolean = false;
  private searchSubject = new Subject<void>();

  // pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  // forms and modals state visibility Flags
  showModal: boolean = false; // Main Order Modal
  showAddClientModal = false;
  showEditPayment: boolean = false;
  showStockWarningModal = false;
  stockWarningMessage = '';

  // operation state flags
  isEditing: boolean = false;
  isSavingOrder: boolean = false;
  isSavingClient: boolean = false;
  loading: boolean = true; // Main table loader
  loadingDetails: boolean = true; // Details modal loader

  // form models
  newOrder: Partial<Orders> = {};
  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '0',
    cellphone: '0',
    address: '',
    status: '',
  };
  // partials (unused?)
  newCut: Partial<Cuts> = {};
  newPrint: Partial<Prints> = {};

  // form specific fields
  requires_e_invoice: boolean = false;
  tempCutTime: number = 0;

  // Vitrine sales items
  salesItems: {
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    stock?: number;
  }[] = [];

  allProducts: {
    id: string;
    name: string;
    price: number;
    cost: number;
    stock: number;
    category: string;
  }[] = [];

  selectedVitrineProductId: string | null = null;
  vitrineSalesDetails: any[] = [];
  vitrineProductSearch = '';
  filteredVitrineProducts: any[] = [];

  // form helpers for extra charges and initial payments
  extraChargeDescription: string = '';
  extraChargeAmount: number = 0;
  extraChargeType: 'fixed' | 'percentage' = 'fixed';

  initialPaymentType: 'none' | 'full' | 'partial' = 'none';
  initialPaymentAmount: number = 0;
  initialPaymentMethod: string = '';
  newPaymentAmount: number = 0;

  // file uploads
  selectedFile: File | null = null;
  uploadedFileName: string | null = null;
  uploadedFilePath: string | null = null;
  selectedInvoiceFile: File | null = null;
  selectedSecondaryFile: File | null = null;

  // dropdown selections for materials inside forms
  selectedCategory: string = '';
  selectedType: string = '';
  selectedCaliber: string = '';
  selectedColor: string = '';

  // notifications
  notificationMessage: string | null = null; // Toast message
  notificationToInsert: Partial<Notifications> = {};
  notificationDesc: string = '';
  orderToInsert: Partial<Orders> = {};

  // lifecycle and subscriptions
  private destroy$ = new Subject<void>();
  private isOrdersLoaded = false; // prevents double loading on auth events

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService
  ) { }

  async ngOnInit(): Promise<void> {
    // listen for auth changes once
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          // if the user changed, reset the "loaded" flag
          if (this.userId !== session.user.id) {
            this.userId = session.user.id;
            this.isOrdersLoaded = false;

            // load auxiliary data in parallel
            this.getClients();
            this.getMaterials();
            this.getVariables();
            this.getProducts();

            // fetch Role
            this.roleService.fetchAndSetUserRole(this.userId);
          }
        });
      }
    });

    // subscribe to role separately to prevent duplicate calls
    this.roleService.role$.pipe(takeUntil(this.destroy$)).subscribe((role) => {
      this.zone.run(() => {
        this.userRole = role;
        if (role && !this.isOrdersLoaded) {
          this.getOrders();
        }
      });
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    // prevent overlapping calls
    if (this.loading && this.orders.length > 0) return;
    this.loading = true;
    // SELECT ONLY THE COLUMNS NEEDED FOR THE TABLE
    let query = this.supabase.from('orders').select(`
        id_order, code, order_type, name, scheduler,
        order_payment_status, order_completion_status, order_confirmed_status, order_delivery_status,
        created_at, created_time, delivery_date, is_immediate,
        total, client_type, secondary_process, secondary_completed, is_vitrine,
        payments(amount)
      `);

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
      if (this.order_role_filter) {
        query = query.or(
          `order_type.eq.${this.order_role_filter},secondary_process.eq.${this.order_role_filter}`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener los pedidos:', error);
      this.loading = false;
      return;
    }
    this.orders = data as Orders[];
    this.orders.sort((a, b) => b.code - a.code);
    this.updateFilteredOrders();
    this.loading = false;
    this.isOrdersLoaded = true;
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
    if (this.isSavingClient) return;
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }

    this.isSavingClient = true;

    try {
      const clientToSave = {
        ...this.newClient,
        name: this.newClient.name.toUpperCase().trim(),
      };

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
    } finally {
      this.isSavingClient = false;
    }
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
  deletingOrderId: string | null = null;
  async deleteOrder(order: Orders): Promise<void> {
    if (this.deletingOrderId === order.id_order) return;

    const confirmed = confirm(`¿Eliminar orden #${order.code}?`);
    if (!confirmed) return;

    this.deletingOrderId = order.id_order;

    // restore stock only for vitrine sales orders
    if (order.order_type === 'sales' && order.is_vitrine === true) {
      const ok = await this.resetVitrineSalesForOrder(order.id_order);
      if (!ok) {
        alert('Error restoring stock for vitrine sale.');
        return;
      }
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
      this.orders = this.orders.filter(
        (o) => o.id_order !== order.id_order
      );
      this.updateFilteredOrders();

      this.showNotification('Orden eliminada correctamente.');
    } catch (error) {
      console.error('Error inesperado al eliminar la orden:', error);
      this.showNotification('Ocurrió un error inesperado.');
    } finally {
      this.deletingOrderId = null;
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
      !this.showPrints &&
      !this.showCuts &&
      !this.showSales &&
      this.vitrineFilterMode !== 'only';

    this.filteredOrdersList = this.orders.filter((order) => {
      const normalizeDate = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const orderDate = normalizeDate(new Date(order.created_at));
      const matchesStartDate = this.startDate
        ? orderDate >= normalizeDate(new Date(this.startDate))
        : true;
      const matchesEndDate = this.endDate
        ? orderDate <= normalizeDate(new Date(this.endDate))
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
        (this.showInProgress &&
          order.order_completion_status === 'inProgress') ||
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
        matchesType &&
        matchesDateRange &&
        matchesNameSearch &&
        matchesScheduler &&
        matchesStatus &&
        matchesVitrine
      );
    });

    if (this.userRole !== 'admin' && this.userRole !== 'scheduler') {
      this.filteredOrdersList = this.filteredOrdersList.sort((a, b) => {
        const aInProgress = a.order_completion_status === 'inProgress';
        const bInProgress = b.order_completion_status === 'inProgress';

        if (aInProgress !== bInProgress) {
          return aInProgress ? -1 : 1;
        }

        if (a.is_immediate !== b.is_immediate) {
          return a.is_immediate ? -1 : 1;
        }

        const daysA = this.getRemainingDeliveryDays(a);
        const daysB = this.getRemainingDeliveryDays(b);

        if (daysA !== daysB) {
          return daysA - daysB;
        }

        return b.code - a.code;
      });
    }
    this.noResultsFound =
      this.searchByNameQuery.trim() !== '' &&
      this.filteredOrdersList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedOrder();
  }

  async searchClients(term: string): Promise<void> {
    const value = term.trim().toLowerCase();

    if (value.length < 1) {
      this.clientSearchResults = [];
      return;
    }

    this.isSearchingClients = true;

    const { data, error } = await this.supabase
      .from('clients')
      .select('id_client, name')
      .ilike('name', `%${value}%`)
      .limit(20);

    this.isSearchingClients = false;

    if (error || !data) {
      console.error('Error searching clients:', error);
      this.clientSearchResults = [];
      return;
    }

    this.clientSearchResults = data
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aStarts = aName.startsWith(value);
        const bStarts = bName.startsWith(value);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return aName.localeCompare(bName);
      })
      .slice(0, 10);
  }

  selectClient(client: ClientSearchResult): void {
    this.selectedClient = client;
    this.newOrder.id_client = client.id_client;
    this.clientSearch = client.name;
    this.clientSearchResults = [];
    this.clientTypedButNotSelected = false;
    this.clientInvalid = false;
  }

  onClientInput(value: string): void {
    this.clientSearch = value;

    // Invalida selección previa
    this.selectedClient = null;
    this.newOrder.id_client = undefined;

    this.clientInvalid = false;
    this.clientTypedButNotSelected = value.trim().length > 0;

    this.searchClients(value);
  }

  onClientBlur(): void {
    setTimeout(() => {
      if (!this.selectedClient) {
        this.autoSelectExactMatch();
      }

      this.clientSearchResults = [];
    }, 150);
  }

  autoSelectExactMatch(): void {
    const value = this.clientSearch?.trim().toLowerCase();
    if (!value) return;

    const matches = this.clients.filter(
      c => c.name.trim().toLowerCase() === value
    );

    if (matches.length === 1) {
      this.selectClient(matches[0]);
    }
  }

  validateClientBeforeSave(): boolean {
    if (!this.selectedClient || !this.newOrder.id_client) {
      this.clientInvalid = true;
      return false;
    }
    return true;
  }

  getUniqueSchedulers(): string[] {
    const schedulers = this.orders.map((o) => o.scheduler).filter(Boolean);
    return Array.from(new Set(schedulers));
  }

  isVitrineSale(): boolean {
    return (
      this.newOrder?.order_type === 'sales' &&
      this.newOrder?.is_vitrine === true
    );
  }

  async getProducts(): Promise<void> {
    const { data, error } = await this.supabase
      .from('products')
      .select('id, name, price, cost, stock, category');

    if (error) {
      console.error('Error al cargar productos:', error);
      return;
    }
    this.allProducts = data || [];
  }

  addVitrineProduct(product: any, quantity: number, unitPrice?: number): void {
    if (!this.isVitrineSale()) {
      return;
    }

    if (!product || quantity <= 0) {
      return;
    }

    const price = unitPrice !== undefined ? unitPrice : Number(product.price);

    const existingIndex = this.salesItems.findIndex(
      (i) => i.product_id === product.id
    );

    if (existingIndex >= 0) {
      // Update existing item
      this.salesItems[existingIndex].quantity += quantity;
      this.salesItems[existingIndex].unit_price = price;
      this.salesItems[existingIndex].subtotal =
        this.salesItems[existingIndex].quantity * price;
    } else {
      // Add new item
      this.salesItems.push({
        product_id: product.id,
        name: product.name,
        quantity: quantity,
        unit_price: price,
        subtotal: quantity * price,
        stock: Number(product.stock),
      });
    }

    this.recalcVitrineTotals();
  }

  addSelectedVitrineProduct(): void {
    if (!this.selectedVitrineProductId) {
      return;
    }

    const product = this.allProducts.find(
      p => p.id === this.selectedVitrineProductId
    );

    if (!product) {
      return;
    }

    this.addVitrineProduct(product, 1);
    this.selectedVitrineProductId = null;
  }

  recalcVitrineTotals(): void {
    let total = 0;

    for (const item of this.salesItems) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;

      item.subtotal = qty * price;
      total += item.subtotal;
    }

    // vitrine rules: unitary_value mirrors base_total
    this.newOrder.base_total = total;
    this.newOrder.unitary_value = total;

    this.updateOrderTotalWithExtras();
  }

  validateVitrineBeforeSave(): boolean {
    if (!this.isVitrineSale()) {
      return true;
    }

    if (this.salesItems.length === 0) {
      alert('Vitrine sale requires at least one product.');
      this.newOrder.is_vitrine = false;
      return false;
    }

    return true;
  }

  async saveVitrineSales(orderId: string): Promise<boolean> {
    let hasStockIssues = false;
    let totalPendingQty = 0;

    for (const item of this.salesItems) {
      const { data: prodData, error: prodErr } = await this.supabase
        .from('products')
        .select('stock, category')
        .eq('id', item.product_id)
        .single();

      if (prodErr || !prodData) {
        alert('Unable to read product stock.');
        return false;
      }

      const currentStock = Number(prodData.stock);
      const requestedQty = item.quantity;

      let fulfilledQty = 0;
      let pendingQty = 0;

      if (currentStock >= requestedQty) {
        fulfilledQty = requestedQty;
      } else {
        fulfilledQty = currentStock;
        pendingQty = requestedQty - currentStock;
        hasStockIssues = true;
        totalPendingQty += pendingQty;
      }

      const newStock = Math.max(currentStock - fulfilledQty, 0);

      await this.supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.product_id);

      const saleRow = {
        id_order: orderId,
        item_type: 'product',
        product_id: item.product_id,
        material_id: null,
        quantity: requestedQty,
        fulfilled_quantity: fulfilledQty,
        pending_quantity: pendingQty,
        unit_price: item.unit_price,
        line_total: item.subtotal,
        category: prodData.category,
      };

      const { error: insertErr } = await this.supabase
        .from('sales')
        .insert([saleRow]);

      if (insertErr) {
        return false;
      }
    }

    const stockStatus = hasStockIssues
      ? totalPendingQty ===
        this.salesItems.reduce((s, i) => s + i.quantity, 0)
        ? 'pending_stock'
        : 'partially_fulfilled'
      : 'fulfilled';

    await this.supabase
      .from('orders')
      .update({
        stock_status: stockStatus,
        pending_quantity: totalPendingQty,
      })
      .eq('id_order', orderId);
    
    // show warning if there is pending stock
    if (hasStockIssues && totalPendingQty > 0) {
      this.stockWarningMessage =
        `Algunos productos no cuentan con el suficiente stock.\n` +
        `Cantidad pendiente: ${totalPendingQty}`;

      this.showStockWarningModal = true;
    }

    return true;
  }

  async resetVitrineSalesForOrder(orderId: string): Promise<boolean> {
    // delete existing sales rows for the order
    const { data: existingSales, error: fetchError } = await this.supabase
      .from('sales')
      .select('product_id, fulfilled_quantity')
      .eq('id_order', orderId);

    if (fetchError) {
      console.error('Error fetching existing sales:', fetchError);
      return false;
    }

    // restore stock based on fulfilled quantities
    for (const row of existingSales || []) {
      if (!row.product_id || !row.fulfilled_quantity) continue;

      const { data: product } = await this.supabase
        .from('products')
        .select('stock')
        .eq('id', row.product_id)
        .single();

      if (product) {
        const restoredStock =
          Number(product.stock) + Number(row.fulfilled_quantity);

        await this.supabase
          .from('products')
          .update({ stock: restoredStock })
          .eq('id', row.product_id);
      }
    }

    // delete sales rows
    const { error: deleteError } = await this.supabase
      .from('sales')
      .delete()
      .eq('id_order', orderId);

    if (deleteError) {
      console.error('Error deleting sales rows:', deleteError);
      return false;
    }

    return true;
  }

  filterVitrineProducts(): void {
    const query = this.vitrineProductSearch.toLowerCase().trim();

    if (!query) {
      this.filteredVitrineProducts = [];
      return;
    }

    this.filteredVitrineProducts = this.allProducts.filter(p =>
      p.name.toLowerCase().includes(query)
    );
  }

  selectVitrineProduct(product: any): void {
    this.addVitrineProduct(product, 1);
    this.vitrineProductSearch = '';
    this.filteredVitrineProducts = [];
  }

  removeVitrineItem(index: number): void {
    if (index < 0 || index >= this.salesItems.length) {
      return;
    }

    this.salesItems.splice(index, 1);
    this.recalcVitrineTotals();
  }

  closeStockWarningModal(): void {
    this.showStockWarningModal = false;
    this.stockWarningMessage = '';
  }

  async selectOrder(order: Orders) {
    this.loadingDetails = true;
    this.selectedOrderTypeDetail = [];

    try {
      // fetch the full details order data from the database
      const { data: fullOrderData, error: orderError } = await this.supabase
        .from('orders')
        .select('*')
        .eq('id_order', order.id_order)
        .single();

      if (orderError || !fullOrderData) {
        console.error('Error loading full order details:', orderError);
        this.showNotification('Error al cargar los detalles del pedido');
        this.loadingDetails = false;
        return;
      }

      // fetch the specific details based on type
      if (fullOrderData.order_type === 'print') {
        const { data, error } = await this.supabase
          .from('prints')
          .select('*')
          .eq('id_order', order.id_order);

        if (error) {
          console.error('Error fetching prints:', error);
        } else {
          this.selectedOrderTypeDetail = data;
        }
      } else if (fullOrderData.order_type === 'laser') {
        const { data, error } = await this.supabase
          .from('cuts')
          .select('*')
          .eq('id_order', order.id_order);

        if (error) {
          console.error('Error fetching cuts:', error);
        } else {
          this.selectedOrderTypeDetail = data;
        }
      } else if (
        fullOrderData.order_type === 'venta' ||
        fullOrderData.order_type === 'sale' ||
        fullOrderData.order_type === 'sales'
      ) {
        const { data, error } = await this.supabase
          .from('sales')
          .select('*')
          .eq('id_order', order.id_order);

        if (error) {
          console.error('Error fetching sales:', error);
        } else {
          this.selectedOrderTypeDetail = data || [];
        }
      }

      // update the component state with the full data
      this.selectedOrder = fullOrderData as Orders;

      this.selectedOrderDetails = [
        {
          ...fullOrderData,
          // ensure extra_charges is an array to prevent UI errors
          extra_charges: fullOrderData.extra_charges || [],
        },
      ];

      // load vitrine sales details if order is a vitrine sale
      this.vitrineSalesDetails = [];

      if (
        order.order_type === 'sales' &&
        order.is_vitrine === true
      ) {
        const { data, error } = await this.supabase
          .from('sales')
          .select(`
            quantity,
            unit_price,
            line_total,
            products ( name )
          `)
          .eq('id_order', order.id_order);

        if (error) {
          console.error('Error loading vitrine sales details:', error);
        } else {
          this.vitrineSalesDetails = data || [];
        }
      }
    } catch (err) {
      console.error('Unexpected error in selectOrder:', err);
    } finally {
      this.loadingDetails = false;
    }
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

    const canOverrideSecondary =
      this.userRole === 'admin' || this.userRole === 'scheduler';

    if (
      order.secondary_process &&
      !order.secondary_completed &&
      (newCompletionStatus === 'finished' || newCompletionStatus === 'delivered') &&
      !canOverrideSecondary
    ) {
      alert('Este pedido tiene un proceso secundario pendiente y no puede ser completado aún.');
      order.order_completion_status = 'inProgress';
      return;
    }

    const newDeliveryStatus =
      newCompletionStatus === 'finished' || newCompletionStatus === 'delivered'
        ? 'Completado'
        : 'toBeDelivered';

    const newConfirmedStatus =
      newCompletionStatus === 'finished' || newCompletionStatus === 'delivered'
        ? 'confirmed'
        : 'notConfirmed';

    const updatePayload: any = {
      order_completion_status: newCompletionStatus,
      order_delivery_status: newDeliveryStatus,
      order_confirmed_status: newConfirmedStatus,
    };

    if (
      canOverrideSecondary &&
      order.secondary_process &&
      !order.secondary_completed &&
      (newCompletionStatus === 'finished' || newCompletionStatus === 'delivered')
    ) {
      updatePayload.secondary_completed = true;
    }

    const { error } = await this.supabase
      .from('orders')
      .update(updatePayload)
      .eq('id_order', order.id_order);

    if (error) {
      console.error('Error actualizando estado:', error);
      order.order_completion_status = 'inProgress';
      return;
    }
    order.order_delivery_status = newDeliveryStatus;
    order.order_confirmed_status = newConfirmedStatus;
    if (updatePayload.secondary_completed) {
      order.secondary_completed = true;
    }   
  }

  async markSecondaryCompleted(order: Orders) {
    const { error } = await this.supabase
      .from('orders')
      .update({ secondary_completed: true })
      .eq('id_order', order.id_order);

    if (error) {
      console.error('Error updating secondary process:', error);
      return;
    }

    // the db trigger handles the 'process' notification automatically
    order.secondary_completed = true;
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
        secondary_process: null,
        is_vitrine: false,
        name: '',
        client_type: '',
        description: '',
        order_payment_status: 'overdue',
        created_at: new Date().toISOString(),
        created_time: this.getCurrentTimeHHMM(),
        delivery_date: '',
        is_immediate: false,
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
        secondary_completed: false,
        notes: '',
        file_path: '',
        invoice_file: '',
        second_file: '',
        scheduler: '',
        discount: 0,
        discount_type: 'fixed',
        requires_e_invoice: false,
        include_iva: false,
      };
      this.clientSearch = '';
      this.clientSearchResults = [];
      this.selectedClient = null;
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.tempCutTime = 0;
      this.salesItems = [];
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

    // fetch full order details
    const { data: fullOrder, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('id_order', order.id_order)
      .single();

    if (error || !fullOrder) {
      console.error('Error loading order for editing:', error);
      this.showNotification('Error al cargar los datos del pedido');
      return;
    }

    this.showModal = true;
    await this.getMaterials();

    // populate form with full order data
    this.newOrder = { ...fullOrder } as Orders;

    // load vitrine sales items when editing
    if (
      this.newOrder.order_type === 'sales' &&
      this.newOrder.is_vitrine === true
    ) {
      const { data: salesData, error: salesError } = await this.supabase
        .from('sales')
        .select('product_id, quantity, unit_price, line_total')
        .eq('id_order', this.newOrder.id_order);

      if (salesError) {
        console.error('Error loading vitrine sales:', salesError);
      } else {
        this.salesItems = salesData.map((row: any) => ({
          product_id: row.product_id,
          name: '',
          quantity: Number(row.quantity) || 0,
          unit_price: Number(row.unit_price) || 0,
          subtotal: Number(row.line_total) || 0,
        }));
      }
    } else {
      this.salesItems = [];
    }

    // enrich vitrine items with product names
    if (this.salesItems.length > 0) {
      await this.getProducts();

      for (const item of this.salesItems) {
        const product = this.allProducts.find(p => p.id === item.product_id);
        if (product) {
          item.name = product.name;
          item.stock = product.stock;
        }
      }
    }

    if (this.newOrder.id_client) {
      const { data: client, error: clientError } = await this.supabase
        .from('clients')
        .select('name')
        .eq('id_client', this.newOrder.id_client)
        .single();

      if (!clientError && client) {
        this.clientSearch = client.name;
      } else {
        this.clientSearch = '';
      }
    }

    // normalize date
    this.newOrder.delivery_date = fullOrder.delivery_date
      ? fullOrder.delivery_date.slice(0, 10)
      : '';

    if (fullOrder.order_type === 'laser') {
      this.tempCutTime = Number(fullOrder.cutting_time) || 0;
    } else {
      this.tempCutTime = 0;
    }

    // in case extra_charges is not an array
    const extrasArray = Array.isArray(this.newOrder.extra_charges)
      ? this.newOrder.extra_charges
      : [];
    this.newOrder.extra_charges = extrasArray;

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

    if (this.isVitrineSale()) {
      this.recalcVitrineTotals();
    }

    // reset dropdowns
    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
    this.clientSearchResults = [];
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
    this.isSavingOrder = true;

    try {
      if (!this.selectedClient) {
        this.autoSelectExactMatch();
      }

      if (!this.selectedClient) {
        alert('Error interno: cliente no resuelto.');
        return;
      }

      newOrderForm.name = this.selectedClient.name;

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

    // Vitrine validation before creating order
    if (!this.validateVitrineBeforeSave()) {
      return;
    }

    if (this.isVitrineSale()) {
      this.recalcVitrineTotals();
    }

    if (this.newOrder.order_type === '') {
      alert('Por favor, seleccione un tipo de pedido.');
      return;
    }

      // calculations
      let baseTotal = 0;

      // Vitrine logic: base total comes from sales items
      if (this.isVitrineSale()) {
        baseTotal = this.salesItems.reduce(
          (sum, item) => sum + Number(item.subtotal || 0),
          0
        );
      } else {
        baseTotal = parseFloat(newOrderForm.unitary_value as string) || 0;
      }

      const extras =
        newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

      let total = baseTotal + extras;

      if (newOrderForm.include_iva) {
        const ivaAmount = total * (this.variables.iva / 100);
        total = total + ivaAmount;
      }
      
      if (newOrderForm.include_iva) {
        const ivaAmount = total * (this.variables.iva / 100);
        total = total + ivaAmount;
      }

      // object construction
      // set code to 0 initially, db ignores it on creation, please do NOT remove or you will break everything AGAIN
      this.newOrder = {
        order_type: newOrderForm.order_type!,
        secondary_process: newOrderForm.secondary_process ?? null,
        is_vitrine: newOrderForm.is_vitrine ?? false,
        name: newOrderForm.name!,
        client_type: newOrderForm.client_type!,
        description: newOrderForm.description?.toUpperCase() || '',
        order_payment_status: newOrderForm.order_payment_status || 'overdue',
        created_at: new Date().toISOString(),
        created_time: this.getCurrentTimeHHMM(),
        delivery_date: newOrderForm.delivery_date || new Date().toISOString(), // someone change this line to 'delivery_date: newOrderForm.delivery_date!,' if the user CAN'T leave it empty
        is_immediate: newOrderForm.is_immediate || false,
        order_quantity: newOrderForm.order_quantity!,
        unitary_value: baseTotal,
        iva: newOrderForm.iva || 0,
        subtotal: baseTotal,
        total: total,
        amount: newOrderForm.amount || 0,
        cutting_time: newOrderForm.cutting_time || 0,
        id_client: newOrderForm.id_client!,
        order_confirmed_status: newOrderForm.order_confirmed_status!,
        order_completion_status: newOrderForm.order_completion_status!,
        order_delivery_status: newOrderForm.order_delivery_status!,
        secondary_completed: newOrderForm.secondary_completed || false,
        notes: newOrderForm.notes!,
        file_path: newOrderForm.file_path!,
        invoice_file: newOrderForm.invoice_file!,
        second_file: newOrderForm.second_file!,
        extra_charges: newOrderForm.extra_charges || [],
        base_total: baseTotal,
        requires_e_invoice: newOrderForm.requires_e_invoice ?? false,
        include_iva: newOrderForm.include_iva ?? false,
        scheduler: (await this.getUserName()) || 'Desconocido',
        code: 0, 
        discount: newOrderForm.discount || 0,
        discount_type: newOrderForm.discount_type || 'percentage'
      };

    if (this.newOrder.order_type === 'laser') {
      this.newOrder.cutting_time = this.tempCutTime || 0;
    }


      const paymentTerm = 30;
      const currentDate = new Date();
      const dueDate = new Date(currentDate);
      dueDate.setDate(dueDate.getDate() + paymentTerm);

      // logic for editing (update)
      if (this.isEditing) {
        if (!newOrderForm.id_order) {
          console.error('ID del pedido no definido para actualizar.');
          alert('Error: No se puede actualizar un pedido sin ID.');
          return;
        }

        this.newOrder.id_order = newOrderForm.id_order;
        // keep existing code when editing
        this.newOrder.code = newOrderForm.code!;

        if (this.newOrder.order_type === 'laser') {
          this.newOrder.cutting_time = this.tempCutTime || 0;
        }

        await this.handleFileUploadForOrder(this.newOrder.id_order!);
        this.selectedFile = null;
        this.uploadedFileName = null;

        // scheduler is set only on order creation
        delete (this.newOrder as any).scheduler;

        const { error } = await this.supabase
          .from('orders')
          .update([this.newOrder])
          .eq('id_order', this.newOrder.id_order);

        // vitrine edit handling: reset and reinsert sales
        if (this.isVitrineSale()) {
          const resetOk = await this.resetVitrineSalesForOrder(this.newOrder.id_order!);
          if (!resetOk) {
            alert('Error resetting vitrine sales.');
            return;
          }

          const insertOk = await this.saveVitrineSales(this.newOrder.id_order!);
          if (!insertOk) {
            alert('Error al actualizar.');
            return;
          }
        }

        if (error) {
          console.error('Error al actualizar el pedido:', error);
          alert('Error al actualizar el pedido.');
          return;
        }

        // handle cuts update
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

            if (updateCutError) console.error('Error al actualizar tabla cuts:', updateCutError);
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
            const { error: insertCutError } = await this.supabase.from('cuts').insert([cutRecord]);
            if (insertCutError) console.error('Error al insertar en tabla cuts:', insertCutError);
          }
        }

        alert('Pedido actualizado correctamente.');
        this.showModal = false;
        await this.getOrders();
      } 
      // logic for creating (insert transaction)
      else {
        // prepare json payload for order
        // we use explicit conversion to ensure type safety for jsonb mapping
        const orderPayload = {
          ...this.newOrder,
          id_client: newOrderForm.id_client,
          total: total,
          // ensure specific fields are strictly handled
          is_vitrine: this.newOrder.is_vitrine || false,
          secondary_completed: this.newOrder.secondary_completed || false,
          requires_e_invoice: this.newOrder.requires_e_invoice || false,
          include_iva: this.newOrder.include_iva || false,
          extra_charges: this.newOrder.extra_charges || [],
          // ensure numbers are numbers
          unitary_value: Number(this.newOrder.unitary_value) || 0,
          order_quantity: Number(this.newOrder.order_quantity) || 0,
          iva: Number(this.newOrder.iva) || 0,
          subtotal: Number(this.newOrder.subtotal) || 0,
          amount: Number(this.newOrder.amount) || 0,
          cutting_time: Number(this.newOrder.cutting_time) || 0,
          base_total: Number(this.newOrder.base_total) || 0,
          pending_quantity: Number(this.newOrder.pending_quantity) || 0,
          discount: Number(this.newOrder.discount) || 0
        };

        // remove code from payload so db generates it
        delete (orderPayload as any).code;

        // prepare json payload for invoice
        // code is handled inside the sql function
        const invoicePayload = {
          payment_term: paymentTerm,
          include_iva: this.newOrder.include_iva || false,
          due_date: dueDate.toISOString().split('T')[0]
        };

        // call the transaction function
        const { data, error } = await this.supabase
          .rpc('create_order_transaction_v3', {
            order_data: orderPayload,
            invoice_data: invoicePayload,
            client_id: newOrderForm.id_client,
            order_total: parseFloat(total as any) || 0
          });

        if (error) throw error;

        // handle success data
        const newOrderId = data.id_order;
        const generatedCode = data.code; 

        // update local state with the generated code
        this.newOrder.code = generatedCode;

        // post-transaction operations
        
        // initial payment
        await this.createInitialPaymentForOrder({ ...this.newOrder, id_order: newOrderId } as any, total);

        // vitrine sales insertion and stock handling
        if (this.isVitrineSale()) {
          const ok = await this.saveVitrineSales(newOrderId);

          if (!ok) {
            alert('Error while saving vitrine products.');
            return;
          }
        }

        // laser cuts insertion
        if (this.newOrder.order_type === 'laser' && this.tempCutTime > 0) {
          const cutRecord = {
            id_order: newOrderId,
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
          
          const { error: cutError } = await this.supabase.from('cuts').insert([cutRecord]);
          if (cutError) console.error('Error al insertar en tabla cuts:', cutError);
        }

        // file uploads
        await this.handleFileUploadForOrder(newOrderId);

        alert(`Pedido #${generatedCode} creado correctamente.`);
        this.showModal = false;
        await this.getOrders();
      }
    } catch (error) {
      console.error('Error inesperado al guardar el pedido:', error);
      alert('Ocurrió un error inesperado al guardar el pedido.');
    } finally {
      this.isSavingOrder = false;
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
    const subtotal = baseTotal + extras;
    // Calcular total con o sin IVA
    if (this.newOrder.include_iva) {
      const ivaAmount = subtotal * (this.variables.iva / 100);
      this.newOrder.total = subtotal + ivaAmount;
      this.newOrder.iva = ivaAmount; // Guardar el monto del IVA
    } else {
      this.newOrder.total = subtotal;
      this.newOrder.iva = 0;
    }

    this.newOrder.subtotal = baseTotal;
    this.newOrder.base_total = baseTotal;
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

  onFileSelected(event: Event, type: 'main' | 'secondary') {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (type === 'main') {
      this.selectedFile = file;
      this.uploadedFileName = file.name;
    }

    if (type === 'secondary') {
      this.selectedSecondaryFile = file;
    }
  }

  onInvoiceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedInvoiceFile = input.files[0];
    }
  }

  async uploadOrderFile(orderId: string, filePath: string, file: File) {
    if (!file || !orderId) return;

    await this.supabase.uploadFile(filePath, file, 'order-files');

    this.uploadedFileName = file.name;
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
  // decomposes combined characters, removes accent, replaces spaces with underscores, and removes special characters
  private normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
  }
  private async handleFileUploadForOrder(orderId: string): Promise<void> {
    if (this.selectedFile) {
      const file = this.selectedFile;
      const safeName = this.normalizeFileName(file.name);
      const filePath = `${orderId}/work/${Date.now()}_${safeName}`;

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
      const safeName = this.normalizeFileName(file.name);
      const filePath = `${orderId}/invoice/${Date.now()}_${safeName}`;

      await this.uploadOrderFile(orderId, filePath, file);

      await this.supabase
        .from('orders')
        .update({ invoice_file: filePath })
        .eq('id_order', orderId);

      this.newOrder.invoice_file = filePath;
      this.selectedInvoiceFile = null;
    }

    // secondary file upload if applicable
    if (this.selectedSecondaryFile && this.newOrder.secondary_process) {
      const file = this.selectedSecondaryFile;
      const safeName = this.normalizeFileName(file.name);
      const secondaryPath = `${orderId}/secondary/${safeName}`;

      await this.uploadOrderFile(
        orderId,
        secondaryPath,
        this.selectedSecondaryFile
      );

      await this.supabase
        .from('orders')
        .update({ second_file: secondaryPath })
        .eq('id_order', orderId);

      this.newOrder.second_file = secondaryPath;
      this.selectedSecondaryFile = null;
    }

    this.uploadedFileName = null;
  }
  get submitButtonText(): string {
    if (this.isSavingOrder || this.isSavingClient) return 'Guardando...';
    return this.isEditing ? 'Actualizar' : 'Guardar';
  }
}

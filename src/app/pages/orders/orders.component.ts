import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';

interface Orders {
  id_order: string;
  order_type: string;
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
  order_quantity: string;
  unitary_value: string | number;
  iva: string | number;
  subtotal: string | number;
  total: string | number;
  amount: string | number;
  id_client: string;
  payments?: Payment[];
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
  material_type: string;
  color: string;
  caliber: string;
  height: string;
  width: string;
  quantity: string;
  cutting_time: string;
  id_order: string;
}

interface Prints {
  id: string;
  material: string;
  material_type: string;
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

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit {
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
  // Checkboxes
  showPrints: boolean = true;
  showCuts: boolean = true;
  showSales: boolean = true;
  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedOrders: Orders[] = [];
  newPaymentAmount: number = 0;
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;
  // Subject para debounce (sin argumentos)
  private searchSubject = new Subject<void>();
  //Calculator
  showCalculator: boolean = false;
  calculationType: 'prints' | 'cuts' | 'sales' | null = null;
  clientType: 'intermediary' | 'final' | null = null;
  // Valores de la impresión
  lamination: boolean = false;
  pPrint: boolean = false;
  stamping: boolean = false;
  assemble: boolean = false;
  laminationValue: number = 2;
  printValue: number = 1.2;
  stampingValue: number = 1.2;
  assembleValue: number = 1.2;
  rollWidth: number = 0;
  measurement: number = 0;
  productNumber: number = 1;
  // Valores para corte
  materialValue: number = 0;
  intermediaryPerMinute: number = 800;
  finalPerMinute: number = 1000;
  usageTime: number = 0;
  calculatorResult: number = 0;
  showAddClientModal = false;
  filteredClients: Client[] = [];




  // Para añadir pedidos
  newOrder: Partial<Orders> = {};
  newCut: Partial<Cuts> = {};
  newPrint: Partial<Prints> = {};
  
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
          this.getOrders();
          this.getClients();
        });
      } else {
        console.error('Usuario no autenticado.');
        this.orders = [];
        this.filteredOrdersList = [];
      }
    });
  }

  async getOrders(): Promise<void> {
    this.loading = true;
    if (this.userRole != 'admin') {
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
      const { data, error } = await this.supabase
        .from('orders')
        .select('*, payments(*)')
        .eq('order_type', this.order_role_filter);

      if (error) {
        console.error('Error al obtener los pedidos:', error);
        this.loading = false;
        return;
      }
      this.orders = data as Orders[];
    } else {
      const { data, error } = await this.supabase.from('orders').select('*');

      if (error) {
        console.error('Error al obtener los pedidos:', error);
        this.loading = false;
        return;
      }
      this.orders = data as Orders[];
    }
    console.log(this.orders);
    // sorting orders by code
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
    this.updateFilteredOrders(); // Filtrar después de cargar los datos
    this.loading = false;
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }
    this.clients = data;
    this.filteredClients = [...this.clients]; // Inicializa los clientes filtrados
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
      company_name: '',
      cellphone: '',
      address: '',
      status: ''
    };
  }

  async saveNewClient(): Promise<void> {
    if (!this.newClient.name || !this.newClient.email || !this.newClient.document_type || !this.newClient.document_number) {
      alert('Por favor, complete todos los campos obligatorios.');
      return;
    }

    const { data, error } = await this.supabase.from('clients').insert([this.newClient]);

    if (error) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
      return;
    }

    alert('Cliente añadido correctamente.');
    this.closeAddClientModal();
    await this.getClients(); // Recargar la lista de clientes
  }

  // Método para mostrar una notificación temporal
  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000); // El mensaje desaparece después de 3 segundos
  }

  // Calculate the total payments for an order
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

    // Calcular el monto pendiente
    const total = parseFloat(String(order.total)) || 0;
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    // Validar que el abono no exceda el monto pendiente
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
      // Insertar el abono
      const { error: insertError } = await this.supabase
        .from('payments')
        .insert([payment]);

      if (insertError) {
        console.error('Error al añadir el abono:', insertError);
        this.showNotification('Error al añadir el abono.');
        return;
      }

      // Obtener la deuda actual del cliente
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

      // Reducir la deuda del cliente
      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: currentDebt - amount })
        .eq('id_client', order.id_client);

      if (updateError) {
        console.error('Error al actualizar la deuda:', updateError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      // Actualizar localmente los datos
      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push({
        ...payment,
        payment_date: new Date().toISOString(),
      });

      // Actualizar el estado de pago del pedido y la factura
      const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = parseFloat(String(order.total)) || 0;
      const newStatus = totalPaid >= orderTotal ? 'upToDate' : 'overdue';

      // Actualizar el estado en la tabla orders
      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', order.id_order);

      // Actualizar el estado en la tabla invoices
      await this.supabase
        .from('invoices')
        .update({ invoice_status: newStatus })
        .eq('id_order', order.id_order);

      // Actualizar localmente el estado
      order.order_payment_status = newStatus;
      if (this.selectedOrder) {
        this.selectedOrder.order_payment_status = newStatus;
      }

      this.newPaymentAmount = 0; // Resetear el campo
      this.showNotification('Abono añadido correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  async updatePayment(): Promise<void> {
    if (!this.selectedPayment || !this.selectedPayment.id_payment) {
      this.showNotification('No se ha seleccionado un abono válido.');
      return;
    }

    try {
      // Obtener el abono original para calcular la diferencia
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

      // Actualizar el abono
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({ amount: newAmount })
        .eq('id_payment', this.selectedPayment.id_payment);

      if (updateError) {
        console.error('Error al actualizar el abono:', updateError);
        this.showNotification('Error al actualizar el abono.');
        return;
      }

      // Obtener la deuda actual del cliente
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

      // Ajustar la deuda del cliente según la diferencia
      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: currentDebt + difference })
        .eq('id_client', this.selectedOrder!.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      // Actualizar localmente los datos
      if (this.selectedOrder && this.selectedOrder.payments) {
        const paymentIndex = this.selectedOrder.payments.findIndex(
          (p) => p.id_payment === this.selectedPayment!.id_payment
        );
        if (paymentIndex !== -1) {
          this.selectedOrder.payments[paymentIndex] = {
            ...this.selectedPayment,
          };
        }

        // Actualizar el estado de pago del pedido y la factura
        const totalPaid = this.selectedOrder.payments.reduce(
          (sum, p) => sum + p.amount,
          0
        );
        const orderTotal = parseFloat(String(this.selectedOrder.total)) || 0;
        const newStatus = totalPaid >= orderTotal ? 'upToDate' : 'overdue';

        // Actualizar el estado en la tabla orders
        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        // Actualizar el estado en la tabla invoices
        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        // Actualizar localmente el estado
        this.selectedOrder.order_payment_status = newStatus;
      }

      this.showEditPayment = false;
      this.selectedPayment = null;
      this.showNotification('Abono actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  // Llamada en (input) de ambos campos sin pasar parámetros
  onSearchInputChange(): void {
    this.searchSubject.next();
  }

  async onSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      // Si no hay búsqueda por número, volver al filtrado normal
      this.updateFilteredOrders();
      return;
    }

    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('code', this.searchQuery.trim());

    if (error) {
      console.error('Error al buscar la orden:', error);
      this.noResultsFound = true; // Mostrar mensaje en caso de error
      this.filteredOrdersList = [];
      this.updatePaginatedOrder();
      return;
    }

    this.filteredOrdersList = data as Orders[];
    this.noResultsFound =
      this.searchQuery.trim() !== '' && (!data || data.length === 0); // Activar mensaje si no hay resultados
    this.currentPage = 1; // Reiniciar paginación
    this.updatePaginatedOrder();
  }

  updateFilteredOrders(): void {
    // Verificar si todos los checkboxes de tipo están desactivados
    const allTypeCheckboxesOff =
      !this.showPrints && !this.showCuts && !this.showSales;

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

      // Si todos los checkboxes de tipo están desactivados, mostrar todos los pedidos
      if (allTypeCheckboxesOff) {
        return matchesDateRange && matchesNameSearch;
      }

      // Filtros normales si hay al menos un checkbox de tipo activado
      const isPrintsFilter = this.showPrints && order.order_type === 'print';
      const isCutsFilter = this.showCuts && order.order_type === 'laser';
      const isSalesFilter = this.showSales && order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      return matchesType && matchesDateRange && matchesNameSearch;
    });

    // Activar noResultsFound solo si hay una búsqueda por nombre y no hay resultados
    this.noResultsFound =
      this.searchByNameQuery.trim() !== '' &&
      this.filteredOrdersList.length === 0;
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedOrder(); // Actualizar la lista paginada
  }

  async selectOrder(order: Orders) {
    this.loadingDetails = true;
    this.selectedOrderTypeDetail = []; // Reiniciar

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
    }

    this.selectedOrderDetails = [order];
    this.loadingDetails = false;
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
    const { error } = await this.supabase
      .from('orders')
      .update({ order_completion_status: order.order_completion_status })
      .eq('id_order', order.id_order);
    if (error) {
      console.error('Error actualizando estado:', error);
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
    if (!this.showModal) {
      this.newOrder = {
        id_order: '',
        order_type: '',
        name: '',
        client_type: '',
        description: '',
        order_payment_status: 'overdue',
        created_at: new Date().toISOString(),
        order_quantity: '',
        unitary_value: '',
        iva: '',
        subtotal: '',
        total: '',
        amount: '',
        id_client: '',
        order_confirmed_status: 'notConfirmed',
        order_completion_status: 'standby',
        order_delivery_status: 'toBeDelivered',
        notes: '',
      };
    }
    this.showModal = !this.showModal;
  }

  async editOrder(order: Orders): Promise<void> {
    this.isEditing = true;
    this.showModal = true;

    // Llenar los campos comunes
    this.newOrder = { ...order };

    // Obtener detalles específicos si es corte o impresión
    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) {
        this.newPrint = { ...data };
      }
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) {
        this.newCut = { ...data };
      }
    }
  }

  async deleteOrder(order: Orders): Promise<void> {
    if (confirm(`¿Eliminar orden #${order.code}?`)) {
      const { error } = await this.supabase
        .from('orders')
        .delete()
        .eq('id_order', order.id_order);
      if (error) {
        console.log('Failed to delete order: ', error);
        return;
      }
      this.getOrders();
    }
  }

  async addOrder(newOrderForm: Partial<Orders>): Promise<void> {
    const selectedClient = this.clients.find(
      (client) => client.id_client === newOrderForm.id_client
    );
    newOrderForm.name = selectedClient ? selectedClient.name : '';

    // Obtener detalles del cliente (deuda y límite de crédito)
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

    if (currentDebt + orderAmount > creditLimit && creditLimit !== 0) {
      alert('El cliente ha alcanzado o excederá su límite de crédito.');
      return;
    }

    this.newOrder = {
      order_type: newOrderForm.order_type,
      name: newOrderForm.name,
      client_type: newOrderForm.client_type,
      description: newOrderForm.description,
      order_payment_status: newOrderForm.order_payment_status || 'overdue',
      created_at: newOrderForm.created_at || new Date().toISOString(),
      order_quantity: newOrderForm.order_quantity,
      unitary_value: newOrderForm.unitary_value || 0,
      iva: newOrderForm.iva || 0,
      subtotal: newOrderForm.subtotal || 0,
      total: newOrderForm.total || 0,
      amount: newOrderForm.amount || 0,
      id_client: newOrderForm.id_client,
      order_confirmed_status: newOrderForm.order_confirmed_status,
      order_completion_status: newOrderForm.order_completion_status,
      order_delivery_status: newOrderForm.order_delivery_status,
      notes: newOrderForm.notes,
    };

    if (this.isEditing) {
      if (!newOrderForm.id_order) {
        console.error('ID del pedido no definido para actualizar.');
        alert('Error: No se puede actualizar un pedido sin ID.');
        return;
      }

      this.newOrder.id_order = newOrderForm.id_order;

      const { error } = await this.supabase
        .from('orders')
        .update([this.newOrder])
        .eq('id_order', this.newOrder.id_order);

      if (error) {
        console.error('Error al actualizar el pedido:', error);
        return;
      }

      if (this.newOrder.order_type === 'print') {
        const printData = { ...this.newPrint };
        const { error: printError } = await this.supabase
          .from('prints')
          .upsert([{ ...printData, id_order: this.newOrder.id_order }]);
        if (printError) {
          console.error('Error actualizando impresión:', printError);
          return;
        }
      } else if (this.newOrder.order_type === 'laser') {
        const cutData = { ...this.newCut };
        const { error: cutError } = await this.supabase
          .from('cuts')
          .upsert([{ ...cutData, id_order: this.newOrder.id_order }]);
        if (cutError) {
          console.error('Error actualizando corte:', cutError);
          return;
        }
      }

      this.getOrders();
      this.toggleAddOrderForm();
    } else if (!this.isEditing) {
      const { data, error } = await this.supabase
        .from('orders')
        .insert([this.newOrder])
        .select();

      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }

      const insertedOrder = data[0];
      this.newOrder.id_order = insertedOrder.id_order;
      this.newOrder.code = insertedOrder.code;

      if (this.newOrder.order_type === 'print') {
        const printData = {
          ...this.newPrint,
          id_order: insertedOrder.id_order,
        };
        const { error: printError } = await this.supabase
          .from('prints')
          .insert([printData]);
        if (printError) {
          console.error('Error al insertar datos de impresión:', printError);
          return;
        }
      } else if (this.newOrder.order_type === 'laser') {
        const cutData = {
          ...this.newCut,
          id_order: insertedOrder.id_order,
        };
        const { error: cutError } = await this.supabase
          .from('cuts')
          .insert([cutData]);
        if (cutError) {
          console.error('Error al insertar datos de corte:', cutError);
          return;
        }
      }
    }
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
  private formatDateForInput(date: Date | string): string {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  openCalculator(): void {
    this.showCalculator = true;
    this.calculationType = null;
    this.resetForm();
  }

  closeCalculator(): void {
    this.showCalculator = false;
    this.resetForm();
  }

  resetForm(): void {
    // General
    this.calculatorResult = 0;
    this.clientType = null;
    // Prints
    this.lamination = false;
    this.pPrint = false;
    this.stamping = false;
    this.assemble = false;
    this.rollWidth = 0;
    this.measurement = 0;
    this.productNumber = 1;
    //Cuts
    this.materialValue = 0;
    this.usageTime = 0;
  }

  setValoresPorCliente(): void {
    if (this.clientType === 'intermediary') {
      this.laminationValue = 1.2;
      this.printValue = 2;
      this.stampingValue = 1.2;
      this.assembleValue = 1.2;
    } else if (this.clientType === 'final') {
      this.laminationValue = 1.5;
      this.printValue = 5;
      this.stampingValue = 1.5;
      this.assembleValue = 1.5;
    }
  }

  calculatePrice(): void {
    if (this.calculationType == 'prints') {
      const base = this.rollWidth * this.measurement * this.productNumber;

      let factor = 0;

      if (this.lamination) factor += this.laminationValue;
      if (this.pPrint) factor += this.printValue;
      if (this.stamping) factor += this.stampingValue;
      if (this.assemble) factor += this.assembleValue;

      this.calculatorResult = base * factor;
    } else if (this.calculationType == 'cuts') {
      let valorTiempo = 0;
      if (this.usageTime <= 10) {
        valorTiempo = 8000;
      } else {
        valorTiempo =
          this.clientType === 'intermediary'
            ? this.usageTime * this.intermediaryPerMinute
            : this.usageTime * this.finalPerMinute;
      }

      this.calculatorResult = this.materialValue + valorTiempo;
    }
    
  }
}

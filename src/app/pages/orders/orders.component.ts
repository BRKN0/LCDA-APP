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

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit {
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
  clients: { id_client: string; name: string }[] = [];
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
  // Subject para debounce (sin argumentos)
  private searchSubject = new Subject<void>();

  // Para añadir pedidos
  newOrder: Partial<Orders> = {};

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
        .select('*')
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
    try {
      const { data, error } = await this.supabase
        .from('clients')
        .select('id_client, name');
      if (error) {
        console.error('Error al obtener los clientes:', error);
        return;
      }
      this.clients = data || [];
    } catch (error) {
      console.error('Error inesperado al obtener clientes:', error);
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
    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);
      if (error) {
        console.log(error);
      }
      this.selectedOrderTypeDetail = data as Prints[];
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);
      if (error) {
        console.log(error);
      }
      this.selectedOrderTypeDetail = data as Cuts[];
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

  editOrder(order: Orders): void {
    // Cargar los datos del pedido seleccionado en el formulario
    this.newOrder = { ...order };
    this.newOrder.created_at = this.formatDateForInput(order.created_at); // Formatear la fecha
    this.isEditing = true; // Indicar que estamos editando
    this.showModal = true; // Mostrar el modal
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
    // Everytime you use a constant used for this you get closer to hell, please stop
    // Like what was even the point? just use newOrder instead of making a useless constant
    // Also, why name the new order coming from the form the same as the Partial Object
    this.newOrder = {
      order_type: newOrderForm.order_type,
      name: newOrderForm.name,
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
    if (this.isEditing == true) {
      this.newOrder.id_order = newOrderForm.id_order;
      const { error } = await this.supabase
        .from('orders')
        .update([this.newOrder])
        .eq('id_order', this.newOrder.id_order);
      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }
      this.getOrders();
      this.toggleAddOrderForm();
    } else {
      const { data, error } = await this.supabase
        .from('orders')
        .insert([this.newOrder])
        .select();
      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }
      this.newOrder.id_order = data[0].id_order;
      this.newOrder.code = data[0].code;
      console.log(this.newOrder);
      this.createNotification(this.newOrder);
      this.getOrders();
      this.toggleAddOrderForm();
    }
  }
  async createNotification(addedOrder: Partial<Orders>) {
    this.notificationDesc = 'Nuevo pedido: ' + addedOrder.description + '. Codigo: ' + addedOrder.code;
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
}

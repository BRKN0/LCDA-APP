import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

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
  unitary_value: string;
  iva: string;
  subtotal: string;
  total: string;
  amount: string;
  id_client: string;
}

interface Cuts {
  id: string;
  material_type: string;
  color: string;
  caliber: string;
  length: string;
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
  showModal: boolean = false;
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
  newOrder: Partial<Orders> = {
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
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
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
    const { data, error } = await this.supabase
      .from('orders') // Nombre de la tabla
      .select('*'); // Seleccionar todos los campos

    if (error) {
      console.error('Error al obtener los pedidos:', error);
      this.loading = false;
      return;
    }

    this.orders = data as Orders[]; // Asignar los datos obtenidos
    this.updateFilteredOrders(); // Filtrar después de cargar los datos
    console.error('Error inesperado:', error);

    // sorting orders by code
    let n = this.orders.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.orders[i].code > this.orders[i + 1].code) {
          [this.orders[i], this.orders[i + 1]] = [
            this.orders[i + 1],
            this.orders[i],
          ];
          swapped = true;
        }
      }
      n--;
    } while (swapped);
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

    let query = this.supabase.from('orders').select('*');

    if (this.searchQuery.trim()) {
      query = query.or(`code.eq.${this.searchQuery.trim()}`);
    }

    if (this.searchByNameQuery.trim()) {
      query = query.or(`name.ilike.%${this.searchByNameQuery.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al buscar la orden:', error);
      alert('Error al buscar la orden.');
      return;
    }

    if (!data || data.length === 0) {
      alert('No se encontraron resultados.');
      return;
    }

    this.filteredOrdersList = data as Orders[];
    this.updatePaginatedOrder();
  }

  updateFilteredOrders(): void {
    const allCheckboxesOff = !this.showPrints && !this.showCuts && !this.showSales;

    this.filteredOrdersList = this.orders.filter((order) => {
      const matchesCode = order.code.toString().includes(this.searchQuery.trim());
      const matchesClientName = order.name.toLowerCase().includes(this.searchByNameQuery.toLowerCase().trim());

      const matchesType =
        allCheckboxesOff ||
        (this.showPrints && order.order_type === 'print') ||
        (this.showCuts && order.order_type === 'laser') ||
        (this.showSales && order.order_type === 'sales');

      const orderDate = new Date(order.created_at);
      const isWithinDateRange =
        (!this.startDate || orderDate >= new Date(this.startDate)) &&
        (!this.endDate || orderDate <= new Date(this.endDate));

      return (matchesCode || matchesClientName) && matchesType && isWithinDateRange;
    });

    this.noResultsFound = this.filteredOrdersList.length === 0;
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

  async addOrder(newOrder: Partial<Orders>): Promise<void> {
    const selectedClient = this.clients.find(
      (client) => client.id_client === newOrder.id_client
    );
    newOrder.name = selectedClient ? selectedClient.name : '';
    const orderToInsert = {
      order_type: newOrder.order_type,
      name: newOrder.name,
      description: newOrder.description,
      order_payment_status: newOrder.order_payment_status || 'overdue',
      created_at: newOrder.created_at || new Date().toISOString(),
      order_quantity: newOrder.order_quantity,
      unitary_value: newOrder.unitary_value || 0,
      iva: newOrder.iva || 0,
      subtotal: newOrder.subtotal || 0,
      total: newOrder.total || 0,
      amount: newOrder.amount || 0,
      id_client: newOrder.id_client,
      order_confirmed_status: newOrder.order_confirmed_status,
      order_completion_status: newOrder.order_completion_status,
      order_delivery_status: newOrder.order_delivery_status,
      notes: newOrder.notes,
    };
    try {
      const { error } = await this.supabase
        .from('orders')
        .insert([orderToInsert]);
      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }
      console.log('Pedido añadido exitosamente:', newOrder);
      this.getOrders();
      this.toggleAddOrderForm();
    } catch (error) {
      console.error('Error inesperado al añadir pedido:', error);
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
    this.totalPages = Math.max(1, Math.ceil(this.filteredOrdersList.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedOrders = this.filteredOrdersList.slice(startIndex, endIndex);
  }
}



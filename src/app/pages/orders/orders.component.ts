import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

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
  orders: Orders[] = [];
  selectedOrderTypeDetail: any | null = null;
  order: Orders | null = null;
  filteredOrdersList: Orders[] = []; // Lista filtrada de pedidos
  clients: { id_client: string; name: string }[] = []; // Lista de clientes
  selectedOrder: Orders | null = null;
  selectedOrderDetails: Orders[] | null = null;
  noResultsFound: boolean = false;
  loading = true;
  loadingDetails = true;
  searchQuery: string = '';
  startDate: string = '';
  endDate: string = '';
  // Estados para checkboxes
  showPrints = true;
  showCuts = true;
  showSales = true;
  // Paginacion
  currentPage: number =1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedOrders: Orders[] = []; // Lista paginada


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
  showAddOrderForm = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getOrders(); // Cargar los pedidos al autenticarse
          this.getClients(); //Cargar clientes
        });
      } else {
        console.error('Usuario no autenticado.');
        this.orders = [];
        this.filteredOrdersList = [];
      }
    });
  }

  /**
   * Obtiene los pedidos desde Supabase
   */
  async getOrders(): Promise<void> {
    this.loading = true;

    try {
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
    } catch (error) {
      console.error('Error inesperado:', error);
    } finally {
      this.loading = false;
    }
  }
  async onSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      alert('Por favor, ingrese un número de factura.');
      return;
    }
    this.loading = true;

    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('code', this.searchQuery.trim());
    this.loading = false;
    if (error) {
      console.error('Error fetching order:', error);
      alert('Error al buscar la factura.');
      return;
    }

    if (!data || data.length === 0) {
      alert('Factura no encontrada.');
      return;
    }

    this.order = {
      ...data[0], //,
      //client: data[0].client,
    } as Orders;

    this.selectOrder(this.order);
    console.log(this.order);
  }
  /**
   * Actualiza la lista filtrada de pedidos según los checkboxes seleccionados
   */
  updateFilteredOrders(): void {
    // Si todas las checkboxes están desmarcadas, no mostrar nada
    if (!this.showPrints && !this.showCuts && !this.showSales) {
      this.filteredOrdersList = [];
      return;
    }

    // Filtrar los pedidos según los checkboxes seleccionados
    this.filteredOrdersList = this.orders.filter((order) => {
      const matchesType =
            (this.showPrints && order.order_type === 'print') ||
            (this.showCuts && order.order_type === 'laser') ||
            (this.showSales && order.order_type === 'sales');

        const orderDate = new Date(order.created_at); // Convertir la fecha del pedido a objeto Date
        const isWithinDateRange =
            (!this.startDate || orderDate >= new Date(this.startDate)) &&
            (!this.endDate || orderDate <= new Date(this.endDate ));

        return matchesType && isWithinDateRange;
    });
    this.noResultsFound = this.filteredOrdersList.length === 0;
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedOrder(); // Actualizar la lista paginada
  }

  async selectOrder(order: Orders) {
    this.loadingDetails = true;
    if (order.order_type == 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);
      if (error) {
        console.log(error);
      }
      console.log("raw:", data);
      this.selectedOrderTypeDetail = data as Prints[];
      console.log(this.selectedOrderDetails);
      this.loadingDetails = false;
    } else if (order.order_type == 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);
      if (error) {
        console.log(error);
      }
      console.log("raw:", data);
      this.selectedOrderTypeDetail = data as Cuts[];
      console.log(this.selectedOrderDetails);
      this.loadingDetails = false;
    } else if (order.order_type == 'sales') {
      this.loadingDetails = false;
    }
    this.selectedOrderDetails = [order];
  }

  async getClients(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('clients') // Tabla de clientes
        .select('id_client, name'); // Solo selecciona el ID y el nombre

      if (error) {
        console.error('Error al obtener los clientes:', error);
        return;
      }

      this.clients = data || []; // Asigna la lista de clientes
    } catch (error) {
      console.error('Error inesperado al obtener clientes:', error);
    }
  }

  /**
   * Añadir nueva orden
   */
  toggleAddOrderForm(): void {
    if (!this.showAddOrderForm) {
      // Reinicia el formulario al abrir la ventana modal
      this.newOrder = {
        id_order: '',
        order_type: '',
        name: '',
        description: '',
        order_payment_status: 'overdue',
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
    this.showAddOrderForm = !this.showAddOrderForm;
  }

  async addOrder(newOrder: Partial<Orders>): Promise<void> {
    // Obtener el nombre del cliente basado en el id_client
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
      unitary_value: newOrder.unitary_value || 0, // Valor predeterminado si no se proporciona
      iva: newOrder.iva || 0,
      subtotal: newOrder.subtotal || 0,
      total: newOrder.total || 0,
      amount: newOrder.amount || 0,
      id_client: newOrder.id_client,
      order_confirmed_status: newOrder.order_confirmed_status,
      order_completion_status: newOrder.order_completion_status,
      order_delivery_status: newOrder.order_delivery_status,
      Notes: newOrder.notes,
    };

    try {
      const { error } = await this.supabase
        .from('orders')
        .insert([orderToInsert]); // Inserta el nuevo pedido en Supabase

      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }

      console.log('Pedido añadido exitosamente:', newOrder);
      this.getOrders(); // Actualiza la lista de pedidos después de añadir uno nuevo
      this.toggleAddOrderForm(); // Cierra el formulario
    } catch (error) {
      console.error('Error inesperado al añadir pedido:', error);
    }
  }

  //Paginacion
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedOrder(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(1, Math.ceil(this.filteredOrdersList.length / this.itemsPerPage));

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedOrders = this.filteredOrdersList.slice(startIndex, endIndex);
  }
}

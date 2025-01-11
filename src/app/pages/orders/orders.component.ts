import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

interface Orders {
  id_order: string;
  order_type: string;
  name: string;
  description: string;
  order_status: string;
  created_at: string;
  order_quantity: string;
  unitary_value: string;
  iva: string;
  subtotal: string;
  total: string;
  amount: string;
  id_client: string;
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
  filteredOrdersList: Orders[] = []; // Lista filtrada de pedidos
  selectedOrder: Orders | null = null;
  loading = true;

  // Estados para checkboxes
  showPrints = true;
  showCuts = true;
  showSales = true;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getOrders(); // Cargar los pedidos al autenticarse
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
      return (
        (this.showPrints && order.order_type === 'print') ||
        (this.showCuts && order.order_type === 'laser') ||
        (this.showSales && order.order_type === 'Ventas')
      );
    });
  }

  /**
   * Alterna entre mostrar y ocultar detalles de un pedido
   */
  toggleDetails(order: Orders): void {
    this.selectedOrder = this.selectedOrder === order ? null : order;
  }
}


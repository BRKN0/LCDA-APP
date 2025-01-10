import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent {
  showPrints = true;
  showCuts = true;
  showSales = true;

  ngOnInit(): void {
    this.updateFilteredOrders();
  }

  orders = [
    {
      codigo: '0001',
      nombre: 'Juan Pérez',
      tipo_pedido: 'Cortes',
      descripcion: '35 RECONOCIMIENTOS EN ACRILICO CRISTAL DE 5 MM EL CUERPO Y LA BASE EN 8 MM',
      estado: 'Completo', //esperar la pagina editable de los trabajadores
    },
    {
      codigo: '0002',
      nombre: 'Ana Gomez',
      tipo_pedido: 'Impresiones',
      descripcion: 'IMPRESIO PEGADA Y ARMADA EN ACRILICO YA CORTADO',
      estado: 'Pendiente', //esperar la pagina editable de los trabajadores
    },
    {
      codigo: '0003',
      nombre: 'Selena Gomez',
      tipo_pedido: 'Ventas',
      descripcion: 'Lamina de color roja',
      estado: 'Completo',
    }
  ]

  selectedOrder: any = null;
  showPedidos = false;

  toggleDetails(order: any) {
    // Alterna entre mostrar y ocultar detalles
    this.selectedOrder = this.selectedOrder === order ? null : order;
    this.showPedidos = false; // Restablece el estado de los pedidos al cambiar de cliente
  }

  selectedOrderDetails: any[] | null = null;

  filteredOrders(): any[] {
    // Load all invoices by default
    if (!this.showPrints && !this.showCuts && !this.showSales) {
      return [];
    }

    // Apply filtering logic based on checkbox state
    return this.orders.filter((order) => {
      if (this.showPrints && order.tipo_pedido === 'Impresiones') {
        return true;
      }
      if (this.showCuts && order.tipo_pedido === 'Cortes') {
        return true;
      }
      if (this.showSales && order.tipo_pedido == 'Ventas') {
        return true;
      }
      return false;
    });
  }

  selectOrder(orders: any) {
    this.selectedOrderDetails = [orders];
  }
  filteredOrdersList: any[] = []; // array for filtered invoices

  updateFilteredOrders(): void {
    // Create a new array for filtered invoices
    let filtered = [];

    // If both checkboxes are unchecked, show all invoices
    if (!this.showPrints && !this.showCuts && !this.showSales) {
      filtered = [...this.orders];
    } else {
      // Otherwise, filter the invoices based on the checkbox states
      filtered = this.orders.filter((order) => {
        return (
          (this.showPrints && order.tipo_pedido === 'Impresiones') ||
          (this.showCuts && order.tipo_pedido === 'Cortes') ||
          (this.showSales && order.tipo_pedido === 'Ventas')
        );
      });
    }

    // Update the filteredInvoicesList in bulk
    this.filteredOrdersList = [...filtered];
  }
}

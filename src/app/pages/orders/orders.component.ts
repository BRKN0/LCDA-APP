import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent {

  orders = [
    {
      codigo: '0001',
      nombre: 'Juan Pérez',
      tipo_pedido: 'Corte laser',
      descripcion: '35 RECONOCIMIENTOS EN ACRILICO CRISTAL DE 5 MM EL CUERPO Y LA BASE EN 8 MM',
      estado: 'Completo', //esperar la pagina editable de los trabajadores
    },
    {
      codigo: '0002',
      nombre: 'Ana Gomez',
      tipo_pedido: 'Impresión',
      descripcion: 'IMPRESIO PEGADA Y ARMADA EN ACRILICO YA CORTADO',
      estado: 'Pendiente', //esperar la pagina editable de los trabajadores
    }
  ]

  selectedOrder: any = null;
  showPedidos = false;

  toggleDetails(order: any) {
    // Alterna entre mostrar y ocultar detalles
    this.selectedOrder = this.selectedOrder === order ? null : order;
    this.showPedidos = false; // Restablece el estado de los pedidos al cambiar de cliente
  }
}

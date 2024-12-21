import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, MainBannerComponent],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})

export class ClientsComponent {

  clients = [
    {
      nombre: 'Juan Pérez',
      nit: '123456789',
      empresa: 'Plásticos SA',
      estado: 'Al Día',
      telefono: '3001234567',
      direccion: 'Cra 45 # 12-34',
      deuda: 0,
      pedidos: [
        { codigo: '001', tipo: 'Corte', estado: 'Pago' },
        { codigo: '002', tipo: 'Impresión', estado: 'Pago' },
        { codigo: '003', tipo: 'Corte', estado: 'Pago' }
      ]
    },
    {
      nombre: 'Ana Gómez',
      nit: '987654321',
      empresa: 'Vinilos Ltda',
      estado: 'En Mora',
      telefono: '3119876543',
      direccion: 'Av 9 # 22-11',
      deuda: 1500,
      pedidos: [
        { codigo: '004', tipo: 'Corte', estado: 'En Mora' },
        { codigo: '005', tipo: 'Impresión', estado: 'Pago' },
        { codigo: '006', tipo: 'Corte', estado: 'No Pago' }
      ]
    },
    {
      nombre: 'Carlos Ruiz',
      nit: '1122334455',
      empresa: 'Maderas y Más',
      estado: 'Al Día',
      telefono: '3023344556',
      direccion: 'Cll 8 # 15-30',
      deuda: 0,
      pedidos: [
        { codigo: '007', tipo: 'Corte', estado: 'Pago' },
        { codigo: '008', tipo: 'Impresión', estado: 'Pago' },
        { codigo: '009', tipo: 'Corte', estado: 'Pago' }
      ]
    }
  ];

  selectedClient: any = null;
  showPedidos = false;

  toggleDetails(client: any) {
    // Alterna entre mostrar y ocultar detalles
    this.selectedClient = this.selectedClient === client ? null : client;
    this.showPedidos = false; // Restablece el estado de los pedidos al cambiar de cliente
  }

  togglePedidos(client: any) {
    // Alterna entre mostrar y ocultar pedidos
    if (this.selectedClient === client) {
      this.showPedidos = !this.showPedidos;
    }
  }
}


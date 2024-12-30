import { Component, OnInit, NgZone } from '@angular/core';
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
  orders?: Orders[];
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, MainBannerComponent],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  selectedClient: Client | null = null;
  showOrders = false;
  loading = true;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getClients();
        });
      }
    });
  }
  async getClients() {
    this.loading = true;
    const { error, data } = await this.supabase
      .from('clients')
      .select(
        '*, orders(id_order, order_type, name, description, order_status, created_at, order_quantity, unitary_value, iva, subtotal, total, amount, id_client)'
      );

    if (error) {
      return;
    }

    this.clients = [...data].map(client => ({
      ...client,
      orders: Array.isArray(client.orders) ? client.orders : client.orders ? [client.orders] : [] // Normalize orders
    })) as Client[];
    console.log(this.clients)
    this.loading = false;
  }

  toggleDetails(client: Client) {
    // Alterna entre mostrar y ocultar detalles
    this.selectedClient = this.selectedClient === client ? null : client;
    this.showOrders = false; // Restablece el estado de los pedidos al cambiar de cliente
  }

  toggleOrders(client: Client) {
    if (this.selectedClient === client) {
      if (!Array.isArray(client.orders)) {
        console.error('Orders is not an array:', client.orders);
        return;
      }

      // Toggle the `showOrders` state
      this.showOrders = !this.showOrders;
    } else {
      console.error('Selected client mismatch or orders not found.');
    }
  }
}

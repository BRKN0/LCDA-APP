import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  code: number;
}

interface Client {
  id_client: string;
  created_at: string;
  name: string;
  document_type: string;
  document_number: string;
  cellphone: string;
  nit?: string | null;
  company_name?: string | null;
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
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  showOrders = false;
  loading = true;
  searchQuery: string = '';
  filterDebt: boolean = false;
  noResultsFound: boolean = false;

  // Para añadir pedidos
  newClient: Partial<Client> = {
    id_client: '',
    document_type: '',
    name: '',
    document_number: '',
    status: 'overdue',
    created_at: new Date().toISOString(),
    cellphone: '',
    nit: '',
    company_name: '',
    email: '',
    debt: 0,
    address: '',
    city: '',
    province: '',
    postal_code: '',
  };
  showAddClientForm = false;

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
    const { error, data } = await this.supabase.from('clients').select(
      `*,
        orders(
        id_order,
        order_type,
        name,
        description,
        order_status,
        created_at,
        order_quantity,
        unitary_value,
        iva,
        subtotal,
        total,
        amount,
        id_client,
        code)`
    );

    if (error) {
      return;
    }

    this.clients = [...data].map((client) => ({
      ...client,
      orders: Array.isArray(client.orders)
        ? client.orders
        : client.orders
        ? [client.orders]
        : [], // Normalize the orders array
    })) as Client[];

    this.filteredClients = this.clients; // Initialize the filtered clients list
    this.loading = false;
  }

  searchClient() {
    // Filt the names and debs of the clients
    this.filteredClients = this.clients.filter((client) => {
      const matchesSearchQuery = client.name
        .toLowerCase()
        .includes(this.searchQuery.toLowerCase());
      const matchesDebtFilter = !this.filterDebt || client.debt > 0;

      return matchesSearchQuery && matchesDebtFilter;
    });


    this.noResultsFound = this.filteredClients.length === 0;
  }

  toggleDetails(client: Client) {
    this.selectedClient = this.selectedClient === client ? null : client;
    this.showOrders = false; // Reset the orders view
  }

  toggleOrders(client: Client | null): void {
    if (client) {
      if (!Array.isArray(client.orders)) {
        console.error('Orders is not an array:', client.orders);
        return;
      }
      this.selectedClient = client; // Asigna el cliente seleccionado
      this.showOrders = true; // Abre la ventana modal
    } else {
      // Cierra la ventana modal y limpia el cliente seleccionado
      this.showOrders = false;
    }
  }

  toggleAddClientForm(): void {
    if (!this.showAddClientForm) {
      // Reinicia el formulario al abrir la ventana modal
      this.newClient = {
        id_client: '',
        document_type: '',
        name: '',
        document_number: '',
        status: 'upToDate',
        cellphone: '',
        nit: '',
        company_name: '',
        email: '',
        debt: 0,
        address: '',
        city: '',
        province: '',
        postal_code: '',
      };
    }
    this.showAddClientForm = !this.showAddClientForm;
  }

  async addClient(newClient: Partial<Client>): Promise<void> {

    const clientToInsert = {
      name: newClient.name,
      document_type: newClient.document_type,
      document_number: newClient.document_number,
      cellphone: newClient.cellphone,
      status: newClient.status || 'upToDate',
      nit: newClient.nit,
      company_name: newClient.company_name || 'N/A', // Valor predeterminado si no se proporciona
      email: newClient.email,
      debt: newClient.debt || 0,
      address: newClient.address,
      city: newClient.city,
      province: newClient.province,
      postal_code: newClient.postal_code,
    };

    try {
      const { error } = await this.supabase
        .from('clients')
        .insert([clientToInsert]); // Inserta el nuevo pedido en Supabase
  
      if (error) {
        console.error('Error al añadir al cliente:', error);
        return;
      }
  
      console.log('Cliente añadido exitosamente:', newClient);
      this.getClients(); // Actualiza la lista de pedidos después de añadir uno nuevo
      this.toggleAddClientForm(); // Cierra el formulario
    } catch (error) {
      console.error('Error inesperado al añadir cliente:', error);
    }
  }

  // Method to generate PDF
  generatePDF(): void {
    if(!this.selectedClient || !this.selectedClient.orders){
      console.error("No hay datos de pedidos para exportar")
      return;
    }

    const doc = new jsPDF();

    //Add tittle
    doc.setFontSize(16);
    doc.text(`Extracto de Cliente: ${this.selectedClient.name}`, 10, 10);

    //client details 
    const orders = this.selectedClient.orders.map((order: any) => [
      order.code,
      order.created_at,
      order.description,
      `$${order.total}`,
      order.order_status === 'upToDate' ? 'Al Día' : 'En Mora',
    ]);

    (doc as any).autoTable({
      head: [['#', 'Fecha', 'Detalles', 'Total', 'Estado']],
      body: orders,
      startY: 40,
    });

    //Save pdf
    doc.save(`Extracto-${this.selectedClient.name}`);
  }

}

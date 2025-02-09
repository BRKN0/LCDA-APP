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
  code: number;
  description: string;
  order_payment_status: string;
  order_completion_status: string;
  order_comfirmed_status: string;
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
  // Variables de paginación
  currentPage: number = 1; // Página actual
  currentOrderPage: number =1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 0; // Total de páginas
  totalOrderPages: number = 1;
  itemsPerOrderPage: number = 10;
  paginatedClients: Client[] = []; // Lista paginada de clientes
  paginatedOrders: Orders[] = []; // Lista paginada de pedidos

  // Variables para formulario
  selectedClientData: Partial<Client> = {}; // Cliente a editar o agregar
  isEditing = false; // Controla si estamos editando
  showModal = false; // Controla la visibilidad del modal

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
        order_payment_status,
        order_payment_status,
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
    this.updatePaginatedClients();
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
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedClients(); // Actualizar la lista paginada
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
      this.currentOrderPage = 1;
      this.updatePaginatedOrders();
    } else {
      // Cierra la ventana modal y limpia el cliente seleccionado
      this.showOrders = false;
    }
  }

  //---------------------------------------------------------------------------

  addNewClient(): void {
    this.selectedClientData = {
      id_client: '',
      name: '',
      document_type: '',
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
    this.isEditing = false;
    this.showModal = true;
  }

  // **Editar Cliente**
  editClient(client: Client): void {
    this.selectedClientData = { ...client };
    this.isEditing = true;
    this.showModal = true;
  }

  // **Guardar Cliente (Insertar o Actualizar)**
  async saveClient(): Promise<void> {
    if (!this.selectedClientData) return;

    const clientToSave = {
      name: this.selectedClientData.name,
      document_type: this.selectedClientData.document_type,
      document_number: this.selectedClientData.document_number,
      cellphone: this.selectedClientData.cellphone,
      status: this.selectedClientData.status || 'upToDate',
      nit: this.selectedClientData.nit,
      company_name: this.selectedClientData.company_name || 'N/A',
      email: this.selectedClientData.email,
      debt: this.selectedClientData.debt || 0,
      address: this.selectedClientData.address,
      city: this.selectedClientData.city,
      province: this.selectedClientData.province,
      postal_code: this.selectedClientData.postal_code,
    };

    try {
      if (this.isEditing) {
        // **Actualizar cliente**
        const { error } = await this.supabase
          .from('clients')
          .update(clientToSave)
          .eq('id_client', this.selectedClientData.id_client);

        if (error) {
          console.error('Error actualizando cliente:', error);
          return;
        }
        alert('Cliente actualizado correctamente');
      } else {
        // **Añadir nuevo cliente**
        const { error } = await this.supabase
          .from('clients')
          .insert([clientToSave]);

        if (error) {
          console.error('Error añadiendo cliente:', error);
          return;
        }
        alert('Cliente añadido correctamente');
      }

      this.getClients();
      this.closeModal();
    } catch (error) {
      console.error('Error inesperado al guardar cliente:', error);
    }
  }

  // **Eliminar Cliente**
  async deleteClient(client: Client): Promise<void> {
    if (confirm(`¿Eliminar el cliente ${client.name}?`)) {
      try {
        const { error } = await this.supabase
          .from('clients')
          .delete()
          .eq('id_client', client.id_client);

        if (error) {
          console.error('Error eliminando cliente:', error);
          return;
        }

        alert('Cliente eliminado correctamente');
        this.getClients();
      } catch (error) {
        console.error('Error inesperado al eliminar cliente:', error);
      }
    }
  }

  // **Cerrar Modal**
  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
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
      order.order_payment_status === 'upToDate' ? 'Al Día' : 'En Mora',
      order.order_payment_status === 'upToDate' ? 'Al Día' : 'En Mora',
    ]);

    (doc as any).autoTable({
      head: [['#', 'Fecha', 'Detalles', 'Total', 'Estado']],
      body: orders,
      startY: 40,
    });

    //Save pdf
    doc.save(`Extracto-${this.selectedClient.name}`);
  }

  //Paginacion
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedClients(): void {
    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los clientes para la página actual
    this.paginatedClients = this.filteredClients.slice(startIndex, endIndex);

    // Calcular el número total de páginas
    this.totalPages = Math.ceil(this.filteredClients.length / this.itemsPerPage);

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  updatePaginatedOrders(): void {
    if (this.selectedClient?.orders?.length) {
      const startIndex = Number((this.currentOrderPage - 1) * this.itemsPerOrderPage);
      const endIndex = startIndex + Number(this.itemsPerOrderPage);
      this.paginatedOrders = this.selectedClient?.orders.slice(startIndex, endIndex) || [];
      this.totalOrderPages = Math.ceil((this.selectedClient?.orders.length || 0) / this.itemsPerOrderPage);
    } else {
      this.totalPages = 0;
    }
  }

  async updateClientStatus(client: Client, newStatus: string): Promise<void> {
    if (!client || !client.id_client) return;

    try {
      const { error } = await this.supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id_client', client.id_client);

      if (error) {
        console.error('Error actualizando el estado del cliente:', error);
        return;
      }

      // Actualizar localmente el estado del cliente sin necesidad de recargar todo
      client.status = newStatus;

      alert(`Estado actualizado a "${newStatus === 'upToDate' ? 'Al día' : 'En mora'}" correctamente`);
    } catch (error) {
      console.error('Error inesperado al actualizar estado:', error);
    }
  }

}

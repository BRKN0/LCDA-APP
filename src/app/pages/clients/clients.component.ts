import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';

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
  payments?: Payment[];
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
  credit_limit: number;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  orders?: Orders[];
}

interface Payment {
  id_payment?: number;
  id_order: string;
  amount: number;
  payment_date?: string;
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
  newPaymentAmount: number = 0;
  newPaymentAmounts: { [key: string]: number } = {};
  showClientModal = false; // Nueva variable para controlar el modal del cliente
  showDetails = false; // Nueva variable para controlar la visibilidad de los detalles
  userId: string | null = null;
  userRole: string | null = null;
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
    private readonly zone: NgZone,
    private readonly roleService: RoleService
  ) {}

    async ngOnInit(): Promise<void> {
      this.supabase.authChanges((_, session) => {
        if (session) {
          this.zone.run(() => {
            this.userId = session.user.id; // Añadir userId como propiedad si no existe
            this.roleService.fetchAndSetUserRole(this.userId);
            this.roleService.role$.subscribe((role) => {
              this.userRole = role;
            });
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
          created_at,
          order_quantity,
          unitary_value,
          iva,
          subtotal,
          total,
          amount,
          id_client,
          code,
          payments(*)
        )`
      );

      if (error) {
        console.error('Error al obtener clientes:', error);
        this.loading = false;
        return;
      }

      this.clients = data.map((client) => ({
        ...client,
        orders: Array.isArray(client.orders)
          ? client.orders.map((order: { payments: any; }) => ({
              ...order,
              payments: Array.isArray(order.payments) ? order.payments : [],
            }))
          : [],
      })) as Client[];

      this.filteredClients = this.clients;
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

  // Abrir el modal del cliente
  openClientModal(client: Client) {
    this.selectedClient = client;
    this.showClientModal = true;
    this.showDetails = false; // Detalles ocultos por defecto
    this.showOrders = false; // Pedidos ocultos por defecto
  }

  // Cerrar el modal del cliente
  closeClientModal() {
    this.showClientModal = false;
    this.selectedClient = null;
    this.showDetails = false;
    this.showOrders = false;
  }

  // Mostrar/Ocultar detalles del cliente
  toggleClientDetails() {
    this.showDetails = !this.showDetails;
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
      this.newPaymentAmounts = {};
      this.updatePaginatedOrders();
    } else {
      // Cierra la ventana modal y limpia el cliente seleccionado
      this.showOrders = false;
    }
  }

  async updateCreditLimit(client: Client | null): Promise<void> {
    if (!client || !client.id_client) {
      alert('No se ha seleccionado un cliente válido.');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('clients')
        .update({ credit_limit: client.credit_limit })
        .eq('id_client', client.id_client);

      if (error) {
        console.error('Error actualizando el límite de crédito:', error);
        alert('Error al actualizar el límite de crédito.');
        return;
      }

      alert('Límite de crédito actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  async addPayment(order: Orders, amount: number): Promise<void> {
    if (!order || !order.id_order || amount <= 0) {
      alert('Por favor, ingrese un monto válido.');
      return;
    }

    const payment: Payment = {
      id_order: order.id_order,
      amount: amount,
    };

    try {
      // Insertar el abono
      const { error: insertError } = await this.supabase
        .from('payments')
        .insert([payment]);

      if (insertError) {
        console.error('Error al añadir el abono:', insertError);
        alert('Error al añadir el abono.');
        return;
      }

      // Obtener la deuda actual del cliente
      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        alert('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;

      // Reducir la deuda del cliente
      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: currentDebt - amount })
        .eq('id_client', order.id_client);

      if (updateError) {
        console.error('Error al actualizar la deuda:', updateError);
        alert('Error al actualizar la deuda del cliente.');
        return;
      }

      // Actualizar localmente los datos del pedido
      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push({ ...payment, payment_date: new Date().toISOString() });

      // Actualizar el estado de pago del pedido si está completamente pagado
      const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = parseFloat(order.total) || 0;
      if (totalPaid >= orderTotal) {
        order.order_payment_status = 'upToDate';
        await this.supabase
          .from('orders')
          .update({ order_payment_status: 'upToDate' })
          .eq('id_order', order.id_order);
      } else {
        order.order_payment_status = 'overdue';
        await this.supabase
          .from('orders')
          .update({ order_payment_status: 'overdue' })
          .eq('id_order', order.id_order);
      }

      // NO recargar los datos completos para evitar cerrar el modal
      // await this.getOrders(); // Comentamos esta línea

      this.newPaymentAmount = 0; // Resetear el campo
      alert('Abono añadido correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

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
      name: this.selectedClientData.name || null,
      document_type: this.selectedClientData.document_type,
      document_number: this.selectedClientData.document_number || null,
      cellphone: this.selectedClientData.cellphone,
      status: this.selectedClientData.status || 'upToDate',
      nit: this.selectedClientData.nit || null,
      company_name: this.selectedClientData.company_name || null,
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

// Nueva función para generar el kardex de clientes
  generateClientsKardex(): void {
    console.log('Botón Generar Kardex clicado');
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      console.log('Fecha actual:', currentDate);

      const csvHeader = [
        'ID Cliente',
        'Nombre',
        'Correo',
        'Tipo de Documento',
        'Número de Documento',
        'NIT',
        'Empresa',
        'Teléfono',
        'Dirección',
        'Ciudad',
        'Provincia',
        'Código Postal',
        'Estado',
        'Deuda',
        'Fecha de Registro',
      ];

      console.log('filteredClients:', this.filteredClients);
      if (!this.filteredClients || this.filteredClients.length === 0) {
        console.warn('No hay clientes para exportar');
        alert('No hay clientes para generar el kardex');
        return;
      }

      const csvRows = this.filteredClients.map((client) => {
        console.log('Procesando cliente:', client);
        // Convertir debt a número y manejar casos no válidos
        const debtValue = typeof client.debt === 'number' ? client.debt : parseFloat(client.debt || '0');
        const formattedDebt = isNaN(debtValue) ? '0.00' : debtValue.toFixed(2);

        return [
          client.id_client,
          client.name || 'Sin Nombre',
          client.email || 'Sin Correo',
          client.document_type || 'N/A',
          client.document_number || 'N/A',
          client.nit || 'N/A',
          client.company_name || 'N/A',
          client.cellphone || 'Sin Teléfono',
          client.address || 'Sin Dirección',
          client.city || 'N/A',
          client.province || 'N/A',
          client.postal_code || 'N/A',
          client.status === 'upToDate' ? 'Al Día' : client.status === 'overdue' ? 'En Mora' : 'Desconocido',
          formattedDebt,
          client.created_at.split('T')[0] || currentDate,
        ].map((value) => `"${value}"`);
      });

      const csvContent = [csvHeader, ...csvRows].map((row) => row.join(';')).join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `clients_${currentDate}.csv`;
      document.body.appendChild(a);
      a.click();
      console.log('Archivo generado y clic simulado');
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error en generateClientsKardex:', error);
      alert('Ocurrió un error al generar el kardex');
    }
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

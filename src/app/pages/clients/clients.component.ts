import { Component, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

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
  iva: number;
  subtotal: string;
  total: string;
  amount: string;
  id_client: string;
  payments?: Payment[];
  include_iva?: boolean;
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
  default_discount?: number;
  /*tax_regime: number;
  is_declarante: boolean;
  retefuente: boolean;
  applies_ica_retention: boolean;*/
}

interface Payment {
  id_payment?: number;
  id_order: string;
  amount: number;
  payment_date?: string;
  payment_method: string;
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  modalExpanded = false;
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  showOrders = false;
  newPaymentAmount: number = 0;
  newPaymentAmounts: { [key: string]: number } = {};
  showClientModal = false;
  showDetails = false;
  userId: string | null = null;
  userRole: string | null = null;
  loading = true;
  searchQuery: string = '';
  filterDebt: boolean = false;
  noResultsFound: boolean = false;
  currentPage: number = 1;
  currentOrderPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;
  totalOrderPages: number = 1;
  itemsPerOrderPage: number = 10;
  paginatedClients: Client[] = [];
  paginatedOrders: Orders[] = [];
  selectedClientData: Partial<Client> = {};
  isEditing = false;
  isSaving = false;
  showModal = false;
  startDate: string = '';
  endDate: string = '';
  onlyWithDebt: boolean = false;
  selectedPaymentMethod: string = 'cash';
  showExtractFilters = false;
  extractStatusFilter: 'all' | 'overdue' = 'all';
  extractFromDate?: string;
  extractToDate?: string;
  extractMessage: string | null = null;
  newClient: Partial<Client> = {
    id_client: '',
    document_type: '',
    name: '',
    document_number: '0',
    status: 'overdue',
    created_at: new Date().toISOString(),
    cellphone: '0',
    nit: '',
    company_name: '',
    email: '',
    debt: 0,
    address: '',
    city: '',
    province: '',
    postal_code: '',
    /*tax_regime: 0,
    is_declarante: false,
    retefuente: false,
    applies_ica_retention: false,*/
  };
  ordersSummary = {
    totalBilled: 0,
    totalPaid: 0,
    outstandingBalance: 0,
  };
  showAddClientForm = false;
  IVA_RATE = 0.19;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService
  ) { }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
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
      `*, orders(
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
        payments(id_payment, id_order, amount, payment_date, payment_method)
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
        ? client.orders.map(
          (order: { payments: any; include_iva?: boolean; iva: number }) => ({
            ...order,
            payments: Array.isArray(order.payments) ? order.payments : [],
            include_iva: order.iva === 1,
          })
        )
        : [],
    })) as Client[];

    for (const client of this.clients) {
      const totalDebt = this.calculateClientDebt(client);
      const hasOverdueOrder = client.orders?.some(
        (order) => order.order_payment_status === 'overdue'
      );
      const newStatus =
        totalDebt > 0 || hasOverdueOrder ? 'overdue' : 'upToDate';

      if (client.debt !== totalDebt || client.status !== newStatus) {
        client.debt = totalDebt;
        client.status = newStatus;
        await this.supabase
          .from('clients')
          .update({ debt: totalDebt, status: newStatus })
          .eq('id_client', client.id_client);
      }
    }

    this.clients.sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    this.filteredClients = this.clients;
    this.updatePaginatedClients();
    this.loading = false;
  }

  /*taxRegimeConfig: Record<number, { is_declarante: boolean; retefuente: boolean; applies_ica_retention: boolean }> = {
    1: { is_declarante: true, retefuente: true, applies_ica_retention: true }, // Autorretenedor
    2: { is_declarante: true, retefuente: true, applies_ica_retention: true }, // Gran Contribuyente
    3: { is_declarante: true, retefuente: true, applies_ica_retention: false }, // Responsable IVA
    4: { is_declarante: false, retefuente: false, applies_ica_retention: false }, // No Responsable
    5: { is_declarante: false, retefuente: false, applies_ica_retention: false }, // Simple
  };

  onTaxRegimeChange(selectedValue: number): void {
    const config = this.taxRegimeConfig[selectedValue];
    if (config && this.selectedClientData) {
      this.selectedClientData.is_declarante = config.is_declarante;
      this.selectedClientData.retefuente = config.retefuente;
      this.selectedClientData.applies_ica_retention = config.applies_ica_retention;
    }
  }*/

  calculateClientDebt(client: Client): number {
    if (!client.orders || client.orders.length === 0) return 0;

    const totalOrders = client.orders.reduce((sum, order) => {
      const orderTotal = this.calculateOrderTotal(order);
      const totalPaid =
        order.payments?.reduce(
          (paidSum, payment) => paidSum + payment.amount,
          0
        ) || 0;
      return sum + (orderTotal - totalPaid);
    }, 0);

    return Math.max(0, totalOrders);
  }

  calculateOrderTotal(order: Orders): number {
    const baseTotal = parseFloat(order.total) || 0;
    if (order.include_iva) {
      return baseTotal + baseTotal * this.IVA_RATE;
    }
    return baseTotal;
  }

  formatPaymentMethod(method: string): string {
    switch (method) {
      case 'cash':
        return 'Efectivo';
      case 'nequi':
        return 'Nequi';
      case 'bancolombia':
        return 'Bancolombia';
      case 'davivienda':
        return 'Davivienda';
      case 'other':
        return 'Otro';
      default:
        return method;
    }
  }

  async applyGlobalPaymentToSelectedClient(amount: number, paymentMethod: string) {
    if (!this.selectedClient) {
      alert('No hay cliente seleccionado.');
      return;
    }

    if (!amount || amount <= 0) {
      alert('Ingrese un monto válido.');
      return;
    }

    await this.allocatePaymentAcrossOrders(this.selectedClient, amount, paymentMethod);

    this.newPaymentAmount = 0;
    this.selectedPaymentMethod = 'cash';
  }


  getOrderDebt(order: Orders): number {
    const total = this.calculateOrderTotal(order);
    const paid = order.payments?.reduce((s, p) => s + p.amount, 0) || 0;
    return Math.max(0, total - paid);
  }

  async allocatePaymentAcrossOrders(client: Client, amount: number, paymentMethod: string = 'cash'): Promise<void> {
    if (!client || !client.orders || amount <= 0) {
      alert('Cliente o monto inválido.');
      return;
    }

    // Ordena por más antiguo
    const ordersByOldest = [...client.orders].sort((a, b) => {
      const dateDiff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

      if (dateDiff !== 0) return dateDiff;

      // Desempate por código: menor código = pedido más antiguo
      return a.code - b.code;
    });

    let remaining = amount;
    const paymentsBatch: Payment[] = [];
    const ordersToUpdate: Array<{ id_order: string; newStatus: string }> = [];

    for (const order of ordersByOldest) {
      if (remaining <= 0) break;

      const debt = this.getOrderDebt(order);
      if (debt <= 0) continue;

      const applied = Math.min(remaining, debt);
      remaining -= applied;

      // acumula el payment para este pedido
      paymentsBatch.push({
        id_order: order.id_order,
        amount: applied,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
      });

      // actualiza en memoria
      if (!order.payments) order.payments = [];
      order.payments.push({
        id_order: order.id_order,
        amount: applied,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
      });

      const newDebt = this.getOrderDebt(order);
      // Si manejas solo 'overdue' | 'upToDate':
      const newStatus = newDebt <= 0 ? 'upToDate' : 'overdue';
      ordersToUpdate.push({ id_order: order.id_order, newStatus });
      order.order_payment_status = newStatus;
    }

    // Persistencia: inserta todos los payments y actualiza estados de pedidos
    try {
      if (paymentsBatch.length) {
        const { error: insertErr } = await this.supabase.from('payments').insert(paymentsBatch);
        if (insertErr) {
          console.error('Error insertando pagos masivos:', insertErr);
          alert('Error al registrar los abonos.');
          return;
        }
      }

      // Actualiza estado de pedidos afectados (uno por uno para claridad)
      for (const upd of ordersToUpdate) {
        const { error: updErr } = await this.supabase
          .from('orders')
          .update({ order_payment_status: upd.newStatus })
          .eq('id_order', upd.id_order);
        if (updErr) {
          console.error('Error actualizando estado de pedido:', updErr, upd.id_order);
        }

        await this.syncInvoiceStatusForOrder(upd.id_order, upd.newStatus);
      }

      // Recalcula deuda/estado del cliente y persiste
      const totalDebt = this.calculateClientDebt(client);
      const hasOverdue = client.orders?.some(o => o.order_payment_status === 'overdue');
      const newClientStatus = (totalDebt > 0 || hasOverdue) ? 'overdue' : 'upToDate';

      client.debt = totalDebt;
      client.status = newClientStatus;

      await this.supabase
        .from('clients')
        .update({ debt: totalDebt, status: newClientStatus })
        .eq('id_client', client.id_client);

      // Refresca UI local
      this.clients = this.clients.map(c =>
        c.id_client === client.id_client ? { ...client } : c
      );
      this.filteredClients = [...this.clients];
      this.updatePaginatedClients();

      if (this.selectedClient && this.selectedClient.id_client === client.id_client) {
        this.selectedClient = { ...client };
        this.updatePaginatedOrders();
      }

      const aplicado = amount - remaining;
      alert(`Abono aplicado: $${aplicado.toFixed(2)}. Saldo sin aplicar: $${remaining.toFixed(2)}.`);
    } catch (err) {
      console.error('Error en allocatePaymentAcrossOrders:', err);
      alert('Ocurrió un error aplicando el abono global.');
    }
  }

  // En ClientsComponent
  private async syncInvoiceStatusForOrder(
    id_order: string,
    status: string // acepta string
  ): Promise<void> {
    // normaliza a los únicos valores válidos
    const normalized: 'upToDate' | 'overdue' =
      status === 'upToDate' ? 'upToDate' : 'overdue';

    const { error } = await this.supabase
      .from('invoices')
      .update({ invoice_status: normalized })
      .eq('id_order', id_order); // ajusta si tu relación es por id_invoice

    if (error) {
      console.error('Error actualizando invoice_status:', error, id_order, status);
    }
  }



  searchClient() {
    this.filteredClients = this.clients.filter((client) => {
      const matchesSearchQuery =
        client.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (client.company_name &&
          client.company_name
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase()));
      const matchesDebtFilter = !this.filterDebt || client.status === 'overdue';

      return matchesSearchQuery && matchesDebtFilter;
    });

    this.noResultsFound = this.filteredClients.length === 0;
    this.currentPage = 1;
    this.updatePaginatedClients();
  }

  openClientModal(client: Client) {
    this.selectedClient = { ...client };
    this.showClientModal = true;
    this.showDetails = false;
    this.showOrders = false;
  }

  closeClientModal() {
    this.showClientModal = false;
    this.selectedClient = null;
    this.showDetails = false;
    this.showOrders = false;
    this.showExtractFilters = false;
    this.extractMessage = null;
    this.resetExtractFilters();
  }

  toggleClientDetails() {
    this.showDetails = !this.showDetails;

    if (this.showDetails) {
      this.showOrders = false;
      this.showExtractFilters = false;
    }

    this.modalExpanded = this.showDetails;
  }

  toggleExtractFilters() {
    this.showExtractFilters = !this.showExtractFilters;

    if (this.showExtractFilters) {
      this.showOrders = false;
      this.showDetails = false;
      this.modalExpanded = false;
    } else {
      this.resetExtractFilters();
    }
  }

  toggleOrders(client: Client | null): void {
    if (client) {
      if (!Array.isArray(client.orders)) {
        console.error('Orders is not an array:', client.orders);
        return;
      }
      this.startDate = '';
      this.endDate = '';
      this.onlyWithDebt = false;
      this.selectedClient = {
        ...client,
        orders: [...client.orders].sort((a, b) => b.code - a.code)
      };
      this.showOrders = true;
      this.showDetails = false;
      this.showExtractFilters = false;
      this.modalExpanded = false;
      this.currentOrderPage = 1;
      this.newPaymentAmounts = {};
      this.updatePaginatedOrders();
    } else {
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
      payment_method: 'cash',
    };

    try {
      const { error: insertError } = await this.supabase
        .from('payments')
        .insert([payment]);

      if (insertError) {
        console.error('Error al añadir el abono:', insertError);
        alert('Error al añadir el abono.');
        return;
      }

      const orderTotal = this.calculateOrderTotal(order);
      const totalPaid =
        (order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0) + amount;
      const newOrderStatus = totalPaid >= orderTotal ? 'upToDate' : 'overdue';

      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push({
        ...payment,
        payment_date: new Date().toISOString(),
      });

      await this.supabase
        .from('orders')
        .update({ order_payment_status: newOrderStatus })
        .eq('id_order', order.id_order);

      const client = this.clients.find((c) => c.id_client === order.id_client);
      if (client) {
        const totalDebt = this.calculateClientDebt(client);
        const hasOverdueOrder = client.orders?.some(
          (o) => o.order_payment_status === 'overdue'
        );
        const newStatus =
          totalDebt > 0 || hasOverdueOrder ? 'overdue' : 'upToDate';

        if (client.debt !== totalDebt || client.status !== newStatus) {
          client.debt = totalDebt;
          client.status = newStatus;
          await this.supabase
            .from('clients')
            .update({ debt: totalDebt, status: newStatus })
            .eq('id_client', client.id_client);
        }

        if (
          this.selectedClient &&
          this.selectedClient.id_client === client.id_client
        ) {
          this.selectedClient.debt = totalDebt;
          this.selectedClient.status = newStatus;
          const updatedOrder = this.selectedClient.orders?.find(
            (o) => o.id_order === order.id_order
          );
          if (updatedOrder) {
            updatedOrder.order_payment_status = newOrderStatus;
            updatedOrder.payments = order.payments;
          }
        }

        this.clients = this.clients.map((c) =>
          c.id_client === client.id_client
            ? {
              ...c,
              debt: totalDebt,
              status: newStatus,
              orders: client.orders,
            }
            : c
        );
        this.filteredClients = [...this.clients];
        this.updatePaginatedClients();
      }

      this.newPaymentAmount = 0;
      alert('Abono añadido correctamente.');
      this.updatePaginatedOrders();
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
      document_number: '0',
      status: 'upToDate',
      cellphone: '0',
      nit: '',
      company_name: '',
      email: '',
      debt: 0,
      address: '',
      city: '',
      province: '',
      postal_code: '',
      default_discount: 0
      /*tax_regime: 0,
      is_declarante: false,
      retefuente: false,
      applies_ica_retention: false,*/
    };
    this.isEditing = false;
    this.showModal = true;
  }

  editClient(client: Client): void {
    this.selectedClientData = { ...client };
    this.isEditing = true;
    this.showModal = true;
  }

  async saveClient(): Promise<void> {
    if (this.isSaving) return;
    if (!this.selectedClientData) return;

    if (!this.selectedClientData.name) {
      alert('Por favor, digite nombre del cliente.');
      return;
    }
    this.isSaving = true;
    const clientToSave = {
      name: this.selectedClientData.name?.toUpperCase().trim() || null,
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
      /*tax_regime: this.selectedClientData.tax_regime,
      is_declarante: this.selectedClientData.is_declarante || false,
      retefuente: this.selectedClientData.retefuente || false,
      applies_ica_retention: this.selectedClientData.applies_ica_retention || false,*/
      credit_limit: this.selectedClientData.credit_limit,
      default_discount: this.selectedClientData.default_discount || 0
    };

    try {
      if (this.isEditing) {
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
    } finally{
      this.isSaving=false;
    }
  }

  async deleteClient(client: Client): Promise<void> {
    if (
      confirm(`¿Eliminar el cliente ${client.company_name || client.name}?`)
    ) {
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

  private calculateOrdersSummary(orders: Orders[]): void {
    const totalBilled = orders.reduce(
      (sum, order) => sum + this.calculateOrderTotal(order),
      0
    );

    const totalPaid = orders.reduce((sum, order) => {
      const paid =
        order.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
      return sum + paid;
    }, 0);

    this.ordersSummary = {
      totalBilled,
      totalPaid,
      outstandingBalance: Math.max(0, totalBilled - totalPaid),
    };
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
  }

  resetExtractFilters() {
    this.extractStatusFilter = 'all';
    this.extractFromDate = undefined;
    this.extractToDate = undefined;
    this.extractMessage = null;
  }

  generatePDF(): boolean {
    if (!this.selectedClient || !this.selectedClient.orders) {
      this.extractMessage = 'No hay datos para generar el extracto.';
      return false;
    }

    let filteredOrders = [...this.selectedClient.orders];

    //  FILTRO POR FECHA (SIEMPRE)
    if (this.extractFromDate && this.extractToDate) {
      const from = new Date(this.extractFromDate).setHours(0, 0, 0, 0);
      const to = new Date(this.extractToDate).setHours(23, 59, 59, 999);

      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.created_at).getTime();
        return orderDate >= from && orderDate <= to;
      });
    }

    //  FILTRO POR ESTADO (OPCIONAL)
    if (this.extractStatusFilter === 'overdue') {
      filteredOrders = filteredOrders.filter(
        order => this.getOrderDebt(order) > 0
      );
    }

    if (filteredOrders.length === 0) {
      this.extractMessage =
        'No hay pedidos que coincidan con los filtros seleccionados.';
      return false;
    }

    // ===== RESÚMENES DEL EXTRACTO (SOLO SOBRE filteredOrders) =====
    const totalFacturado = filteredOrders.reduce((sum, order) => {
      return sum + this.calculateOrderTotal(order);
    }, 0);

    const totalAbonado = filteredOrders.reduce((sum, order) => {
      const paid =
        order.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
      return sum + paid;
    }, 0);

    const totalDeuda = Math.max(0, totalFacturado - totalAbonado);

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(
      `Extracto de Cliente: ${this.selectedClient.company_name || this.selectedClient.name
      }`,
      10,
      10
    );

    const orders = filteredOrders.map((order: Orders) => {
      const debt = this.getOrderDebt(order);

      return [
        order.code,
        new Date(order.created_at).toLocaleDateString('es-CO'),
        order.description,
        `$${this.formatCurrency(this.calculateOrderTotal(order))}`,
        debt > 0 ? `$${this.formatCurrency(debt)}` : '0',
        order.order_payment_status === 'upToDate' ? 'Al Día' : 'En Mora',
        (order.payments || [])
          .map(
            (p) =>
              `$${this.formatCurrency(p.amount)} - ${this.formatPaymentMethod(
                p.payment_method
              )} - ${p.payment_date
                ? new Date(p.payment_date).toLocaleDateString('es-CO')
                : 'Sin fecha'
              }`
          )
          .join('\n'),
      ];
    });


    const tableResult = (doc as any).autoTable({
      head: [['#', 'Fecha', 'Detalles', 'Total', 'Deuda', 'Estado', 'Abonos']],
      body: orders,
      startY: 40,
    });

    const finalY =
      typeof tableResult.finalY === 'number'
        ? tableResult.finalY
        : (doc as any).lastAutoTable?.finalY || 40;

    let summaryY = finalY + 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del extracto', 10, summaryY);

    summaryY += 6;
    doc.setFont('helvetica', 'normal');

    doc.text(`Total facturado: $${this.formatCurrency(totalFacturado)}`, 10, summaryY);
    summaryY += 5;

    doc.text(`Total abonado: $${this.formatCurrency(totalAbonado)}`, 10, summaryY);
    summaryY += 5;

    doc.text(`Saldo pendiente: $${this.formatCurrency(totalDeuda)}`, 10, summaryY);
    doc.save(
      `Extracto-${this.selectedClient.name}.pdf`
    );

    return true;
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  downloadExtract() {
    this.extractMessage = null;

    const success = this.generatePDF();

    if (!success) return;

    this.resetExtractFilters();
    this.showExtractFilters = false;
  }

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
        const debtValue =
          typeof client.debt === 'number'
            ? client.debt
            : parseFloat(client.debt || '0');
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
          client.province || '',
          client.postal_code || 'N/A',
          client.status === 'upToDate'
            ? 'Al Día'
            : client.status === 'overdue'
              ? 'En Mora'
              : 'Desconocido',
          formattedDebt,
          client.created_at.split('T')[0] || currentDate,
        ].map((value) => `"${value}"`);
      });

      const csvContent = [csvHeader, ...csvRows]
        .map((row) => row.join(';'))
        .join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], {
        type: 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `clients_${currentDate}.csv`;
      document.body.appendChild(a);
      a.click();
      console.log('Archivo generado y clicado');
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error en generateClientsKardex:', error);
      alert('Error al generar el kardex.');
    }
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedClients(): void {
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedClients = this.filteredClients.slice(startIndex, endIndex);
    this.totalPages = Math.ceil(
      this.filteredClients.length / this.itemsPerPage
    );

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  updatePaginatedOrders(): void {
    if (this.selectedClient?.orders?.length) {
      let filteredOrders = [...this.selectedClient.orders];

      if (this.startDate) {
        const start = new Date(this.startDate);
        filteredOrders = filteredOrders.filter((order) =>
          new Date(order.created_at) >= start
        );
      }

      if (this.endDate) {
        const end = new Date(this.endDate);
        filteredOrders = filteredOrders.filter((order) =>
          new Date(order.created_at) <= end
        );
      }

      if (this.onlyWithDebt) {
        filteredOrders = filteredOrders.filter(
          (order) => order.order_payment_status === 'overdue'
        );
      }

      const startIndex = (this.currentOrderPage - 1) * this.itemsPerOrderPage;
      const endIndex = startIndex + this.itemsPerOrderPage;
      this.paginatedOrders = filteredOrders.slice(startIndex, endIndex);
      this.totalOrderPages = Math.ceil(
        filteredOrders.length / this.itemsPerOrderPage
      );
      
      this.calculateOrdersSummary(filteredOrders);
    } else {
      this.paginatedOrders = [];
      this.totalOrderPages = 0;
    }
  }

  clearDateFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.onlyWithDebt = false;
    this.currentOrderPage = 1;
    this.updatePaginatedOrders();
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

      client.status = newStatus;
      alert(
        `Estado actualizado a "${newStatus === 'upToDate' ? 'Al día' : 'En mora'
        }" correctamente`
      );
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  }
  clearFilters(): void {
    this.searchQuery = '';
    this.filterDebt = false;
    this.filteredClients = this.clients;
    this.currentPage = 1;
    this.updatePaginatedClients();
    this.noResultsFound = false;
  }

  get submitButtonText(): string {
    if (this.isSaving) return 'Guardando...';
    return this.isEditing ? 'Actualizar' : 'Guardar';
  }


}

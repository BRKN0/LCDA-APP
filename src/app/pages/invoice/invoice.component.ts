import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { Router, RouterOutlet } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';

interface Invoice {
  id_invoice: string;
  created_at: Date | string;
  invoice_status: string;
  id_order: string;
  code: string;
  payment_term: number | null;
  order: Orders;
  include_iva: boolean;
  due_date: string | null;
  classification: string;
  e_invoice_done: boolean;
}

interface Employee {
  id_employee: string;
  name: string;
  id_user: string;
  employee_type?: string;
}

interface VitrineSaleItem {
  product_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_name: string;
}

interface InvoicePermission {
  id: number;
  id_invoice: string;
  id_user: string;
  employee_details?: Employee;
}
interface VariableMap {
  iva: number;
  utility_margin: number;
  retefuente_bienes_declara: number;
  retefuente_bienes_no_declara: number;
  retefuente_servicios_declara: number;
  retefuente_servicios_no_declara: number;
  reteica_bienes: number;
  reteica_servicios: number;
}
interface Orders {
  id_order: string;
  order_type: string;
  secondary_process?: string;
  name: string;
  description: string;
  order_payment_status: string;
  order_completion_status?: string;
  created_at: Date;
  order_quantity: number;
  unitary_value: number;
  iva?: number;
  subtotal?: number;
  total?: number;
  amount: number;
  id_client: string;
  client: Client;
  payments?: Payment[];
  delivery_date: string;
  baseTotal?: number;
  requires_e_invoice: boolean;
  is_vitrine: boolean;
  include_iva?: boolean;
}

interface Client {
  id_client: string;
  name: string;
  document_type: string;
  document_number: string;
  cellphone: string;
  nit: string;
  email: string;
  status: string;
  debt: number;
  address: string;
  city: string;
  /*province: string;
  postal_code: string;
  tax_regime: number;
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
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss'],
})
export class InvoiceComponent implements OnInit {
  clients: Client[] = [];
  invoices: Invoice[] = [];
  orders: Orders[] = [];
  invoice: Invoice | null = null;
  showPrints = true;
  showCuts = true;
  showSales = true;
  showDebt = false;
  showRequiresFE = true;
  showNoRequiresFE = true;
  showFEPending = true;
  showFEDone = true;
  showVitrineSales = true;
  showNonVitrineSales = true;
  selectedInvoiceDetails: Invoice[] | null = null;
  loading = true;
  searchQuery: string = '';
  nameSearchQuery: string = '';
  clientSearchQuery: string = '';
  filteredInvoicesList: Invoice[] = [];
  filteredClients: Client[] = [];
  selectedPaymentMethodFilter: string = 'all';
  clientOrders: Orders[] = [];
  noResultsFound: boolean = false;
  startDate: string = '';
  endDate: string = '';
  paymentDateStart: string = '';
  paymentDateEnd: string = '';
  isEditing = false;
  isSaving = false;
  showModal = false;
  showAddClientModal = false;
  showClientDropdown: boolean = false;
  selectedInvoice: Invoice | null = null;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedInvoice: Invoice[] = [];
  IVA_RATE = 0;
  newPaymentAmount: number = 0;
  newPaymentMethod: string = '';
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;
  calculatedValues: {
    subtotal: number;
    iva: number;
    total: number;
    /*reteica: number;
    retefuente: number;*/
  } | null = null;

  vitrineSalesDetails: VitrineSaleItem[] = [];


  variables: VariableMap = {
    iva: 0,
    utility_margin: 0,
    retefuente_bienes_declara: 0,
    retefuente_bienes_no_declara: 0,
    retefuente_servicios_declara: 0,
    retefuente_servicios_no_declara: 0,
    reteica_bienes: 0,
    reteica_servicios: 0,
  };
  variablesMap: Record<string, number> = {};
  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '',
    cellphone: '',
    address: '',
    status: '',
  };
  showDailySummary: boolean = false;
  dailySummary = {
    totalScheduled: 0,
    totalPaid: 0,
    rangeDebt: 0,
    pendingDebt: 0,
    invoiceCount: 0,
    totalIVA: 0
  };

  // permission variables
  showPermissionModal: boolean = false;
  schedulers: Employee[] = [];
  currentPermissions: InvoicePermission[] = [];
  selectedUserId: string = '';
  permissionLoading: boolean = false;
  userRole: string | null = null;
  userId: string | null = null;
  canManagePayments: boolean = false;

  // Variables para autocompletado de clientes en búsqueda
  showClientNameSuggestions = false;
  clientNameSuggestions: Client[] = [];
  clientNameSelected = false;

/**
* Cierra el dropdown de sugerencias al hacer clic fuera
*/
@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const clickedInside = target.closest('.search-name-container');

  if (!clickedInside) {
    this.showClientNameSuggestions = false;
  }
}


  private pct(n: number | null | undefined, digits = 0): string {
    const v = Number(n ?? 0);
    return `${(v * 100).toFixed(digits)}%`;
  }

  ivaLabel(): string {
    return `IVA (${this.pct(this.IVA_RATE, 0)})`;
  }

  /**
  * Normaliza texto para que no tenga en cuenta algun acento o mayúscula
  */
  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
  /*retefuenteLabel(invoice: Invoice): string {
    const classKey = this.normalizeClassification(invoice.classification);
    const declara = invoice.order.client.is_declarante
      ? 'declara'
      : 'no_declara';
    const key =
      classKey === 'bienes'
        ? (`retefuente_bienes_${declara}` as keyof VariableMap)
        : (`retefuente_servicios_${declara}` as keyof VariableMap);
    return `Retefuente (${this.pct(this.variables[key], 2)})`;
  }

  reteicaLabel(invoice: Invoice): string {
    const classKey = this.normalizeClassification(invoice.classification);
    const key =
      classKey === 'bienes'
        ? ('reteica_bienes' as keyof VariableMap)
        : ('reteica_servicios' as keyof VariableMap);
    return `ReteICA (${this.pct(this.variables[key], 2)})`;
  }*/
  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly router: Router,
    private readonly roleService: RoleService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          if (this.userId !== session.user.id) {
            this.userId = session.user.id;
            this.roleService.fetchAndSetUserRole(this.userId);
            this.roleService.role$.subscribe((role) => {
              this.userRole = role;
            });
            console.log('user role is: ', this.userRole);
            this.getInvoices();
            this.getClients();
            this.loadOrders();
            this.getVariables();
          }
        });
      }
    });
    this.updateFilteredInvoices();
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }
    this.clients = data;
    this.filteredClients = [...this.clients];
  }
  async getVariables() {
    const { data, error } = await this.supabase
      .from('variables')
      .select('name, value');

    if (error) {
      console.error('Error loading variables:', error);
      return;
    }

    const tmp: Partial<VariableMap> = {};
    for (const row of data ?? []) {
      const key = String(row.name) as keyof VariableMap;
      const raw = Number(row.value);
      if (Number.isFinite(raw)) {
        (tmp as any)[key] = raw / 100;
      }
    }

    this.variables = {
      iva: tmp.iva ?? 0,
      utility_margin: tmp.utility_margin ?? 0,
      retefuente_bienes_declara: tmp.retefuente_bienes_declara ?? 0,
      retefuente_bienes_no_declara: tmp.retefuente_bienes_no_declara ?? 0,
      retefuente_servicios_declara: tmp.retefuente_servicios_declara ?? 0,
      retefuente_servicios_no_declara: tmp.retefuente_servicios_no_declara ?? 0,
      reteica_bienes: tmp.reteica_bienes ?? 0,
      reteica_servicios: tmp.reteica_servicios ?? 0,
    };
    this.IVA_RATE = this.variables.iva || 0;
  }
  async saveNewClient(): Promise<void> {
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }
    this.isSaving = true;

    try {
      const { data, error } = await this.supabase
        .from('clients')
        .insert([this.newClient]);

      if (error) {
        console.error('Error añadiendo el cliente:', error);
        alert('Error al añadir el cliente.');
        return;
      }

      alert('Cliente añadido correctamente.');
      this.closeAddClientModal();
      await this.getClients();
    } catch (error) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
    } finally {
      this.isSaving = false;
    }
  }

  searchClients(): void {
    if (!this.clientSearchQuery.trim()) {
      this.filteredClients = [...this.clients];
      return;
    }

    this.filteredClients = this.clients.filter((client) =>
      client.name.toLowerCase().includes(this.clientSearchQuery.toLowerCase()),
    );
  }

  selectClient(client: Client): void {
    if (this.selectedInvoice) {
      this.selectedInvoice.order.id_client = client.id_client;
      this.selectedInvoice.order.client = { ...client };
      this.clientSearchQuery = `${client.name}`;
      this.showClientDropdown = false;
      this.updateClientOrders();
    }
  }

  hideClientDropdown(): void {
    setTimeout(() => {
      this.showClientDropdown = false;
    }, 200);
  }

  updateClientOrders(): void {
    if (!this.selectedInvoice || !this.selectedInvoice.order) {
      this.clientOrders = [];
      return;
    }

    const selectedClientId = this.selectedInvoice.order.id_client;
    const selectedOrderType = this.selectedInvoice.order.order_type;

    if (selectedClientId) {
      this.clientOrders = this.orders.filter((order) => {
        const matchesClient = order.id_client === selectedClientId;
        const matchesType = order.order_type === selectedOrderType;
        const isAssigned = this.invoices.some(
          (invoice) =>
            invoice.id_order === order.id_order &&
            (!this.isEditing ||
              (this.selectedInvoice &&
                invoice.id_invoice !== this.selectedInvoice.id_invoice)),
        );
        return matchesClient && matchesType && !isAssigned;
      });
      console.log('Órdenes disponibles para el cliente:', this.clientOrders);
    } else {
      this.clientOrders = [];
    }
  }

  navigateToAddClient(): void {
    this.router.navigate(['/clients']);
    this.closeModal();
  }

  async onSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      alert('Por favor, ingrese un número de factura.');
      return;
    }

    this.loading = true;

    const { data, error } = await this.supabase
      .from('invoices')
      .select(
        `
        *,
        orders(*,
          clients(*),
          payments(*)
        )
      `,
      )
      .eq('code', this.searchQuery.trim());
    this.loading = false;
    if (error) {
      console.error('Error fetching invoice:', error);
      alert('Error al buscar la factura.');
      return;
    }

    if (!data || data.length === 0) {
      alert('Factura no encontrada.');
      this.searchQuery = '';
      this.updatePaginatedInvoices();
      return;
    }

    this.filteredInvoicesList = (data || []).map((inv: any) => ({
      ...inv,
      order: {
        ...inv.orders,
        client: inv.orders?.clients || null,
        payments: inv.orders?.payments || [],
      },
    }));
    this.currentPage = 1;
    this.updatePaginatedInvoices();
  }

  async getInvoices() {
    this.loading = true;
    const { data, error } = await this.supabase.from('invoices').select(`
      *,
      orders(*,
        clients(*),
        payments(*)
      )
    `);
    if (error) {
      console.error('Error fetching invoices:', error);
      this.loading = false;
      return;
    }

    this.invoices = [...data].map((invoice) => {
      // Usar el payment_term guardado en la base de datos, solo calcular si es null
      let paymentTerm =
        invoice.payment_term !== null ? invoice.payment_term : 5;
      return {
        ...invoice,
        include_iva: invoice.include_iva ?? false,
        due_date: invoice.due_date,
        payment_term: paymentTerm, // Usar el valor guardado o calculado solo si es null
        order: {
          ...invoice.orders,
          total: invoice.orders.total || invoice.orders.amount || 0,
          client: invoice.orders?.clients || null,
          payments: invoice.orders?.payments || [],
          is_vitrine: !!invoice.orders?.is_vitrine,
        },
      };
    }) as Invoice[];

    let n = this.invoices.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.invoices[i].code < this.invoices[i + 1].code) {
          [this.invoices[i], this.invoices[i + 1]] = [
            this.invoices[i + 1],
            this.invoices[i],
          ];
          swapped = true;
        }
      }
      n--;
    } while (swapped);

    this.loading = false;
    this.updateFilteredInvoices();
    this.syncInvoicesStatusOnLoad(this.invoices).catch((err) => {
      console.error('Error syncing invoice status:', err);
    });
  }

  updateFilteredInvoices(): void {
    if (!this.invoices || this.invoices.length === 0) {
      this.filteredInvoicesList = [];
      this.paginatedInvoice = [];
      this.noResultsFound = true;
      return;
    }

    const allTypeCheckboxesOff =
      !this.showPrints && !this.showCuts && !this.showSales;

    this.filteredInvoicesList = this.invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.created_at);
      const matchesStartDate = this.startDate
        ? invoiceDate >= new Date(this.startDate)
        : true;
      const matchesEndDate = this.endDate
        ? invoiceDate <= new Date(this.endDate + 'T23:59:59')
        : true;
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const normalizedNameSearch = this.normalizeText(this.nameSearchQuery);
      const normalizedClientName = this.normalizeText(invoice.order.client.name);
      const matchesNameSearch =
        !this.nameSearchQuery ||
        normalizedClientName.includes(normalizedNameSearch);

      if (allTypeCheckboxesOff) {
        return matchesDateRange && matchesNameSearch;
      }

      const isDebtFilter = this.showDebt
        ? invoice.invoice_status === 'overdue'
        : true;

      const isPrintsFilter =
        this.showPrints && invoice.order.order_type === 'print';
      const isCutsFilter =
        this.showCuts && invoice.order.order_type === 'laser';
      const isSalesFilter =
        this.showSales && invoice.order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      let matchesVitrine = true;

      if (invoice.order.order_type === 'sales') {
        matchesVitrine =
          (this.showVitrineSales && invoice.order.is_vitrine) ||
          (this.showNonVitrineSales && !invoice.order.is_vitrine);
      }

      const matchesRequiresFE =
        (this.showRequiresFE && invoice.order.requires_e_invoice) ||
        (this.showNoRequiresFE && !invoice.order.requires_e_invoice);

      let matchesFEStatus = true;

      if (invoice.order.requires_e_invoice) {
        matchesFEStatus =
          (this.showFEPending && !invoice.e_invoice_done) ||
          (this.showFEDone && invoice.e_invoice_done);
      }

      let matchesPaymentFilters = true;

      const hasPaymentMethodFilter = this.selectedPaymentMethodFilter !== 'all';
      const hasPaymentDateFilter = this.paymentDateStart || this.paymentDateEnd;

      if (hasPaymentMethodFilter || hasPaymentDateFilter) {
        const paymentStart = this.paymentDateStart
          ? new Date(this.paymentDateStart + 'T00:00:00')
          : null;

        const paymentEnd = this.paymentDateEnd
          ? new Date(this.paymentDateEnd + 'T23:59:59')
          : null;

        const payments = invoice.order?.payments || [];

        matchesPaymentFilters = payments.some((p) => {
          if (!p.payment_date) return false;

          const paymentDate = new Date(p.payment_date);

          const matchesDate =
            !hasPaymentDateFilter ||
            ((!paymentStart || paymentDate >= paymentStart) &&
              (!paymentEnd || paymentDate <= paymentEnd));

          const matchesMethod =
            !hasPaymentMethodFilter ||
            p.payment_method === this.selectedPaymentMethodFilter;

          return matchesDate && matchesMethod;
        });
      }

      return (
        isDebtFilter &&
        matchesType &&
        matchesVitrine &&
        matchesDateRange &&
        matchesNameSearch &&
        matchesRequiresFE &&
        matchesFEStatus &&
        matchesPaymentFilters
      );
    });

    this.noResultsFound = this.filteredInvoicesList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedInvoices();

    if (this.showDailySummary) {
      this.calculateSummary();
    }
  }

  async calculateInvoiceValues(invoice: Invoice): Promise<{
    subtotal: number;
    iva: number;
    total: number;
    /*reteica: number;
    retefuente: number;*/
  }> {
    const order = invoice.order;
    const cliente = order.client;
    const classKey = this.normalizeClassification(invoice.classification);
    let subtotal = 0;
    let iva = 0;
    let total = subtotal;

    if (invoice.include_iva && order.total) {
      const gross = order.total;
      const denom = 1 + (this.IVA_RATE || 0);
      subtotal = +(gross / denom).toFixed(2);
      iva = +(gross - subtotal).toFixed(2);
      iva = Number(iva.toFixed(2));
      total = gross;
    } else {
      subtotal = +(order.total || 0).toFixed(2);
      iva = 0;
      total = subtotal;
    }

    /*let retefuente = 0;
    if (cliente?.retefuente && invoice.include_iva) {
      const declara = cliente.is_declarante ? 'declara' : 'no_declara';
      const key = (
        classKey === 'bienes'
          ? `retefuente_bienes_${declara}`
          : `retefuente_servicios_${declara}`
      ) as keyof VariableMap;

      const rate = this.variables[key] ?? 0;

      // thresholds (subtotals before IVA)
      const superaTope =
        (classKey === 'bienes' && subtotal >= 498000) ||
        (classKey === 'servicios' && subtotal >= 100000);

      if (rate > 0 && superaTope) {
        retefuente = +(subtotal * rate).toFixed(2);
      }
    }

    // RETEICA (if client applies ICA retention and includes IVA)
    let reteica = 0;
    if (cliente?.applies_ica_retention && invoice.include_iva) {
      const key = (
        classKey === 'bienes' ? 'reteica_bienes' : 'reteica_servicios'
      ) as keyof VariableMap;
      const rate = this.variables[key] ?? 0;
      if (rate > 0) {
        reteica = +(subtotal * rate).toFixed(2);
      }
    }*/

    return { subtotal, iva, total /*, reteica, retefuente*/ };
  }

  async selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
    this.calculatedValues = await this.calculateInvoiceValues(invoice);
    this.checkPaymentPermissions(invoice.id_invoice);

    const order = invoice.order;
    if (
      order?.order_type === 'sales' &&
      order?.is_vitrine
    ) {
      await this.loadVitrineSalesDetails(order.id_order);
    } else {
      this.vitrineSalesDetails = [];
    }
  }

  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000);
  }

  closeDetails() {
    this.selectedInvoiceDetails = null;
    this.showEditPayment = false;
    this.selectedPayment = null;
    this.notificationMessage = null;
  }

  async addPayment(
    order: Orders,
    amount: number,
    paymentMethod: string,
  ): Promise<void> {
    if (!order || !order.id_order || amount <= 0) {
      this.showNotification('Por favor, ingrese un monto válido.');
      return;
    }

    if (!paymentMethod) {
      this.showNotification('Por favor, seleccione un método de pago.');
      return;
    }

    const invoice = this.selectedInvoiceDetails![0];
    const { total } = await this.calculateInvoiceValues(invoice);
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    if (amount > remainingBalance) {
      this.showNotification(
        `El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(
          2,
        )}.`,
      );
      return;
    }

    const payment: Payment = {
      id_order: order.id_order,
      amount: amount,
      payment_method: paymentMethod,
    };

    try {
      const { data, error: insertError } = await this.supabase
        .from('payments')
        .insert([payment])
        .select();

      if (insertError || !data || data.length === 0) {
        console.error('Error al añadir el abono:', insertError);
        this.showNotification('Error al añadir el abono.');
        return;
      }

      const newPayment = data[0];
      newPayment.payment_date = new Date().toISOString();

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt - amount;
      const newClientStatus = newDebt > 0 ? 'overdue' : 'upToDate';

      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newClientStatus })
        .eq('id_client', order.id_client);

      if (updateError) {
        console.error('Error al actualizar la deuda:', updateError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push(newPayment);

      const totalPaidUpdated = this.getTotalPayments(order);
      const newRemainingBalance = total - totalPaidUpdated;
      /*
      const newOrderStatus =
        newRemainingBalance <= 0
          ? 'finished'
          : order.order_completion_status || '';
      */
      const newPaymentStatus =
        newRemainingBalance <= 0 ? 'upToDate' : 'overdue';

      await this.supabase
        .from('orders')
        .update({
          order_payment_status: newPaymentStatus,
        })
        .eq('id_order', order.id_order);

      await this.supabase
        .from('invoices')
        .update({ invoice_status: newPaymentStatus })
        .eq('id_order', order.id_order);

      await this.getInvoices();

      this.newPaymentAmount = 0;
      this.newPaymentMethod = '';
      this.showNotification('Abono añadido correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  editPayment(payment: Payment): void {
    this.selectedPayment = { ...payment };
    this.showEditPayment = true;
  }

  async updatePayment(order: Orders): Promise<void> {
    if (!this.selectedPayment || !this.selectedPayment.id_payment) {
      this.showNotification('No se ha seleccionado un abono válido.');
      return;
    }

    if (!this.selectedPayment.payment_method) {
      this.showNotification('Por favor, seleccione un método de pago.');
      return;
    }

    try {
      const { data: originalPayment, error: fetchError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('id_payment', this.selectedPayment.id_payment)
        .single();

      if (fetchError || !originalPayment) {
        console.error('Error al obtener el abono original:', fetchError);
        this.showNotification('Error al obtener el abono original.');
        return;
      }

      const originalAmount = originalPayment.amount;
      const newAmount = this.selectedPayment.amount;
      const difference = newAmount - originalAmount;

      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          amount: newAmount,
          payment_method: this.selectedPayment.payment_method,
        })
        .eq('id_payment', this.selectedPayment.id_payment);

      if (updateError) {
        console.error('Error al actualizar el abono:', updateError);
        this.showNotification('Error al actualizar el abono.');
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt + difference;
      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', order.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (order.payments) {
        const paymentIndex = order.payments.findIndex(
          (p) => p.id_payment === this.selectedPayment!.id_payment,
        );
        if (paymentIndex !== -1) {
          order.payments[paymentIndex] = { ...this.selectedPayment };
        }

        const totalPaid = this.getTotalPayments(order);
        const invoice = this.selectedInvoiceDetails![0];
        const { total } = await this.calculateInvoiceValues(invoice);
        const newRemainingBalance = total - totalPaid;
        const newStatus = newRemainingBalance <= 0 ? 'upToDate' : 'overdue';

        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', order.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', order.id_order);

        await this.getInvoices();
      }

      this.showEditPayment = false;
      this.selectedPayment = null;
      this.showNotification('Abono actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  /*
  updatePaymentTermFromDeliveryDate(invoice: Invoice): void {
    if (!invoice.order.delivery_date || !this.selectedInvoice) return;

    const createdDate = new Date(invoice.order.created_at);
    const delivery = new Date(invoice.order.delivery_date);
    const diffTime = delivery.getTime() - createdDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    this.selectedInvoice.payment_term = Math.max(0, diffDays);
  }
  */

  async deletePayment(payment: Payment, order: Orders): Promise<void> {
    if (!payment || !payment.id_payment) {
      this.showNotification('No se ha seleccionado un abono válido.');
      return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este abono?')) {
      return;
    }

    try {
      const { error: deleteError } = await this.supabase
        .from('payments')
        .delete()
        .eq('id_payment', payment.id_payment);

      if (deleteError) {
        console.error('Error al eliminar el abono:', deleteError);
        this.showNotification('Error al eliminar el abono.');
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt + payment.amount;
      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', order.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (order.payments) {
        order.payments = order.payments.filter(
          (p) => p.id_payment !== payment.id_payment,
        );

        const totalPaid = this.getTotalPayments(order);
        const invoice = this.selectedInvoiceDetails![0];
        const { total } = await this.calculateInvoiceValues(invoice);
        const newRemainingBalance = total - totalPaid;
        const newStatus = newRemainingBalance <= 0 ? 'upToDate' : 'overdue';

        await this.supabase
          .from('orders')
          .update({
            order_payment_status: newStatus,
          })
          .eq('id_order', order.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', order.id_order);

        await this.getInvoices();
      }

      this.showNotification('Abono eliminado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  getTotalPayments(order: Orders): number {
    if (!order || !Array.isArray(order.payments)) return 0;
    return order.payments.reduce((sum, p) => sum + p.amount, 0);
  }

  getRemainingBalance(invoice: Invoice): number {
    const total = invoice.order.total || 0; // Use the saved total, not the temporary display value
    const totalPaid = this.getTotalPayments(invoice.order);
    return Math.max(0, total - totalPaid);
  }

  private isZeroish(n: number): boolean {
    return Math.abs(n) < 1e-6;
  }

  async checkPaymentDeadlineNotification(invoice: Invoice): Promise<void> {
    if (!invoice.due_date) return;

    const totalPaid = this.getTotalPayments(invoice.order);
    const { total } = await this.calculateInvoiceValues(invoice);
    const remainingBalance = total - totalPaid;

    // Solo crear notificación si aún hay saldo pendiente
    if (remainingBalance <= 0) {
      // Si está pagado, eliminar notificaciones existentes
      await this.supabase
        .from('notifications')
        .delete()
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline');
      return;
    }

    const daysRemaining = this.getRemainingPaymentDays(invoice);

    // Si faltan 3 días o menos (y aún no ha vencido)
    if (daysRemaining <= 3 && daysRemaining > 0) {
      // Verificar si ya existe la notificación
      const { data: existingNotification } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline')
        .maybeSingle();

      if (!existingNotification) {
        const notificationData = {
          type: 'payment_deadline',
          description: `Plazo de pago próximo a vencer: Factura ${invoice.code} - Cliente: ${invoice.order.client.name} - Faltan ${daysRemaining} día(s)`,
          id_invoice: invoice.id_invoice,
          due_date: invoice.due_date,
        };

        await this.supabase.from('notifications').insert([notificationData]);
      }
    } else if (daysRemaining <= 0) {
      // Si ya venció, eliminar la notificación de "próximo a vencer"
      await this.supabase
        .from('notifications')
        .delete()
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline');
    }
  }

  private async syncInvoicesStatusOnLoad(invoices: Invoice[]): Promise<void> {
    const updates: Array<Promise<void>> = [];

    for (const inv of invoices) {
      const remaining = this.getRemainingBalance(inv);
      const newStatus: 'upToDate' | 'overdue' = this.isZeroish(remaining)
        ? 'upToDate'
        : 'overdue';

      if (inv.invoice_status === newStatus) {
        await this.checkPaymentDeadlineNotification(inv);
        continue;
      }

      updates.push(
        (async () => {
          const q = this.supabase
            .from('invoices')
            .update({ invoice_status: newStatus });
          const { error } = (inv as any).id_invoice
            ? await q.eq('id_invoice', (inv as any).id_invoice) // si tienes id de factura
            : await q.eq('id_order', inv.order.id_order); // si relacionas por pedido

          if (!error) {
            inv.invoice_status = newStatus; // refleja en memoria
          } else {
            console.error('Error actualizando invoice_status:', error, inv);
          }

          // Verificar notificaciones después de actualizar estado
          await this.checkPaymentDeadlineNotification(inv);
        })(),
      );
    }

    await Promise.all(updates);
  }

/**
 * Obtiene los días RESTANTES del plazo de pago
 */
public getRemainingPaymentTerm(invoice: Invoice): string {
  // Si está pagado completamente, mostrar "Realizado"
  const isInvoiceUpToDate =
    invoice?.invoice_status?.toLowerCase() === 'uptodate' ||
    invoice?.order?.order_payment_status?.toLowerCase() === 'uptodate' ||
    this.isZeroish(this.getRemainingBalance(invoice));

  if (isInvoiceUpToDate) {
    return 'Realizado';
  }

  // Verificar si el pedido ya está completado y pagado
  const orderStatus = invoice.order.order_completion_status;
  const paymentStatus = invoice.order.order_payment_status;
  const isOrderCompleted = orderStatus?.toLowerCase() === 'finished';
  const isPaymentUpToDate = paymentStatus?.toLowerCase() === 'uptodate';

  if (isOrderCompleted && isPaymentUpToDate) {
    return 'Realizado';
  }

  // CALCULAR DÍAS TRANSCURRIDOS DESDE LA CREACIÓN DE LA FACTURA
  const createdDate = new Date(invoice.created_at);
  const currentDate = new Date();

  // Normalizar horas para comparar solo fechas
  createdDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  const diffTime = currentDate.getTime() - createdDate.getTime();
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // El plazo original (por defecto 5 días, pero puede ser modificado)
  const originalPaymentTerm = invoice.payment_term ?? 5;

  // CALCULAR DÍAS RESTANTES = PLAZO ORIGINAL - DÍAS TRANSCURRIDOS
  const remainingDays = originalPaymentTerm - daysPassed;

  // Mostrar resultado
  if (remainingDays < 0) {
    return 'Vencido';
  } else if (remainingDays === 0) {
    return 'Vence hoy';
  } else {
    return `${remainingDays} día${remainingDays === 1 ? '' : 's'}`;
  }
}

  public getRemainingDeliveryDays(dueDate: string | null): number {
    if (!dueDate) return 0;

    const now = new Date();
    const delivery = new Date(dueDate);
    delivery.setHours(23, 59, 59, 999);

    const diffTime = delivery.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  formatNumber(value: number): string {
    return value.toFixed(2);
  }

  formatCOP(value: number): string {
    return value.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  async generatePdf(): Promise<void> {
    if (!this.selectedInvoiceDetails) {
      alert('Por favor, selecciona una factura primero.');
      return;
    }

    const invoice = this.selectedInvoiceDetails[0];
    if (!invoice.order) {
      alert('Por favor, elija una orden válida.');
      return;
    }

    const { subtotal, iva, total /*, reteica, retefuente*/ } =
      await this.calculateInvoiceValues(invoice);
    const totalPaid = this.getTotalPayments(invoice.order);
    const remainingBalance = total - totalPaid;

    const doc = new jsPDF();
    const invoice_date = new Date(invoice.created_at);
    const year = invoice_date.getFullYear();
    const month = (invoice_date.getMonth() + 1).toString().padStart(2, '0');
    const day = invoice_date.getDate().toString().padStart(2, '0');

    const logoUrl = '/Logo.png';
    const logo = await this.loadImage(logoUrl);
    doc.addImage(logo, 'JPEG', 90, 5, 30, 20);

    doc.setTextColor(200);
    doc.setFontSize(30);
    doc.text('Recibo ', 190, 10, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Barrio Blas de Lezo Cl. 21A Mz. 11A - Lt. 12', 10, 30);
    doc.text(`Fecha: ${day}-${month}-${year}`, 190, 30, { align: 'right' });

    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Recibo de Venta N°: ${invoice.code}`, 190, 40, {
      align: 'right',
    });

    doc.text('3004947020', 10, 50);
    if (invoice.order.client.nit) {
      doc.text(`NIT: ${invoice.order.client.nit}`, 10, 60);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Recibo De:', 10, 70);
    doc.setFont('helvetica', 'normal');

    let y = 80;
    doc.text(`Nombre: ${invoice.order.client.name}`, 10, y);
    y += 6;
    doc.text(`Identificación: ${invoice.order.client.document_number}`, 10, y);
    y += 6;
    doc.text(`Dirección: ${invoice.order.client.address}`, 10, y);
    y += 6;
    /*doc.text(`Provincia: ${invoice.order.client.province}`, 10, y);
    y += 6;
    doc.text(`Código Postal: ${invoice.order.client.postal_code}`, 10, y);
    y += 6;*/
    doc.text(`E-mail: ${invoice.order.client.email}`, 10, y);
    y += 6;
    doc.text(`Teléfono: ${invoice.order.client.cellphone}`, 10, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.order.description, y);
    descriptionLines.forEach((line) => {
      doc.text(line, 10, y);
      y += 8;
    });

    y += 10;

    // **TABLA DE DETALLES SEGÚN TIPO DE PEDIDO**
    const orderType = invoice.order.order_type;

    /*if (orderType === 'print') {
      const { data: printsData, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', invoice.order.id_order);

      if (!error && printsData && printsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE PRODUCTOS', 10, y);
        y += 8;

        const tableHeaders = ['Material', 'Cant.', 'Procesos', 'Precio Total'];
        const colWidths = [80, 20, 50, 30];
        const startX = 10;

        doc.setFontSize(10);
        let currentX = startX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, currentX, y);
          currentX += colWidths[i];
        });

        y += 2;
        doc.line(startX, y, 190, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        for (const print of printsData) {
          const category = print.category || '';
          const materialType = print.material_type || '';
          const color = print.color || '';
          const caliber = print.caliber || '';

          let materialParts = [];
          if (category) materialParts.push(category);
          if (materialType) materialParts.push(materialType);
          if (color) materialParts.push(color);
          if (caliber) materialParts.push(caliber);

          const materialStr = materialParts.join(' - ') || 'N/A';

          doc.text(materialStr, startX, y, { maxWidth: colWidths[0] - 5 });

          doc.text(String(print.quantity || '0'), startX + colWidths[0], y);

          const processes = [];
          if (print.laminating) processes.push('Lam.');
          if (print.printing) processes.push('Imp.');
          if (print.die_cutting) processes.push('Troq.');
          if (print.assembly) processes.push('Ens.');
          const processesStr = processes.join(', ') || '-';
          doc.text(processesStr, startX + colWidths[0] + colWidths[1], y);

          // Calcular precio total del item
          const unitPrice = Number(print.unit_price) || 0;
          const qty = Number(print.quantity) || 0;
          const itemTotal = unitPrice * qty || subtotal / printsData.length;
          doc.text(
            `$${itemTotal.toFixed(2)}`,
            startX + colWidths[0] + colWidths[1] + colWidths[2],
            y
          );

          y += 8;
        }

        y += 2;
        doc.line(startX, y, 190, y);
        y += 10;
      }
    } else if (orderType === 'laser') {
      // TABLA PARA CORTES LÁSER
      const { data: cutsData, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', invoice.order.id_order);

      if (!error && cutsData && cutsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE CORTES', 10, y);
        y += 8;

        // Headers: Material | Cant. | Alto | Ancho | Precio Unit. | Total
        const tableHeaders = [
          'Material',
          'Cant.',
          'Alto',
          'Ancho',
          'Precio Unit.',
          'Total',
        ];
        const colWidths = [50, 15, 15, 15, 35, 35];
        const startX = 10;

        doc.setFontSize(10);
        let currentX = startX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, currentX, y);
          currentX += colWidths[i];
        });

        y += 2;
        doc.line(startX, y, 190, y);
        y += 6;

        doc.setFont('helvetica', 'normal');

        let totalCortes = 0; // Acumular el total del pedido

        for (const cut of cutsData) {
          // Construir el nombre del material
          const category = cut.category || '';
          const materialType = cut.material_type || '';
          const color = cut.color || '';
          const caliber = cut.caliber || '';

          let materialParts = [];
          if (category) materialParts.push(category);
          if (materialType) materialParts.push(materialType);
          if (caliber) materialParts.push(caliber);
          if (color) materialParts.push(color);

          const materialStr = materialParts.join(' - ') || 'N/A';

          // Dibujar fila
          currentX = startX;

          // Material
          doc.text(materialStr, currentX, y, { maxWidth: colWidths[0] - 5 });
          currentX += colWidths[0];

          // Cantidad
          doc.text(String(cut.quantity || 0), currentX, y);
          currentX += colWidths[1];

          // Alto
          doc.text(String(cut.height || 0), currentX, y);
          currentX += colWidths[2];

          // Ancho
          doc.text(String(cut.width || 0), currentX, y);
          currentX += colWidths[3];

          // Precio Unitario (unit_price)
          const unitPrice = Number(cut.unit_price || 0);
          doc.text(`$${unitPrice.toFixed(2)}`, currentX, y);
          currentX += colWidths[4];

          // Total de la línea (line_total)
          const lineTotal = Number(cut.line_total || 0);
          doc.text(`$${lineTotal.toFixed(2)}`, currentX, y);

          totalCortes += lineTotal;

          y += 8;
        }

        y += 2;
        doc.line(startX, y, 190, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
      }
    } else */if (orderType === 'sales' &&
        invoice.order.is_vitrine &&
        this.vitrineSalesDetails.length > 0) {
      // TABLA PARA VENTAS (SALES)
      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DE VENTAS', 10, y);
      y += 8;

      const headers = ['Producto', 'Cant', 'Unit', 'Subtotal'];
      const widths = [100, 20, 30, 30];
      let x = 10;

      doc.setFontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += widths[i];
      });

      y += 2;
      doc.line(10, y, 190, y);
      y += 6;

      doc.setFont('helvetica', 'normal');

      for (const item of this.vitrineSalesDetails) {
        x = 10;

        doc.text(item.product_name, x, y, { maxWidth: widths[0] - 5 });
        x += widths[0];

        doc.text(String(item.quantity), x, y);
        x += widths[1];

        doc.text(this.formatCOP(item.unit_price), x, y);
        x += widths[2];

        doc.text(this.formatCOP(item.line_total), x, y);

        y += 8;
      }

      y += 4;
    }
    // Resumen financiero
    let currentY = y;

    if (invoice.order.payments && invoice.order.payments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Abonos Realizados:', 10, currentY);
      currentY += 7;
      doc.setFont('helvetica', 'normal');
      invoice.order.payments.forEach((payment) => {
        doc.text(
          `$${this.formatCOP(payment.amount)} - ${
            payment.payment_method === 'cash'
              ? 'Efectivo'
              : payment.payment_method === 'nequi'
                ? 'Nequi'
                : payment.payment_method === 'bancolombia'
                  ? 'Bancolombia'
                  : payment.payment_method === 'Davivienda'
                    ? 'Davivienda'
                    : payment.payment_method === 'other'
                      ? 'Otro'
                      : 'Desconocido'
          } - ${
            payment.payment_date
              ? new Date(payment.payment_date).toLocaleDateString('es-CO')
              : ''
          }`,
          10,
          currentY,
        );
        currentY += 7;
      });
      currentY += 5;
    }

    const summaryX = 10;
    const valueX = 60;
    doc.setFont('helvetica', 'bold');

    doc.text('Subtotal:', summaryX, currentY);
    doc.text(`$${this.formatCOP(subtotal)}`, valueX, currentY, { align: 'left' });
    currentY += 7;

    if (invoice.include_iva) {
      doc.text(this.ivaLabel() + ':', summaryX, currentY);
      doc.text(`$${this.formatCOP(iva)}`, valueX, currentY, { align: 'left' });
      currentY += 7;
    }

    /*if (retefuente > 0) {
      doc.text(this.retefuenteLabel(invoice) + ':', summaryX, currentY);
      doc.text(`-$${retefuente.toFixed(2)}`, valueX, currentY, {
        align: 'left',
      });
      currentY += 7;
    }

    if (reteica > 0) {
      doc.text(this.reteicaLabel(invoice) + ':', summaryX, currentY);
      doc.text(`-$${reteica.toFixed(2)}`, valueX, currentY, { align: 'left' });
      currentY += 7;
    }*/

    doc.setFontSize(14);
    doc.text('Total:', summaryX, currentY);
    doc.text(`$${this.formatCOP(total)}`, valueX, currentY, { align: 'left' });
    currentY += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Falta por Pagar:', summaryX, currentY);
    doc.text(`$${this.formatCOP(remainingBalance)}`, valueX + 15, currentY, {
      align: 'left',
    });

    const footerStartY = currentY + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Si tiene cualquier tipo de pregunta acerca de esta cotización, póngase en contacto al número 3004947020',
      10,
      footerStartY + 10,
    );

    doc.setFont('helvetica', 'bold');
    doc.text('GRACIAS POR SU CONFIANZA', 10, footerStartY + 25);

    doc.save(`Recibo_de_venta_${invoice.code}.pdf`);
  }

  private wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);
      if (testWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedInvoices(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredInvoicesList.length / this.itemsPerPage),
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedInvoice = this.filteredInvoicesList.slice(
      startIndex,
      endIndex,
    );
  }

  async downloadQuotePDF(): Promise<void> {
    if (!this.selectedInvoiceDetails) {
      alert('Por favor, selecciona una factura primero.');
      return;
    }

    const invoice = this.selectedInvoiceDetails[0];
    if (!invoice.order) {
      alert('Por favor, elija una orden válida.');
      return;
    }

    const { subtotal, iva, total /*, reteica, retefuente*/ } =
      await this.calculateInvoiceValues(invoice);
    const totalPaid = this.getTotalPayments(invoice.order);
    const remainingBalance = total - totalPaid;

    const doc = new jsPDF();
    const invoice_date = new Date(invoice.created_at);
    const year = invoice_date.getFullYear();
    const month = (invoice_date.getMonth() + 1).toString().padStart(2, '0');
    const day = invoice_date.getDate().toString().padStart(2, '0');

    const logoUrl = '/Logo.png';
    const logo = await this.loadImage(logoUrl);
    doc.addImage(logo, 'JPEG', 90, 5, 30, 20);

    doc.setTextColor(200);
    doc.setFontSize(30);
    doc.text('Cuenta de Cobro', 190, 10, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Barrio Blas de Lezo Cl. 21A Mz. 11A - Lt. 12', 10, 30);
    doc.text(`Fecha: ${day}-${month}-${year}`, 190, 30, { align: 'right' });

    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Cuenta de Cobro N°: ${invoice.code}`, 190, 40, {
      align: 'right',
    });

    doc.text('3004947020', 10, 50);
    if (invoice.order.client.nit) {
      doc.text(`NIT: ${invoice.order.client.nit}`, 10, 60);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 10, 70);
    doc.setFont('helvetica', 'normal');

    let y = 80;
    doc.text(`Nombre: ${invoice.order.client.name}`, 10, y);
    y += 6;
    doc.text(`Identificación: ${invoice.order.client.document_number}`, 10, y);
    y += 6;
    doc.text(`Dirección: ${invoice.order.client.address}`, 10, y);
    y += 6;
    /*doc.text(`Provincia: ${invoice.order.client.province}`, 10, y);
    y += 6;
    doc.text(`Código Postal: ${invoice.order.client.postal_code}`, 10, y);
    y += 6;*/
    doc.text(`E-mail: ${invoice.order.client.email}`, 10, y);
    y += 6;
    doc.text(`Teléfono: ${invoice.order.client.cellphone}`, 10, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.order.description, y);
    descriptionLines.forEach((line) => {
      doc.text(line, 10, y);
      y += 8;
    });

    y += 10;

    // **TABLA DE DETALLES SEGÚN TIPO DE PEDIDO**
    const orderType = invoice.order.order_type;

    /*if (orderType === 'print') {
      const { data: printsData, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', invoice.order.id_order);

      if (!error && printsData && printsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE PRODUCTOS', 10, y);
        y += 8;

        const tableHeaders = ['Material', 'Cant.', 'Procesos', 'Precio Total'];
        const colWidths = [80, 20, 50, 30];
        const startX = 10;

        doc.setFontSize(10);
        let currentX = startX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, currentX, y);
          currentX += colWidths[i];
        });

        y += 2;
        doc.line(startX, y, 190, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        for (const print of printsData) {
          const category = print.category || '';
          const materialType = print.material_type || '';
          const color = print.color || '';
          const caliber = print.caliber || '';

          let materialParts = [];
          if (category) materialParts.push(category);
          if (materialType) materialParts.push(materialType);
          if (color) materialParts.push(color);
          if (caliber) materialParts.push(caliber);

          const materialStr = materialParts.join(' - ') || 'N/A';

          doc.text(materialStr, startX, y, { maxWidth: colWidths[0] - 5 });

          doc.text(String(print.quantity || '0'), startX + colWidths[0], y);

          const processes = [];
          if (print.laminating) processes.push('Lam.');
          if (print.printing) processes.push('Imp.');
          if (print.die_cutting) processes.push('Troq.');
          if (print.assembly) processes.push('Ens.');
          const processesStr = processes.join(', ') || '-';
          doc.text(processesStr, startX + colWidths[0] + colWidths[1], y);

          const qty = Number(print.quantity) || 0;
          const itemTotal = subtotal / printsData.length;
          doc.text(
            `$${itemTotal.toFixed(2)}`,
            startX + colWidths[0] + colWidths[1] + colWidths[2],
            y
          );

          y += 8;
        }

        y += 2;
        doc.line(startX, y, 190, y);
        y += 10;
      }
    } else if (orderType === 'laser') {
      // TABLA PARA CORTES LÁSER
      const { data: cutsData, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', invoice.order.id_order);

      if (!error && cutsData && cutsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE CORTES', 10, y);
        y += 8;

        // Headers: Material | Cant. | Alto | Ancho | Precio Unit. | Total
        const tableHeaders = [
          'Material',
          'Cant.',
          'Alto',
          'Ancho',
          'Precio Unit.',
          'Total',
        ];
        const colWidths = [50, 15, 15, 15, 35, 35];
        const startX = 10;

        doc.setFontSize(10);
        let currentX = startX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, currentX, y);
          currentX += colWidths[i];
        });

        y += 2;
        doc.line(startX, y, 190, y);
        y += 6;

        doc.setFont('helvetica', 'normal');

        let totalCortes = 0; // Acumular el total del pedido

        for (const cut of cutsData) {
          // Construir el nombre del material
          const category = cut.category || '';
          const materialType = cut.material_type || '';
          const color = cut.color || '';
          const caliber = cut.caliber || '';

          let materialParts = [];
          if (category) materialParts.push(category);
          if (materialType) materialParts.push(materialType);
          if (caliber) materialParts.push(caliber);
          if (color) materialParts.push(color);

          const materialStr = materialParts.join(' - ') || 'N/A';

          // Dibujar fila
          currentX = startX;

          // Material
          doc.text(materialStr, currentX, y, { maxWidth: colWidths[0] - 5 });
          currentX += colWidths[0];

          // Cantidad
          doc.text(String(cut.quantity || 0), currentX, y);
          currentX += colWidths[1];

          // Alto
          doc.text(String(cut.height || 0), currentX, y);
          currentX += colWidths[2];

          // Ancho
          doc.text(String(cut.width || 0), currentX, y);
          currentX += colWidths[3];

          // Precio Unitario (unit_price)
          const unitPrice = Number(cut.unit_price || 0);
          doc.text(`$${unitPrice.toFixed(2)}`, currentX, y);
          currentX += colWidths[4];

          // Total de la línea (line_total)
          const lineTotal = Number(cut.line_total || 0);
          doc.text(`$${lineTotal.toFixed(2)}`, currentX, y);

          totalCortes += lineTotal;

          y += 8;
        }

        y += 2;
        doc.line(startX, y, 190, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
      }
    } else*/ if (orderType === 'sales' &&
        invoice.order.is_vitrine &&
        this.vitrineSalesDetails.length > 0) {
      // TABLA PARA VENTAS (SALES)
      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DE VENTAS', 10, y);
      y += 8;

      const headers = ['Producto', 'Cant', 'Unit', 'Subtotal'];
      const widths = [100, 20, 30, 30];
      let x = 10;

      doc.setFontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += widths[i];
      });

      y += 2;
      doc.line(10, y, 190, y);
      y += 6;

      doc.setFont('helvetica', 'normal');

      for (const item of this.vitrineSalesDetails) {
        x = 10;

        doc.text(item.product_name, x, y, { maxWidth: widths[0] - 5 });
        x += widths[0];

        doc.text(String(item.quantity), x, y);
        x += widths[1];

        doc.text(this.formatCOP(item.unit_price), x, y);
        x += widths[2];

        doc.text(this.formatCOP(item.line_total), x, y);

        y += 8;
      }

      y += 4;
    }

    // Resumen financiero
    let currentY = y;
    const summaryX = 10;
    const valueX = 60;

    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', summaryX, currentY);
    doc.text(`$${this.formatCOP(subtotal)}`, valueX, currentY, { align: 'left' });
    currentY += 7;

    if (invoice.include_iva) {
      doc.text(this.ivaLabel() + ':', summaryX, currentY);
      doc.text(`$${this.formatCOP(iva)}`, valueX, currentY, { align: 'left' });
      currentY += 7;
    }

    /*if (retefuente > 0) {
      doc.text(this.retefuenteLabel(invoice) + ':', summaryX, currentY);
      doc.text(`-$${retefuente.toFixed(2)}`, valueX, currentY, {
        align: 'left',
      });
      currentY += 7;
    }

    if (reteica > 0) {
      doc.text(this.reteicaLabel(invoice) + ':', summaryX, currentY);
      doc.text(`-$${reteica.toFixed(2)}`, valueX, currentY, { align: 'left' });
      currentY += 7;
    }*/

    doc.setFontSize(14);
    doc.text('Total:', summaryX, currentY);
    doc.text(`$${this.formatCOP(total)}`, valueX, currentY, { align: 'left' });
    currentY += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Total a Cobrar:', summaryX, currentY);
    doc.text(`$${this.formatCOP(remainingBalance)}`, valueX + 15, currentY, {
      align: 'left',
    });

    const footerStartY = currentY + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');

    doc.setFont('helvetica', 'bold');
    doc.text('GRACIAS POR SU CONFIANZA', 10, footerStartY + 15);

    doc.save(`Cuenta_de_cobro_${invoice.code}.pdf`);
  }

  async downloadDeliveryNotePDF(): Promise<void> {
    if (!this.selectedInvoiceDetails) return;

    const invoice = this.selectedInvoiceDetails[0];
    const order = invoice.order;
    const client = order.client;

    const doc = new jsPDF();
    const date = new Date(invoice.created_at);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    doc.setFontSize(20);
    doc.text('NOTA DE REMISIÓN', 190, 10, { align: 'right' });

    doc.setFontSize(12);
    doc.text(`Fecha: ${day}-${month}-${year}`, 190, 30, { align: 'right' });
    doc.text(`Nota de Remisión N°: ${invoice.code}`, 190, 40, {
      align: 'right',
    });

    doc.text('Cliente:', 10, 60);
    doc.text(`Nombre: ${client.name}`, 10, 70);
    doc.text(`Dirección: ${client.address}`, 10, 78);
    doc.text(`Teléfono: ${client.cellphone}`, 10, 86);

    doc.text('Descripción del Pedido:', 10, 102);
    const descLines = doc.splitTextToSize(
      order.description || 'Sin descripción',
      180,
    );
    doc.text(descLines, 10, 112);

    let y = 130;

    // **LISTA PARA PRINTS: Material, Tipo y Procesos**
    const orderType = order.order_type;

    /*if (orderType === 'print') {
      const { data: printsData, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);

      if (!error && printsData && printsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Materiales:', 10, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        for (const print of printsData) {
          const category = print.category || 'N/A'; // vinilo
          const materialType = print.material_type || ''; // verde oscuro
          const color = print.color || '';
          const caliber = print.caliber || '';

          let materialParts = [category];
          if (materialType) materialParts.push(materialType);
          if (color) materialParts.push(color);
          if (caliber) materialParts.push(caliber);

          const materialStr = materialParts.join(' - ');

          doc.text(`• ${materialStr}`, 10, y);
          y += 6;

          // Procesos
          const processes = [];
          if (print.laminating) processes.push('Laminado');
          if (print.printing) processes.push('Impresión');
          if (print.die_cutting) processes.push('Troquelado');
          if (print.assembly) processes.push('Ensamblado');

          if (processes.length > 0) {
            doc.text(`  Procesos: ${processes.join(', ')}`, 10, y);
            y += 6;
          }

          y += 2; // Espacio entre items
        }
      }
    } else if (orderType === 'laser') {
      const { data: cutsData, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);

      if (!error && cutsData && cutsData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Tipo de pedido: Cortes', 10, y);
        y += 8;

        doc.text('Materiales:', 10, y);
        y += 8;

        doc.setFont('helvetica', 'normal');

        for (const cut of cutsData) {
          const category = cut.category || 'N/A';
          const materialType = cut.material_type || '';
          const color = cut.color || '';
          const caliber = cut.caliber || '';

          let materialParts = [category];
          if (materialType) materialParts.push(materialType);
          if (caliber) materialParts.push(caliber);
          if (color) materialParts.push(color);

          const materialStr = materialParts.join(' - ');

          doc.text(`• ${materialStr}`, 10, y);
          y += 6;
        }

        y += 2; // Espacio entre items
      } else {
        doc.text('Tipo de pedido: Cortes', 10, y);
      }
    } else*/ if (orderType === 'sales' &&
        invoice.order.is_vitrine &&
        this.vitrineSalesDetails.length > 0) {
      // TABLA PARA VENTAS (SALES)
      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DE VENTAS', 10, y);
      y += 8;

      const headers = ['Producto', 'Cant', 'Unit', 'Subtotal'];
      const widths = [100, 20, 30, 30];
      let x = 10;

      doc.setFontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += widths[i];
      });

      y += 2;
      doc.line(10, y, 190, y);
      y += 6;

      doc.setFont('helvetica', 'normal');

      for (const item of this.vitrineSalesDetails) {
        x = 10;

        doc.text(item.product_name, x, y, { maxWidth: widths[0] - 5 });
        x += widths[0];

        doc.text(String(item.quantity), x, y);
        x += widths[1];

        doc.text(this.formatCOP(item.unit_price), x, y);
        x += widths[2];

        doc.text(this.formatCOP(item.line_total), x, y);

        y += 8;
      }

      y += 4;
    }

    y += 10;

    // Firma
    doc.text('Firma Recibido:', 10, y + 20);
    doc.line(10, y + 30, 80, y + 30);

    doc.save(`Nota_de_Remisión_${invoice.code}.pdf`);
  }

  addNewInvoice(): void {
    this.selectedInvoice = {
      id_invoice: '',
      created_at: new Date().toISOString(),
      invoice_status: 'upToDate',
      id_order: '',
      code: '',
      include_iva: false,
      payment_term: 5,
      due_date: null,
      classification: 'Bien',
      e_invoice_done: false,
      order: {
        id_order: '',
        order_type: 'print',
        name: '',
        description: '',
        order_payment_status: '',
        created_at: new Date(),
        order_quantity: 0,
        unitary_value: 0,
        iva: 0,
        subtotal: 0,
        total: 0,
        amount: 0,
        id_client: '',
        delivery_date: '',
        baseTotal: 0,
        client: {
          id_client: '',
          name: '',
          document_type: '',
          document_number: '',
          cellphone: '',
          nit: '',
          email: '',
          status: '',
          debt: 0,
          address: '',
          city: '',
          /*province: '',
          postal_code: '',*/
        } as Client,
      } as Orders,
    };
    this.isEditing = false;
    this.showModal = true;
    this.clientSearchQuery = '';
    this.filteredClients = [...this.clients];
    this.clientOrders = [];
    this.showClientDropdown = false;
    this.updateClientOrders();
  }

  async editInvoice(invoice: Invoice): Promise<void> {
    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .select('include_iva')
      .eq('id_order', invoice.order.id_order)
      .single();

    if (orderError) {
      console.error('Error al obtener datos del pedido:', orderError);
    }
    // Usar el valor de Orders si existe, si no usar el de la factura
    const currentIncludeIva =
      orderData?.include_iva ?? invoice.include_iva ?? false;

    this.selectedInvoice = {
      ...invoice,
      created_at: invoice.created_at,
      payment_term: invoice.payment_term ?? 5,
      due_date: invoice.due_date,
      include_iva: currentIncludeIva,
      e_invoice_done: invoice.e_invoice_done ?? false,
      classification: invoice.classification,
      order: {
        ...invoice.order,
        total: invoice.order.total || invoice.order.amount || 0,
        baseTotal: invoice.order.total || invoice.order.amount || 0,
      },
    };
    this.isEditing = true;
    this.showModal = true;
    this.clientSearchQuery = invoice.order.client.name;
    this.updateClientOrders();
  }

  getRemainingPaymentDays(invoice: Invoice): number {
    if (!invoice.due_date) return 0;

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, daysRemaining); // Nunca negativo
  }

  async validateOrderExists(orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id_order')
      .eq('id_order', orderId)
      .single();

    if (error || !data) {
      console.error('Error validando la orden:', error);
      return false;
    }
    return true;
  }

  onIncludeIvaChange(): void {
    if (this.selectedInvoice && this.selectedInvoice.order) {
      const order = this.selectedInvoice.order;
      const baseTotal = order.total || 0;

      if (this.selectedInvoice.include_iva) {
        order.total = Math.round(baseTotal * (1 + (this.IVA_RATE || 0)));
        order.baseTotal = baseTotal;
      } else {
        const calculatedBase = Math.round(
          (order.total || 0) / (1 + (this.IVA_RATE || 0)),
        );
        order.total = calculatedBase;
        order.baseTotal = calculatedBase;
      }
    }
  }

  async updateOrderTotal(): Promise<void> {
    if (!this.selectedInvoice?.order?.id_order) return;

    const baseTotal =
      this.selectedInvoice.order.baseTotal ??
      this.selectedInvoice.order.total ??
      0;

    this.selectedInvoice.order.total = this.selectedInvoice.include_iva
      ? Math.round(baseTotal * (1 + (this.IVA_RATE || 0)))
      : baseTotal;

    const { error } = await this.supabase
      .from('orders')
      .update({ total: this.selectedInvoice.order.total })
      .eq('id_order', this.selectedInvoice.order.id_order);

    if (error) {
      console.error('Error updating order total:', error);
      this.showNotification('Error al actualizar el total del pedido.');
      return;
    }

    // Update the local order total
    const invoiceIndex = this.invoices.findIndex(
      (i) => i.id_invoice === this.selectedInvoice!.id_invoice,
    );
    if (invoiceIndex !== -1) {
      this.invoices[invoiceIndex].order.total =
        this.selectedInvoice.order.total;
    }

    // Recalculate due_date if payment_term exists
    if (this.selectedInvoice.payment_term) {
      const deliveryDate = this.selectedInvoice.order.delivery_date
        ? new Date(this.selectedInvoice.order.delivery_date)
        : new Date();
      this.selectedInvoice.due_date = new Date(
        deliveryDate.getTime() +
          this.selectedInvoice.payment_term * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error: dueDateError } = await this.supabase
        .from('invoices')
        .update({ due_date: this.selectedInvoice.due_date })
        .eq('id_invoice', this.selectedInvoice.id_invoice);

      if (dueDateError) {
        console.error('Error updating due date:', dueDateError);
        this.showNotification('Error al actualizar la fecha de vencimiento.');
      }
    }

    this.showNotification('Total del pedido actualizado correctamente.');
  }

  // Update baseTotal when the total input changes
  onTotalChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.selectedInvoice && this.selectedInvoice.order) {
      const newValue = parseFloat(input.value) || 0;
      this.selectedInvoice.order.baseTotal = newValue; // Update baseTotal immediately
      console.log('onTotalChange - new baseTotal:', newValue);
      this.onIncludeIvaChange(); // Recalculate based on the new baseTotal
    }
  }

  async saveInvoice(): Promise<void> {

    this.isSaving = true;

    if (!this.selectedInvoice) {
      console.error('No se ha seleccionado ninguna factura.');
      alert('No se ha seleccionado ninguna factura.');
      this.closeModal();
      return;
    }

    if (!this.selectedInvoice.order.id_client) {
      alert('Por favor, seleccione un cliente válido.');
      this.closeModal();
      return;
    }

    if (!this.selectedInvoice.order.id_order) {
      alert('Por favor, seleccione una orden válida.');
      this.closeModal();
      return;
    }

    const orderExists = await this.validateOrderExists(
      this.selectedInvoice.order.id_order,
    );
    if (!orderExists) {
      alert('La orden seleccionada no existe.');
      this.closeModal();
      return;
    }

    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .select('delivery_date, total, payments(*)')
      .eq('id_order', this.selectedInvoice.order.id_order)
      .single();

    if (orderError || !orderData) {
      console.error('Error al obtener la orden:', orderError);
      alert('Error al obtener la orden asociada.');
      this.closeModal();
      return;
    }

    let deliveryDate = orderData.delivery_date || new Date().toISOString();
    let paymentTerm: number | null;
    let dueDate: string | null;

    // Solo calcular dueDate si NO existe o si es una factura nueva
    if (this.isEditing && this.selectedInvoice.due_date) {
      // Si estamos editando Y ya tiene duedate, se mantiene
      dueDate = this.selectedInvoice.due_date;
      paymentTerm = this.selectedInvoice.payment_term ?? 5;
    } else {
      // Si es nueva factura O no tiene duedate, calcularlo
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      paymentTerm = this.selectedInvoice.payment_term ?? 5;

      const dueDateCalculated = new Date(currentDate);
      dueDateCalculated.setDate(dueDateCalculated.getDate() + paymentTerm);
      dueDate = dueDateCalculated.toISOString().split('T')[0];
    }

    const originalTotal =
      this.selectedInvoice.order.total || orderData.total || 0;
    const totalPaid = orderData.payments
      ? orderData.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
    const remainingBalance = originalTotal - totalPaid;
    const newPaymentStatus = remainingBalance <= 0 ? 'upToDate' : 'overdue';

    const invoiceData: Partial<Invoice> = {
      invoice_status: newPaymentStatus,
      id_order: this.selectedInvoice.order.id_order,
      code: this.selectedInvoice.code,
      include_iva: this.selectedInvoice.include_iva,
      payment_term: paymentTerm,
      due_date: dueDate,
      classification: this.selectedInvoice.classification,
      e_invoice_done: this.selectedInvoice.order.requires_e_invoice
        ? this.selectedInvoice.e_invoice_done
        : false,
    };

    try {
      if (this.isEditing) {
        const originalIncludeIva =
          (
            await this.supabase
              .from('invoices')
              .select('include_iva')
              .eq('id_invoice', this.selectedInvoice.id_invoice)
              .single()
          ).data?.include_iva ?? false;

        const { error } = await this.supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id_invoice', this.selectedInvoice.id_invoice);

        if (error) {
          console.error('Error al actualizar la factura:', error);
          this.showNotification(
            `Error al actualizar la factura: ${error.message}`,
          );
          return;
        }

        // Sincronizar include_iva con Orders
        const { error: orderUpdateError } = await this.supabase
          .from('orders')
          .update({
            order_payment_status: newPaymentStatus,
            include_iva: this.selectedInvoice.include_iva,
          })
          .eq('id_order', this.selectedInvoice.order.id_order);

        if (orderUpdateError) {
          console.error('Error al actualizar el pedido:', orderUpdateError);
          this.showNotification('Error al sincronizar IVA con el pedido.');
        }

        if (this.selectedInvoice.include_iva !== originalIncludeIva) {
          await this.updateOrderTotal();
        } else {
          await this.supabase
            .from('orders')
            .update({ total: originalTotal })
            .eq('id_order', this.selectedInvoice.order.id_order);
        }

        this.showNotification('Factura actualizada correctamente.');

        await this.getInvoices();
      } else {
        const { data, error } = await this.supabase
          .from('invoices')
          .insert([invoiceData])
          .select();

        if (error) {
          console.error('Error al añadir la factura:', error);
          this.showNotification(`Error al añadir la factura: ${error.message}`);
          return;
        }

        const insertedInvoice = data[0];
        this.selectedInvoice.id_invoice = insertedInvoice.id_invoice;
        this.selectedInvoice.code = insertedInvoice.code;

        // Sincronizar include_iva con Orders al crear factura
        const { error: orderUpdateError } = await this.supabase
          .from('orders')
          .update({ include_iva: this.selectedInvoice.include_iva })
          .eq('id_order', this.selectedInvoice.order.id_order);

        if (orderUpdateError) {
          console.error('Error al actualizar IVA en Orders:', orderUpdateError);
          this.showNotification('Error al sincronizar IVA con el pedido.');
        }

        const { data: clientData, error: clientError } = await this.supabase
          .from('clients')
          .select('debt')
          .eq('id_client', this.selectedInvoice.order.id_client)
          .single();

        if (clientError || !clientData) {
          console.error('Error al obtener la deuda del cliente:', clientError);
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        const currentDebt = clientData.debt || 0;
        const newDebt = currentDebt + originalTotal;
        const newClientStatus = newDebt > 0 ? 'overdue' : 'upToDate';

        const { error: updateClientError } = await this.supabase
          .from('clients')
          .update({ debt: newDebt, status: newClientStatus })
          .eq('id_client', this.selectedInvoice.order.id_client);

        if (updateClientError) {
          console.error(
            'Error al actualizar la deuda del cliente:',
            updateClientError,
          );
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        this.showNotification('Factura añadida correctamente.');

        await this.getInvoices();
      }

      await this.loadOrders();
      this.closeModal();
    } catch (error) {
      console.error('Error inesperado al guardar la factura:', error);
      this.showNotification(
        'Ocurrió un error inesperado al guardar la factura.',
      );
    }finally {
      this.isSaving = false;
    }
  }

/**
 * Actualiza las sugerencias del dropdown de nombres de clientes
 */
updateClientNameSuggestions(): void {
  const value = this.nameSearchQuery.trim();

  // Si está vacío, muestra los primeros 50 clientes únicos de las facturas
  if (!value) {
    const uniqueClients = new Map<string, Client>();
    this.invoices.forEach(invoice => {
      if (invoice.order?.client && !uniqueClients.has(invoice.order.client.id_client)) {
        uniqueClients.set(invoice.order.client.id_client, invoice.order.client);
      }
    });
    this.clientNameSuggestions = Array.from(uniqueClients.values()).slice(0, 50);
    this.showClientNameSuggestions = true;
    return;
  }

  const normalizedSearch = this.normalizeText(value);

  // Filtrar clientes únicos que coincidan
  const uniqueClients = new Map<string, Client>();
  this.invoices.forEach(invoice => {
    if (invoice.order?.client) {
      const normalizedName = this.normalizeText(invoice.order.client.name);

      if (normalizedName.includes(normalizedSearch) &&
          !uniqueClients.has(invoice.order.client.id_client)) {
        uniqueClients.set(invoice.order.client.id_client, invoice.order.client);
      }
    }
  });

  this.clientNameSuggestions = Array.from(uniqueClients.values());
  this.showClientNameSuggestions = this.clientNameSuggestions.length > 0;
}

/**
* Maneja el click/focus en el campo de búsqueda de nombre
*/
onNameSearchFocus(): void {
  if (!this.clientNameSelected) {
    this.updateClientNameSuggestions();
  }
}

/**
* Maneja cuando el usuario escribe en el campo de búsqueda de nombre
*/
onNameSearchInput(): void {
  if (this.clientNameSelected) {
    this.clientNameSelected = false;
  }
  this.updateClientNameSuggestions();
  this.updateFilteredInvoices();
}

/**
* Selecciona un cliente desde el dropdown de búsqueda
*/
selectClientNameFromSuggestion(client: Client): void {
  this.nameSearchQuery = client.name;
  this.showClientNameSuggestions = false;
  this.clientNameSelected = true;
  this.updateFilteredInvoices();
}

  calculateSummary(): void {
    const invoices = this.filteredInvoicesList;

    let totalScheduled = 0;
    let rangeDebt = 0;
    let totalIVA = 0;

    invoices.forEach((invoice) => {
      const total = invoice.order.total || 0;
      const paid = this.getTotalPayments(invoice.order);
      const pending = total - paid;

      totalScheduled += total;

      if (pending > 0) {
        rangeDebt += pending;
      }

      if (invoice.order.requires_e_invoice) {
        totalIVA += invoice.order.iva || 0;
      }
    });

    this.dailySummary = {
      totalScheduled,
      totalPaid: this.calculateMoneyReceived(invoices),
      rangeDebt,
      pendingDebt: this.calculateGlobalPendingDebt(),
      totalIVA,
      invoiceCount: invoices.length,
    };
  }

  calculateMoneyReceived(invoicesToUse: any[]): number {
    const hasPaymentRange = this.paymentDateStart || this.paymentDateEnd;

    const start =
      hasPaymentRange && this.paymentDateStart
        ? new Date(this.paymentDateStart + 'T00:00:00')
        : null;

    const end =
      hasPaymentRange && this.paymentDateEnd
        ? new Date(this.paymentDateEnd + 'T23:59:59')
        : null;

    let total = 0;

    invoicesToUse.forEach((invoice) => {
      invoice.order.payments?.forEach((payment: Payment) => {
        if (!payment.payment_date) return;

        if (
          this.selectedPaymentMethodFilter !== 'all' &&
          payment.payment_method !== this.selectedPaymentMethodFilter
        ) {
          return;
        }

        if (hasPaymentRange) {
          const paymentDate = new Date(payment.payment_date);
          const inRange =
            (!start || paymentDate >= start) &&
            (!end || paymentDate <= end);

          if (!inRange) return;
        }

        total += payment.amount;
      });
    });

    return total;
  }

  calculateGlobalPendingDebt(): number {
    return this.invoices.reduce((sum, invoice) => {
      const total = invoice.order.total || 0;
      const paid = this.getTotalPayments(invoice.order);
      const pending = total - paid;

      return pending > 0 ? sum + pending : sum;
    }, 0);
  }

  toggleDailySummary(): void {
    this.showDailySummary = !this.showDailySummary;

    if (this.showDailySummary) {
      this.calculateSummary();
    }
  }

  private calculateDueDate(
    deliveryDate: string | Date,
    paymentTerm: number | null,
  ): string | null {
    if (!deliveryDate || paymentTerm === null) return null;
    const baseDate = new Date(deliveryDate);
    if (isNaN(baseDate.getTime())) return null;
    const dueDate = new Date(baseDate);
    dueDate.setDate(baseDate.getDate() + paymentTerm);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.toISOString();
  }

  private calculateDeliveryDate(
    startDate: string,
    paymentTerm: number,
  ): string {
    const baseDate = new Date(startDate);
    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(baseDate.getDate() + paymentTerm);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate.toISOString();
  }

  async deleteInvoice(invoice: Invoice): Promise<void> {
    if (!confirm(`¿Eliminar factura #${invoice.code}?`)) {
      return;
    }

    try {
      const { error: deleteError } = await this.supabase
        .from('invoices')
        .delete()
        .eq('id_invoice', invoice.id_invoice);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        this.showNotification('Error al eliminar la factura.');
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', invoice.order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const { total } = await this.calculateInvoiceValues(invoice);
      const newDebt = currentDebt - total;
      const newClientStatus = newDebt > 0 ? 'overdue' : 'upToDate';

      const { error: updateClientError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newClientStatus })
        .eq('id_client', invoice.order.id_client);

      if (updateClientError) {
        console.error(
          'Error al actualizar la deuda del cliente:',
          updateClientError,
        );
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      this.invoices = this.invoices.filter(
        (i) => i.id_invoice !== invoice.id_invoice,
      );
      this.updateFilteredInvoices();
      await this.loadOrders();
      this.updateClientOrders();
      this.showNotification('Factura eliminada correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  async loadVitrineSalesDetails(orderId: string): Promise<void> {
    if (!orderId) {
      this.vitrineSalesDetails = [];
      return;
    }

    const { data, error } = await this.supabase
      .from('sales')
      .select(`
        product_id,
        quantity,
        unit_price,
        line_total,
        products ( name )
      `)
      .eq('id_order', orderId);

    if (error) {
      console.error('Error loading vitrine sales details:', error);
      this.vitrineSalesDetails = [];
      return;
    }

    this.vitrineSalesDetails = (data ?? []).map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      product_name: item.products?.name ?? 'Producto',
    }));
  }

  async loadOrders(): Promise<void> {
    const { data, error } = await this.supabase.from('orders').select(`
    *,
    clients(*)
  `);

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }

    this.orders = data.map((order) => ({
      ...order,
      client: order.clients || null,
      delivery_date: order.delivery_date || new Date().toISOString(),
    })) as Orders[];
  }

  openAddClientModal(): void {
    this.showAddClientModal = true;
  }

  closeAddClientModal(): void {
    this.showAddClientModal = false;
    this.newClient = {
      name: '',
      email: '',
      document_type: '',
      document_number: '',
      cellphone: '',
      address: '',
      status: '',
    };
  }

  clearFilters(): void {
    // Resetear todas las variables de filtro
    this.searchQuery = '';
    this.nameSearchQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.paymentDateStart = '';
    this.paymentDateEnd = '';
    this.showPrints = true;
    this.showCuts = true;
    this.showSales = true;
    this.showDebt = false;
    this.showRequiresFE = true;
    this.showNoRequiresFE = true;
    this.showFEPending = true;
    this.showFEDone = true;
    this.showNonVitrineSales = true;
    this.showVitrineSales = true;
    this.selectedPaymentMethodFilter = 'all';
    this.clientNameSelected = false;
    this.showClientNameSuggestions = false;
    this.clientNameSuggestions = [];

    // Recargar la lista completa
    this.updateFilteredInvoices();
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.selectedInvoice = null;
    this.clientSearchQuery = '';
    this.filteredClients = [...this.clients];
    this.clientOrders = [];
    this.showClientDropdown = false;
    this.selectedInvoiceDetails = null;
    this.newPaymentMethod = '';
  }
  private normalizeClassification(c?: string | null): 'bienes' | 'servicios' {
    const s = (c ?? '').trim().toLowerCase();
    if (['bien', 'bienes', 'producto', 'productos'].includes(s))
      return 'bienes';
    if (['servicio', 'servicios'].includes(s)) return 'servicios';
    return 'servicios';
  }

  get submitButtonText(): string {
    if (this.isSaving) return 'Guardando...';
    return this.isEditing ? 'Actualizar' : 'Guardar';
  }
  async getSchedulers() {
    const { data, error } = await this.supabase
      .from('employees')
      .select(
        `
         id_employee,
         name,
         id_user,
         users!inner (
           roles!inner ( name )
         )
      `,
      )
      .eq('users.roles.name', 'scheduler')
      .not('id_user', 'is', null);

    if (error) {
      console.error('Error fetching schedulers:', error);
      // fallback fetch all employees with users if the deep filter fails
      this.fetchAllEmployeesWithUsers();
    } else {
      this.schedulers = data.map((d: any) => ({
        id_employee: d.id_employee,
        name: d.name,
        id_user: d.id_user,
      }));
    }
  }

  // fallback if the deep join above fails
  async fetchAllEmployeesWithUsers() {
    const { data } = await this.supabase
      .from('employees')
      .select('id_employee, name, id_user')
      .not('id_user', 'is', null);

    if (data) this.schedulers = data as Employee[];
  }

  async loadInvoicePermissions(invoiceId: string) {
    this.permissionLoading = true;
    this.currentPermissions = [];

    // get permissions
    const { data: perms, error } = await this.supabase
      .from('invoice_permissions')
      .select('*')
      .eq('id_invoice', invoiceId);

    if (error || !perms || perms.length === 0) {
      this.permissionLoading = false;
      return;
    }

    // get employee names
    const userIds = perms.map((p: any) => p.id_user);
    const { data: employees } = await this.supabase
      .from('employees')
      .select('id_user, name')
      .in('id_user', userIds);

    // merge
    this.currentPermissions = perms.map((p: any) => {
      const emp = employees?.find((e: any) => e.id_user === p.id_user);
      return {
        ...p,
        employee_details: emp, // employee object for display
      };
    });

    this.permissionLoading = false;
  }

  openPermissionModal(invoice: Invoice) {
    if (!this.selectedInvoiceDetails) {
      this.selectedInvoiceDetails = [invoice];
    }
    this.showPermissionModal = true;
    this.getSchedulers();
    this.loadInvoicePermissions(invoice.id_invoice);
  }

  closePermissionModal() {
    this.showPermissionModal = false;
    this.selectedUserId = '';
    this.currentPermissions = [];
  }

  async grantPermission() {
    if (!this.selectedUserId || !this.selectedInvoiceDetails) return;

    const invoiceId = this.selectedInvoiceDetails[0].id_invoice;

    const { error } = await this.supabase.from('invoice_permissions').insert({
      id_invoice: invoiceId,
      id_user: this.selectedUserId,
    });

    if (error) {
      console.error(error);
      // handle the trigger in db
      if (error.message.includes('scheduler')) {
        this.showNotification(
          'Error: El usuario seleccionado no es un Scheduler.',
        );
      } else if (error.code === '23505') {
        this.showNotification('Este usuario ya tiene permiso.');
      } else {
        this.showNotification('Error al conceder permiso.');
      }
    } else {
      this.showNotification('Permiso concedido correctamente.');
      this.loadInvoicePermissions(invoiceId);
      this.selectedUserId = '';
    }
  }

  async revokePermission(userId: string) {
    if (!this.selectedInvoiceDetails) return;
    const invoiceId = this.selectedInvoiceDetails[0].id_invoice;

    const { error } = await this.supabase
      .from('invoice_permissions')
      .delete()
      .eq('id_invoice', invoiceId)
      .eq('id_user', userId);

    if (error) {
      this.showNotification('Error al revocar permiso.');
    } else {
      this.showNotification('Permiso revocado.');
      this.loadInvoicePermissions(invoiceId);
    }
  }
  async checkPaymentPermissions(invoiceId: string) {
    this.canManagePayments = false;
    if (this.userRole === 'admin') {
      this.canManagePayments = true;
      return;
    }

    if (this.userId) {
      const { data, error } = await this.supabase
        .from('invoice_permissions')
        .select('id')
        .eq('id_invoice', invoiceId)
        .eq('id_user', this.userId)
        .maybeSingle();

      if (data) {
        this.canManagePayments = true;
      }
      if (error) {
        console.error('Error checking payment permissions:', error);
        return;
      }
    }
  }
}

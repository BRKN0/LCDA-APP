import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { Router, RouterOutlet } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

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
  name: string;
  description: string;
  order_payment_status: string;
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
  tax_regime: number;
  is_declarante: boolean;
  retefuente: boolean;
  applies_ica_retention: boolean;
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
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
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
  selectedInvoiceDetails: Invoice[] | null = null;
  loading = true;
  searchQuery: string = '';
  nameSearchQuery: string = '';
  clientSearchQuery: string = '';
  filteredInvoicesList: Invoice[] = [];
  filteredClients: Client[] = [];
  clientOrders: Orders[] = [];
  noResultsFound: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isEditing = false;
  showModal = false;
  showAddClientModal = false;
  showClientDropdown: boolean = false;
  selectedInvoice: Invoice | null = null;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedInvoice: Invoice[] = [];
  IVA_RATE = 0.19;
  newPaymentAmount: number = 0;
  newPaymentMethod: string = '';
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;
  calculatedValues: {
    subtotal: number;
    iva: number;
    total: number;
    reteica: number;
    retefuente: number;
  } | null = null;
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
    company_name: '',
    cellphone: '',
    address: '',
    status: '',
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getInvoices();
          this.getClients();
          this.loadOrders();
          this.getVariables();
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

    const map: Partial<VariableMap> = {};
    for (const variable of data) {
      const name = variable.name as keyof VariableMap;
      const parsedValue = parseFloat(variable.value);
      if (!isNaN(parsedValue) && name in this.variables) {
        map[name] = parsedValue;
      }
    }

    this.variables = map as VariableMap;
    console.log('Variables cargadas:', this.variables);
  }
  async saveNewClient(): Promise<void> {
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }

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
  }

  searchClients(): void {
    if (!this.clientSearchQuery.trim()) {
      this.filteredClients = [...this.clients];
      return;
    }

    this.filteredClients = this.clients.filter(
      (client) =>
        client.name
          .toLowerCase()
          .includes(this.clientSearchQuery.toLowerCase()) ||
        (client.company_name &&
          client.company_name
            .toLowerCase()
            .includes(this.clientSearchQuery.toLowerCase()))
    );
  }

  selectClient(client: Client): void {
    if (this.selectedInvoice) {
      this.selectedInvoice.order.id_client = client.id_client;
      this.selectedInvoice.order.client = { ...client };
      this.clientSearchQuery = `${client.name} (${
        client.company_name || 'Sin empresa'
      })`;
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
                invoice.id_invoice !== this.selectedInvoice.id_invoice))
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
          clients(*)
        )
      `
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
      return;
    }

    this.invoice = {
      ...data[0],
      include_iva: data[0].include_iva ?? false,
      due_date: data[0].due_date,
      order: {
        ...data[0].orders,
        client: data[0].orders?.clients || null,
      },
    } as Invoice;

    this.selectInvoice(this.invoice);
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

    this.invoices = [...data].map((invoice) => ({
      ...invoice,
      include_iva: invoice.include_iva ?? false,
      due_date: invoice.due_date,
      payment_term: invoice.payment_term || null,
      order: {
        ...invoice.orders,
        client: invoice.orders?.clients || null,
        payments: invoice.orders?.payments || [],
      },
    })) as Invoice[];
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
  }

  updateFilteredInvoices(): void {
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

      const matchesNameSearch =
        !this.nameSearchQuery ||
        invoice.order.client.name
          .toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase()) ||
        (invoice.order.client.company_name &&
          invoice.order.client.company_name
            .toLowerCase()
            .includes(this.nameSearchQuery.toLowerCase()));

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

      return (
        isDebtFilter && matchesType && matchesDateRange && matchesNameSearch
      );
    });

    this.noResultsFound = this.filteredInvoicesList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedInvoices();
  }

  async calculateInvoiceValues(invoice: Invoice): Promise<{
    subtotal: number;
    iva: number;
    total: number;
    reteica: number;
    retefuente: number;
  }> {
    const order = invoice.order;
    const cliente = order.client;
    const classification = invoice.classification?.toLowerCase();
    let baseTotal = order.total || 0;
    let subtotal = baseTotal;
    let iva = 0;

    if (invoice.include_iva && this.variables.iva > 0) {
      subtotal = +(baseTotal / (1 + this.variables.iva)).toFixed(2);
      iva = +(baseTotal - subtotal).toFixed(2);
    }

    const classificationKey =
      classification === 'bienes' ? 'bienes' : 'servicios';

    // RETEFUENTE
    let retefuente = 0;
    if (cliente.retefuente && classification && invoice.include_iva) {
      const declara = cliente.is_declarante ? 'declara' : 'no_declara';
      const retefuenteKey =
        `retefuente_${classificationKey}_${declara}` as keyof VariableMap;
      const rate = this.variables[retefuenteKey] ?? 0;
      console.log('Calculando con clave:', retefuenteKey);
      console.log('Variables:', this.variables);
      const superaTope =
        (classification === 'bienes' && subtotal >= 498000) ||
        (classification === 'servicio' && subtotal >= 100000);
      console.log('RATE', rate);
      if (rate > 0.0 && superaTope) {
        retefuente = +(subtotal * rate).toFixed(2);
      }
    }

    // RETEICA
    let reteica = 0;
    if (
      cliente.applies_ica_retention &&
      classification &&
      invoice.include_iva
    ) {
      const reteicaKey = `reteica_${classificationKey}` as keyof VariableMap;
      const rate = this.variables[reteicaKey] ?? 0;
      if (rate > 0) {
        reteica = +(subtotal * rate).toFixed(2);
      }
    }

    return {
      subtotal,
      iva,
      total: baseTotal,
      reteica,
      retefuente,
    };
  }
  // No Idea what this is, is not used at all
  async getDisplayAmount(invoice: Invoice) {
    const { total } = await this.calculateInvoiceValues(invoice);
    return total.toFixed(2);
  }

  async selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
    this.calculatedValues = await this.calculateInvoiceValues(invoice);
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
    paymentMethod: string
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
          2
        )}.`
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
      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
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
          (p) => p.id_payment === this.selectedPayment!.id_payment
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
          (p) => p.id_payment !== payment.id_payment
        );

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

  public getRemainingPaymentTerm(invoice: Invoice): number {
    if (!invoice.due_date) return 0;
    const dueDate = new Date(invoice.due_date);
    const currentDate = new Date();
    const diffTime = dueDate.getTime() - currentDate.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return remainingDays;
  }

  formatNumber(value: number): string {
    return value.toFixed(2);
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

    const { subtotal, iva, total, reteica, retefuente } =
      await this.calculateInvoiceValues(invoice);
    const totalPaid = this.getTotalPayments(invoice.order);
    const remainingBalance = total - totalPaid;
    const quantity = invoice.order.order_quantity;
    const unitaryValue = subtotal / quantity;

    const doc = new jsPDF();
    const invoice_date = new Date(invoice.created_at);
    const year = invoice_date.getFullYear();
    const month = (invoice_date.getMonth() + 1).toString().padStart(2, '0');
    const day = invoice_date.getDate().toString().padStart(2, '0');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('La Casa del Acrilico', 10, 10);

    const logoUrl = '/Logo.png';
    const logo = await this.loadImage(logoUrl);
    doc.addImage(logo, 'JPEG', 90, 5, 30, 20);

    doc.setTextColor(200);
    doc.setFontSize(30);
    doc.text('FACTURA', 190, 10, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Barrio Blas de Lezo Cl. 21A Mz. 11A - Lt. 12', 10, 30);
    doc.text(`Fecha: ${day}-${month}-${year}`, 190, 30, { align: 'right' });

    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Factura N°: ${invoice.code}`, 190, 40, { align: 'right' });

    doc.text('3004947020', 10, 50);
    if (invoice.order.client.nit) {
      doc.text(`NIT: ${invoice.order.client.nit}`, 10, 60);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Facturar a:', 10, 70);
    doc.setFont('helvetica', 'normal');

    let y = 80;
    doc.text(`Nombre: ${invoice.order.client.name}`, 10, y);
    y += 6;
    doc.text(
      `Nombre de la empresa: ${invoice.order.client.company_name || 'N/A'}`,
      10,
      y
    );
    y += 6;
    doc.text(`Dirección: ${invoice.order.client.address}`, 10, y);
    y += 6;
    doc.text(`Ciudad: ${invoice.order.client.city}`, 10, y);
    y += 6;
    doc.text(`Provincia: ${invoice.order.client.province}`, 10, y);
    y += 6;
    doc.text(`Código Postal: ${invoice.order.client.postal_code}`, 10, y);
    y += 6;
    doc.text(`E-mail: ${invoice.order.client.email}`, 10, y);
    y += 6;
    doc.text(`Teléfono: ${invoice.order.client.cellphone}`, 10, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.order.description, y);
    let currentY = y;
    descriptionLines.forEach((line) => {
      doc.text(line, 10, currentY);
      currentY += 10;
    });

    const startY = currentY + 10;
    const rowHeight = 7;
    const headerXPositions = [10, 40, 120, 170];
    const summaryStartY = startY + rowHeight * 2;

    doc.setFont('helvetica', 'bold');
    doc.text('CANTIDAD', headerXPositions[0], startY);
    doc.text('VALOR UNITARIO', headerXPositions[1], startY);
    doc.text('ABONO', headerXPositions[2], startY, { align: 'right' });

    currentY = startY + rowHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.order.order_quantity}`, headerXPositions[0], currentY);
    doc.text(`$${unitaryValue.toFixed(2)}`, headerXPositions[1], currentY);
    doc.text(`$${subtotal.toFixed(2)}`, headerXPositions[2], currentY, {
      align: 'right',
    });

    // Añadir lista de abonos al PDF
    if (invoice.order.payments && invoice.order.payments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Abonos Realizados:', 10, summaryStartY);
      currentY = summaryStartY + rowHeight;
      doc.setFont('helvetica', 'normal');
      invoice.order.payments.forEach((payment) => {
        doc.text(
          `$${payment.amount} - ${payment.payment_method} - ${
            payment.payment_date
              ? new Date(payment.payment_date).toLocaleDateString('es-CO')
              : ''
          }`,
          10,
          currentY
        );
        currentY += rowHeight;
      });
    }

    const summaryX = headerXPositions[0];
    const valueX = headerXPositions[1];
    doc.setFont('helvetica', 'bold');

    doc.text('Subtotal:', summaryX, currentY);
    doc.text(`$${subtotal.toFixed(2)}`, valueX, currentY, { align: 'left' });
    currentY += rowHeight;

    if (invoice.include_iva) {
      doc.text('IVA (19%):', summaryX, currentY);
      doc.text(`$${iva.toFixed(2)}`, valueX, currentY, { align: 'left' });
      currentY += rowHeight;
    }

    if (retefuente > 0) {
      doc.text('Retefuente:', summaryX, currentY);
      doc.text(`$${retefuente.toFixed(2)}`, valueX, currentY, {
        align: 'left',
      });
      currentY += rowHeight;
    }

    if (reteica > 0) {
      doc.text('ReteICA:', summaryX, currentY);
      doc.text(`$${reteica.toFixed(2)}`, valueX, currentY, { align: 'left' });
      currentY += rowHeight;
    }

    doc.setFontSize(14);
    doc.text('Total:', summaryX, currentY);
    doc.text(`$${total.toFixed(2)}`, valueX, currentY, { align: 'left' });
    currentY += rowHeight;

    const spacing = 15;
    const totalPagarY = currentY + rowHeight;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total a Pagar:', summaryX, totalPagarY);
    doc.text(`$${remainingBalance.toFixed(2)}`, valueX + spacing, totalPagarY, {
      align: 'left',
    });

    const footerStartY = totalPagarY + rowHeight * 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Todos los cheques se extenderán a nombre de La casa del acrilico',
      10,
      footerStartY
    );
    doc.text(
      'Si tiene cualquier tipo de pregunta acerca de esta factura, póngase en contacto al número 3004947020',
      10,
      footerStartY + 10
    );

    doc.setFont('helvetica', 'bold');
    doc.text('GRACIAS POR SU CONFIANZA', 10, footerStartY + 25);

    doc.save(`Factura-${invoice.code}.pdf`);
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
      Math.ceil(this.filteredInvoicesList.length / this.itemsPerPage)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedInvoice = this.filteredInvoicesList.slice(
      startIndex,
      endIndex
    );
  }

  addNewInvoice(): void {
    this.selectedInvoice = {
      id_invoice: '',
      created_at: new Date().toISOString(),
      invoice_status: 'upToDate',
      id_order: '',
      code: '',
      include_iva: false,
      payment_term: null,
      due_date: null,
      classification: 'Bien',
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
          company_name: '',
          email: '',
          status: '',
          debt: 0,
          address: '',
          city: '',
          province: '',
          postal_code: '',
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

  editInvoice(invoice: Invoice): void {
    this.selectedInvoice = {
      ...invoice,
      created_at: invoice.created_at,
      payment_term: invoice.payment_term || null,
      due_date: invoice.due_date,
      include_iva: invoice.include_iva ?? false,
      classification: invoice.classification,
      order: {
        ...invoice.order,
        total: invoice.order.total || invoice.order.amount || 0, // Use current total as base
        baseTotal: invoice.order.total || invoice.order.amount || 0,
      },
    };
    this.isEditing = true;
    this.showModal = true;
    this.clientSearchQuery = `${invoice.order.client.name} (${
      invoice.order.client.company_name || 'Sin empresa'
    })`;
    this.updateClientOrders();
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
      const total = order.total || 0;

      if (this.selectedInvoice.include_iva) {
        // Agrega el IVA al total base
        const baseTotal = order.baseTotal || total; // Si no hay baseTotal, asumimos que total es base
        order.total = Math.round(baseTotal * (1 + this.IVA_RATE));
        order.baseTotal = baseTotal; // Guardamos el baseTotal explícitamente
      } else {
        // Eliminar el IVA del total actual
        const calculatedBase = +(total / (1 + this.IVA_RATE)).toFixed(2);
        order.total = Math.round(calculatedBase); // Redondeamos para evitar decimales flotantes
        order.baseTotal = calculatedBase;
      }
    }
  }

  async updateOrderTotal(): Promise<void> {
    if (
      !this.selectedInvoice ||
      !this.selectedInvoice.order ||
      !this.selectedInvoice.order.id_order
    ) {
      return;
    }

    const baseTotal =
      this.selectedInvoice.order.baseTotal ||
      this.selectedInvoice.order.total ||
      0;
    if (this.selectedInvoice.include_iva) {
      // Save with IVA applied to baseTotal
      this.selectedInvoice.order.total = Math.round(
        baseTotal * (1 + this.IVA_RATE)
      );
    } else {
      // Save the baseTotal without IVA
      this.selectedInvoice.order.total = baseTotal;
    }

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
      (i) => i.id_invoice === this.selectedInvoice!.id_invoice
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
          this.selectedInvoice.payment_term * 24 * 60 * 60 * 1000
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

    const paymentTerm = this.selectedInvoice.payment_term
      ? parseInt(this.selectedInvoice.payment_term.toString(), 10)
      : null;
    if (paymentTerm !== null && (isNaN(paymentTerm) || paymentTerm < 1)) {
      this.showNotification(
        'El plazo de pago debe ser un número entero mayor o igual a 1.'
      );
      return;
    }

    const orderExists = await this.validateOrderExists(
      this.selectedInvoice.order.id_order
    );
    if (!orderExists) {
      alert('La orden seleccionada no existe.');
      this.closeModal();
      return;
    }

    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .select('delivery_date, total')
      .eq('id_order', this.selectedInvoice.order.id_order)
      .single();

    if (orderError || !orderData) {
      console.error('Error al obtener la orden:', orderError);
      alert('Error al obtener la orden asociada.');
      this.closeModal();
      return;
    }

    const deliveryDate = orderData.delivery_date
      ? new Date(orderData.delivery_date)
      : new Date();
    const dueDate =
      paymentTerm !== null
        ? new Date(
            deliveryDate.getTime() + paymentTerm * 24 * 60 * 60 * 1000
          ).toISOString()
        : this.selectedInvoice.due_date;

    const invoiceData: Partial<Invoice> = {
      invoice_status: this.selectedInvoice.invoice_status,
      id_order: this.selectedInvoice.order.id_order,
      code: this.selectedInvoice.code,
      include_iva: this.selectedInvoice.include_iva,
      payment_term: paymentTerm,
      due_date: dueDate,
      classification: this.selectedInvoice.classification,
    };

    try {
      if (this.isEditing) {
        const { error } = await this.supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id_invoice', this.selectedInvoice.id_invoice);

        if (error) {
          console.error('Error al actualizar la factura:', error);
          this.showNotification(
            `Error al actualizar la factura: ${error.message}`
          );
          return;
        }

        // Update the order total only on save
        await this.updateOrderTotal();

        this.showNotification('Factura actualizada correctamente.');
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
        const { total } = await this.calculateInvoiceValues(
          this.selectedInvoice
        );
        const newDebt = currentDebt + total;

        const newClientStatus = newDebt > 0 ? 'overdue' : 'upToDate';

        const { error: updateClientError } = await this.supabase
          .from('clients')
          .update({ debt: newDebt, status: newClientStatus })
          .eq('id_client', this.selectedInvoice.order.id_client);

        if (updateClientError) {
          console.error(
            'Error al actualizar la deuda del cliente:',
            updateClientError
          );
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        this.showNotification('Factura añadida correctamente.');
      }

      await this.getInvoices();
      await this.loadOrders();
      this.closeModal();
    } catch (error) {
      console.error('Error inesperado al guardar la factura:', error);
      this.showNotification(
        'Ocurrió un error inesperado al guardar la factura.'
      );
    }
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
          updateClientError
        );
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      this.invoices = this.invoices.filter(
        (i) => i.id_invoice !== invoice.id_invoice
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
      company_name: '',
      cellphone: '',
      address: '',
      status: '',
    };
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
}

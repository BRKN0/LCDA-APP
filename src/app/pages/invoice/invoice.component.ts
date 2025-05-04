import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

interface Invoice {
  id_invoice: string;
  created_at: Date | string;
  invoice_status: string;
  id_order: string;
  code: string;
  payment_term: number;
  order: Orders;
  include_iva: boolean;
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
}

interface Payment {
  id_payment?: number;
  id_order: string;
  amount: number;
  payment_date?: string;
}

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
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
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;

  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '',
    company_name: '',
    cellphone: '',
    address: '',
    status: ''
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getInvoices();
          this.getClients();
          this.loadOrders();
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

  async saveNewClient(): Promise<void> {
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }

    const { data, error } = await this.supabase.from('clients').insert([this.newClient]);

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

    this.filteredClients = this.clients.filter((client) =>
      client.name.toLowerCase().includes(this.clientSearchQuery.toLowerCase()) ||
      (client.company_name && client.company_name.toLowerCase().includes(this.clientSearchQuery.toLowerCase()))
    );
  }

  selectClient(client: Client): void {
    if (this.selectedInvoice) {
      this.selectedInvoice.order.id_client = client.id_client;
      this.selectedInvoice.order.client = { ...client };
      this.clientSearchQuery = `${client.name} (${client.company_name || 'Sin empresa'})`;
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
            (!this.isEditing || (this.selectedInvoice && invoice.id_invoice !== this.selectedInvoice.id_invoice))
        );
        return matchesClient && matchesType && !isAssigned;
      });
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
      .select(`
        *,
        orders(*,
          clients(*)
        )
      `)
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
      include_iva: data[0].include_iva ?? true,
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
      include_iva: invoice.include_iva ?? true,
      order: {
        ...invoice.orders,
        client: invoice.orders?.clients || null,
      },
    })) as Invoice[];
    let n = this.invoices.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.invoices[i].code < this.invoices[i + 1].code) {
          [this.invoices[i], this.invoices[i + 1]] = [this.invoices[i + 1], this.invoices[i]];
          swapped = true;
        }
      }
      n--;
    } while (swapped);
    this.loading = false;
    this.updateFilteredInvoices();
  }

  updateFilteredInvoices(): void {
    const allTypeCheckboxesOff = !this.showPrints && !this.showCuts && !this.showSales;

    this.filteredInvoicesList = this.invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.created_at);
      const matchesStartDate = this.startDate ? invoiceDate >= new Date(this.startDate) : true;
      const matchesEndDate = this.endDate ? invoiceDate <= new Date(this.endDate + 'T23:59:59') : true;
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesNameSearch =
        !this.nameSearchQuery ||
        invoice.order.client.name.toLowerCase().includes(this.nameSearchQuery.toLowerCase()) ||
        (invoice.order.client.company_name &&
          invoice.order.client.company_name.toLowerCase().includes(this.nameSearchQuery.toLowerCase()));

      if (allTypeCheckboxesOff) {
        return matchesDateRange && matchesNameSearch;
      }

      const isDebtFilter = this.showDebt ? invoice.invoice_status === 'overdue' : true;

      const isPrintsFilter = this.showPrints && invoice.order.order_type === 'print';
      const isCutsFilter = this.showCuts && invoice.order.order_type === 'laser';
      const isSalesFilter = this.showSales && invoice.order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      return isDebtFilter && matchesType && matchesDateRange && matchesNameSearch;
    });

    this.noResultsFound = this.filteredInvoicesList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedInvoices();
  }

  calculateInvoiceValues(invoice: Invoice): { subtotal: number; iva: number; total: number } {
    const baseTotal = invoice.order.total || 0;
    const iva = invoice.include_iva ? baseTotal * this.IVA_RATE : 0;
    const total = baseTotal + iva;
    return { subtotal: baseTotal, iva, total };
  }

  getDisplayAmount(invoice: Invoice): string {
    const { total } = this.calculateInvoiceValues(invoice);
    return total.toFixed(2);
  }

  selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
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

  async addPayment(order: Orders, amount: number): Promise<void> {
    if (!order || !order.id_order || amount <= 0) {
      this.showNotification('Por favor, ingrese un monto válido.');
      return;
    }

    const total = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    if (amount > remainingBalance) {
      this.showNotification(`El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(2)}.`);
      return;
    }

    const payment: Payment = {
      id_order: order.id_order,
      amount: amount,
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
      const orderTotal = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
      const newRemainingBalance = orderTotal - totalPaidUpdated;
      const newStatus = newRemainingBalance <= 0 ? 'upToDate' : 'overdue';
      console.log('addPayment - totalPaid:', totalPaidUpdated, 'orderTotal:', orderTotal, 'newRemainingBalance:', newRemainingBalance, 'newStatus:', newStatus);

      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', order.id_order);

      await this.supabase
        .from('invoices')
        .update({ invoice_status: newStatus })
        .eq('id_order', order.id_order);

      // Recargar los datos para reflejar los cambios en la interfaz
      await this.getInvoices();

      this.newPaymentAmount = 0;
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
        .update({ amount: newAmount })
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
        const orderTotal = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
        const newRemainingBalance = orderTotal - totalPaid;
        const newStatus = newRemainingBalance <= 0 ? 'upToDate' : 'overdue';
        console.log('updatePayment - totalPaid:', totalPaid, 'orderTotal:', orderTotal, 'newRemainingBalance:', newRemainingBalance, 'newStatus:', newStatus);

        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', order.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', order.id_order);

        // Recargar los datos para reflejar los cambios en la interfaz
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
        order.payments = order.payments.filter((p) => p.id_payment !== payment.id_payment);

        const totalPaid = this.getTotalPayments(order);
        const orderTotal = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
        const newRemainingBalance = orderTotal - totalPaid;
        const newStatus = newRemainingBalance <= 0 ? 'upToDate' : 'overdue';
        console.log('deletePayment - totalPaid:', totalPaid, 'orderTotal:', orderTotal, 'newRemainingBalance:', newRemainingBalance, 'newStatus:', newStatus);

        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', order.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', order.id_order);

        // Recargar los datos para reflejar los cambios en la interfaz
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
    const invoiceValues = this.calculateInvoiceValues(invoice);
    const totalPaid = this.getTotalPayments(invoice.order);
    return Math.max(0, invoiceValues.total - totalPaid);
  }

  public getRemainingPaymentTerm(invoice: Invoice): number {
    const createdAt = new Date(invoice.created_at);
    const dueDate = new Date(createdAt.getTime() + invoice.payment_term * 24 * 60 * 60 * 1000);
    const currentDate = new Date();
    const diffTime = dueDate.getTime() - currentDate.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return remainingDays; // Permitimos valores negativos para depuración
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

    const { subtotal, iva, total } = this.calculateInvoiceValues(invoice);
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

    doc.text(`Nombre: ${invoice.order.client.name}`, 10, 80);
    doc.text(
      `Nombre de la empresa: ${invoice.order.client.company_name || 'N/A'}`,
      10,
      100
    );
    doc.text(`Dirección: ${invoice.order.client.address}`, 10, 110);
    doc.text(`Ciudad: ${invoice.order.client.city}`, 10, 120);
    doc.text(`Provincia: ${invoice.order.client.province}`, 10, 130);
    doc.text(`Código Postal: ${invoice.order.client.postal_code}`, 10, 140);
    doc.text(`E-mail: ${invoice.order.client.email}`, 10, 150);
    doc.text(`Teléfono: ${invoice.order.client.cellphone}`, 10, 160);

    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, 170);
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.order.description, 180);
    let currentY = 180;
    descriptionLines.forEach((line) => {
      doc.text(line, 10, currentY);
      currentY += 10;
    });

    const startY = currentY + 10;
    const rowHeight = 10;
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
    doc.text(`$${subtotal.toFixed(2)}`, headerXPositions[2], currentY, { align: 'right' });

    const summaryX = headerXPositions[0];
    const valueX = headerXPositions[1];
    doc.setFont('helvetica', 'bold');

    doc.text('Subtotal:', summaryX, summaryStartY);
    doc.text(`$${subtotal.toFixed(2)}`, valueX, summaryStartY, { align: 'left' });

    if (invoice.include_iva) {
      doc.text('IVA (19%):', summaryX, summaryStartY + rowHeight);
      doc.text(`$${iva.toFixed(2)}`, valueX, summaryStartY + rowHeight, { align: 'left' });
    }

    doc.setFontSize(14);
    doc.text('Total:', summaryX, summaryStartY + rowHeight * 2);
    doc.text(`$${total.toFixed(2)}`, valueX, summaryStartY + rowHeight * 2, { align: 'left' });

    const spacing = 15;
    const totalPagarY = summaryStartY + rowHeight * 3.5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total a Pagar:', summaryX, totalPagarY);
    doc.text(`$${remainingBalance.toFixed(2)}`, valueX + spacing, totalPagarY, { align: 'left' });

    const footerStartY = totalPagarY + rowHeight * 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Todos los cheques se extenderán a nombre de La casa del acrilico', 10, footerStartY);
    doc.text('Si tiene cualquier tipo de pregunta acerca de esta factura, póngase en contacto al número 3004947020', 10, footerStartY + 10);

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
    this.totalPages = Math.max(1, Math.ceil(this.filteredInvoicesList.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedInvoice = this.filteredInvoicesList.slice(startIndex, endIndex);
  }

  addNewInvoice(): void {
    this.selectedInvoice = {
      id_invoice: '',
      created_at: new Date().toISOString(),
      invoice_status: 'upToDate',
      id_order: '',
      code: '',
      include_iva: true,
      payment_term: 30, // Valor predeterminado al crear una nueva factura
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
  }

  editInvoice(invoice: Invoice): void {
    this.selectedInvoice = {
      ...invoice,
      created_at: invoice.created_at, // Aseguramos que created_at no se modifique
      payment_term: invoice.payment_term || 30, // Aseguramos que payment_term tenga el valor correcto
    };
    this.isEditing = true;
    this.showModal = true;
    this.clientSearchQuery = `${invoice.order.client.name} (${invoice.order.client.company_name || 'Sin empresa'})`;
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

    if (!this.selectedInvoice.payment_term || this.selectedInvoice.payment_term < 1) {
      this.showNotification('El plazo de pago debe ser un número mayor o igual a 1.');
      return;
    }

    const orderExists = await this.validateOrderExists(this.selectedInvoice.order.id_order);
    if (!orderExists) {
      alert('La orden seleccionada no existe.');
      this.closeModal();
      return;
    }

    const selectedOrder = this.clientOrders.find(
      (order) => order.id_order === this.selectedInvoice!.order.id_order
    );
    if (selectedOrder) {
      this.selectedInvoice.order.total = selectedOrder.total;
    }

    const currentOrder = this.orders.find(
      (order) => order.id_order === this.selectedInvoice!.order.id_order
    );
    if (currentOrder && currentOrder.total !== this.selectedInvoice.order.total) {
      const { error: updateOrderError } = await this.supabase
        .from('orders')
        .update({ total: this.selectedInvoice.order.total })
        .eq('id_order', this.selectedInvoice.order.id_order);
      if (updateOrderError) {
        console.error('Error actualizando el importe del pedido:', updateOrderError);
        alert('Error al actualizar el importe del pedido: ' + updateOrderError.message);
        this.closeModal();
        return;
      }
    }

    const ivaValue = this.selectedInvoice.include_iva ? 1 : 0;
    const { error: updateIvaError } = await this.supabase
      .from('orders')
      .update({ iva: ivaValue })
      .eq('id_order', this.selectedInvoice.order.id_order);
    if (updateIvaError) {
      console.error('Error al actualizar el campo iva en orders:', updateIvaError);
      alert('Error al actualizar el IVA del pedido: ' + updateIvaError.message);
      this.closeModal();
      return;
    }

    try {
      let newStatus = 'upToDate';
      let newDebt = 0;

      // Calcular total con o sin IVA
      const { total } = this.calculateInvoiceValues(this.selectedInvoice);
      const totalPaid = this.getTotalPayments(this.selectedInvoice.order);
      const remainingBalance = total - totalPaid;

      // Determinar nuevo estado
      newStatus = remainingBalance <= 0 ? 'upToDate' : 'overdue';

      // Actualizar deuda del cliente
      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', this.selectedInvoice.order.id_client)
        .single();
      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        alert('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      newDebt = this.isEditing ? currentDebt : currentDebt + remainingBalance;
      await this.supabase
        .from('clients')
        .update({
          debt: newDebt,
          status: newDebt > 0 ? 'overdue' : 'upToDate',
        })
        .eq('id_client', this.selectedInvoice.order.id_client);

      // Guardar o actualizar la factura
      if (this.isEditing) {
        // Al editar, no incluimos created_at en la actualización para evitar que se modifique
        const { error } = await this.supabase
          .from('invoices')
          .update({
            id_order: this.selectedInvoice.order.id_order,
            invoice_status: newStatus,
            include_iva: this.selectedInvoice.include_iva,
            payment_term: this.selectedInvoice.payment_term,
            code: this.selectedInvoice.code || null,
          })
          .eq('id_invoice', this.selectedInvoice.id_invoice);

        if (error) {
          console.error('Error actualizando la factura:', error);
          alert('Error al actualizar la factura: ' + error.message);
          return;
        }

        alert('Factura actualizada correctamente.');
      } else {
        // Al crear una nueva factura, sí incluimos created_at
        const invoiceToSave = {
          code: this.selectedInvoice.code || null,
          created_at: new Date().toISOString(),
          invoice_status: newStatus,
          id_order: this.selectedInvoice.order.id_order,
          include_iva: this.selectedInvoice.include_iva,
          payment_term: this.selectedInvoice.payment_term,
        };

        const { data, error } = await this.supabase.from('invoices').insert([invoiceToSave]).select();
        if (error) {
          console.error('Error añadiendo la factura:', error);
          alert('Error al añadir la factura: ' + error.message);
          return;
        }

        alert('Factura añadida correctamente.');
      }

      // Actualizar estado del pedido
      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', this.selectedInvoice.order.id_order);

      await this.getInvoices();
      await this.loadOrders();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    } finally {
      this.closeModal();
    }
  }

  async deleteInvoice(invoice: Invoice): Promise<void> {
    if (confirm(`¿Eliminar factura #${invoice.code}?`)) {
      try {
        // Paso 1: Eliminar los pagos asociados al pedido (si los hay)
        const { error: deletePaymentsError } = await this.supabase
          .from('payments')
          .delete()
          .eq('id_order', invoice.id_order);

        if (deletePaymentsError) {
          console.error('Error al eliminar los pagos asociados:', deletePaymentsError);
          this.showNotification('Error al eliminar los pagos asociados.');
          return;
        }

        // Paso 2: Eliminar la factura
        const { error: deleteInvoiceError } = await this.supabase
          .from('invoices')
          .delete()
          .eq('id_invoice', invoice.id_invoice);

        if (deleteInvoiceError) {
          console.error('Failed to delete invoice:', deleteInvoiceError);
          this.showNotification('Error al eliminar la factura.');
          return;
        }

        // Paso 3: Actualizar la deuda del cliente
        const orderTotal = this.calculateInvoiceValues(invoice).total;
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
        const newDebt = currentDebt - orderTotal;
        const newClientStatus = newDebt > 0 ? 'overdue' : 'upToDate';

        const { error: updateClientError } = await this.supabase
          .from('clients')
          .update({ debt: newDebt, status: newClientStatus })
          .eq('id_client', invoice.order.id_client);

        if (updateClientError) {
          console.error('Error al actualizar la deuda del cliente:', updateClientError);
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        // Recargar los datos para reflejar los cambios en la interfaz
        await this.getInvoices();

        this.showNotification('Factura eliminada correctamente.');
      } catch (error) {
        console.error('Error inesperado al eliminar la factura:', error);
        this.showNotification('Ocurrió un error inesperado al eliminar la factura.');
      }
    }
  }

  async loadOrders(): Promise<void> {
    const { data, error } = await this.supabase.from('orders').select('*');
    if (error) {
      console.error('Error cargando órdenes:', error);
      alert('Error al cargar las órdenes.');
      return;
    }
    this.orders = data;
    console.log('Órdenes cargadas:', this.orders);
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedInvoice = null;
    this.isEditing = false;
    this.showAddClientModal = false;
    this.showClientDropdown = false;
    this.clientOrders = [];
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
      status: ''
    };
  }
}

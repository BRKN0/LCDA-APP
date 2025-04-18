import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { Router } from '@angular/router'; // Importar Router
import { SupabaseService } from '../../services/supabase.service';

interface Invoice {
  id_invoice: string;
  created_at: Date;
  invoice_status: string;
  id_order: string;
  code: string;
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
  order_quantity: string;
  unitary_value: string;
  iva?: string;
  subtotal?: string;
  total?: string;
  amount: string;
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
  orders: Orders[] = []; // Lista de órdenes
  invoice: Invoice | null = null;
  showPrints = true;
  showCuts = true;
  showSales = true;
  showDebt = false;
  selectedInvoiceDetails: Invoice[] | null = null;
  loading = true;
  searchQuery: string = '';
  nameSearchQuery: string = '';
  clientSearchQuery: string = ''; // Para búsqueda manual de clientes
  filteredInvoicesList: Invoice[] = [];
  filteredClients: Client[] = []; // Lista filtrada de clientes para búsqueda
  clientOrders: Orders[] = []; // Órdenes filtradas por cliente seleccionado
  noResultsFound: boolean = false;
  startDate: string = '';
  endDate: string = '';
  isEditing = false;
  showModal = false;
  showAddClientModal = false;
  showClientDropdown: boolean = false; // Controla la visibilidad del dropdown de sugerencias
  selectedInvoice: any | null = null;
  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedInvoice: Invoice[] = []; // Lista paginada
  IVA_RATE = 0.19; // Tasa de IVA
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
    private router: Router // Inyectar Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getInvoices();
          this.getClients();
          this.loadOrders(); // Cargar órdenes al iniciar
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
    this.filteredClients = [...this.clients]; // Inicializa los clientes filtrados
  }

  async saveNewClient(): Promise<void> {
    if (!this.newClient.name || !this.newClient.email || !this.newClient.document_type || !this.newClient.document_number) {
      alert('Por favor, complete todos los campos obligatorios.');
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
    await this.getClients(); // Recargar la lista de clientes
  }

  /**
   * Busca clientes por nombre
   */
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

  /**
   * Selecciona un cliente de las sugerencias
   */
  selectClient(client: Client): void {
    if (this.selectedInvoice) {
      this.selectedInvoice.order.id_client = client.id_client;
      this.selectedInvoice.order.client = { ...client }; // Asignar todos los datos del cliente
      // Actualizar el campo de búsqueda con el nombre del cliente
      this.clientSearchQuery = `${client.name} (${client.company_name || 'Sin empresa'})`;
      this.showClientDropdown = false; // Ocultar el dropdown después de seleccionar
      this.updateClientOrders(); // Actualizar los pedidos al seleccionar un cliente
    }
  }

  /**
   * Oculta el dropdown de sugerencias al perder el foco
   */
  hideClientDropdown(): void {
    setTimeout(() => {
      this.showClientDropdown = false;
    }, 200); // Pequeño delay para permitir clics en las sugerencias
  }

  // Nueva función para actualizar los pedidos del cliente seleccionado
  updateClientOrders(): void {
    if (!this.selectedInvoice) return;

    const selectedClientId = this.selectedInvoice.order.id_client;
    const selectedOrderType = this.selectedInvoice.order.order_type;

    if (selectedClientId) {
      // Filtrar pedidos por cliente y tipo
      this.clientOrders = this.orders.filter((order) => {
        const matchesClient = order.id_client === selectedClientId;
        const matchesType = order.order_type === selectedOrderType;
        // Excluir pedidos que ya están asignados a una factura (excepto si es la factura que estamos editando)
        const isAssigned = this.invoices.some(
          (invoice) =>
            invoice.id_order === order.id_order &&
            (!this.isEditing || invoice.id_invoice !== this.selectedInvoice.id_invoice)
        );
        return matchesClient && matchesType && !isAssigned;
      });
    } else {
      this.clientOrders = [];
    }

    // Si no hay pedidos disponibles, mostramos un mensaje (opcional)
    if (this.clientOrders.length === 0) {
      console.log('No hay pedidos disponibles para este cliente y tipo.');
    }
  }

  /**
   * Navega a la página para añadir un nuevo cliente
   */
  navigateToAddClient(): void {
    this.router.navigate(['/clients']); // Ajusta la ruta según tu configuración
    this.closeModal(); // Opcional: cierra el formulario actual
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
      include_iva: data[0].include_iva ?? true, // Valor por defecto
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
      return;
    }

    this.invoices = [...data].map((invoice) => ({
      ...invoice,
      include_iva: invoice.include_iva ?? true, // Asignar true por defecto si no existe
      order: {
        ...invoice.orders,
        client: invoice.orders?.clients || null,
      },
    })) as Invoice[];
    // sorting invoice by code
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
    // Verificar si todos los checkboxes de tipo están desactivados
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

      // Si todos los checkboxes de tipo están desactivados, reiniciar y mostrar todas las facturas
      if (allTypeCheckboxesOff) {
        console.log('Todos los checkboxes de tipo están desactivados, mostrando todas las facturas');
        return matchesDateRange && matchesNameSearch;
      }

      // Filtros normales si hay al menos un checkbox de tipo activado
      const isDebtFilter = this.showDebt ? invoice.invoice_status === 'overdue' : true;

      const isPrintsFilter = this.showPrints && invoice.order.order_type === 'print';
      const isCutsFilter = this.showCuts && invoice.order.order_type === 'laser';
      const isSalesFilter = this.showSales && invoice.order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      return isDebtFilter && matchesType && matchesDateRange && matchesNameSearch;
    });

    this.noResultsFound = this.filteredInvoicesList.length === 0;
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedInvoices(); // Actualizar la lista paginada
  }

  // Calcular valores dinámicos para la factura
  calculateInvoiceValues(invoice: Invoice): { subtotal: number; iva: number; total: number } {
    const amount = parseFloat(invoice.order.amount) || 0;
    const subtotal = amount;
    const iva = invoice.include_iva ? amount * this.IVA_RATE : 0;
    const total = subtotal + iva;
    return { subtotal, iva, total };
  }

  // Obtener el valor a mostrar en la tabla
  getDisplayAmount(invoice: Invoice): string {
    const { total, subtotal } = this.calculateInvoiceValues(invoice);
    return invoice.include_iva ? total.toFixed(2) : subtotal.toFixed(2);
  }

  selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
  }

  // Método para mostrar una notificación temporal
  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000); // El mensaje desaparece después de 3 segundos
  }

  // Cerrar el modal de detalles
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

    // Calcular el monto pendiente
    const total = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    // Validar que el abono no exceda el monto pendiente
    if (amount > remainingBalance) {
      this.showNotification(`El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(2)}.`);
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
        this.showNotification('Error al añadir el abono.');
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
        this.showNotification('Error al actualizar la deuda del cliente.');
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
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      // Actualizar localmente los datos
      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push({ ...payment, payment_date: new Date().toISOString() });

      // Actualizar el estado de pago del pedido y la factura
      const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const orderTotal = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
      const newStatus = totalPaid >= orderTotal ? 'upToDate' : 'overdue';

      // Actualizar el estado en la tabla orders
      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', order.id_order);

      // Actualizar el estado en la tabla invoices
      await this.supabase
        .from('invoices')
        .update({ invoice_status: newStatus })
        .eq('id_order', order.id_order);

      // Actualizar localmente el estado
      order.order_payment_status = newStatus;
      this.selectedInvoiceDetails![0].invoice_status = newStatus;

      this.newPaymentAmount = 0; // Resetear el campo
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
      // Obtener el abono original para calcular la diferencia
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

      // Actualizar el abono
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({ amount: newAmount })
        .eq('id_payment', this.selectedPayment.id_payment);

      if (updateError) {
        console.error('Error al actualizar el abono:', updateError);
        this.showNotification('Error al actualizar el abono.');
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
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;

      // Ajustar la deuda del cliente según la diferencia
      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: currentDebt + difference })
        .eq('id_client', order.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      // Actualizar localmente los datos
      if (order.payments) {
        const paymentIndex = order.payments.findIndex(
          (p) => p.id_payment === this.selectedPayment!.id_payment
        );
        if (paymentIndex !== -1) {
          order.payments[paymentIndex] = { ...this.selectedPayment };
        }

        // Actualizar el estado de pago del pedido y la factura
        const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
        const orderTotal = this.calculateInvoiceValues(this.selectedInvoiceDetails![0]).total;
        const newStatus = totalPaid >= orderTotal ? 'upToDate' : 'overdue';

        // Actualizar el estado en la tabla orders
        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', order.id_order);

        // Actualizar el estado en la tabla invoices
        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', order.id_order);

        // Actualizar localmente el estado
        order.order_payment_status = newStatus;
        this.selectedInvoiceDetails![0].invoice_status = newStatus;
      }

      this.showEditPayment = false;
      this.selectedPayment = null;
      this.showNotification('Abono actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  // Calculate the total payments for an order
  getTotalPayments(order: Orders): number {
    return order.payments && Array.isArray(order.payments)
      ? order.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
  }

  // Calculate the remaining balance for an invoice
  getRemainingBalance(invoice: Invoice): number {
    const total = this.calculateInvoiceValues(invoice).total;
    const totalPaid = this.getTotalPayments(invoice.order);
    return total - totalPaid > 0 ? (total - totalPaid) : 0;
  }

  // Format a number to 2 decimal places
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

    const amount = parseFloat(invoice.order.amount) || 0;
    const quantity = parseFloat(invoice.order.order_quantity) || 1;
    const unitaryValue = amount / quantity;
    const subtotal = amount;
    const iva = invoice.include_iva ? subtotal * this.IVA_RATE : 0;
    const total = subtotal + iva;
    const totalPaid = this.getTotalPayments(invoice.order);
    const remainingBalance = total - totalPaid;
    const finalPrice = total - remainingBalance;

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
    const summaryStartY = startY + rowHeight * 2; // Define summaryStartY based on startY and rowHeight

    doc.setFont('helvetica', 'bold');
    doc.text('CANTIDAD', headerXPositions[0], startY);
    doc.text('VALOR UNITARIO', headerXPositions[1], startY);
    doc.text('ABONO', headerXPositions[2], startY, { align: 'right' });

    currentY = startY + rowHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.order.order_quantity}`, headerXPositions[0], currentY);
    doc.text(`$${unitaryValue.toFixed(2)}`, headerXPositions[1], currentY);
    doc.text(`$${subtotal.toFixed(2)}`, headerXPositions[2], currentY, { align: 'right' });

    const summaryX = headerXPositions[0]; // Alinear con "CANTIDAD"
    const valueX = headerXPositions[1];   // Alinear con "VALOR UNITARIO"
    doc.setFont('helvetica', 'bold');

    // Ajustar posiciones de los textos
    doc.text('Subtotal:', summaryX, summaryStartY);
    doc.text(`$${subtotal.toFixed(2)}`, valueX, summaryStartY, { align: 'left' });

    // IVA
    if (invoice.include_iva) {
      doc.text('IVA (19%):', summaryX, summaryStartY + rowHeight);
      doc.text(`$${iva.toFixed(2)}`, valueX, summaryStartY + rowHeight, { align: 'left' });
    }

    // Total en negrita
    doc.setFontSize(14);
    doc.text('Total:', summaryX, summaryStartY + rowHeight * 2);
    doc.text(`$${total.toFixed(2)}`, valueX, summaryStartY + rowHeight * 2, { align: 'left' });

    const spacing = 15; // Aumenta este valor si sigue muy pegado

    // Total a Pagar (más arriba y separado)
    const totalPagarY = summaryStartY + rowHeight * 3.5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total a Pagar:', summaryX, totalPagarY);
    doc.text(`$${remainingBalance.toFixed(2)}`, valueX + spacing, totalPagarY, { align: 'left' });

    // Espaciado extra para el mensaje final
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

  // Paginación
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedInvoices(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(1, Math.ceil(this.filteredInvoicesList.length / this.itemsPerPage));

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedInvoice = this.filteredInvoicesList.slice(startIndex, endIndex);
  }

  addNewInvoice(): void {
    this.selectedInvoice = {
      id_invoice: '',
      created_at: new Date().toISOString().split('T')[0],
      invoice_status: 'upToDate',
      id_order: '',
      code: '',
      include_iva: true, // Por defecto, incluye IVA
      order: {
        id_order: '',
        order_type: 'print',
        name: '',
        description: '',
        order_payment_status: '',
        created_at: new Date(),
        order_quantity: '',
        unitary_value: '',
        iva: '',
        subtotal: '',
        total: '',
        amount: '',
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
        },
      },
    };
    this.isEditing = false;
    this.showModal = true;
    this.clientSearchQuery = '';
    this.filteredClients = [...this.clients];
    this.clientOrders = [];
    this.showClientDropdown = false; // Asegurarse de que el dropdown esté oculto al inicio
  }

  editInvoice(invoice: Invoice): void {
    this.selectedInvoice = { ...invoice };
    this.selectedInvoice.created_at = this.formatDateForInput(invoice.created_at); // Formatear la fecha
    this.isEditing = true;
    this.showModal = true;
    this.clientSearchQuery = `${invoice.order.client.name} (${invoice.order.client.company_name || 'Sin empresa'})`; // Mostrar el nombre del cliente seleccionado
    this.updateClientOrders(); // Filtrar las órdenes del cliente seleccionado
  }

  // Función para formatear la fecha en el formato que espera el input de tipo date
  private formatDateForInput(date: Date | string): string {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0'); // Meses van de 0 a 11
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      return;
    }

    if (!this.selectedInvoice.order.id_client) {
      alert('Por favor, seleccione un cliente válido.');
      return;
    }

    if (!this.selectedInvoice.order.id_order) {
      alert('Por favor, seleccione una orden válida.');
      return;
    }

    if (!this.selectedInvoice.order.id_order || !this.selectedInvoice.created_at) {
      this.showNotification('Por favor, complete todos los campos requeridos.');
      return;
    }

    const orderExists = await this.validateOrderExists(this.selectedInvoice.order.id_order);
    if (!orderExists) {
      alert('La orden seleccionada no existe.');
      return;
    }

    // Actualizar el amount en la tabla orders
    const { error: updateOrderError } = await this.supabase
      .from('orders')
      .update({ amount: this.selectedInvoice.order.amount })
      .eq('id_order', this.selectedInvoice.order.id_order);

    if (updateOrderError) {
      console.error('Error actualizando el importe del pedido:', updateOrderError);
      alert('Error al actualizar el importe del pedido: ' + updateOrderError.message);
      return;
    }

    // Preparar la fecha seleccionada manualmente para evitar problemas de zona horaria
    const selectedDate = this.selectedInvoice.created_at; // Esto viene del input en formato 'YYYY-MM-DD'
    const dateParts = selectedDate.split('-'); // Separar el año, mes y día
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Los meses en JavaScript son 0-11
    const day = parseInt(dateParts[2], 10);

    // Crear un objeto Date con la fecha seleccionada, asegurándonos de que sea al inicio del día en UTC
    const adjustedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const isoDate = adjustedDate.toISOString(); // Esto será algo como '2025-03-19T00:00:00.000Z'

    // Preparar la factura para guardar
    const invoiceToSave = {
      code: this.selectedInvoice.code || null,
      created_at: isoDate, // Usar la fecha ajustada
      invoice_status: this.selectedInvoice.invoice_status,
      id_order: this.selectedInvoice.order.id_order,
      include_iva: this.selectedInvoice.includeIVA,
    };

    // Agregar un console.log para depurar la fecha que se está enviando
    console.log('Fecha enviada a Supabase:', invoiceToSave.created_at);

    try {
      if (this.isEditing) {
        const { error } = await this.supabase
          .from('invoices')
          .update({
            id_order: this.selectedInvoice.order.id_order,
            created_at: this.selectedInvoice.created_at,
            invoice_status: this.selectedInvoice.invoice_status,
            include_iva: this.selectedInvoice.includeIVA,
          })
          .eq('id_invoice', this.selectedInvoice.id_invoice);

        if (error) {
          console.error('Error actualizando la factura:', error);
          alert('Error al actualizar la factura: ' + error.message);
          return;
        }
        alert('Factura actualizada correctamente.');
      } else {
        const { error } = await this.supabase.from('invoices').insert([invoiceToSave]);

        if (error) {
          console.error('Error añadiendo la factura:', error);
          if (error.code === '42501') {
            alert('No tienes permisos para añadir esta factura. Por favor, verifica tu autenticación o contacta al administrador.');
          } else {
            alert('Error al añadir la factura: ' + error.message);
          }
          return;
        }
        alert('Factura añadida correctamente.');
      }

      await this.getInvoices();
      await this.loadOrders(); // Recargar los pedidos para reflejar el nuevo amount
      this.closeModal();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async deleteInvoice(invoice: Invoice): Promise<void> {
    if (confirm(`¿Eliminar factura #${invoice.code}?`)) {
      const { error } = await this.supabase
        .from('invoices')
        .delete()
        .eq('id_invoice', invoice.id_invoice);

      if (error) {
        console.log('Failed to delete invoice:', error);
        return;
      }

      this.getInvoices();
    }
  }

  async loadOrders(): Promise<void> {
    const { data, error } = await this.supabase.from('orders').select('*');
    if (error) {
      console.error('Error cargando órdenes:', error);
      alert('Error al cargar las órdenes.');
      return;
    }
    this.orders = data; // Asignar las órdenes cargadas
    console.log('Órdenes cargadas:', this.orders); // Verificar en consola
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedInvoice = null;
    this.isEditing = false;
    this.showAddClientModal = false;
    this.showClientDropdown = false; // Reiniciar el dropdown de sugerencias
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

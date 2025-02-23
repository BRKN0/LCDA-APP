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
  iva: string;
  subtotal: string;
  total: string;
  amount: string;
  id_client: string;
  client: Client;
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
  filterDebt: boolean = false;
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

  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '',
    company_name: '',
    cellphone: '',
    address: '',
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
      this.onClientSelect(); // Actualiza las órdenes del cliente seleccionado
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

  /**
   * Filtra las órdenes del cliente seleccionado
   */
  onClientSelect(): void {
    const selectedClientId = this.selectedInvoice.order.id_client;
    if (selectedClientId) {
      this.clientOrders = this.orders.filter(
        (order) => order.id_client === selectedClientId
      );
    } else {
      this.clientOrders = [];
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
        clients(*)
      )
    `);
    if (error) {
      return;
    }

    this.invoices = [...data].map((invoice) => ({
      ...invoice,
      order: {
        ...invoice.orders,
        client: invoice.orders?.clients || null,
      },
    })) as Invoice[];
    this.loading = false;
    this.updateFilteredInvoices();
  }

  updateFilteredInvoices(): void {
    this.filteredInvoicesList = this.invoices.filter((invoice) => {
      const isDebtFilter = this.showDebt ? invoice.invoice_status === 'overdue' : true;

      const isPrintsFilter = this.showPrints && invoice.order.order_type === 'print';
      const isCutsFilter = this.showCuts && invoice.order.order_type === 'laser';
      const isSalesFilter = this.showSales && invoice.order.order_type === 'sales';

      const matchesType =
        isPrintsFilter || isCutsFilter || isSalesFilter || (!this.showPrints && !this.showCuts && !this.showSales);

      const invoiceDate = new Date(invoice.created_at);
      const matchesStartDate = this.startDate ? invoiceDate >= new Date(this.startDate) : true;
      const matchesEndDate = this.endDate ? invoiceDate <= new Date(this.endDate + 'T23:59:59') : true;

      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesNameSearch =
        !this.nameSearchQuery ||
        invoice.order.client.name.toLowerCase().includes(this.nameSearchQuery.toLowerCase()) ||
        (invoice.order.client.company_name &&
          invoice.order.client.company_name.toLowerCase().includes(this.nameSearchQuery.toLowerCase()));

      return isDebtFilter && matchesType && matchesDateRange && matchesNameSearch;
    });

    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedInvoices(); // Actualizar la lista paginada
  }

  selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
  }

  async generatePdf(): Promise<void> {
    if (!this.selectedInvoiceDetails) {
      alert('Por favor, selecciona una factura primero.');
      return;
    }

    const invoice = this.selectedInvoiceDetails[0];

    // Validar si la orden existe
    if (!invoice.order) {
      alert('Por favor, elija una orden válida.');
      return;
    }

    const doc = new jsPDF();
    const invoice_date = new Date(invoice.created_at);
    const year = invoice_date.getFullYear();
    const month = invoice_date.getMonth() + 1;
    const day = invoice_date.getDate();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('La Casa del Acrilico', 10, 10);

    const logoUrl = 'Untitled.jpg';
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
    // Validar si el cliente existe antes de acceder a sus propiedades
    if (invoice.order.client) {
      doc.text(`Cliente: ${invoice.order.client.name}`, 10, 40);
      doc.text(`NIT: ${invoice.order.client.nit || 'N/A'}`, 10, 50);
    } else {
      doc.text('Cliente: No disponible', 10, 40);
    }
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

    doc.setFont('helvetica', 'bold');
    doc.text('CANTIDAD', headerXPositions[0], startY);
    doc.text('VALOR UNITARIO', headerXPositions[1], startY);
    doc.text('IMPORTE', headerXPositions[2], startY, { align: 'right' });

    currentY = startY + rowHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.order.order_quantity}`, headerXPositions[0], currentY);
    doc.text(`$${invoice.order.unitary_value}`, headerXPositions[1], currentY);
    doc.text(`$${invoice.order.amount}`, headerXPositions[2], currentY, {
      align: 'right',
    });

    const summaryStartY = currentY + 20;
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', headerXPositions[1], summaryStartY, {
      align: 'right',
    });
    doc.text(`$${invoice.order.subtotal}`, headerXPositions[2], summaryStartY, {
      align: 'right',
    });

    doc.text('IVA 19%:', headerXPositions[1], summaryStartY + rowHeight, {
      align: 'right',
    });
    doc.text(
      `$${invoice.order.iva || '0.00'}`,
      headerXPositions[2],
      summaryStartY + rowHeight,
      { align: 'right' }
    );

    doc.text('TOTAL:', headerXPositions[1], summaryStartY + rowHeight * 2, {
      align: 'right',
    });
    doc.text(
      `$${invoice.order.total}`,
      headerXPositions[2],
      summaryStartY + rowHeight * 2,
      { align: 'right' }
    );

    const footerStartY = summaryStartY + rowHeight * 4;
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
    doc.text('GRACIAS POR SU CONFIANZA', 10, footerStartY + 20);

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
    this.onClientSelect(); // Filtrar las órdenes del cliente seleccionado
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
      return;
    }

    // Validar que se haya seleccionado un cliente
    if (!this.selectedInvoice.order.id_client) {
      alert('Por favor, seleccione un cliente válido.');
      return;
    }

    // Validar que se haya seleccionado una orden
    if (!this.selectedInvoice.order.id_order) {
      alert('Por favor, seleccione una orden válida.');
      return;
    }

    // Verificar si la orden existe en la base de datos
    const orderExists = await this.validateOrderExists(this.selectedInvoice.order.id_order);
    if (!orderExists) {
      alert('La orden seleccionada no existe.');
      return;
    }

    // Preparar los datos para guardar
    const invoiceToSave = {
      code: this.selectedInvoice.code || null, // Usar el código existente o null para generar uno nuevo
      created_at: new Date(this.selectedInvoice.created_at).toISOString(),
      invoice_status: this.selectedInvoice.invoice_status,
      id_order: this.selectedInvoice.order.id_order,
    };

    try {
      if (this.isEditing) {
        // Actualizar factura existente
        const { error } = await this.supabase
          .from('invoices')
          .update(invoiceToSave)
          .eq('id_invoice', this.selectedInvoice.id_invoice);

        if (error) {
          console.error('Error actualizando la factura:', error);
          alert('Error al actualizar la factura.');
          return;
        }
        alert('Factura actualizada correctamente.');
      } else {
        // Crear nueva factura
        const { error } = await this.supabase.from('invoices').insert([invoiceToSave]);

        if (error) {
          console.error('Error añadiendo la factura:', error);
          alert('Error al añadir la factura.');
          return;
        }
        alert('Factura añadida correctamente.');
      }

      // Actualizar la lista de facturas
      await this.getInvoices();
      this.closeModal(); // Cerrar el modal después de guardar
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
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
    };
  }
}

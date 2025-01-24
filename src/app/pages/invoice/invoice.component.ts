import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
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
  order_status: string;
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
  invoice: Invoice | null = null;
  //checkbox status
  showPrints = true;
  showCuts = true;
  showSales = true;
  showDebt = false;
  selectedInvoiceDetails: Invoice[] | null = null;
  loading = true;
  searchQuery: string = '';
  nameSearchQuery: string = '';
  filteredInvoicesList: Invoice[] = [];
  filteredClients: Client[] = [];
  filterDebt: boolean = false;
  noResultsFound: boolean = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.updateFilteredInvoices();
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getInvoices();
        });
      }
    });
  }
  searchClient() {
    // Filter clients based on name and debt status
    this.filteredClients = this.clients.filter((client) => {
      const matchesSearchQuery =
        client.name
          .toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase()) ||
        (client.company_name &&
          client.company_name
            .toLowerCase()
            .includes(this.nameSearchQuery.toLowerCase()));

      // Correctly check for the debt filter
      const matchesDebtFilter = !this.filterDebt || client.debt > 0;

      return matchesSearchQuery && matchesDebtFilter;
    });

    // Handle the case when no clients are found
    this.noResultsFound = this.filteredClients.length === 0;
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
          clients(
            id_client,
            name,
            document_type,
            document_number,
            cellphone,
            company_name,
            nit,
            email,
            address,
            status,
            debt,
            city,
            province,
            postal_code
          )
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
    // Select the first matching invoice
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
        clients(
          id_client,
          name,
          document_type,
          document_number,
          cellphone,
          company_name,
          nit,
          email,
          address,
          status,
          debt,
          city,
          province,
          postal_code
        )
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
  }
  filteredInvoices(): Invoice[] {
    // If no filter is selected, return all invoices
    if (
      !this.showPrints &&
      !this.showCuts &&
      !this.showSales &&
      !this.showDebt &&
      !this.nameSearchQuery // Make sure to check nameSearchQuery too
    ) {
      return this.invoices;
    }

    return this.invoices.filter((invoice) => {
      // Check if 'showDebt' is active, and only include overdue invoices if it is
      const isDebtFilter = this.showDebt
        ? invoice.invoice_status === 'overdue'
        : true;

      // Apply other filters only if they are active
      const isPrintsFilter =
        this.showPrints && invoice.order.order_type === 'print';
      const isCutsFilter =
        this.showCuts && invoice.order.order_type === 'laser';
      const isSalesFilter =
        this.showSales && invoice.order.order_type === 'sales';

      // Apply the name search filter (if there is a nameSearchQuery)
      const matchesNameSearchQuery =
        !this.nameSearchQuery ||
        invoice.order.client.company_name
          ?.toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase()) ||
        invoice.order.client.name
          ?.toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase());

      // Combine all filters: matches debt status, other filters, and the name search query
      const matchesFilters =
        isDebtFilter && (isPrintsFilter || isCutsFilter || isSalesFilter);

      // Return true if the invoice matches both the filters and the name search query
      return matchesFilters && matchesNameSearchQuery;
    });
  }

  selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
  }

  updateFilteredInvoices(): void {
    let filtered = [];

    // First, check if the debt filter is active
    if (this.showDebt) {
      // If the debt filter is active, only include invoices with overdue status
      filtered = this.invoices.filter(
        (invoice) => invoice.invoice_status === 'overdue'
      );
    } else {
      // If the debt filter is not active, filter based on the other criteria
      filtered = this.invoices.filter((invoice) => {
        return (
          (this.showPrints && invoice.order.order_type === 'print') ||
          (this.showCuts && invoice.order.order_type === 'laser') ||
          (this.showSales && invoice.order.order_type === 'sales')
        );
      });
    }

    // Now, filter based on the other checkboxes (Prints, Cuts, Sales), but only if they are active
    if (this.showPrints || this.showCuts || this.showSales) {
      filtered = filtered.filter((invoice) => {
        return (
          (this.showPrints && invoice.order.order_type === 'print') ||
          (this.showCuts && invoice.order.order_type === 'laser') ||
          (this.showSales && invoice.order.order_type === 'sales')
        );
      });
    }

    // Update the filtered invoices list
    this.filteredInvoicesList = [...filtered];
  }

  async generatePdf(): Promise<void> {
    if (!this.selectedInvoiceDetails) {
      alert('Por favor, selecciona una factura primero.');
      return;
    }

    const invoice = this.selectedInvoiceDetails[0];
    const doc = new jsPDF(); // = new jsPDF ({format: 'a6'}); TODO: change the format to a6 and prevent somehow make the text fit
    // Date Formatting
    const invoice_date = new Date(invoice.created_at);
    const year = invoice_date.getFullYear();
    const month = invoice_date.getMonth() + 1; // Month is zero-based
    const day = invoice_date.getDate();

    // Header Section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('La Casa del Acrilico', 10, 10); // Left text

    const logoUrl = 'Untitled.jpg';
    const logo = await this.loadImage(logoUrl);
    doc.addImage(logo, 'JPEG', 90, 5, 30, 20); // Center logo

    doc.setTextColor(200);
    doc.setFontSize(30);
    doc.text('FACTURA', 190, 10, { align: 'right' }); // Right text in light gray
    doc.setTextColor(0); // Reset text color

    // Address and Invoice Info
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

    // Add Subtitle
    doc.setFont('helvetica', 'bold');
    doc.text('Facturar a:', 10, 70);
    doc.setFont('helvetica', 'normal');

    // Customer Details
    doc.text(`Nombre: ${invoice.order.client.name}`, 10, 80);
    if (invoice.order.client.nit) {
      doc.text(`NIT: ${invoice.order.client.nit}`, 10, 90);
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

    // Description Section
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, 170);
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.order.description, 180); // Use a maximum width
    let currentY = 180;
    descriptionLines.forEach((line) => {
      doc.text(line, 10, currentY);
      currentY += 10;
    });

    // Table Headers
    const startY = currentY + 10;
    const rowHeight = 10;
    const headerXPositions = [10, 40, 120, 170]; // Calculate positions based on column widths

    doc.setFont('helvetica', 'bold');
    doc.text('CANTIDAD', headerXPositions[0], startY);
    doc.text('VALOR UNITARIO', headerXPositions[1], startY);
    doc.text('IMPORTE', headerXPositions[2], startY, { align: 'right' });

    // Table Rows
    currentY = startY + rowHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.order.order_quantity}`, headerXPositions[0], currentY);
    doc.text(`$${invoice.order.unitary_value}`, headerXPositions[1], currentY);
    doc.text(`$${invoice.order.amount}`, headerXPositions[2], currentY, {
      align: 'right',
    });

    // Summary Section
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

    // Footer Section
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

    // Save the PDF
    doc.save(`Factura-${invoice.code}.pdf`);
  }

  // Helper function to wrap text
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
}

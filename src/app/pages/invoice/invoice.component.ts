import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { SupabaseService } from '../../services/supabase.service';

interface Invoice {
  id_invoice: string;
  created_at: string;
  invoice_status: string;
  id_order: string;
  order: Orders;
}

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
  invoices: Invoice[] = [];
  showPrints = true;
  showCuts = true;
  selectedInvoiceDetails: Invoice[] | null = null;
  loading = true;

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
  async getInvoices() {
    this.loading = true;
    const { data, error } = await this.supabase
    .from('invoice')
    .select(`
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
        client: invoice.orders?.clients || null
      }
    })) as Invoice[];
    this.loading = false;
  }
  filteredInvoices(): any[] {
    // Load all invoices by default
    if (!this.showPrints && !this.showCuts) {
      return this.invoices;
    }

    // Apply filtering logic based on checkbox state
    return this.invoices.filter((invoice) => {
      if (this.showPrints && invoice.order.order_type === 'print') {
        return true;
      }
      if (this.showCuts && invoice.order.order_type === 'laser') {
        return true;
      }
      return false;
    });
  }

  selectInvoice(invoice: Invoice) {
    this.selectedInvoiceDetails = [invoice];
  }
  filteredInvoicesList: Invoice[] = []; // array for filtered invoices

  updateFilteredInvoices(): void {
    // Create a new array for filtered invoices
    let filtered = [];

    // If both checkboxes are unchecked, show all invoices
    if (!this.showPrints && !this.showCuts) {
      filtered = [...this.invoices];
    } else {
      // Otherwise, filter the invoices based on the checkbox states
      filtered = this.invoices.filter((invoice) => {
        return (
          (this.showPrints && invoice.order.order_type === 'print') ||
          (this.showCuts && invoice.order.order_type === 'laser')
        );
      });
    }

    // Update the filteredInvoicesList in bulk
    this.filteredInvoicesList = [...filtered];
  }

  async generatePdf(): Promise<void> {
    if (!this.selectedInvoiceDetails) {
      alert('Por favor, selecciona una factura primero.');
      return;
    }

    const invoice = this.selectedInvoiceDetails[0];
    const doc = new jsPDF();

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
    doc.text(`Fecha: ${invoice.created_at}`, 190, 30, { align: 'right' });

    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Factura N°: ${invoice.id_invoice}`, 190, 40, { align: 'right' });

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
    doc.text(`Nombre de la empresa: ${invoice.order.client.company_name || 'N/A'}`, 10, 100);
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
    doc.save(`Factura-${invoice.id_invoice}.pdf`);
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

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss'],
})
export class InvoiceComponent implements OnInit {
  showPrints = true;
  showCuts = true;

  constructor() {}

  ngOnInit(): void {
    this.updateFilteredInvoices();
  }
  invoices = [
    {
      invoice_id: '1',
      name: 'Jose Carlos Ochoa',
      nit: null,
      company_name: null,
      address: 'Cra 43 #57-122',
      city: 'Cartagena',
      province: 'Bolivar',
      postal_code: '13010',
      email: 'JCO2342@gmail.com',
      phone_number: '3013348721',
      date: '11/07/24',
      description: 'Corte estándar de acrílico (3mm) para division de oficina',
      quantity: '5',
      unitary_value: '250000',
      amount: '1250000',
      subtotal: '1250000',
      iva: '237500',
      total: '1487500',
      status: 'Pago',
      type: 'Cortes',
    },
    {
      invoice_id: '3',
      name: 'Vicente Lopez Perez',
      nit: null,
      company_name: null,
      address: 'Cra 33 #17-111',
      city: 'Cartagena',
      province: 'Bolivar',
      postal_code: '13222',
      email: 'VicenteLP@gmail.com',
      phone_number: '3143211652',
      date: '12/01/24',
      description: 'Corte de acrílico (5mm) para vitrina',
      quantity: '10',
      unitary_value: '180000',
      amount: '1800000',
      subtotal: '1800000',
      iva: null,
      total: '1800000',
      status: 'Esperando pago',
      type: 'Cortes',
    },
    {
      invoice_id: '2',
      name: 'Manuel Hernando Cabarcas',
      nit: '731434221-1',
      company_name: 'Example inc.',
      address: 'Cra 16 #27-102',
      city: 'Cartagena',
      province: 'Bolivar',
      postal_code: '13011',
      email: 'exampleinc@hotmail.com',
      phone_number: '3221148721',
      date: '13/01/24',
      description: 'Letras de acrílico (10mm) para señalización de oficina',
      quantity: '3',
      unitary_value: '350000',
      amount: '1050000',
      subtotal: '1050000',
      iva: '199500',
      total: '1249500',
      status: 'En mora',
      type: 'Cortes',
    },
    {
      invoice_id: '101',
      name: 'Alan Montes Gomez',
      nit: null,
      company_name: null,
      address: 'Av. El Lago #50-33',
      city: 'Cartagena',
      province: 'Bolivar',
      postal_code: '13012',
      email: 'alan.montes.gomez@gmail.com',
      phone_number: '3105567890',
      date: '11/10/24',
      description:
        'Impresión en acrílico (3mm) de fotografía para decoración de oficina',
      quantity: '3',
      unitary_value: '450000',
      amount: '1350000',
      subtotal: '1350000',
      iva: '256500',
      total: '1606500',
      status: 'Pago',
      type: 'Impresiones',
    },
    {
      invoice_id: '102',
      name: 'Carlos Alberto Herrera',
      nit: null,
      company_name: null,
      address: 'Calle 32 #12-50',
      city: 'Cartagena',
      province: 'Bolivar',
      postal_code: '13013',
      email: 'carlos_herrera@email.com',
      phone_number: '3144567891',
      date: '15/10/24',
      description:
        'Impresión UV sobre acrílico (5mm) para cartel de presentación de producto',
      quantity: '7',
      unitary_value: '500000',
      amount: '3500000',
      subtotal: '3500000',
      iva: '665000',
      total: '4165000',
      status: 'Pago',
      type: 'Impresiones',
    },
    {
      invoice_id: '103',
      name: 'Felipe Ramos',
      nit: '4456341223-2',
      company_name: 'Ramos Design Ltda.',
      address: 'Carrera 10 #20-15',
      city: 'Barranquilla',
      province: 'Atlantico',
      postal_code: '08001',
      email: 'feliperamos@ramosdesign.com',
      phone_number: '3181234567',
      date: '20/10/24',
      description:
        'Impresión en acrílico (10mm) con diseño corporativo para oficina',
      quantity: '5',
      unitary_value: '800,000',
      amount: '4000000',
      subtotal: '4000000',
      iva: '760000',
      total: '4760000',
      status: 'Pago',
      type: 'Impresiones',
    },
  ];

  selectedInvoiceDetails: any[] | null = null;

  filteredInvoices(): any[] {
    // Load all invoices by default
    if (!this.showPrints && !this.showCuts) {
      return this.invoices;
    }

    // Apply filtering logic based on checkbox state
    return this.invoices.filter((invoice) => {
      if (this.showPrints && invoice.type === 'Impresiones') {
        return true;
      }
      if (this.showCuts && invoice.type === 'Cortes') {
        return true;
      }
      return false;
    });
  }

  selectInvoice(invoice: any) {
    this.selectedInvoiceDetails = [invoice];
  }
  filteredInvoicesList: any[] = []; // array for filtered invoices

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
          (this.showPrints && invoice.type === 'Impresiones') ||
          (this.showCuts && invoice.type === 'Cortes')
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
    doc.text(`Fecha: ${invoice.date}`, 190, 30, { align: 'right' });
  
    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Factura N°: ${invoice.invoice_id}`, 190, 40, { align: 'right' });
  
    doc.text('3004947020', 10, 50);
    if (invoice.nit) {
      doc.text(`NIT: ${invoice.nit}`, 10, 60);
    }
  
    // Add Subtitle
    doc.setFont('helvetica', 'bold');
    doc.text('Facturar a:', 10, 70);
    doc.setFont('helvetica', 'normal');
  
    // Customer Details
    doc.text(`Nombre: ${invoice.name}`, 10, 80);
    if (invoice.nit) {
      doc.text(`NIT: ${invoice.nit}`, 10, 90);
    }
    doc.text(`Nombre de la empresa: ${invoice.company_name || 'N/A'}`, 10, 100);
    doc.text(`Dirección: ${invoice.address}`, 10, 110);
    doc.text(`Ciudad: ${invoice.city}`, 10, 120);
    doc.text(`Provincia: ${invoice.province}`, 10, 130);
    doc.text(`Código Postal: ${invoice.postal_code}`, 10, 140);
    doc.text(`E-mail: ${invoice.email}`, 10, 150);
    doc.text(`Teléfono: ${invoice.phone_number}`, 10, 160);
  
    // Description Section
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN:', 10, 170);
    doc.setFont('helvetica', 'normal');
    const descriptionLines = this.wrapText(doc, invoice.description, 180); // Use a maximum width
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
    doc.text(`${invoice.quantity}`, headerXPositions[0], currentY);
    doc.text(`$${invoice.unitary_value}`, headerXPositions[1], currentY);
    doc.text(`$${invoice.amount}`, headerXPositions[2], currentY, { align: 'right' });
  
    // Summary Section
    const summaryStartY = currentY + 20;
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', headerXPositions[1], summaryStartY, { align: 'right' });
    doc.text(`$${invoice.subtotal}`, headerXPositions[2], summaryStartY, { align: 'right' });
  
    doc.text('IVA 19%:', headerXPositions[1], summaryStartY + rowHeight, { align: 'right' });
    doc.text(`$${invoice.iva || '0.00'}`, headerXPositions[2], summaryStartY + rowHeight, { align: 'right' });
  
    doc.text('TOTAL:', headerXPositions[1], summaryStartY + rowHeight * 2, { align: 'right' });
    doc.text(`$${invoice.total}`, headerXPositions[2], summaryStartY + rowHeight * 2, { align: 'right' });
  
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
    doc.save(`Factura-${invoice.invoice_id}.pdf`);
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

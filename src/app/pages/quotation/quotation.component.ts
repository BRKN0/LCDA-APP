import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { jsPDF } from 'jspdf';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

// models
type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';
type DiscountType = 'none' | 'percent' | 'value';
type DominantMaterial = {
    label: string;        // "Varios materiales" | descripción del material
    percent: number;      // 0..1
    materialId?: string;  // id_material si aplica
  };

interface Client {
  id_client: string;
  name: string;
  company_name?: string | null;
  nit?: string | null;
  email?: string | null;
  cellphone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
}

interface Material {
  id_material: string;
  code?: string;
  type: string;
  category?: string | null;
  color?: string | null;
  caliber?: string | null;
}

interface Quotation {
  id_quotation: string;
  code: string;
  title: string;
  id_client: string | null;
  walk_in: boolean;
  customer_label?: string | null;
  status: QuotationStatus;
  issue_date: string; 
  currency: string;  
  include_iva: boolean;   
  global_discount_type: DiscountType;
  global_discount_value: number; 
  notes_public?: string | null;
  notes_private?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  client?: Client | null; 
  items?: QuotationItem[]; 
}

interface QuotationItem {
  id: string;
  id_quotation: string;
  line_number: number;
  id_material?: string | null;
  description: string;
  quantity: number;
  unit_price?: number; 
  total_price: number; 
  notes_admin?: string | null; 
  metadata?: any;
  unit?: string;
}

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './quotation.component.html',
  styleUrls: ['./quotation.component.scss'],
})
export class QuotationComponent implements OnInit {
  // ui state
  loading = true;
  quotations: Quotation[] = [];
  filteredQuotations: Quotation[] = [];
  selectedQuotation: Quotation = this.newEmptyQuotation();
  selectedQuotationDetails: Quotation | null = null;
  showModal = false;
  isEditing = false;
  showDrafts = true;
  showSent = true;
  showApproved = true;
  showConverted = true;
  showClientDropdown = false;
  showAddClientModal = false;
  filteredClients: Client[] = [];
  userId: string | null = null;

  // filtros / búsqueda / paginación
  searchText = '';
  clientSearch = '';
  startDate = '';
  endDate = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  paginated: Quotation[] = [];

  // datos auxiliares
  clients: Client[] = [];
  materialsCache: Material[] = [];
  suggestions: Record<number, Material[]> = {};

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

  async saveNewClient(): Promise<string | null> {
    if (!this.newClient.name?.trim()) {
      alert('Por favor, escriba un nombre para el cliente.');
      return null;
    }

    const { data, error } = await this.supabase
      .from('clients')
      .insert([this.newClient])
      .select('id_client, name')
      .single();

    if (error || !data) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
      return null;
    }

    alert('Cliente añadido correctamente.');
  
    await this.getClients?.();
    this.closeAddClientModal();

    return data.id_client;
  }

  constructor(private readonly supabase: SupabaseService, private readonly zone: NgZone) {}

  private newEmptyQuotation(): Quotation {
    return {
      id_quotation: '',
      code: '',
      title: '',
      id_client: null,
      walk_in: false,
      customer_label: '',
      status: 'draft',
      issue_date: new Date().toISOString().slice(0,10),
      currency: 'COP',
      include_iva: true,
      global_discount_type: 'none',
      global_discount_value: 0,
      notes_public: '',
      notes_private: '',
      items: [],
    };
  }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.userId = session.user?.id ?? null;
        this.zone.run(async () => {
          await Promise.all([this.getQuotations(), this.getClients(), this.getSomeMaterials()]);
          this.updateFiltered();
          this.loading = false;
        });
      }
    });
  }

  async getQuotations(): Promise<void> {
    const { data, error } = await this.supabase
      .from('quotations')
      .select(`
        *,
        clients(*),
        quotation_items(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotations:', error);
      return;
    }

    this.quotations = (data || []).map((q: any) => ({
      ...q,
      client: q.clients ?? null,
      items: (q.quotation_items || []).sort((a: any, b: any) => a.line_number - b.line_number),
    })) as Quotation[];
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*').order('name', { ascending: true });
    if (error) { console.error(error); return; }
    this.clients = data as Client[];
    this.filteredClients = [...this.clients];
  }

  searchClients(): void {
    const q = (this.clientSearch || '').toLowerCase().trim();
    if (!q) {
      this.filteredClients = [...this.clients];
      return;
    }
    this.filteredClients = this.clients.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q)
    );
  }

  onClientSearchFocus() { this.showClientDropdown = true; }
  onClientSearchBlur()  { setTimeout(() => (this.showClientDropdown = false), 150); }

  selectClientFromDropdown(c: Client) {
    if (!this.selectedQuotation) return;
    this.selectedQuotation.id_client = c.id_client;
    this.clientSearch = c.name;
    this.showClientDropdown = false;
  }

  async getSomeMaterials(): Promise<void> {
    const { data, error } = await this.supabase.from('materials').select('id_material, code, type, category, color, caliber').limit(50);
    if (error) { console.error(error); return; }
    this.materialsCache = data as Material[];
  }

  async getUserName(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('user_name')
      .eq('id', this.userId)
      .maybeSingle();

    return error || !data ? null : data.user_name;
  }


  async searchMaterials(term: string): Promise<Material[]> {
    if (!term || term.trim().length < 2) return [];
    const { data, error } = await this.supabase
      .from('materials')
      .select('id_material, code, type, category, color, caliber')
      .ilike('type', `%${term}%`)
      .limit(10);
    if (error) { console.error(error); return []; }
    return data as Material[];
  }

  updateFiltered(): void {
    const text = (this.searchText || '').toLowerCase().trim();

    this.filteredQuotations = this.quotations.filter(q => {
      const clientName  = (q.client?.company_name || q.client?.name || q.customer_label || '').toLowerCase();
      const title       = (q.title || '').toLowerCase();

      const matchesSearch =
        !text ||
        clientName.includes(text) ||
        title.includes(text);

      const createdAt = q.created_at ? new Date(q.created_at) : new Date(q.issue_date);
      const matchesStartDate = this.startDate ? createdAt >= new Date(this.startDate) : true;
      const matchesEndDate   = this.endDate   ? createdAt <= new Date(this.endDate + 'T23:59:59') : true;

      const matchesStatus =
        (this.showDrafts    && q.status === 'draft')     ||
        (this.showSent      && q.status === 'sent')      ||
        (this.showApproved  && q.status === 'approved')  ||
        (this.showConverted && q.status === 'converted');

      return matchesSearch && matchesStartDate && matchesEndDate && matchesStatus;
    });

    this.currentPage = 1;
    this.updatePaginated();
  }


  updatePaginated(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredQuotations.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginated = this.filteredQuotations.slice(start, end);
  }

  clearFilters(): void {
    this.searchText = '';
    this.clientSearch = '';
    this.startDate = '';
    this.endDate = '';
    this.showDrafts    = true;
    this.showSent      = true;
    this.showApproved  = true;
    this.showConverted = true;
    this.updateFiltered();
  }

  addNewQuotation(): void {
    this.selectedQuotation = this.newEmptyQuotation();
    this.isEditing = false;
    this.showModal = true;
    this.suggestions = {};
    this.addItem();
  }

  editQuotation(q: Quotation): void {
    this.selectedQuotation = {
      ...q,
      items: (q.items || []).map(i => ({ ...i })),
    };

    if (q.client && !q.walk_in) {
      this.clientSearch =
        q.client.company_name?.trim() ||
        q.client.name?.trim() ||
        '';
    } else if (q.walk_in) {
      this.clientSearch = q.customer_label || 'Cliente Mostrador';
    } else {
      this.clientSearch = '';
    }
    
    this.isEditing = true;
    this.showModal = true;
    this.suggestions = {};
  }

  async saveQuotation(): Promise<void> {
    if (!this.selectedQuotation) return;
    const q = this.selectedQuotation;

    if (!q.title || !q.title.trim()) {
      alert('Escribe un título para la cotización.');
      return;
    }
    if (q.walk_in && !q.customer_label) {
      q.customer_label = 'Cliente Mostrador';
    }

    try {
      const userName = (await this.getUserName()) ?? 'Sistema';

      // 1) Encabezado
      const upsertPayload: any = {
        title: q.title.trim(),
        id_client: q.walk_in ? null : q.id_client,
        walk_in: !!q.walk_in,
        customer_label: q.walk_in ? (q.customer_label || 'Cliente Mostrador') : null,
        status: q.status,
        issue_date: q.issue_date,
        currency: q.currency || 'COP',
        include_iva: !!q.include_iva,
        global_discount_type: q.global_discount_type || 'none',
        global_discount_value: q.global_discount_value || 0,
        notes_public: q.notes_public || null,
        notes_private: q.notes_private || null,
        updated_at: new Date().toISOString(),
      };

      if (!this.isEditing) {
        upsertPayload.created_by = userName;
        upsertPayload.created_at = new Date().toISOString();
      }

      let quotationId = q.id_quotation;

      if (this.isEditing && quotationId) {
        const { error } = await this.supabase
          .from('quotations')
          .update(upsertPayload)
          .eq('id_quotation', quotationId);
        if (error) throw error;
      } else {
        const { data, error } = await this.supabase
          .from('quotations')
          .insert([upsertPayload])
          .select('id_quotation')
          .single();
        if (error) throw error;

        quotationId = data.id_quotation;

        this.selectedQuotation.id_quotation = quotationId;
      }

      // 2) Ítems (borrar e insertar)
      const items = (q.items || []).map((it, idx) => {
        const qty = Number(it.quantity ?? 1);
        const up = Number((it as any).unit_price ?? 0);
        const total = isFinite(Number((it as any).total_price))
          ? Number((it as any).total_price)
          : +(qty * up).toFixed(2);

        return {
          id_quotation: quotationId,
          line_number: idx + 1,
          id_material: it.id_material ?? null,
          quantity: qty,
          description: (it as any).description?.toString().trim() || '',
          unit_price: up,
          total_price: total,
          notes_admin: (it as any).notes_admin ?? null,
        };
      });

      await this.supabase.from('quotation_items').delete().eq('id_quotation', quotationId);
      if (items.length > 0) {
        const { error: insertItemsError } = await this.supabase
          .from('quotation_items')
          .insert(items);
        if (insertItemsError) throw insertItemsError;
      }

      // 3) Recargar
      await this.getQuotations();
      this.updateFiltered();
      this.closeModal();
    } catch (e) {
      console.error('Error guardando cotización:', e);
      alert('Error guardando la cotización.');
    }
  }


  async deleteQuotation(q: Quotation): Promise<void> {
    if (!confirm(`¿Eliminar la cotización ${q.code || q.title}?`)) return;

    await this.supabase.from('quotation_items').delete().eq('id_quotation', q.id_quotation);

    const { error } = await this.supabase.from('quotations').delete().eq('id_quotation', q.id_quotation);
    if (error) { console.error(error); alert('Error eliminando la cotización.'); return; }

    await this.getQuotations();
    this.updateFiltered();
    this.selectedQuotationDetails = null;
  }

  addItem(row?: Partial<QuotationItem>): void {
    const items = this.selectedQuotation.items || (this.selectedQuotation.items = []);
    items.push({
      id: '',
      id_quotation: this.selectedQuotation.id_quotation || '',
      line_number: items.length + 1,
      id_material: row?.id_material ?? null,
      description: row?.description ?? '',
      quantity: row?.quantity ?? 1,
      unit_price: row?.unit_price ?? 0,
      unit: row?.unit ?? 'und',
      total_price: row?.total_price ?? 0,
      notes_admin: row?.notes_admin ?? null,
      metadata: row?.metadata ?? null,
    });
  }

  removeItem(index: number): void {
    if (!this.selectedQuotation?.items) return;
    this.selectedQuotation.items.splice(index, 1);
    this.selectedQuotation.items.forEach((it, idx) => (it.line_number = idx + 1));
    delete this.suggestions[index];
  }

  async onDetailInput(rowIndex: number, term: string): Promise<void> {
    if (!term || term.trim().length < 2) {
      this.suggestions[rowIndex] = [];
      return;
    }
    this.suggestions[rowIndex] = await this.searchMaterials(term.trim());
  }

  selectMaterial(rowIndex: number, m: Material): void {
    if (!this.selectedQuotation?.items) return;
    const g = this.selectedQuotation.items[rowIndex];
    g.id_material = m.id_material;
    g.description = m.type;
    if (!g.quantity) g.quantity = 1;
    this.suggestions[rowIndex] = [];
  }

  clearMaterial(rowIndex: number): void {
    if (!this.selectedQuotation?.items) return;
    this.selectedQuotation.items[rowIndex].id_material = null;
    this.suggestions[rowIndex] = [];
  }

  selectQuotation(q: Quotation): void {
    this.selectedQuotationDetails = q;
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

  formatMoneyCOP(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  async generateQuotationPdf(): Promise<void> {
    if (!this.selectedQuotationDetails) { alert('Selecciona una cotización.'); return; }
    const q = this.selectedQuotationDetails;
    const items = q.items || [];

    const totals = this.calculateQuotationTotals(q, items);
    const doc = new jsPDF({
      compress: true
    });
    const d = new Date(q.created_at || q.issue_date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    // encabezado
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', 10, 15);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`Fecha: ${day}-${month}-${year}`, 10, 22);
    doc.text(`Cotización N°: ${q.code || '-'}`, 10, 28);

    const logo = await this.loadImage('/Logo.png');
    doc.addImage(logo, 'PNG', 150, 10, 35, 20, undefined, 'FAST');

    doc.setFont('helvetica', 'bold');
    doc.text('LA CASA DEL ACRÍLICO', 120, 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('NIT: 901479196-1', 120, 41);
    doc.text('Barrio: Blas de Lezo Cl. 21A Mz.11A Lt.12', 120, 46);
    doc.text('Cartagena de Indias, Colombia', 120, 51);
    doc.text('Tel: 300 494 7020', 120, 56);
    doc.text('lacasadelacrilico21@gmail.com', 120, 61);


    // destinatario
    let y = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DATOS DEL CLIENTE:', 10, y);

    doc.setFont('helvetica', 'normal');
    y += 6;

    doc.text(q.client?.name || 'Cliente Mostrador', 10, y); y += 5;
    if (q.client?.nit) {
      doc.text(`NIT: ${q.client.nit}`, 10, y); y += 5; 
    }
    if (q.client?.address) { 
      doc.text(`Dirección: ${q.client.address}`, 10, y); y += 5; 
    }
    if (q.client?.cellphone) {
      doc.text(`Tel: ${q.client.cellphone}`, 10, y); y += 5; 
    }
    if (q.client?.email) { 
      doc.text(`Email: ${q.client.email}`, 10, y); y += 5; 
    }
    doc.setDrawColor(180);
    doc.line(10, y + 4, 200, y + 4);
    y += 12;

    // Tabla items
    const rowH = 7;
    const col = {
      index: 10,
      detail: 20,
      qty: 125,
      unit: 150,
      total: 190
    };
    doc.setDrawColor(150);
    doc.line(10, y, 200, y);

    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);

    doc.text('N°', col.index, y);
    doc.text('DESCRIPCIÓN', col.detail, y);
    doc.text('CANT', col.qty, y, { align: 'right' });
    doc.text('V. UNIT', col.unit, y, { align: 'right' });
    doc.text('TOTAL', col.total, y, { align: 'right' });

    y += 2;
    doc.line(10, y, 200, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let cy = y + rowH;

    items.forEach((it, i) => {
      doc.text(String(i + 1), col.index, cy);

      const lines = doc.splitTextToSize(it.description || '-', 95);
      doc.text(lines, col.detail, cy);

      doc.text(String(it.quantity ?? 1), col.qty, cy, { align: 'right' });

      doc.text(
        this.formatMoneyCOP(it.unit_price || 0),
        col.unit,
        cy,
        { align: 'right' }
      );

      doc.text(
        this.formatMoneyCOP(it.total_price),
        col.total,
        cy,
        { align: 'right' }
      );

      const height = (lines.length - 1) * 5;
      cy += rowH + height;

      // salto de página
      if (cy > 260) {
        doc.addPage();
        cy = 20;
      }
    });

    cy += 12;
    const totalsLabelX = col.unit - 20;
    const totalsValueX = col.total;

    // Totales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Subtotal:', totalsLabelX, cy);

    doc.setFont('helvetica', 'normal');
    doc.text(
      this.formatMoneyCOP(totals.subTotal),
      totalsValueX,
      cy,
      { align: 'right' }
    );

    cy += rowH;

    if (q.include_iva) {
      doc.setFont('helvetica', 'bold');
      doc.text('IVA (19%):', totalsLabelX, cy);

      doc.setFont('helvetica', 'normal');
      doc.text(
        this.formatMoneyCOP(totals.ivaTotal),
        totalsValueX,
        cy,
        { align: 'right' }
      );

      cy += rowH;
    }

    doc.setDrawColor(150);
    doc.line(totalsLabelX, cy, totalsValueX, cy);

    cy += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL:', totalsLabelX, cy);

    doc.text(
      this.formatMoneyCOP(totals.grandTotal),
      totalsValueX,
      cy,
      { align: 'right' }
    );

    cy += rowH + 6;

    // Notas
    cy += 4;
    doc.setDrawColor(180);
    doc.line(10, cy, 200, cy);
    cy += 8;

    if (q.notes_public) {

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('OBSERVACIONES:', 10, cy);

      cy += 6;
        doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      const noteLines = doc.splitTextToSize(q.notes_public, 180);
      doc.text(noteLines, 10, cy);

      cy += noteLines.length * 5;
    }


    doc.save(`Cotizacion ${q.client?.name || q.code}.pdf`);
  }

  recalculateItem(it: any): void {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unit_price) || 0;
    it.total_price = +(qty * unit).toFixed(2);
  }

  calculateQuotationTotals(q: Quotation, items: QuotationItem[]) {
    const subTotal = +(items.reduce((s, it) => s + Number(it.total_price || 0), 0)).toFixed(2);

    let globalDiscount = 0;
    if (q.global_discount_type === 'percent') {
      globalDiscount = +((subTotal) * (q.global_discount_value / 100)).toFixed(2);
    } else if (q.global_discount_type === 'value') {
      globalDiscount = +(q.global_discount_value || 0).toFixed(2);
    }

    const baseAfterDiscount = Math.max(0, +(subTotal - globalDiscount).toFixed(2));
    const ivaTotal = q.include_iva ? +(baseAfterDiscount * 0.19).toFixed(2) : 0;
    const grandTotal = +(baseAfterDiscount + ivaTotal).toFixed(2);

    return { subTotal, globalDiscount, ivaTotal, grandTotal };
  }

  async convertQuotationToOrder(q: Quotation): Promise<void> {
    if (!q) return;

    if (!q.id_client) {
      alert('Para convertir a pedido, selecciona/crea un cliente.');
      return;
    }

    try {
      const items = q.items || [];
      const totals = this.calculateQuotationTotals(q, items);

      let clientName: string | null =
        (q as any).client_name || (q as any).client?.name || null;
      if (!clientName) {
        const { data: c } = await this.supabase
          .from('clients')
          .select('name')
          .eq('id_client', q.id_client)
          .maybeSingle();
        clientName = c?.name || 'Cliente sin nombre';
      }

      const schedulerName = (await this.getUserName?.()) || 'Desconocido';

      const dominant = this.resolveMainMaterial(items);

      const formatCOP = (n: number) =>
        n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

      const lines = items.map((it, idx) => {
        const qty = Number(it.quantity ?? 0);
        const desc = (it.description || '').trim();
        const price = formatCOP(Number(it.total_price || 0));
        return `   ${idx + 1}. ${qty} × ${desc} → ${price}`;
      });

      const discountLine =
        totals.globalDiscount > 0
          ? `Descuento aplicado: ${formatCOP(totals.globalDiscount)}\n`
          : '';

      const description =
        [
          `Pedido generado desde la cotización #${q.code || q.id_quotation || '—'}`,
          `Título: ${q.title?.trim() || 'Sin título'}`,
          '',
          'Detalle de ítems:',
          ...lines,
          '',
          discountLine.trim(),
          `Subtotal: ${formatCOP(totals.subTotal)}`,
          `Total: ${formatCOP(totals.subTotal)}`, 
        ]
          .filter(Boolean)
          .join('\n');

      const orderQuantity = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const safeQuantity = orderQuantity > 0 ? orderQuantity : 1;
      const unitaryValue = Number((totals.subTotal / safeQuantity).toFixed(2));

      const snapshotCharge = {
        kind: 'snapshot',
        label: 'Snapshot de cotización',
        amount: 0,
        payload: {
          items_snapshot: items.map(it => ({
            line_number: it.line_number ?? null,
            id_material: it.id_material ?? null,
            description: it.description ?? null,
            quantity: it.quantity ?? null,
            unit: it.unit ?? null,
            total_price: it.total_price ?? null,
            notes_admin: it.notes_admin ?? null,
            metadata: it.metadata ?? null,
          })),
          pricing_snapshot: {
            sub_total: totals.subTotal,
            global_discount: totals.globalDiscount,
            iva_total: totals.ivaTotal,
            grand_total: totals.grandTotal,
            currency: q.currency,
            include_iva: q.include_iva,
            source_quotation_id: q.id_quotation,
          },
          dominant_material: {
            label: dominant.label,
            percent: dominant.percent ?? 0,
            material_id: dominant.materialId ?? null,
          },
        },
      };
      const extra_charges: any[] = [snapshotCharge];

      const payloadOrder: any = {
        id_client: q.id_client,
        name: clientName,                 
        description,                     
        subtotal: totals.subTotal,    
        base_total: totals.subTotal,     
        iva: 0,                    
        total: totals.subTotal,      
        include_iva: false,         

        order_type: 'sales',
        order_payment_status: 'overdue',
        order_completion_status: 'standby',
        order_confirmed_status: 'notConfirmed',
        order_delivery_status: 'toBeDelivered',
        is_authorized: false,

        order_quantity: safeQuantity,
        unitary_value: unitaryValue,
        amount: 0,

        scheduler: schedulerName,

        notes: `Convertido desde la cotización #${q.code || q.id_quotation}`,
        created_at: new Date().toISOString().slice(0, 10),
        extra_charges,                                    
      };

      // insert order
      const { data, error } = await this.supabase
        .from('orders')
        .insert([payloadOrder])
        .select('*')
        .throwOnError();

      if (!data?.length) {
        console.error('[convertQuotationToOrder] Insert sin filas devueltas:', { data });
        alert('No se pudo confirmar la creación del pedido.');
        return;
      }

      const order = data[0];

      type InvoiceInsertLocal = {
        created_at: string;
        invoice_status: string;
        id_order: string;
        due_date: string;
        include_iva: boolean;
        payment_term: number;
        classification?: string;
      };

      const { data: existingInv, error: existErr } = await this.supabase
        .from('invoices')
        .select('id_invoice')
        .eq('id_order', order.id_order)
        .limit(1);

      if (existErr) {
        console.warn('[convertQuotationToOrder] No se pudo verificar factura existente:', existErr);
      }

      if (!existErr && (!existingInv || existingInv.length === 0)) {
        const paymentTermDays = Number((q as any)?.payment_term ?? 0);
        const createdAtISO = new Date().toISOString();
        const dueDateISO = (() => {
          const d = new Date();
          d.setDate(d.getDate() + paymentTermDays);
          return d.toISOString();
        })();

        const newInvoice: InvoiceInsertLocal = {
          created_at: createdAtISO,
          invoice_status: 'overdue',
          id_order: order.id_order,
          due_date: dueDateISO,
          include_iva: false,
          payment_term: paymentTermDays,
          classification: 'sales',
        };

        const { error: invErr } = await this.supabase
          .from('invoices')
          .insert([newInvoice]);

        if (invErr) {
          console.error('[convertQuotationToOrder] Error creando factura:', invErr);
        }
      }

      await this.supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id_quotation', q.id_quotation)
        .throwOnError();

      alert(`Pedido creado (ID: ${order.id_order || '—'}) y factura generada desde la cotización #${q.code || '—'}.`);
      await this.getQuotations();
      this.updateFiltered();

    } catch (err) {
      console.error('[convertQuotationToOrder] Error:', err);
      alert('Error creando el pedido/factura. Revisa la consola.');
    }
    }



  private resolveMainMaterial(items: QuotationItem[]): DominantMaterial {
    const withMaterial = items.filter(i => i?.id_material);
    if (withMaterial.length === 0) return { label: 'Varios materiales', percent: 0 };

    const map = new Map<string, { total: number; detail: string }>();
    for (const it of withMaterial) {
      const key = String(it.id_material);
      const prev = map.get(key) || { total: 0, detail: it.description || '' };
      map.set(key, { total: prev.total + Number(it.total_price || 0), detail: prev.detail || it.description || '' });
    }

    const ranked = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
    const total = ranked.reduce((s, [, v]) => s + v.total, 0) || 1;
    const [matId, top] = ranked[0];
    const percent = top.total / total;

    if (ranked.length === 1 || percent >= 0.6) {
      return { label: top.detail || 'Material', percent, materialId: matId };
    }
    return { label: 'Varios materiales', percent };
  }

  private formatMoney(n: number, currency = 'COP'): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency }).format(n || 0);
  }

  private buildOrderDescription(q: Quotation, items: QuotationItem[], totals: any): string {
    const title = q.title?.trim() || 'Sin título';
    const quotationNum = q.code || q.id_quotation || '—';
    const lines = items.map((it, idx) => {
      const qty = it.quantity ?? 0;
      const desc = it.description || '';
      const price = Number(it.total_price || 0).toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      });
      return `   ${idx + 1}. ${qty} × ${desc} → ${price}`;
    });

    const sub = totals.subTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    const tot = totals.grandTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

    const materialLabel = this.resolveMainMaterial(items);
    const discountText =
      totals.globalDiscount > 0
        ? `Descuento aplicado: ${totals.globalDiscount.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
          })}`
        : null;

    const descLines = [
      `Pedido generado desde la cotización #${quotationNum}`,
      `Título: ${title}`,
      '',
      'Detalle de ítems:',
      ...lines,
      '',
      discountText ? discountText : '',
      `Subtotal: ${sub}`,
      `Total: ${tot}`,
    ].filter(Boolean);

    return descLines.join('\n');
  }



  // helpers
  formatNumber(n: number): string { return (n ?? 0).toFixed(2); }
  money(v: number, currency = 'COP'): string { return `$${(v ?? 0).toFixed(2)}`; }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.selectedQuotation = this.newEmptyQuotation();
    this.suggestions = {};
  }
}

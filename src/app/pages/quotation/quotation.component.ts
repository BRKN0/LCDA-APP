import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { jsPDF } from 'jspdf';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

// ====== MODELOS ======
type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';
type DiscountType = 'none' | 'percent' | 'value';

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
  id: string;
  code?: string;
  name: string;
  category?: string | null;
  color?: string | null;
  caliber?: string | null;
}

interface Quotation {
  id: string;
  consecutive: string;
  title: string;
  id_client: string | null;
  walk_in: boolean;
  customer_label?: string | null;
  status: QuotationStatus;
  issue_date: string;            // ISO date (YYYY-MM-DD)
  currency: string;              // 'COP'
  include_iva: boolean;          // si se debe aplicar IVA (19%) al total
  global_discount_type: DiscountType;
  global_discount_value: number; // valor o %
  notes_public?: string | null;
  notes_private?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  client?: Client | null;        // JOIN
  items?: QuotationItem[];       // JOIN
}

interface QuotationItem {
  id: string;
  id_quotation: string;
  line_number: number;
  id_material?: string | null;
  detail: string;        // visible al cliente
  quantity: number;
  unit: string;          // 'und', 'm²', etc.
  line_total: number;    // total línea SIN IVA
  note_internal?: string | null; // NO se imprime
  metadata?: any;
}

@Component({
  selector: 'app-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, MainBannerComponent],
  templateUrl: './quotation.component.html',
  styleUrls: ['./quotation.component.scss'],
})
export class QuotationComponent implements OnInit {
  // ====== ESTADO UI ======
  loading = true;
  quotations: Quotation[] = [];
  filteredQuotations: Quotation[] = [];
  selectedQuotation: Quotation = this.newEmptyQuotation();          // para crear/editar en modal
  selectedQuotationDetails: Quotation | null = null;    // para ver detalle/PDF
  showModal = false;
  isEditing = false;
  showDrafts = true;
  showSent = true;
  showApproved = true;
  showConverted = true;
  showClientDropdown = false;
  filteredClients: Client[] = [];

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
  suggestions: Record<number, Material[]> = {}; // autocompletar por fila

  // IVA fijo (si usas variables globales, cámbialo aquí)
  readonly IVA_RATE = 0.19;

  constructor(private readonly supabase: SupabaseService, private readonly zone: NgZone) {}

  private newEmptyQuotation(): Quotation {
  return {
    id: '',
    consecutive: '',
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


  // ====== CICLO DE VIDA ======
  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(async () => {
          await Promise.all([this.getQuotations(), this.getClients(), this.getSomeMaterials()]);
          this.updateFiltered();
          this.loading = false;
        });
      }
    });
  }

  // ====== CARGA DE DATOS ======
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

    // ordenar por consecutivo desc como en invoices si lo prefieres
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*').order('name', { ascending: true });
    if (error) { console.error(error); return; }
    this.clients = data as Client[];
    this.initClientsFilter();
  }

  private initClientsFilter() {
    this.filteredClients = [...this.clients];
  }

  // buscador simple de clientes
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
    // carga inicial para autocompletar (puedes paginar/limitar)
    const { data, error } = await this.supabase.from('materials').select('id, code, name, category, color, caliber').limit(50);
    if (error) { console.error(error); return; }
    this.materialsCache = data as Material[];
  }

  async searchMaterials(term: string): Promise<Material[]> {
    if (!term || term.trim().length < 2) return [];
    const { data, error } = await this.supabase
      .from('materials')
      .select('id, code, name, category, color, caliber')
      .ilike('name', `%${term}%`)
      .limit(10);
    if (error) { console.error(error); return []; }
    return data as Material[];
  }

  // ====== FILTROS / PAGINACIÓN ======
  updateFiltered(): void {
    const list = this.quotations.filter(q => {
      const byText =
        !this.searchText ||
        q.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
        (q.consecutive || '').toLowerCase().includes(this.searchText.toLowerCase()) ||
        (q.client?.name || '').toLowerCase().includes(this.searchText.toLowerCase());

      const byClient =
        !this.clientSearch ||
        (q.client?.name || '').toLowerCase().includes(this.clientSearch.toLowerCase()) ||
        (q.client?.company_name || '').toLowerCase().includes(this.clientSearch.toLowerCase());

      const createdAt = q.created_at ? new Date(q.created_at) : new Date(q.issue_date);
      const byStart = this.startDate ? createdAt >= new Date(this.startDate) : true;
      const byEnd = this.endDate ? createdAt <= new Date(this.endDate + 'T23:59:59') : true;

      const statusOk =
        (this.showDrafts    && q.status === 'draft')     ||
        (this.showSent      && q.status === 'sent')      ||
        (this.showApproved  && q.status === 'approved')  ||
        (this.showConverted && q.status === 'converted') ||
        // si todos están apagados, no mostrar nada:
        (this.showDrafts || this.showSent || this.showApproved || this.showConverted ? false : true);

      return byText && byClient && byStart && byEnd && statusOk;
    });

    this.filteredQuotations = list;
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
    this.updateFiltered();
  }

  // ====== CRUD COTIZACIÓN ======
  addNewQuotation(): void {
    this.selectedQuotation = this.newEmptyQuotation();
    this.isEditing = false;
    this.showModal = true;
    this.suggestions = {};
    this.addItem(); // al menos una fila
  }

  editQuotation(q: Quotation): void {
    this.selectedQuotation = {
      ...q,
      items: (q.items || []).map(i => ({ ...i })),
    };
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
      // 1) Guardar encabezado
      let upsertPayload: any = {
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
      };

      let quotationId = q.id;
      if (this.isEditing && quotationId) {
        const { error } = await this.supabase.from('quotations').update(upsertPayload).eq('id', quotationId);
        if (error) throw error;
      } else {
        const { data, error } = await this.supabase.from('quotations').insert([upsertPayload]).select().single();
        if (error) throw error;
        quotationId = data.id;
      }

      // 2) Guardar ítems (estrategia simple: borrar e insertar)
      const items = (q.items || []).map((it, idx) => ({
        id_quotation: quotationId,
        line_number: idx + 1,
        id_material: it.id_material || null,
        detail: (it.detail || '').trim(),
        quantity: Number(it.quantity || 1),
        unit: it.unit || 'und',
        line_total: Number(it.line_total || 0),
        note_internal: it.note_internal || null,
        metadata: it.metadata || null,
      }));

      // borrar existentes y reinsertar
      await this.supabase.from('quotation_items').delete().eq('id_quotation', quotationId);
      if (items.length > 0) {
        const { error: insertItemsError } = await this.supabase.from('quotation_items').insert(items);
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
    if (!confirm(`¿Eliminar la cotización ${q.consecutive || q.title}?`)) return;
    const { error } = await this.supabase.from('quotations').delete().eq('id', q.id);
    if (error) { console.error(error); alert('Error eliminando la cotización.'); return; }
    await this.getQuotations();
    this.updateFiltered();
    this.selectedQuotationDetails = null;
  }

  // ====== ÍTEMS (tabla editable) ======
  addItem(row?: Partial<QuotationItem>): void {
    if (!this.selectedQuotation) return;
    const items = this.selectedQuotation.items || (this.selectedQuotation.items = []);
    items.push({
      id: '',
      id_quotation: this.selectedQuotation.id || '',
      line_number: items.length + 1,
      id_material: row?.id_material ?? null,
      detail: row?.detail ?? '',
      quantity: row?.quantity ?? 1,
      unit: row?.unit ?? 'und',
      line_total: row?.line_total ?? 0,
      note_internal: row?.note_internal ?? '',
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
    g.id_material = m.id;
    g.detail = m.name; // visible al cliente (editable)
    if (!g.unit || g.unit === 'und') g.unit = 'und'; // puedes mapear por material
    this.suggestions[rowIndex] = [];
  }

  clearMaterial(rowIndex: number): void {
    if (!this.selectedQuotation?.items) return;
    this.selectedQuotation.items[rowIndex].id_material = null;
    this.suggestions[rowIndex] = [];
  }

  // ====== DETALLE / PDF ======
  selectQuotation(q: Quotation): void {
    this.selectedQuotationDetails = q;
  }

  async generateQuotationPdf(): Promise<void> {
    if (!this.selectedQuotationDetails) { alert('Selecciona una cotización.'); return; }
    const q = this.selectedQuotationDetails;
    const items = q.items || [];

    const totals = this.calculateQuotationTotals(q, items);
    const doc = new jsPDF();

    // encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('La Casa del Acrílico', 10, 10);

    doc.setTextColor(200);
    doc.setFontSize(30);
    doc.text('Cotización', 190, 10, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Barrio Blas de Lezo Cl. 21A Mz. 11A - Lt. 12', 10, 30);
    const d = new Date(q.created_at || q.issue_date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    doc.text(`Fecha: ${day}-${month}-${year}`, 190, 30, { align: 'right' });

    doc.text('Cartagena de Indias, Colombia', 10, 40);
    doc.text(`Cotización N°: ${q.consecutive || '-'}`, 190, 40, { align: 'right' });

    // destinatario
    doc.setFont('helvetica', 'bold');
    doc.text('Cotizar a:', 10, 56);
    doc.setFont('helvetica', 'normal');
    let y = 64;
    if (q.client) {
      doc.text(`Nombre: ${q.client.name}`, 10, y); y += 6;
      if (q.client.company_name) { doc.text(`Empresa: ${q.client.company_name}`, 10, y); y += 6; }
      if (q.client.address) { doc.text(`Dirección: ${q.client.address}`, 10, y); y += 6; }
      const city = [q.client.city, q.client.province].filter(Boolean).join(', ');
      if (city) { doc.text(`Ciudad/Prov.: ${city}`, 10, y); y += 6; }
      if (q.client.email) { doc.text(`E-mail: ${q.client.email}`, 10, y); y += 6; }
      if (q.client.cellphone) { doc.text(`Teléfono: ${q.client.cellphone}`, 10, y); y += 6; }
    } else {
      doc.text(q.customer_label || 'Cliente Mostrador', 10, y);
      y += 6;
    }

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Título: ${q.title}`, 10, y);
    y += 10;

    // Tabla items
    const rowH = 7;
    const col = { qty: 10, detail: 30, cost: 170 };
    doc.setFont('helvetica', 'bold');
    doc.text('CANT', col.qty, y);
    doc.text('DETALLE', col.detail, y);
    doc.text('COSTO', col.cost, y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    let cy = y + rowH;

    for (const it of items) {
      doc.text(String(it.quantity ?? 1), col.qty, cy);
      const lines = doc.splitTextToSize(it.detail || '-', 130);
      doc.text(lines, col.detail, cy);
      doc.text(this.money(it.line_total || 0, q.currency), col.cost, cy, { align: 'right' });

      const linesHeight = (lines.length - 1) * 5.5;
      cy = cy + rowH + linesHeight;

      if (cy > 260) { doc.addPage(); cy = 20; }
    }

    cy += 6;

    // Totales
    const sumX = 120;
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', sumX, cy);
    doc.setFont('helvetica', 'normal');
    doc.text(this.money(totals.subTotal, q.currency), sumX + 50, cy, { align: 'right' }); cy += rowH;

    if (totals.globalDiscount > 0) {
      doc.setFont('helvetica', 'bold'); doc.text('Descuento global:', sumX, cy);
      doc.setFont('helvetica', 'normal'); doc.text(this.money(totals.globalDiscount, q.currency), sumX + 50, cy, { align: 'right' }); cy += rowH;
    }

    if (q.include_iva) {
      doc.setFont('helvetica', 'bold'); doc.text('IVA:', sumX, cy);
      doc.setFont('helvetica', 'normal'); doc.text(this.money(totals.ivaTotal, q.currency), sumX + 50, cy, { align: 'right' }); cy += rowH;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', sumX, cy);
    doc.text(this.money(totals.grandTotal, q.currency), sumX + 50, cy, { align: 'right' }); cy += rowH + 8;

    if (q.notes_public) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('Notas:', 10, cy); cy += 6;
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(q.notes_public, 180);
      doc.text(noteLines, 10, cy);
    }

    doc.save(`Cotizacion-${q.consecutive || 'sin_consecutivo'}.pdf`);
  }

  calculateQuotationTotals(q: Quotation, items: QuotationItem[]) {
    const subTotal = +(items.reduce((s, it) => s + Number(it.line_total || 0), 0)).toFixed(2);

    let globalDiscount = 0;
    if (q.global_discount_type === 'percent') {
      globalDiscount = +((subTotal) * (q.global_discount_value / 100)).toFixed(2);
    } else if (q.global_discount_type === 'value') {
      globalDiscount = +(q.global_discount_value || 0).toFixed(2);
    }

    const baseAfterDiscount = Math.max(0, +(subTotal - globalDiscount).toFixed(2));
    const ivaTotal = q.include_iva ? +(baseAfterDiscount * this.IVA_RATE).toFixed(2) : 0;
    const grandTotal = +(baseAfterDiscount + ivaTotal).toFixed(2);

    return { subTotal, globalDiscount, ivaTotal, grandTotal };
  }

  // ====== CONVERSIÓN A PEDIDO ======
  async convertQuotationToOrder(q: Quotation): Promise<void> {
    if (!q) return;
    // cliente requerido al convertir
    if (!q.id_client) {
      alert('Para convertir a pedido, selecciona/crea un cliente.');
      return;
    }

    const items = q.items || [];
    const totals = this.calculateQuotationTotals(q, items);

    // material principal o "Varios materiales"
    const materialName = this.resolveMainMaterial(items);

    const payloadOrder: any = {
      description: q.title,                     // TÍTULO → descripción del pedido
      material: materialName,                   // heurística
      id_client: q.id_client,
      total: totals.grandTotal,                 // ajusta si tu orders calcula diferente
      baseTotal: totals.subTotal,               // opcional si lo usas
      source_quotation_id: q.id,                // debes haber agregado esta col a orders
      items_snapshot: items.map(it => ({
        line_number: it.line_number,
        id_material: it.id_material || null,
        detail: it.detail,
        quantity: it.quantity,
        unit: it.unit,
        line_total: it.line_total,
        note_internal: it.note_internal || null,
        metadata: it.metadata || null,
      })),
      pricing_snapshot: {
        sub_total: totals.subTotal,
        global_discount: totals.globalDiscount,
        iva_total: totals.ivaTotal,
        grand_total: totals.grandTotal,
        currency: q.currency,
        include_iva: q.include_iva,
      },
    };

    const { data: order, error } = await this.supabase.from('orders').insert([payloadOrder]).select().single();
    if (error) { console.error(error); alert('Error creando el pedido.'); return; }

    // marcar cotización convertida
    await this.supabase.from('quotations').update({ status: 'converted' }).eq('id', q.id);

    alert(`Pedido creado (ID: ${order.id_order || '—'}) a partir de la cotización.`);
    await this.getQuotations();
    this.updateFiltered();
  }

  private resolveMainMaterial(items: QuotationItem[]): string {
    const withMaterial = items.filter(i => i.id_material);
    if (withMaterial.length === 0) return 'Varios materiales';

    // Agrupar por id_material y sumar valor de línea
    const map = new Map<string, { total: number; detail: string }>();
    for (const it of withMaterial) {
      const key = it.id_material as string;
      const prev = map.get(key) || { total: 0, detail: it.detail || '' };
      prev.total += Number(it.line_total || 0);
      prev.detail = prev.detail || it.detail || '';
      map.set(key, prev);
    }
    const arr = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
    if (arr.length === 1) return arr[0][1].detail || 'Material';
    // dominante >= 60%
    const totalMaterials = arr.reduce((s, [, v]) => s + v.total, 0);
    const [name, v] = arr[0];
    return v.total / (totalMaterials || 1) >= 0.6 ? (arr[0][1].detail || 'Material') : 'Varios materiales';
  }

  // ====== HELPERS ======
  formatNumber(n: number): string { return (n ?? 0).toFixed(2); }
  money(v: number, currency = 'COP'): string { return `$${(v ?? 0).toFixed(2)}`; }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.selectedQuotation = this.newEmptyQuotation();
    this.suggestions = {};
  }
}

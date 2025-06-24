import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { RouterOutlet } from '@angular/router';

interface Polystyrene {
  id_polystyrene?: string;
  created_at?: string;
  width: number;
  height: number;
  type: string;
  caliber: string;
  whole: number;
}

interface Client {
  id_client: string;
  name: string;
  company_name?: string;
  default_profit?: number;
  default_margin?: number;
  default_discount?: number;
}

interface PolystyreneCalculationResult {
  area: number;
  basePriceWithProfit: number;
  appliedMargin: number;
  priceWithMargin: number;
  discount: number;
  finalPriceWithoutIva: number;
  iva: number;
  finalPriceWithIva: number;
}

@Component({
  selector: 'app-polystyrene',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './polystyrene.component.html',
  styleUrl: './polystyrene.component.scss',
})
export class PolystyreneComponent implements OnInit {
  polystyrenes: Polystyrene[] = [];
  filteredPolystyrenes: Polystyrene[] = [];
  paginatedPolystyrenes: Polystyrene[] = [];
  selectedPolystyrene!: Polystyrene;
  availableTypes: string[] = [];
  sortDirection: 'asc' | 'desc' = 'asc'; // Orden ascendente por defecto
  sortColumn: 'caliber' | 'type' = 'caliber'; // Columna por la que ordenar

  searchType: string = '';
  searchCaliber: string = '';
  selectedFormat: string = '1 Lámina';
  showModal = false;
  isEditing = false;
  loading = true;
  showCalculatorModal = false;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  calculatorForm = {
    width: 0,
    height: 0,
    caliber: '',
    type: '',
    format: '1 Lámina',
    whole: 0,
    margin: 30,
    discount: 0,
    includeIva: false
  };
  calculationResult: PolystyreneCalculationResult | null = null;

  clients: Client[] = [];
  filteredClients: Client[] = [];
  clientSearchQuery: string = '';
  showClientDropdown: boolean = false;
  selectedClient: Client | null = null;
  showClientDefaultsModal: boolean = false;

  formatFactors: { [key: string]: { factor: number; margin: number } } = {
    '1 Lámina': { factor: 1, margin: 0 },
    '1/2 (Media Lámina)': { factor: 1 / 2, margin: 0.1 },
    '1/3 (Tercio de Lámina)': { factor: 1 / 3, margin: 0.3 },
    '1/4 (Cuarto de Lámina)': { factor: 1 / 4, margin: 0.4 },
    '1/8 (Octavo de Lámina)': { factor: 1 / 8, margin: 0.55 },
    '1/16 (Dieciseisavo de Lámina)': { factor: 1 / 16, margin: 0.63 },
    '1/32 (Treintaydosavo de Lámina)': { factor: 1 / 32, margin: 0.66 },
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.loadPolystyrenes();
        });
      }
    });
    await this.getClients();
  }

  async loadPolystyrenes(): Promise<void> {
    const { error, data } = await this.supabase
      .from('polystyrene')
      .select('*')

    if (error) {
      console.error('Error cargando:', error);
      return;
    }

    this.polystyrenes = data as Polystyrene[];

    this.polystyrenes.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;

      return Number(a.caliber) - Number(b.caliber);
    });

    const typesSet = new Set<string>();
    this.polystyrenes.forEach(p => {
      if (p.type) typesSet.add(p.type.toLowerCase());
    });
    this.availableTypes = Array.from(typesSet).sort();

    this.updateFilteredPolystyrenes();
    this.loading = false;
  }

  toggleSortDirection(column: 'caliber'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.polystyrenes.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;

      // Calibre numérico
      return this.sortDirection === 'asc'
        ? Number(a.caliber) - Number(b.caliber)
        : Number(b.caliber) - Number(a.caliber);
    });

    this.updateFilteredPolystyrenes();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  updateFilteredPolystyrenes(): void {
    this.filteredPolystyrenes = this.polystyrenes.filter((item) => {
      const matchesType = !this.searchType || item.type?.toLowerCase() === this.searchType;
      const matchesCaliber = item.caliber?.toLowerCase().includes(this.searchCaliber.toLowerCase());
      return matchesType && matchesCaliber;
    });
    this.currentPage = 1;
    this.updatePaginatedPolystyrenes();
  }

  updatePaginatedPolystyrenes(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredPolystyrenes.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    this.paginatedPolystyrenes = this.filteredPolystyrenes.slice(startIndex, endIndex);
  }

  addPolystyrene(): void {
    this.selectedPolystyrene = {
      type: '',
      width: 100,
      height: 200,
      caliber: '0',
      whole: 0
    };
    this.isEditing = false;
    this.showModal = true;
  }

  editPolystyrene(item: Polystyrene): void {
    this.selectedPolystyrene = { ...item };
    this.isEditing = true;
    this.showModal = true;
  }

  async savePolystyrene(): Promise<void> {
    const itemToSave = {
      type: this.selectedPolystyrene.type,
      width: this.selectedPolystyrene.width,
      height: this.selectedPolystyrene.height,
      caliber: this.selectedPolystyrene.caliber,
      whole: this.selectedPolystyrene.whole
    };

    if (!this.selectedPolystyrene.type || !this.selectedPolystyrene.caliber || !this.selectedPolystyrene.whole) {
      alert ('Por favor, complete todos los campos.');
      return;
    }

    if (this.isEditing && this.selectedPolystyrene.id_polystyrene) {
      const { error } = await this.supabase
        .from('polystyrene')
        .update(itemToSave)
        .eq('id_polystyrene', this.selectedPolystyrene.id_polystyrene);

      if (error) {
        console.error('Error actualizando:', error);
      } else {
        alert('Registro actualizado');
        this.loadPolystyrenes();
      }
    } else {
      const { error } = await this.supabase
        .from('polystyrene')
        .insert([itemToSave]);

      if (error) {
        console.error('Error añadiendo:', error);
      } else {
        alert('Registro añadido');
        this.loadPolystyrenes();
      }
    }
    this.closeModal();
  }

  async deletePolystyrene(item: Polystyrene): Promise<void> {
    if (confirm(`¿Eliminar el tipo ${item.type} - calibre ${item.caliber}?`)) {
      const { error } = await this.supabase
        .from('polystyrene')
        .delete()
        .eq('id_polystyrene', item.id_polystyrene);

      if (error) {
        console.error('Error eliminando:', error);
      } else {
        alert('Registro eliminado');
        this.loadPolystyrenes();
      }
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
  }

  // Funciones de cálculo reutilizadas
  calculatePriceForTable(item: Polystyrene): PolystyreneCalculationResult {
    const pedidoArea = (item.width * item.height) / 10000;
    const factor = this.formatFactors[this.selectedFormat]?.factor || 1;
    const extraMargin = this.formatFactors[this.selectedFormat]?.margin || 0;
    const adjustedArea = pedidoArea * factor;

    const totalSheetArea = 2.0;

    const baseCost = adjustedArea >= totalSheetArea
      ? item.whole
      : (item.whole / totalSheetArea) * adjustedArea;

    const utilidad = 0.3; // 30% fijo en la tabla
    const priceWithUtility = Math.ceil((baseCost / (1 - utilidad)) / 100) * 100;

    const priceWithMargin = Math.ceil((priceWithUtility * (1 + extraMargin)) / 100) * 100;

    const discount = 0; // descuento fijo para tabla
    const discountValue = Math.ceil((priceWithMargin * discount) / 100) * 100;

    const priceWithoutIva = Math.ceil((priceWithMargin - discountValue) / 100) * 100;

    const iva = Math.ceil((priceWithoutIva * 0.19) / 100) * 100;
    const finalWithIva = priceWithoutIva + iva;

    return {
      area: adjustedArea,
      basePriceWithProfit: priceWithUtility,
      appliedMargin: extraMargin,
      priceWithMargin,
      discount: discountValue,
      finalPriceWithoutIva: priceWithoutIva,
      iva,
      finalPriceWithIva: finalWithIva
    };
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) {
      console.error('Error obteniendo clientes:', error);
      return;
    }
    this.clients = data;
    this.filteredClients = [...this.clients];
  }

  searchClients(): void {
    const query = this.clientSearchQuery.toLowerCase().trim();
    this.filteredClients = this.clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.company_name?.toLowerCase().includes(query)
    );
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.clientSearchQuery = `${client.name} (${client.company_name || 'Sin empresa'})`;
    this.showClientDropdown = false;
    this.calculatorForm.margin = client.default_margin || 30;
    this.calculatorForm.discount = client.default_discount || 0;
  }

  hideClientDropdown(): void {
    setTimeout(() => (this.showClientDropdown = false), 200);
  }

  openCalculatorModal(): void {
    this.showCalculatorModal = true;
    this.clientSearchQuery = '';
    this.filteredClients = [...this.clients];
    this.selectedClient = null;
    this.calculatorForm = {
      width: 0,
      height: 0,
      caliber: '',
      type: '',
      format: '1 Lámina',
      whole: 0,
      margin: 30,
      discount: 0,
      includeIva: false
    };
    this.calculationResult = null;
  }

  closeCalculatorModal(): void {
    this.showCalculatorModal = false;
    this.selectedClient = null;
    this.calculationResult = null;
  }

  calculatePolystyreneValues(): void {
    const pedidoArea = (this.calculatorForm.width * this.calculatorForm.height) / 10000;
    const factor = this.formatFactors[this.calculatorForm.format]?.factor || 1;
    const extraMargin = this.formatFactors[this.calculatorForm.format]?.margin || 0;

    // Área ajustada por formato (por si es fracción de lámina)
    const adjustedArea = pedidoArea * factor;

    // Área total de una lámina (según tu hoja)
    const totalSheetArea = 2.0; // 100x200 cm = 2.0 m²

    // Si el pedido cubre una lámina completa o más, no se divide por área
    const baseCost = (adjustedArea >= totalSheetArea)
      ? this.calculatorForm.whole
      : (this.calculatorForm.whole / totalSheetArea) * adjustedArea;

    // Aplicar utilidad
    const utilidad = this.calculatorForm.margin / 100;
    const priceWithUtility = Math.ceil((baseCost / (1 - utilidad)) / 100) * 100;

    // Aplicar margen adicional por formato (si aplica)
    const priceWithMargin = Math.ceil((priceWithUtility * (1 + extraMargin)) / 100) * 100;

    // Aplicar descuento (si aplica)
    const descuento = this.calculatorForm.discount / 100;
    const discountValue = Math.ceil((priceWithMargin * descuento) / 100) * 100;

    // Precio sin IVA
    const priceWithoutIva = Math.ceil((priceWithMargin - discountValue) / 100) * 100;

    // IVA (si se incluye)
    const ivaValue = this.calculatorForm.includeIva
      ? Math.ceil((priceWithoutIva * 0.19) / 100) * 100
      : 0;

    const finalPrice = priceWithoutIva + ivaValue;

    // Resultado final
    this.calculationResult = {
      area: adjustedArea,
      basePriceWithProfit: priceWithUtility,
      appliedMargin: extraMargin,
      priceWithMargin: priceWithMargin,
      discount: discountValue,
      finalPriceWithoutIva: priceWithoutIva,
      iva: ivaValue,
      finalPriceWithIva: finalPrice
    };
  }

  openClientDefaultsModal(): void {
    this.showClientDefaultsModal = true;
  }

  closeClientDefaultsModal(): void {
    this.showClientDefaultsModal = false;
  }

  async saveClientDefaults(): Promise<void> {
    if (!this.selectedClient ||
        this.selectedClient.default_margin === undefined ||
        this.selectedClient.default_discount === undefined) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('clients')
        .update({
          default_margin: this.selectedClient.default_margin,
          default_discount: this.selectedClient.default_discount
        })
        .eq('id_client', this.selectedClient.id_client);

      if (error) {
        console.error('Error al actualizar cliente:', error);
        alert('Error al guardar los cambios.');
        return;
      }

      alert('Valores predeterminados actualizados correctamente.');
      this.calculatorForm.margin = this.selectedClient.default_margin;
      this.calculatorForm.discount = this.selectedClient.default_discount;

      await this.getClients();
      this.closeClientDefaultsModal();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }
}

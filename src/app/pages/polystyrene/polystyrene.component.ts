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
  noCabe?: boolean;
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
  customWidth: number | null = null;
  customHeight: number | null = null;

  // NUEVO: Checkboxes para filtrar por tipo
  showOriginal: boolean = true;
  showEco: boolean = true;
  showClear: boolean = true;
  showColor: boolean = true;

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
      .select('*');

    if (error) {
      console.error('Error cargando:', error);
      return;
    }

    this.polystyrenes = data as Polystyrene[];

    // Ordenar por jerarquía
    this.polystyrenes = this.sortPolystyrenesHierarchical(
      data as Polystyrene[]
    );

    const typesSet = new Set<string>();
    this.polystyrenes.forEach(p => {
      if (p.type) typesSet.add(p.type.toLowerCase());
    });
    this.availableTypes = Array.from(typesSet).sort();

    this.updateFilteredPolystyrenes();
    this.loading = false;
  }

  // Filtros con checkboxes
  updateFilteredPolystyrenes(): void {
    // Filtrar por texto
    let tempFiltered = this.polystyrenes.filter((item) => {
      const matchesCaliber = item.caliber?.toLowerCase().includes(this.searchCaliber.toLowerCase());
      return matchesCaliber;
    });

    // Filtrar por checkboxes de tipo
    const allCheckboxesOff = !this.showOriginal && !this.showEco &&
                              !this.showClear && !this.showColor;

    if (!allCheckboxesOff) {
      tempFiltered = tempFiltered.filter(item => {
        const normalizedType = item.type.toLowerCase();
        return (
          (this.showOriginal && normalizedType === 'original') ||
          (this.showEco && normalizedType === 'eco') ||
          (this.showClear && normalizedType === 'clear') ||
          (this.showColor && normalizedType === 'color')
        );
      });
    }

    this.filteredPolystyrenes = this.sortPolystyrenesHierarchical(tempFiltered);
    this.currentPage = 1;
    this.updatePaginatedPolystyrenes();
  }

  private sortPolystyrenesHierarchical(list: Polystyrene[]): Polystyrene[] {
    return list.sort((a, b) => {
      // 1. Width
      if (a.width !== b.width) {
        return a.width - b.width;
      }

      // 2. Height
      if (a.height !== b.height) {
        return a.height - b.height;
      }

      // 3. Type
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) {
        return typeCompare;
      }

      // 4. Caliber (ASC, numérico)
      return Number(a.caliber) - Number(b.caliber);
    });
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
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      if (this.isEditing && this.selectedPolystyrene.id_polystyrene) {
        // Guardar calibre original
        const originalCaliber = this.polystyrenes.find(
          p => p.id_polystyrene === this.selectedPolystyrene.id_polystyrene
        )?.caliber;
        const caliberChanged = originalCaliber !== this.selectedPolystyrene.caliber;

        const { error } = await this.supabase
          .from('polystyrene')
          .update(itemToSave)
          .eq('id_polystyrene', this.selectedPolystyrene.id_polystyrene);

        if (error) {
          console.error('Error actualizando:', error);
          alert('Error al actualizar el registro.');
          return;
        }

        alert('Registro actualizado');

        // Solo recargar si cambió el calibre
        if (caliberChanged) {
          await this.loadPolystyrenes();
        } else {
          await this.updateSingleItem(this.selectedPolystyrene.id_polystyrene);
        }
      } else {
        const { error } = await this.supabase
          .from('polystyrene')
          .insert([itemToSave]);

        if (error) {
          console.error('Error añadiendo:', error);
          alert('Error al añadir el registro.');
          return;
        }

        alert('Registro añadido');
        await this.loadPolystyrenes();
      }

      this.closeModal();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  // Método para actualizar un solo item sin reordenar
  private async updateSingleItem(id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('polystyrene')
      .select('*')
      .eq('id_polystyrene', id)
      .single();

    if (error) {
      console.error('Error al obtener el item actualizado:', error);
      return;
    }

    // Actualizar en los arrays sin cambiar el orden
    const indexInAll = this.polystyrenes.findIndex(item => item.id_polystyrene === id);
    if (indexInAll !== -1) {
      this.polystyrenes[indexInAll] = data;
    }

    const indexInFiltered = this.filteredPolystyrenes.findIndex(item => item.id_polystyrene === id);
    if (indexInFiltered !== -1) {
      this.filteredPolystyrenes[indexInFiltered] = data;
    }

    const indexInPaginated = this.paginatedPolystyrenes.findIndex(item => item.id_polystyrene === id);
    if (indexInPaginated !== -1) {
      this.paginatedPolystyrenes[indexInPaginated] = data;
    }
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

  calculatePriceForTable(item: Polystyrene): PolystyreneCalculationResult & { noCabe?: boolean } {
    const useCustom = !this.selectedFormat || this.selectedFormat.trim() === '';

    const width = useCustom ? this.customWidth ?? item.width : item.width;
    const height = useCustom ? this.customHeight ?? item.height : item.height;

    const pedidoArea = (width * height) / 10000;
    const totalSheetArea = 2.0;

    if (pedidoArea > totalSheetArea) {
      return {
        area: pedidoArea,
        basePriceWithProfit: 0,
        appliedMargin: 0,
        priceWithMargin: 0,
        discount: 0,
        finalPriceWithoutIva: 0,
        iva: 0,
        finalPriceWithIva: 0,
        noCabe: true
      };
    }

    let extraMargin = this.formatFactors[this.selectedFormat]?.margin || 0;

    if (useCustom) {
      const marginResult = this.calculateAppliedMarginReal(width, height);
      if (marginResult === 'NO_CABE') {
        return {
          area: pedidoArea,
          basePriceWithProfit: 0,
          appliedMargin: 0,
          priceWithMargin: 0,
          discount: 0,
          finalPriceWithoutIva: 0,
          iva: 0,
          finalPriceWithIva: 0,
          noCabe: true
        };
      }
      extraMargin = marginResult as number;
    }

    const factor = this.formatFactors[this.selectedFormat]?.factor || 1;
    const adjustedArea = pedidoArea * factor;

    const baseCost = adjustedArea >= totalSheetArea
      ? item.whole
      : (item.whole / totalSheetArea) * adjustedArea;

    const utilidad = 0.3;
    const priceWithUtility = Math.ceil((baseCost / (1 - utilidad)) / 100) * 100;

    const priceWithMargin = Math.ceil((priceWithUtility * (1 + extraMargin)) / 100) * 100;
    const discount = 0;
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
      includeIva: true
    };
    this.calculationResult = null;
  }

  closeCalculatorModal(): void {
    this.showCalculatorModal = false;
    this.selectedClient = null;
    this.calculationResult = null;
  }

  calculatePolystyreneValues(): void {
    const width = this.calculatorForm.width;
    const height = this.calculatorForm.height;
    const format = this.calculatorForm.format;
    const cost = this.calculatorForm.whole;
    const utilidad = this.calculatorForm.margin / 100;
    const discount = this.calculatorForm.discount / 100;

    const areaCm2 = width * height;
    const totalSheetAreaCm2 = 100 * 200;
    const areaM2 = areaCm2 / 10000;

    const isCustom = !format || format.trim() === '';

    if (areaCm2 > totalSheetAreaCm2) {
      this.calculationResult = {
        area: areaM2,
        basePriceWithProfit: 0,
        appliedMargin: 0,
        priceWithMargin: 0,
        discount: 0,
        finalPriceWithoutIva: 0,
        iva: 0,
        finalPriceWithIva: 0,
        noCabe: true
      };
      return;
    }

    let extraMargin = 0;
    if (isCustom) {
      const marginResult = this.calculateAppliedMarginReal(width, height);
      if (marginResult === 'NO_CABE') {
        this.calculationResult = {
          area: areaM2,
          basePriceWithProfit: 0,
          appliedMargin: 0,
          priceWithMargin: 0,
          discount: 0,
          finalPriceWithoutIva: 0,
          iva: 0,
          finalPriceWithIva: 0,
          noCabe: true
        };
        return;
      }
      extraMargin = marginResult as number;
    } else {
      extraMargin = this.formatFactors[format]?.margin || 0;
    }

    const factor = this.formatFactors[format]?.factor || 1;
    const adjustedArea = areaM2 * factor;

    const totalSheetAreaM2 = 2.0;
    const baseCost = adjustedArea >= totalSheetAreaM2
      ? cost
      : (cost / totalSheetAreaM2) * adjustedArea;

    const priceWithUtility = Math.ceil((baseCost / (1 - utilidad)) / 100) * 100;
    const priceWithMargin = Math.ceil((priceWithUtility * (1 + extraMargin)) / 100) * 100;
    const discountValue = Math.ceil((priceWithMargin * discount) / 100) * 100;

    const priceWithoutIva = Math.ceil((priceWithMargin - discountValue) / 100) * 100;
    const ivaValue = this.calculatorForm.includeIva
      ? Math.ceil((priceWithoutIva * 0.19) / 100) * 100
      : 0;
    const finalPrice = priceWithoutIva + ivaValue;

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

  isUsingCustomSize(): boolean {
    return !this.selectedFormat || this.selectedFormat.trim() === '';
  }

  calculateAppliedMarginReal(width: number, height: number): number | 'NO_CABE' {
    const areaTotal = 100 * 200;
    const area = width * height;

    if (area > areaTotal) return 'NO_CABE';
    if (area <= 0) return 0;

    const fraction = area / areaTotal;
    const exactFractions = [1/2, 1/3, 1/4, 1/8, 1/16, 1/32];

    const isExactFraction = exactFractions.some(f => Math.abs(f - fraction) < 0.001);

    const M1 = 0.80;
    const M2 = 0.65;
    const M3 = 0.80;
    const M4 = 0.30;

    if (fraction === 1) return 0;

    if (isExactFraction) {
      return M3 - M4 * (area / (areaTotal / 2));
    } else {
      return M1 - M2 * (area / areaTotal);
    }
  }

  // Limpiar todos los filtros incluyendo checkboxes
  clearFilters(): void {
    this.searchCaliber = '';
    this.searchType = '';
    this.selectedFormat = '1 Lámina';
    this.customWidth = null;
    this.customHeight = null;
    this.showOriginal = true;
    this.showEco = true;
    this.showClear = true;
    this.showColor = true;
    this.updateFilteredPolystyrenes();
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

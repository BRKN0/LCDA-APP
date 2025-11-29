import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

interface Acrylic {
  id_acrylics: string;
  width: number;
  height: number;
  color: string;
  gauge: number;
  cost_price: number;
  created_at: string;
}

interface Client {
  id_client: string;
  name: string;
  company_name: string;
  default_profit?: number;
  default_margin?: number;
  default_discount?: number;
}

interface CalculationResult {
  orderArea: number;
  basePriceWithProfit: number;
  appliedMargin: number;
  priceWithMargin: number;
  discount: number;
  finalPriceWithoutIva: number;
  iva: number;
  finalPriceWithIva: number;
  noCabe?: boolean;
}

interface StandardSize {
  width: number;
  height: number;
  area: number;
}

@Component({
  selector: 'app-acrylics',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent, RouterOutlet],
  templateUrl: './acrylics.component.html',
  styleUrl: './acrylics.component.scss'
})
export class AcrylicsComponent implements OnInit {
  acrylicItems: Acrylic[] = [];
  filteredAcrylicItems: Acrylic[] = [];
  paginatedAcrylicItems: Acrylic[] = [];
  selectedAcrylic: Acrylic | null = null;
  showModal: boolean = false;
  formAcrylic: Acrylic;
  selectedFormat: string = 'Sin formato';
  loading = true;
  searchTerm: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  // NUEVO: Filtros de tipo por checkbox
  showCristalOpal: boolean = true;
  showColorRojo: boolean = true;
  showHumo: boolean = true;
  showEspejo: boolean = true;
  showMetalizados: boolean = true;

  // Propiedades para la calculadora
  showCalculatorModal: boolean = false;
  calculatorForm: {
    width: number;
    height: number;
    gauge: number;
    color: string;
    format: string;
    cost_price: number;
    margin: number;
    discount: number;
    includeIva: boolean;
  };
  calculationResult: CalculationResult | null = null;
  clients: Client[] = [];
  filteredClients: Client[] = [];
  clientSearchQuery: string = '';
  showClientDropdown: boolean = false;
  selectedClient: Client | null = null;

  showClientDefaultsModal: boolean = false;

  tableMargin: number = 30;
  tableDiscount: number = 0;

  selectedClientForTable: Client | null = null;

  globalWidth: number = 0;
  globalHeight: number = 0;
  appliedMargin: number = 30;

  private baseUtilidadPercentage = 0.30;

  private formatFactors: { [key: string]: { factor: number; margin: number } } = {
    '1 Lámina': { factor: 1, margin: 0 },
    '1/2 (Media Lámina)': { factor: 0.5, margin: 0.10 },
    '1/3 (Tercio de Lámina)': { factor: 0.3333, margin: 0.28 },
    '1/4 (Cuarto de Lámina)': { factor: 0.25, margin: 0.25 },
    '1/8 (Octavo de Lámina)': { factor: 0.125, margin: 0.33 },
    '1/16 (Dieciseisavo de Lámina)': { factor: 0.0625, margin: 0.36 },
    '1/32 (Treintaydosavo de Lámina)': { factor: 0.03125, margin: 0.38 },
    'Sin formato': { factor: 0, margin: 0 }
  };

  private standardSizes: StandardSize[] = [
      { width: 120, height: 180, area: 120 * 180 },
      { width: 130, height: 190, area: 130 * 190 },
      { width: 125, height: 245, area: 125 * 245 },
      { width: 150, height: 250, area: 150 * 250 },
      { width: 150, height: 300, area: 150 * 300 },
      { width: 180, height: 260, area: 180 * 260 },
      { width: 180, height: 300, area: 180 * 300 }
  ];

  private M1: number = 0.40;
  private M2: number = 0.35;
  private M3: number = 0.40;
  private M4: number = 0.30;

  constructor(private readonly supabase: SupabaseService) {
    this.formAcrylic = { id_acrylics: '', width: 0, height: 0, color: '', gauge: 0, cost_price: 0, created_at: '' };
    this.calculatorForm = {
      width: 0,
      height: 0,
      gauge: 0,
      color: 'Cristal y Opal',
      format: '1 Lámina',
      cost_price: 0,
      margin: 30,
      discount: 0,
      includeIva: false
    };
  }

  ngOnInit(): void {
    this.getAcrylicItems();
    this.getClients();
  }

  async getAcrylicItems(): Promise<void> {
    this.loading = true;
    const { data, error } = await this.supabase.from('acrylics').select('*');
    if (error) {
      console.error('Error al obtener acrílicos:', error);
      return;
    }
    this.acrylicItems = data || [];

    // CAMBIO: Ordenar por fecha de creación (más recientes primero)
    this.acrylicItems.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    this.filteredAcrylicItems = [...this.acrylicItems];
    this.currentPage = 1;
    this.updatePaginatedAcrylicItems();
    this.loading = false;
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
    this.selectedClient = client;
    this.clientSearchQuery = `${client.name} (${client.company_name || 'Sin empresa'})`;
    this.showClientDropdown = false;
    this.calculatorForm.margin = client.default_margin || client.default_profit || 30;
    this.calculatorForm.discount = client.default_discount || 0;
  }

  hideClientDropdown(): void {
    setTimeout(() => {
      this.showClientDropdown = false;
    }, 200);
  }

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applySortByGauge();
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedAcrylicItems();
  }

  private applySortByGauge(): void {
    this.filteredAcrylicItems.sort((a, b) => {
      const valueA = a.gauge;
      const valueB = b.gauge;
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  openModal(acrylic?: Acrylic): void {
    if (acrylic) {
      this.selectedAcrylic = { ...acrylic };
      this.formAcrylic = { ...acrylic };
    } else {
      this.selectedAcrylic = null;
      this.formAcrylic = { id_acrylics: '', width: 0, height: 0, color: '', gauge: 0, cost_price: 0, created_at: '' };
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedAcrylic = null;
    this.formAcrylic = { id_acrylics: '', width: 0, height: 0, color: '', gauge: 0, cost_price: 0, created_at: '' };
  }

  openCalculatorModal(): void {
    this.showCalculatorModal = true;
    this.calculatorForm = {
      width: 0,
      height: 0,
      gauge: 0,
      color: 'Cristal y Opal',
      format: '1 Lámina',
      cost_price: 0,
      margin: this.tableMargin,
      discount: this.tableDiscount,
      includeIva: false
    };
    this.calculationResult = null;
    this.clientSearchQuery = '';
    this.filteredClients = [...this.clients];
    this.showClientDropdown = false;
  }

  closeCalculatorModal(): void {
    this.showCalculatorModal = false;
    this.calculationResult = null;
    this.selectedClient = null;
    this.calculatorForm = {
      width: 0,
      height: 0,
      gauge: 0,
      color: 'Cristal y Opal',
      format: '1 Lámina',
      cost_price: 0,
      margin: 30,
      discount: 0,
      includeIva: false
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
        console.error('Error al actualizar los valores predeterminados del cliente:', error);
        alert('Error al guardar los cambios.');
        return;
      }

      this.selectedClient.default_margin = this.selectedClient.default_margin;
      this.selectedClient.default_discount = this.selectedClient.default_discount;

      if (this.selectedClient) {
        this.calculatorForm.margin = this.selectedClient.default_margin;
        this.calculatorForm.discount = this.selectedClient.default_discount;
      }

      alert('Valores predeterminados actualizados correctamente.');
      this.closeClientDefaultsModal();
      await this.getClients();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  clearGlobalValues(): void {
    this.globalWidth = 0;
    this.globalHeight = 0;
    this.searchTerm = '';
    this.updatePaginatedAcrylicItems();
  }

  // NUEVO: Método para limpiar todos los filtros incluyendo checkboxes
  clearFilters(): void {
    this.searchTerm = '';
    this.showCristalOpal = true;
    this.showColorRojo = true;
    this.showHumo = true;
    this.showEspejo = true;
    this.showMetalizados = true;
    this.updatePaginatedAcrylicItems();
  }

  findSuitableStandardSize(width: number, height: number): StandardSize | null {
    const sortedSizes = [...this.standardSizes].sort((a, b) => a.area - b.area);

    for (const size of sortedSizes) {
      const exceedsNormal = width > size.width || height > size.height;
      const exceedsSwapped = width > size.height || height > size.width;

      if (!exceedsNormal || !exceedsSwapped) {
        const fitsNormal = width <= size.width && height <= size.height;
        const fitsSwapped = width <= size.height && height <= size.width;

        if (fitsNormal || fitsSwapped) {
          return size;
        }
      }
    }
    return null;
  }

  calculateTotalSheetArea(acrylic: Acrylic): number {
    return (acrylic.width * acrylic.height) / 10000;
  }

  calcUtilidadSinFormato(
    costoLamina: number,
    anchoGlobal: number,
    altoGlobal: number,
    standardSize: StandardSize
  ): number {
    const areaStdCm2 = standardSize.width * standardSize.height;
    const areaGlobalCm2 = anchoGlobal * altoGlobal;
    const precioVenta = Math.round((costoLamina / areaStdCm2) * areaGlobalCm2 / 0.7);
    const costoProporcional = (costoLamina / areaStdCm2) * areaGlobalCm2;
    return Math.round(precioVenta - costoProporcional);
  }

  calculateOrderArea(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const useCustom = format === 'Sin formato';
    const width = useCustom ? (this.globalWidth || acrylic.width) : acrylic.width;
    const height = useCustom ? (this.globalHeight || acrylic.height) : acrylic.height;
    const pedidoArea = (width * height) / 10000;
    const factor = this.formatFactors[format]?.factor || 1;
    return pedidoArea * factor;
  }

  calculateBasePriceWithProfit(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const costPrice = acrylic.cost_price;
    const totalSheetAreaCm2 = acrylic.width * acrylic.height;
    const useCustom = format === 'Sin formato';
    const width = useCustom ? (this.globalWidth || 60) : acrylic.width;
    const height = useCustom ? (this.globalHeight || 60) : acrylic.height;
    const orderAreaCm2 = width * height;
    if (orderAreaCm2 <= 0 || totalSheetAreaCm2 <= 0) return 0;

    const costProportion = (costPrice * (orderAreaCm2 / totalSheetAreaCm2));
    const basePrice = costProportion / 0.7;
    const adjustmentFactor = (39.300 / (costProportion / 0.7)) || 1;
    return Math.ceil((basePrice * adjustmentFactor) / 100) * 100;
  }

  calculateAppliedMargin(acrylic: Acrylic, format: string = this.selectedFormat): number {
    if (format !== 'Sin formato' && this.formatFactors[format]?.margin !== undefined) {
      return this.formatFactors[format].margin || 0;
    }
    const useCustom = format === 'Sin formato';
    const width = useCustom ? (this.globalWidth || acrylic.width) : acrylic.width;
    const height = useCustom ? (this.globalHeight || acrylic.height) : acrylic.height;
    const orderArea = (width * height) / 10000;
    const totalSheetArea = this.calculateTotalSheetArea(acrylic);
    if (orderArea <= 0) return 0;
    const areaRatio = orderArea / totalSheetArea;
    if (areaRatio >= 1) return 0;
    const standardFractions = [0.5, 0.3333, 0.25, 0.125, 0.0625, 0.03125];
    if (standardFractions.includes(Number(areaRatio.toFixed(4)))) {
      return this.M3 - this.M4 * (areaRatio / 0.5);
    }
    return this.M1 - this.M2 * areaRatio;
  }

  calculatePriceWithMargin(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const basePrice = this.calculateBasePriceWithProfit(acrylic, format);
    const useCustom = format === 'Sin formato';
    const width = useCustom ? (this.globalWidth || acrylic.width) : acrylic.width;
    const height = useCustom ? (this.globalHeight || acrylic.height) : acrylic.height;
    const tempAcrylic = { ...acrylic, width, height };
    const extraMargin = this.calculateAppliedMargin(tempAcrylic, format);

    if (extraMargin === 0 && useCustom && (width > acrylic.width || height > acrylic.height)) {
      return 0;
    }
    return Math.ceil((basePrice * (1 + extraMargin)) / 100) * 100;
  }

  calculatePriceWithMarginUsingClient(acrylic: Acrylic, format: string = this.selectedFormat): number {
    return this.calculatePriceWithMargin(acrylic, format);
  }

  calculateFinalPriceWithoutIva(acrylic: Acrylic, discountPercentage: number, format: string = this.selectedFormat): number {
    const priceWithMargin = this.calculatePriceWithMargin(acrylic, format);
    const discount = this.calculateDiscount(acrylic, discountPercentage, format);
    return Math.ceil((priceWithMargin - discount) / 100) * 100;
  }

  calculateIva(acrylic: Acrylic, discountPercentage: number, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(acrylic, discountPercentage, format);
    return Math.round(finalPriceWithoutIva * 0.19);
  }

  calculatePriceWithIva(acrylic: Acrylic, discountPercentage: number, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(acrylic, discountPercentage, format);
    const iva = this.calculateIva(acrylic, discountPercentage, format);
    return Math.ceil((finalPriceWithoutIva + iva) / 100) * 100;
  }

  findNearestStandardSize(inputWidth: number, inputHeight: number): { width: number; height: number; fits: boolean; swapped: boolean } | null {
    let bestFit: { width: number; height: number; fits: boolean; swapped: boolean } | null = null;
    for (const size of this.standardSizes) {
      if (inputWidth <= size.width && inputHeight <= size.height) {
        bestFit = { width: size.width, height: size.height, fits: true, swapped: false };
        break;
      }
      if (inputHeight <= size.width && inputWidth <= size.height) {
        bestFit = { width: size.width, height: size.height, fits: true, swapped: true };
        break;
      }
    }
    return bestFit;
  }

  dynamicMargin(areaRatio: number): number {
    if (areaRatio >= 1) return 0;
    return 0.40 - 0.35 * areaRatio;
  }

  calculatePriceForTable(acrylic: Acrylic): CalculationResult & { noCabe?: boolean } {
    const useCustom = this.selectedFormat === 'Sin formato';

    const width = useCustom ? (this.globalWidth || acrylic.width) : acrylic.width;
    const height = useCustom ? (this.globalHeight || acrylic.height) : acrylic.height;

    const formatFactor = this.formatFactors[this.selectedFormat]?.factor || 1;
    const extraMargin = this.formatFactors[this.selectedFormat]?.margin || 0;

    const areaCm2 = width * height;
    const areaStdCm2 = acrylic.width * acrylic.height;
    const adjustedAreaCm2 = useCustom ? areaCm2 : areaStdCm2 * formatFactor;
    const areaRatio = adjustedAreaCm2 / areaStdCm2;

    const suitableSize = this.findSuitableStandardSize(width, height);
    const fitsAcrylic = width <= acrylic.width && height <= acrylic.height;
    const fitsAcrylicSwapped = width <= acrylic.height && height <= acrylic.width;

    if (!suitableSize || !(fitsAcrylic || fitsAcrylicSwapped)) {
      return {
        orderArea: adjustedAreaCm2 / 10000,
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

    const costoProporcional = (acrylic.cost_price / areaStdCm2) * adjustedAreaCm2;
    const precioCon30 = Math.ceil((costoProporcional / 0.7) / 100) * 100;

    const marginPct = useCustom ? this.dynamicMargin(areaRatio) : extraMargin;

    const precioVenta = Math.ceil((precioCon30 * (1 + marginPct)) / 100) * 100;

    const discountPct = this.selectedClientForTable?.default_discount || this.tableDiscount || 0;
    const discountValue = Math.ceil((precioVenta * (discountPct / 100)) / 100) * 100;

    const priceWithoutIva = Math.ceil((precioVenta - discountValue) / 100) * 100;
    const iva = Math.ceil((priceWithoutIva * 0.19) / 100) * 100;

    return {
      orderArea: adjustedAreaCm2 / 10000,
      basePriceWithProfit: precioCon30,
      appliedMargin: marginPct,
      priceWithMargin: precioVenta,
      discount: discountValue,
      finalPriceWithoutIva: priceWithoutIva,
      iva,
      finalPriceWithIva: priceWithoutIva + iva,
      noCabe: false
    };
  }

  private getStandardSizeFor(width: number, height: number): StandardSize | null {
    return this.standardSizes.find(s =>
      (width <= s.width && height <= s.height) ||
      (width <= s.height && height <= s.width)
    ) || null;
  }

  calculateValues(): void {
    const matchingAcrylics = this.acrylicItems.filter(a => a.color === this.calculatorForm.color);
    if (!matchingAcrylics.length) {
      alert('No se encontró un acrílico con el color seleccionado.');
      return;
    }
    const sortedAcrylics = matchingAcrylics.sort((a, b) =>
      Math.abs(a.gauge - this.calculatorForm.gauge) - Math.abs(b.gauge - this.calculatorForm.gauge)
    );
    const nearestAcrylic = sortedAcrylics[0];
    const width = this.calculatorForm.width;
    const height = this.calculatorForm.height;
    const format = this.calculatorForm.format;
    const cost = this.calculatorForm.cost_price || nearestAcrylic.cost_price;
    const utilidad = this.calculatorForm.margin / 100;
    const discount = this.selectedClient?.default_discount || this.calculatorForm.discount || 0;

    const areaCm2 = width * height;
    const orderArea = areaCm2 / 10000;

    const isCustom = format === 'Sin formato';

    const suitableSize = this.findNearestStandardSize(width, height);
    const fitsAcrylic = width <= nearestAcrylic.width && height <= nearestAcrylic.height;
    const fitsAcrylicSwapped = width <= nearestAcrylic.height && height <= nearestAcrylic.width;

    if (!suitableSize || !(fitsAcrylic || fitsAcrylicSwapped)) {
      this.calculationResult = {
        orderArea,
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
      extraMargin = this.calculateAppliedMargin({ ...nearestAcrylic, width, height }, format);
      if (extraMargin === 0 && orderArea > this.calculateTotalSheetArea(nearestAcrylic)) {
        this.calculationResult = {
          orderArea,
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
    } else {
      extraMargin = this.formatFactors[format]?.margin || 0;
    }

    const factor = this.formatFactors[format]?.factor || 1;
    const adjustedArea = orderArea * factor;
    const matchingStandard = this.standardSizes.find(
      s => s.width === suitableSize.width && s.height === suitableSize.height
    );
    const totalSheetArea = matchingStandard ? matchingStandard.area / 10000 : 0;
    const baseCost = adjustedArea >= totalSheetArea
      ? cost
      : (cost / totalSheetArea) * adjustedArea;

    const priceWithUtility = Math.ceil((baseCost / (1 - utilidad)) / 100) * 100;
    const priceWithMargin = Math.ceil((priceWithUtility * (1 + extraMargin)) / 100) * 100;
    const discountValue = Math.ceil((priceWithMargin * (discount / 100)) / 100) * 100;

    const priceWithoutIva = Math.ceil((priceWithMargin - discountValue) / 100) * 100;
    const ivaValue = this.calculatorForm.includeIva
      ? Math.ceil((priceWithoutIva * 0.19) / 100) * 100
      : 0;
    const finalPrice = priceWithoutIva + ivaValue;

    this.calculationResult = {
      orderArea: adjustedArea,
      basePriceWithProfit: priceWithUtility,
      appliedMargin: extraMargin,
      priceWithMargin,
      discount: discountValue,
      finalPriceWithoutIva: priceWithoutIva,
      iva: ivaValue,
      finalPriceWithIva: finalPrice
    };
  }

  calculateDiscount(acrylic: Acrylic, discount: number = 0, format: string = this.selectedFormat): number {
    if (!this.selectedClientForTable && !this.selectedClient || format === '1 Lámina') {
      return 0;
    }
    const discountToUse = this.selectedClient?.default_discount || this.selectedClientForTable?.default_discount || discount;
    const priceWithMargin = this.calculatePriceWithMarginUsingClient(acrylic, format);
    if (priceWithMargin === 0) {
      return 0;
    }
    const discountAmount = Math.ceil((priceWithMargin * (discountToUse / 100)) / 100) * 100;
    return discountAmount;
  }

  async saveAcrylic(): Promise<void> {
  if (!this.formAcrylic.width || !this.formAcrylic.height || !this.formAcrylic.color || !this.formAcrylic.gauge || this.formAcrylic.cost_price <= 0) {
    alert('Por favor, complete todos los campos.');
    return;
  }

  try {
    if (this.selectedAcrylic) {
      // Guardar el calibre original antes de actualizar
      const originalGauge = this.selectedAcrylic.gauge;
      const gaugeChanged = originalGauge !== this.formAcrylic.gauge;

      const { error } = await this.supabase
        .from('acrylics')
        .update({
          width: this.formAcrylic.width,
          height: this.formAcrylic.height,
          color: this.formAcrylic.color,
          gauge: this.formAcrylic.gauge,
          cost_price: this.formAcrylic.cost_price,
        })
        .eq('id_acrylics', this.selectedAcrylic.id_acrylics);

      if (error) {
        console.error('Error al actualizar acrílico:', error);
        alert('Error al actualizar el acrílico.');
        return;
      }

      alert('Acrílico actualizado correctamente.');

      // NUEVO: Solo recargar y reordenar si cambió el calibre
      if (gaugeChanged) {
        await this.getAcrylicItems(); // Recarga todo y reordena
      } else {
        // Actualizar solo el item editado sin cambiar el orden
        await this.updateSingleItem(this.selectedAcrylic.id_acrylics);
      }
    } else {
      const { error } = await this.supabase
        .from('acrylics')
        .insert([
          {
            width: this.formAcrylic.width,
            height: this.formAcrylic.height,
            color: this.formAcrylic.color,
            gauge: this.formAcrylic.gauge,
            cost_price: this.formAcrylic.cost_price,
          },
        ]);

      if (error) {
        console.error('Error al crear acrílico:', error);
        alert('Error al crear el acrílico.');
        return;
      }

      alert('Acrílico creado correctamente.');
      await this.getAcrylicItems(); // Para nuevos items sí recargamos todo
    }

    this.closeModal();
  } catch (error) {
    console.error('Error inesperado:', error);
    alert('Ocurrió un error inesperado.');
  }
}

private async updateSingleItem(id: string): Promise<void> {
  const { data, error } = await this.supabase
    .from('acrylics')
    .select('*')
    .eq('id_acrylics', id)
    .single();

  if (error) {
    console.error('Error al obtener el item actualizado:', error);
    return;
  }

  // Encontrar y actualizar el item en los arrays sin cambiar el orden
  const indexInAll = this.acrylicItems.findIndex(item => item.id_acrylics === id);
  if (indexInAll !== -1) {
    this.acrylicItems[indexInAll] = data;
  }

  const indexInFiltered = this.filteredAcrylicItems.findIndex(item => item.id_acrylics === id);
  if (indexInFiltered !== -1) {
    this.filteredAcrylicItems[indexInFiltered] = data;
  }

  const indexInPaginated = this.paginatedAcrylicItems.findIndex(item => item.id_acrylics === id);
  if (indexInPaginated !== -1) {
    this.paginatedAcrylicItems[indexInPaginated] = data;
  }
}


  async deleteAcrylic(id_acrylic: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('acrylics')
        .delete()
        .eq('id_acrylics', id_acrylic);

      if (error) {
        console.error('Error al eliminar acrílico:', error);
        alert('Error al eliminar el acrílico.');
        return;
      }

      alert('Acrílico eliminado correctamente.');
      await this.getAcrylicItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  updatePaginatedAcrylicItems(): void {
    // Filtrar primero por búsqueda de texto
    let tempFiltered = this.acrylicItems.filter(item => {
      const searchLower = this.searchTerm.toLowerCase();
      const matchesColor = item.color.toLowerCase().includes(searchLower);
      const matchesWidth = item.width.toString().includes(this.searchTerm);
      const matchesHeight = item.height.toString().includes(this.searchTerm);
      const matchesGauge = item.gauge.toString().includes(this.searchTerm);
      return matchesColor || matchesWidth || matchesHeight || matchesGauge;
    });

    // Filtrar por checkboxes de tipo/color
    const allCheckboxesOff = !this.showCristalOpal && !this.showColorRojo &&
                              !this.showHumo && !this.showEspejo && !this.showMetalizados;

    if (!allCheckboxesOff) {
      tempFiltered = tempFiltered.filter(item => {
        const normalizedColor = item.color.trim();
        return (
          (this.showCristalOpal && normalizedColor === 'Cristal y Opal') ||
          (this.showColorRojo && normalizedColor === 'Color Rojo') ||
          (this.showHumo && normalizedColor === 'Humo') ||
          (this.showEspejo && normalizedColor === 'Espejo') ||
          (this.showMetalizados && normalizedColor === 'Metalizados')
        );
      });
    }

    this.filteredAcrylicItems = tempFiltered;

    if (this.sortDirection) {
      this.applySortByGauge();
    }

    // Actualizar paginación
    this.totalPages = Math.ceil(this.filteredAcrylicItems.length / this.itemsPerPage);
    this.paginatedAcrylicItems = this.filteredAcrylicItems.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }


  redondearSiSinFormato(val: number, format: string): number {
    return format === 'Sin formato'
      ? Math.ceil(val / 100) * 100
      : val;
  }

  onClientSelectedForTable(): void {
    console.log('Cliente seleccionado:', this.selectedClientForTable);
    if (this.selectedClientForTable) {
      console.log('Margen del cliente:', this.selectedClientForTable.default_margin || this.selectedClientForTable.default_profit);
    }
    this.updatePaginatedAcrylicItems();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePaginatedAcrylicItems();
  }
}

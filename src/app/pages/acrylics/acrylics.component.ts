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

  // Propiedades para el modal de valores predeterminados del cliente
  showClientDefaultsModal: boolean = false;

  // Default values for table calculations
  tableMargin: number = 30; // Default 30% margin
  tableDiscount: number = 0; // Default 0% discount

  selectedClientForTable: Client | null = null;

  globalWidth: number = 0;
  globalHeight: number = 0;
  appliedMargin: number = 30;

  private baseUtilidadPercentage = 0.30; // Utilidad base fija al 30%

  // Factores de formato (para el área)
  private formatFactors: { [key: string]: number } = {
    '1 Lámina': 1,
    '1/2 (Media Lámina)': 0.5,
    '1/3 (Tercio de Lámina)': 0.3333,
    '1/4 (Cuarto de Lámina)': 0.25,
    '1/8 (Octavo de Lámina)': 0.125,
    '1/16 (Dieciseisavo de Lámina)': 0.0625,
    '1/32 (Treintaydosavo de Lámina)': 0.03125,
    'Sin formato': 0 // Sin formato, se usa el área completa
  };

  // Márgenes variables por formato
  private formatMargins: { [key: string]: number } = {
    'Sin formato': 0, // Margen inicial, se actualizará con el porcentaje del formato
    '1 Lámina': 0,
    '1/2 (Media Lámina)': 0.10,
    '1/3 (Tercio de Lámina)': 0.28,
    '1/4 (Cuarto de Lámina)': 0.25,
    '1/8 (Octavo de Lámina)': 0.33,
    '1/16 (Dieciseisavo de Lámina)': 0.36,
    '1/32 (Treintaydosavo de Lámina)': 0.38,
  };

  // Lista de medidas estándar (ancho x alto en cm)
  private standardSizes: { width: number; height: number }[] = [
    { width: 122, height: 244 },
    { width: 120, height: 180 },
    { width: 130, height: 190 },
    { width: 125, height: 245 },
    { width: 100, height: 200 },
  ];

  private M1: number = 0.40; // Q3/100 = 40/100
  private M2: number = 0.35; // (Q3-Q2)/100 = (40-5)/100
  private M3: number = 0.40; // R3/100 = 40/100
  private M4: number = 0.30; // (R3-R2)/100 = (40-10)/100

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
    this.filteredAcrylicItems = [...this.acrylicItems];
    this.applyCurrentSort();
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
    this.applyCurrentSort();
    this.updatePaginatedAcrylicItems();
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

      // Update the local selectedClient with the new values
      this.selectedClient.default_margin = this.selectedClient.default_margin;
      this.selectedClient.default_discount = this.selectedClient.default_discount;

      // Update calculatorForm with the new values immediately
      if (this.selectedClient) {
        this.calculatorForm.margin = this.selectedClient.default_margin;
        this.calculatorForm.discount = this.selectedClient.default_discount;
      }

      alert('Valores predeterminados actualizados correctamente.');
      this.closeClientDefaultsModal();
      await this.getClients(); // Refresh clients list
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  clearGlobalValues(): void {
    this.globalWidth = 0;
    this.globalHeight = 0;
    this.appliedMargin = 0; // Reset applied margin to 0
    this.selectedFormat = 'Sin formato'; // Reset format to 'Sin formato'
    this.updatePaginatedAcrylicItems();
  }

  calculateTotalSheetArea(acrylic: Acrylic): number {
    return (acrylic.width * acrylic.height) / 10000; // Área en m² usando dimensiones originales
  }

  // Actualizar calculateOrderArea para soportar dimensiones globales y estándar
  calculateOrderArea(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const factor = this.formatFactors[format] || 0;
    const totalSheetArea = this.calculateTotalSheetArea(acrylic);

    if (factor > 0) {
      // Formato seleccionado: usar área total de la lámina * factor
      return totalSheetArea * factor; // Área en m²
    }
    // Sin formato: usar dimensiones globales si están definidas
    if (format === 'Sin formato' && this.globalWidth > 0 && this.globalHeight > 0) {
      return (this.globalWidth * this.globalHeight) / 10000; // Área global en m²
    }
    // Si no hay formato ni dimensiones globales, usar área total de la lámina
    return totalSheetArea;
  }

  // Modificar calculateBasePriceWithProfit para usar dimensiones globales
  calculateBasePriceWithProfit(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const costPrice = acrylic.cost_price;
    const totalSheetArea = this.calculateTotalSheetArea(acrylic);
    const orderArea = this.calculateOrderArea(acrylic, format);
    if (orderArea <= 0 || totalSheetArea <= 0) return 0;
    const adjustedCostPrice = (costPrice / totalSheetArea) * orderArea;
    const basePrice = adjustedCostPrice / (1 - this.baseUtilidadPercentage); // Añade 30% de utilidad
    return Math.ceil(basePrice / 100) * 100;
  }

   calculateAppliedMargin(acrylic: Acrylic, format: string = this.selectedFormat): number {
    // Para formatos predefinidos, usar márgenes de formatMargins
    if (format !== 'Sin formato' && this.formatMargins[format] !== undefined) {
      return this.formatMargins[format];
    }

    // Para "Sin formato", calcular el margen automáticamente
    const orderArea = this.calculateOrderArea(acrylic, format);
    const totalSheetArea = this.calculateTotalSheetArea(acrylic);

    if (orderArea <= 0) {
      return 0; // Área no válida
    }

    const areaRatio = orderArea / totalSheetArea;

    if (areaRatio === 1) {
      return 0; // Formato "1 Lámina"
    }

    const standardFractions = [0.5, 0.3333, 0.25, 0.125, 0.0625, 0.03125];
    if (standardFractions.includes(Number(areaRatio.toFixed(4)))) {
      // Esto no debería aplicarse en "Sin formato", pero se incluye por consistencia
      return this.M3 - this.M4 * (orderArea / (totalSheetArea / 2));
    }

    // Dimensiones personalizadas (Sin formato): M1 - M2 * (orderArea / totalSheetArea)
    return this.M1 - this.M2 * areaRatio;
  }

  calculatePriceWithMargin(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const basePrice = this.calculateBasePriceWithProfit(acrylic, format);
    const appliedMargin = this.calculateAppliedMargin(acrylic, format);
    return Math.ceil((basePrice * (1 + appliedMargin)) / 100) * 100;
  }

  calculatePriceWithMarginUsingClient(acrylic: Acrylic, format: string = this.selectedFormat): number {
    return this.calculatePriceWithMargin(acrylic, format); // Reutiliza la lógica general
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

  // Función para encontrar la medida estándar más cercana
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

  // Modificar calculateValues para usar medidas estándar
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
    const standardSize = this.findNearestStandardSize(this.calculatorForm.width, this.calculatorForm.height);
    if (!standardSize) {
      alert('Las dimensiones ingresadas no caben en ninguna medida estándar.');
      return;
    }
    const effectiveWidth = standardSize.swapped ? this.calculatorForm.height : this.calculatorForm.width;
    const effectiveHeight = standardSize.swapped ? this.calculatorForm.width : this.calculatorForm.height;
    const costPrice = this.calculatorForm.cost_price || nearestAcrylic.cost_price;
    const format = this.calculatorForm.format;
    const discountToUse = this.selectedClient?.default_discount !== undefined
      ? this.selectedClient.default_discount
      : this.calculatorForm.discount || 0;
    const orderArea = this.calculateOrderArea({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, format);
    const basePriceWithProfit = this.calculateBasePriceWithProfit({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, format);
    const appliedMargin = this.calculateAppliedMargin({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, format);
    const priceWithMargin = this.calculatePriceWithMargin({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, format);
    const discount = this.calculateDiscount({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, discountToUse, format);
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, discountToUse, format);
    const iva = this.calculatorForm.includeIva ? this.calculateIva({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, discountToUse, format) : 0;
    const finalPriceWithIva = this.calculatePriceWithIva({ ...nearestAcrylic, width: standardSize.width, height: standardSize.height }, discountToUse, format);
    this.calculationResult = {
      orderArea,
      basePriceWithProfit,
      appliedMargin,
      priceWithMargin,
      discount,
      finalPriceWithoutIva,
      iva,
      finalPriceWithIva
    };
    if (standardSize.swapped) {
      console.log(`Dimensiones intercambiadas: ${this.calculatorForm.width}x${this.calculatorForm.height} → ${effectiveWidth}x${effectiveHeight}`);
    }
  }

  calculateDiscount(acrylic: Acrylic, discount: number = 0, format: string = this.selectedFormat): number {
    // Depuración
    console.log('Calculating Discount - Format:', format, 'Selected Client For Table:', this.selectedClientForTable, 'Discount:', discount);

    // Solo aplicar descuento si hay un cliente seleccionado y el formato no es "1 Lámina"
    if (!this.selectedClientForTable && !this.selectedClient || format === '1 Lámina') {
      return 0;
    }
    const discountToUse = this.selectedClient?.default_discount || this.selectedClientForTable?.default_discount || discount;
    const priceWithMargin = this.calculatePriceWithMarginUsingClient(acrylic, format);
    const discountAmount = Math.ceil((priceWithMargin * (discountToUse / 100)) / 100) * 100;
    console.log('Discount Amount Calculated:', discountAmount);
    return discountAmount;
  }

  async saveAcrylic(): Promise<void> {
    if (!this.formAcrylic.width || !this.formAcrylic.height || !this.formAcrylic.color || !this.formAcrylic.gauge || this.formAcrylic.cost_price <= 0) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      if (this.selectedAcrylic) {
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
      }

      this.closeModal();
      await this.getAcrylicItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
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
  // Actualizar appliedMargin automáticamente si es "Sin formato"
  if (this.selectedFormat === 'Sin formato' && this.globalWidth > 0 && this.globalHeight > 0 && this.acrylicItems.length > 0) {
    const sampleAcrylic = { ...this.acrylicItems[0], width: 120, height: 180 }; // Usar dimensiones estándar de referencia
    this.appliedMargin = this.calculateAppliedMargin(sampleAcrylic, this.selectedFormat) * 100; // Convertir a porcentaje
  } else if (this.selectedFormat !== 'Sin formato') {
    this.appliedMargin = this.formatMargins[this.selectedFormat] * 100 || 30; // Usar margen predefinido
  }

  // Filtrar por searchTerm en color, width, height y gauge
  this.filteredAcrylicItems = this.acrylicItems.filter(item => {
    const searchLower = this.searchTerm.toLowerCase();
    const matchesColor = item.color.toLowerCase().includes(searchLower);
    const matchesWidth = item.width.toString().includes(this.searchTerm);
    const matchesHeight = item.height.toString().includes(this.searchTerm);
    const matchesGauge = item.gauge.toString().includes(this.searchTerm);
    return matchesColor || matchesWidth || matchesHeight || matchesGauge;
  });

  // Actualizar paginación
  this.totalPages = Math.ceil(this.filteredAcrylicItems.length / this.itemsPerPage);
  this.paginatedAcrylicItems = this.filteredAcrylicItems.slice(
    (this.currentPage - 1) * this.itemsPerPage,
    this.currentPage * this.itemsPerPage
  );
}

  private applyCurrentSort(): void {
    this.filteredAcrylicItems.sort((a, b) => {
      const valueA = a.gauge;
      const valueB = b.gauge;
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
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

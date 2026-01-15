import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface Mdf {
  id_mdf: string;
  width: number;
  height: number;
  thickness: number;
  cost: number;
  freight: number;
  created_at: string;
}

interface Client {
  id_client: string;
  name: string;
  company_name: string;
  default_margin?: number;
  default_discount?: number;
}

interface CalculationResult {
  priceWith30Profit: number;
  totalSheetArea: number;
  area: number;
  priceWithMargin: number;
  appliedMargin: number;
  pricePlusMargin: number;
  discount: number;
  finalPriceWithoutIva: number;
  iva: number;
  finalPriceWithIva: number;
}

@Component({
  selector: 'app-mdf',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './mdf.component.html',
  styleUrl: './mdf.component.scss'
})

export class MDFComponent implements OnInit {
  mdfItems: Mdf[] = [];
  filteredMdfItems: Mdf[] = [];
  paginatedMdfItems: Mdf[] = [];
  selectedMdf: Mdf | null = null;
  showModal: boolean = false;
  newMdf: Mdf = { id_mdf: '', width: 0, height: 0, thickness: 0, cost: 0, freight: 0, created_at: '' };
  formMdf: Mdf;
  loading = true;
  searchTerm: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  selectedFormat: string = 'Sin formato';
  selectedClientForTable: Client | null = null;

  // Propiedades para la calculadora
  showCalculatorModal: boolean = false;
  calculatorForm: {
    width: number;
    height: number;
    thickness: number;
    cost: number;
    freight: number;
    format: string;
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
  globalWidth: number = 0;
  globalHeight: number = 0;
  private utilityMargin: number = 0.30;

  constructor(private readonly supabase: SupabaseService) {
    this.formMdf = { ...this.newMdf };
    this.calculatorForm = {
      width: 0,
      height: 0,
      thickness: 0,
      cost: 0,
      freight: 0,
      format: '1 Lámina',
      margin: 30,
      discount: 0,
      includeIva: false
    };
  }

    async ngOnInit(): Promise<void> {
    await this.loadUtilityMargin();
    this.getMdfItems();
    this.getClients();
  }

  async loadUtilityMargin(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('variables')
        .select('value')
        .eq('name', 'utility_margin')
        .single();

      if (error) {
        console.error('Error al cargar utility_margin:', error);
        this.utilityMargin = 0.30;
        return;
      }

      if (data && data.value) {
        this.utilityMargin = parseFloat(data.value) / 100;
        console.log('Utility margin cargado en MDF:', this.utilityMargin);
      }
    } catch (error) {
      console.error('Error inesperado al cargar utility_margin:', error);
      this.utilityMargin = 0.30;
    }
  }

  async getMdfItems(): Promise<void> {
    this.loading = true;
    const { data, error } = await this.supabase.from('mdf').select('*');
    if (error) {
      console.error('Error al obtener MDF:', error);
      alert('Error al cargar los datos.');
      return;
    }
    this.mdfItems = data || [];
    this.filteredMdfItems = [...this.mdfItems];
    this.currentPage = 1;
    this.updatePaginatedMdfItems();
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
    this.calculatorForm.margin = this.selectedClient.default_margin || 30;
    this.calculatorForm.discount = this.selectedClient.default_discount || 0;
  }

  hideClientDropdown(): void {
    setTimeout(() => { this.showClientDropdown = false; }, 200);
  }

  private sortMdf(items: Mdf[]): Mdf[] {
    return items.sort((a, b) => {
      // Área total ASC
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA !== areaB) {
        return areaA - areaB;
      }

      // Espesor ASC
      return a.thickness - b.thickness;
    });
  }

  openModal(mdf?: Mdf): void {
    if (mdf) {
      this.selectedMdf = { ...mdf };
      this.formMdf = { ...mdf };
    } else {
      this.selectedMdf = null;
      this.formMdf = { ...this.newMdf };
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedMdf = null;
    this.formMdf = { ...this.newMdf };
  }

  openCalculatorModal(): void {
    this.showCalculatorModal = true;
    this.calculatorForm = {
      width: 0,
      height: 0,
      thickness: 0,
      cost: 0,
      freight: 0,
      format: '1 Lámina',
      margin: 30,
      discount: 0,
      includeIva: false
    };
    this.calculationResult = null;
    this.clientSearchQuery = '';
    this.selectedClient = null;
    this.filteredClients = [...this.clients];
    this.showClientDropdown = false;
  }

  closeCalculatorModal(): void {
    this.showCalculatorModal = false;
    this.calculationResult = null;
    this.selectedClient = null;
  }

  openClientDefaultsModal(): void {
    this.showClientDefaultsModal = true;
  }

  closeClientDefaultsModal(): void {
    this.showClientDefaultsModal = false;
  }

  async saveClientDefaults(): Promise<void> {
    if (!this.selectedClient) return;
    const { error } = await this.supabase
      .from('clients')
      .update({
        default_margin: this.selectedClient.default_margin,
        default_discount: this.selectedClient.default_discount
      })
      .eq('id_client', this.selectedClient.id_client);
    if (error) {
      console.error('Error updating client defaults:', error);
      alert('Error al guardar los valores predeterminados.');
    } else {
      alert('Valores predeterminados guardados correctamente.');
    }
    this.closeClientDefaultsModal();
  }

  calculateMdfValues(): void {
    if (!this.calculatorForm.width || !this.calculatorForm.height || !this.calculatorForm.thickness || !this.calculatorForm.cost || !this.calculatorForm.freight) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    const mdf: Mdf = {
      id_mdf: '',
      width: this.calculatorForm.width,
      height: this.calculatorForm.height,
      thickness: this.calculatorForm.thickness,
      cost: this.calculatorForm.cost,
      freight: this.calculatorForm.freight,
      created_at: ''
    };
    const marginToUse = this.selectedClient?.default_margin || this.calculatorForm.margin || 30;
    const discountToUse = this.selectedClient?.default_discount || this.calculatorForm.discount || 0;

    this.calculationResult = {
      priceWith30Profit: this.calculatePriceWith30Profit(mdf),
      totalSheetArea: this.calculateTotalSheetArea(mdf),
      area: this.calculateArea(mdf, this.calculatorForm.format),
      priceWithMargin: this.calculatePriceWithMargin(mdf, this.calculatorForm.format),
      appliedMargin: this.calculateAppliedMargin(this.calculatorForm.format),
      pricePlusMargin: this.calculatePricePlusMargin(mdf, this.calculatorForm.format),
      discount: this.calculateDiscount(mdf, discountToUse, this.calculatorForm.format),
      finalPriceWithoutIva: this.calculateFinalPriceWithoutIva(mdf, discountToUse, this.calculatorForm.format),
      iva: this.calculatorForm.includeIva ? this.calculateIva(mdf, discountToUse, this.calculatorForm.format) : 0,
      finalPriceWithIva: this.calculatorForm.includeIva ? this.calculatePriceWithIva(mdf, discountToUse, this.calculatorForm.format) : 0
    };
  }

  async saveMdf(): Promise<void> {
    if (!this.formMdf.width || !this.formMdf.height || !this.formMdf.thickness || this.formMdf.cost <= 0 || this.formMdf.freight <= 0) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      if (this.selectedMdf) {
        const { error } = await this.supabase
          .from('mdf')
          .update({
            width: this.formMdf.width,
            height: this.formMdf.height,
            thickness: this.formMdf.thickness,
            cost: this.formMdf.cost,
            freight: this.formMdf.freight,
          })
          .eq('id_mdf', this.selectedMdf.id_mdf);

        if (error) {
          console.error('Error al actualizar MDF:', error);
          alert('Error al actualizar el MDF.');
          return;
        }
        alert('MDF actualizado correctamente.');
      } else {
        const { error } = await this.supabase
          .from('mdf')
          .insert([
            {
              width: this.formMdf.width,
              height: this.formMdf.height,
              thickness: this.formMdf.thickness,
              cost: this.formMdf.cost,
              freight: this.formMdf.freight,
            },
          ]);

        if (error) {
          console.error('Error al crear MDF:', error);
          alert('Error al crear el MDF.');
          return;
        }
        alert('MDF creado correctamente.');
      }

      this.closeModal();
      await this.getMdfItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  async deleteMdf(id_mdf: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('mdf')
        .delete()
        .eq('id_mdf', id_mdf);

      if (error) {
        console.error('Error al eliminar MDF:', error);
        alert('Error al eliminar el MDF.');
        return;
      }

      alert('MDF eliminado correctamente.');
      await this.getMdfItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  calculatePriceWith30Profit(mdf: Mdf): number {
    const totalCost = mdf.cost + mdf.freight;
    return Math.ceil((totalCost / (1 - this.utilityMargin)) / 100) * 100;
  }

  calculateTotalSheetArea(mdf: Mdf): number {
    return mdf.width * mdf.height;
  }

  calculateArea(mdf: Mdf, format: string): number {
    if (format === 'Sin formato') {
      return this.globalWidth * this.globalHeight;
    }
    const totalArea = this.calculateTotalSheetArea(mdf);
    const formatFactor = this.getFormatFactor(format);
    return totalArea / formatFactor;
  }

  calculatePriceWithMargin(mdf: Mdf, format: string): number {
  const totalArea = this.calculateTotalSheetArea(mdf);
  const totalCost = mdf.cost + mdf.freight;

  // Si es "Sin formato", usar dimensiones globales
  if (format === 'Sin formato') {
    const customArea = this.globalWidth * this.globalHeight;

    // Validar que las dimensiones globales caben en la lámina
    const fitsNormal = this.globalWidth <= mdf.width && this.globalHeight <= mdf.height;
    const fitsSwapped = this.globalWidth <= mdf.height && this.globalHeight <= mdf.width;

    if (!fitsNormal && !fitsSwapped) {
      return 0; // No cabe
    }

    if (customArea <= 0) return 0;

    return Math.ceil((((totalCost / totalArea) * customArea) / (1 - this.utilityMargin)) / 100) * 100;
  }

  // Para formatos predefinidos, cálculo normal
  const area = this.calculateArea(mdf, format);
  return area > 0 ? Math.ceil((((totalCost / totalArea) * area) / (1 - this.utilityMargin)) / 100) * 100 : 0;
}

  calculateAppliedMargin(format: string, mdf?: Mdf): number {
  // Si es "Sin formato", calcular margen dinámico
  if (format === 'Sin formato' && mdf) {
    const totalSheetArea = this.calculateTotalSheetArea(mdf);
    const customArea = this.globalWidth * this.globalHeight;

    if (customArea <= 0 || totalSheetArea <= 0) return 0;

    const areaRatio = customArea / totalSheetArea;

    // Si el área es igual o mayor que la lámina completa, margen = 0
    if (areaRatio >= 1) return 0;

    // Para "Sin formato", el margen es simplemente 1 - areaRatio
    return 1 - areaRatio;
  }

  // Márgenes fijos para formatos predefinidos
  const margins: { [key: string]: number } = {
    '1 Lámina': 0,
    '1/2 (Media Lámina)': 0.10,
    '1/3 (Tercio de Lámina)': 0.40,
    '1/4 (Cuarto de Lámina)': 0.55,
    '1/8 (Octavo de Lámina)': 0.78,
    '1/16 (Dieciseisavo de Lámina)': 0.89,
    '1/32 (Treintaydosavo de Lámina)': 0.94,
    'Sin formato': 0
  };
  return margins[format] || 0;
}

  calculatePricePlusMargin(mdf: Mdf, format: string): number {
    const priceWithMargin = this.calculatePriceWithMargin(mdf, format);

    if (priceWithMargin === 0) return 0; // No cabe o área inválida

    const appliedMargin = this.calculateAppliedMargin(format, mdf);
    return Math.ceil(priceWithMargin * (1 + appliedMargin) / 100) * 100;
  }

  clearGlobalValues(): void {
    this.globalWidth = 0;
    this.globalHeight = 0;
    this.updatePaginatedMdfItems();
  }

  calculateDiscount(mdf: Mdf, discountPercent: number = 0, format: string): number {
    const pricePlusMargin = this.calculatePricePlusMargin(mdf, format);
    const discountAmount = Math.ceil(pricePlusMargin * (discountPercent / 100) / 100) * 100;
    return discountAmount > pricePlusMargin ? pricePlusMargin : discountAmount;
  }

  calculateFinalPriceWithoutIva(mdf: Mdf, discountPercent: number = 0, format: string): number {
    const pricePlusMargin = this.calculatePricePlusMargin(mdf, format);
    const discount = this.calculateDiscount(mdf, discountPercent, format);
    return Math.ceil((pricePlusMargin - discount) / 100) * 100;
  }

  calculateIva(mdf: Mdf, discountPercent: number = 0, format: string): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(mdf, discountPercent, format);
    return Math.ceil(finalPriceWithoutIva * 0.19 / 100) * 100;
  }

  calculatePriceWithIva(mdf: Mdf, discountPercent: number = 0, format: string): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(mdf, discountPercent, format);
    const iva = this.calculateIva(mdf, discountPercent, format);
    return finalPriceWithoutIva + iva;
  }

  onClientSelectedForTable(): void {
    this.calculatorForm.margin = this.selectedClientForTable?.default_margin || 30;
    this.calculatorForm.discount = this.selectedClientForTable?.default_discount || 0;
    this.updatePaginatedMdfItems();
  }

  updatePaginatedMdfItems(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const filtered = this.mdfItems.filter(mdf =>
      mdf.thickness.toString().toLowerCase().includes(term) ||
      mdf.cost.toString().includes(term) ||
      mdf.freight.toString().includes(term)
    );

    this.filteredMdfItems = this.sortMdf(filtered);


    const itemsPerPageNum = Number(this.itemsPerPage);
    this.totalPages = Math.max(1, Math.ceil(this.filteredMdfItems.length / itemsPerPageNum));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = (this.currentPage - 1) * itemsPerPageNum;
    const endIndex = startIndex + itemsPerPageNum;
    this.paginatedMdfItems = this.filteredMdfItems.slice(startIndex, endIndex);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.updatePaginatedMdfItems();
  }
  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePaginatedMdfItems();
  }

  private getFormatFactor(format: string): number {
    const factors: { [key: string]: number } = {
      '1 Lámina': 1,
      '1/2 (Media Lámina)': 2,
      '1/3 (Tercio de Lámina)': 3,
      '1/4 (Cuarto de Lámina)': 4,
      '1/8 (Octavo de Lámina)': 8,
      '1/16 (Dieciseisavo de Lámina)': 16,
      '1/32 (Treintaydosavo de Lámina)': 32,
      'Sin formato': 0
    };
    return factors[format] || 1;
  }
}

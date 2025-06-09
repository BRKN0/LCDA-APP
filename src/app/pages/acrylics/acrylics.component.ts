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
  selectedFormat: string = '1 Lámina';
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

  // Factores de formato (para el área)
  private formatFactors: { [key: string]: number } = {
    '1 Lámina': 1,
    '1/2 (Media Lámina)': 0.5,
    '1/3 (Tercio de Lámina)': 0.3333,
    '1/4 (Cuarto de Lámina)': 0.25,
    '1/8 (Octavo de Lámina)': 0.125,
    '1/16 (Dieciseisavo de Lámina)': 0.0625,
    '1/32 (Treintaydosavo de Lámina)': 0.03125,
  };

  // Márgenes por formato (en fracción, ej. 0.10 = 10%)
  private formatMargins: { [key: string]: number } = {
    '1 Lámina': 0,
    '1/2 (Media Lámina)': 0.10,
    '1/3 (Tercio de Lámina)': 0.42,
    '1/4 (Cuarto de Lámina)': 0.30,
    '1/8 (Octavo de Lámina)': 0.40,
    '1/16 (Dieciseisavo de Lámina)': 0.45,
    '1/32 (Treintaydosavo de Lámina)': 0.48,
  };

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
      margin: this.selectedClient?.default_margin || this.selectedClient?.default_profit || 30,
      discount: this.selectedClient?.default_discount || 0,
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
    // Reset calculatorForm to default values when closing
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

  private calculateTotalSheetArea(acrylic: Acrylic): number {
    return (acrylic.width * acrylic.height) / 10000;
  }

  calculateOrderArea(width: number, height: number, format: string = this.selectedFormat): number {
    const totalArea = (width * height) / 10000;
    const factor = this.formatFactors[format] || 1;
    return totalArea * factor;
  }

  calculateBasePriceWithProfit(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const costPrice = acrylic.cost_price;
    const totalSheetArea = this.calculateTotalSheetArea(acrylic);
    const orderArea = this.calculateOrderArea(acrylic.width, acrylic.height, format);
    const pricePerUnitArea = costPrice / totalSheetArea;
    const adjustedPrice = (pricePerUnitArea * orderArea) / (1 - this.tableMargin / 100);
    return Math.ceil(adjustedPrice / 100) * 100;
  }

  calculateAppliedMargin(format: string = this.selectedFormat): number {
    return this.formatMargins[format] || 0;
  }

  calculatePriceWithMargin(acrylic: Acrylic, format: string = this.selectedFormat): number {
    const basePriceWithProfit = this.calculateBasePriceWithProfit(acrylic, format);
    const appliedMargin = this.calculateAppliedMargin(format);
    return Math.ceil((basePriceWithProfit * (1 + appliedMargin)) / 100) * 100;
  }

  calculateDiscount(acrylic: Acrylic, discount: number = this.tableDiscount, format: string = this.selectedFormat): number {
    const priceWithMargin = this.calculatePriceWithMargin(acrylic, format);
    const discountPercentage = discount / 100;
    return Math.ceil((priceWithMargin * discountPercentage) / 100) * 100;
  }

  calculateFinalPriceWithoutIva(acrylic: Acrylic, discount: number = this.tableDiscount, format: string = this.selectedFormat): number {
    const priceWithMargin = this.calculatePriceWithMargin(acrylic, format);
    const discountValue = this.calculateDiscount(acrylic, discount, format);
    return Math.ceil((priceWithMargin - discountValue) / 100) * 100;
  }

  calculateIva(acrylic: Acrylic, discount: number = this.tableDiscount, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(acrylic, discount, format);
    return Math.ceil((finalPriceWithoutIva * 0.19) / 100) * 100;
  }

  calculatePriceWithIva(acrylic: Acrylic, discount: number = this.tableDiscount, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(acrylic, discount, format);
    const iva = this.calculateIva(acrylic, discount, format);
    return finalPriceWithoutIva + iva;
  }

  calculateValues(): void {
    const matchingAcrylics = this.acrylicItems.filter(a => a.color === this.calculatorForm.color);
    if (!matchingAcrylics.length) {
      alert('No se encontró un acrílico con el color seleccionado.');
      return;
    }

    // Interpolate cost price based on nearest gauge
    const sortedAcrylics = matchingAcrylics.sort((a, b) => Math.abs(a.gauge - this.calculatorForm.gauge) - Math.abs(b.gauge - this.calculatorForm.gauge));
    const nearestAcrylic = sortedAcrylics[0];
    const costPrice = this.calculatorForm.cost_price || nearestAcrylic.cost_price;
    const margin = this.calculatorForm.margin / 100;
    const discount = this.calculatorForm.discount;
    const format = this.calculatorForm.format;

    const orderArea = this.calculateOrderArea(this.calculatorForm.width, this.calculatorForm.height, format);
    const totalSheetArea = this.calculateTotalSheetArea(nearestAcrylic);
    const areaFactor = orderArea / totalSheetArea;

    const adjustedCostPrice = costPrice * areaFactor;
    const basePriceWithProfit = Math.ceil((adjustedCostPrice / (1 - margin)) / 100) * 100;
    const appliedMargin = this.calculateAppliedMargin(format);
    const priceWithMargin = Math.ceil((basePriceWithProfit * (1 + appliedMargin)) / 100) * 100;
    const discountValue = Math.ceil((priceWithMargin * (discount / 100)) / 100) * 100;
    const finalPriceWithoutIva = Math.ceil((priceWithMargin - discountValue) / 100) * 100;
    const iva = this.calculatorForm.includeIva ? Math.ceil((finalPriceWithoutIva * 0.19) / 100) * 100 : 0;
    const finalPriceWithIva = finalPriceWithoutIva + iva;

    this.calculationResult = {
      orderArea,
      basePriceWithProfit,
      appliedMargin,
      priceWithMargin,
      discount: discountValue,
      finalPriceWithoutIva,
      iva,
      finalPriceWithIva
    };
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
    const term = this.searchTerm.toLowerCase().trim();
    const filtered = this.acrylicItems.filter(acrylic =>
      acrylic.width.toString().includes(term) ||
      acrylic.height.toString().includes(term) ||
      acrylic.color.toLowerCase().includes(term) ||
      acrylic.gauge.toString().includes(term)
    );

    this.filteredAcrylicItems = [...filtered];
    this.applyCurrentSort();

    const itemsPerPageNum = Number(this.itemsPerPage);
    this.totalPages = Math.max(1, Math.ceil(this.filteredAcrylicItems.length / itemsPerPageNum));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = (this.currentPage - 1) * itemsPerPageNum;
    const endIndex = startIndex + itemsPerPageNum;
    this.paginatedAcrylicItems = this.filteredAcrylicItems.slice(startIndex, endIndex);
  }

  private applyCurrentSort(): void {
    this.filteredAcrylicItems.sort((a, b) => {
      const valueA = a.gauge;
      const valueB = b.gauge;
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePaginatedAcrylicItems();
  }
}

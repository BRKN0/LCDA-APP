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
    cost_price: number; // Nuevo campo para precio ingresado
    format: string;
    profit: number;
    margin: number; // Nuevo campo para margen
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

  constructor(private readonly supabase: SupabaseService) {
    this.formAcrylic = { id_acrylics: '', width: 0, height: 0, color: '', gauge: 0, cost_price: 0, created_at: '' };
    this.calculatorForm = {
      width: 0,
      height: 0,
      gauge: 0,
      color: 'Cristal y Opal',
      cost_price: 0, // Valor inicial para precio
      format: '1 Lámina',
      profit: 30,
      margin: 0, // Valor inicial para margen
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
    const { data, error } = await this.supabase
      .from('acrylics')
      .select('*');

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
    this.calculatorForm.profit = client.default_profit || 30;
    this.calculatorForm.margin = client.default_margin || 0; // Usar margen del cliente
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
      cost_price: 0, // Permitir ingreso manual del precio
      format: '1 Lámina',
      profit: this.selectedClient?.default_profit || 30,
      margin: this.selectedClient?.default_margin || 0, // Margen del cliente
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
  }

  openClientDefaultsModal(): void {
    this.showClientDefaultsModal = true;
  }

  closeClientDefaultsModal(): void {
    this.showClientDefaultsModal = false;
  }

  async saveClientDefaults(): Promise<void> {
    if (!this.selectedClient ||
        this.selectedClient.default_profit === undefined ||
        this.selectedClient.default_discount === undefined ||
        this.selectedClient.default_margin === undefined) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('clients')
        .update({
          default_profit: this.selectedClient.default_profit,
          default_margin: this.selectedClient.default_margin,
          default_discount: this.selectedClient.default_discount
        })
        .eq('id_client', this.selectedClient.id_client);

      if (error) {
        console.error('Error al actualizar los valores predeterminados del cliente:', error);
        alert('Error al guardar los cambios.');
        return;
      }

      alert('Valores predeterminados actualizados correctamente.');
      this.closeClientDefaultsModal();
      await this.getClients();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert('Ocurrió un error inesperado.');
    }
  }

  // Calcular el área según el formato
  calculateOrderArea(width: number, height: number, format: string = this.selectedFormat): number {
    const totalArea = (width * height) / 10000; // Área total del pedido en m²
    const factor = this.formatFactors[format] || 1;
    return totalArea * factor;
  }

  // Calcular el precio con utilidad
  calculateBasePriceWithProfit(costPrice: number, width: number, height: number, format: string = this.selectedFormat, profit: number = 30): number {
    const orderArea = this.calculateOrderArea(width, height, format);
    const profitFactor = 1 - (profit / 100); // Ajustar según el porcentaje de utilidad
    const adjustedFactor = profitFactor === 0 ? 1 : profitFactor; // Evitar división por cero
    const adjustedPrice = (costPrice * orderArea) / adjustedFactor; // Aplicar utilidad al precio ingresado
    return Math.ceil(adjustedPrice / 100) * 100;
  }

  // Calcular el margen aplicado (usar el ingresado o del cliente)
  calculateAppliedMargin(margin: number = 0): number {
    return margin / 100; // Convertir a fracción
  }

  // Calcular el precio con margen
  calculatePriceWithMargin(costPrice: number, width: number, height: number, format: string = this.selectedFormat, margin: number = 0): number {
    const basePriceWithProfit = this.calculateBasePriceWithProfit(costPrice, width, height, format, this.calculatorForm?.profit || 0);
    const appliedMargin = this.calculateAppliedMargin(margin || this.calculatorForm?.margin || 0);
    return Math.ceil((basePriceWithProfit * (1 + appliedMargin)) / 100) * 100;
  }

  // Calcular el descuento
  calculateDiscount(costPrice: number, width: number, height: number, discount: number, format: string = this.selectedFormat): number {
    const priceWithMargin = this.calculatePriceWithMargin(costPrice, width, height, format, this.calculatorForm?.margin || 0);
    const discountPercentage = discount / 100;
    return Math.ceil((priceWithMargin * discountPercentage) / 100) * 100;
  }

  // Calcular el precio final sin IVA
  calculateFinalPriceWithoutIva(costPrice: number, width: number, height: number, discount: number, format: string = this.selectedFormat): number {
    const priceWithMargin = this.calculatePriceWithMargin(costPrice, width, height, format, this.calculatorForm?.margin || 0);
    const discountValue = this.calculateDiscount(costPrice, width, height, discount, format);
    return Math.ceil((priceWithMargin - discountValue) / 100) * 100;
  }

  // Calcular el IVA
  calculateIva(costPrice: number, width: number, height: number, discount: number, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(costPrice, width, height, discount, format);
    return Math.ceil((finalPriceWithoutIva * 0.19) / 100) * 100;
  }

  // Calcular el precio con IVA
  calculatePriceWithIva(costPrice: number, width: number, height: number, discount: number, format: string = this.selectedFormat): number {
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(costPrice, width, height, discount, format);
    const iva = this.calculateIva(costPrice, width, height, discount, format);
    return finalPriceWithoutIva + (this.calculatorForm?.includeIva ? iva : 0);
  }

  calculateValues(): void {
    const { width, height, cost_price, format, profit, margin, discount, includeIva } = this.calculatorForm;

    if (!width || !height || !cost_price) {
      alert('Por favor, complete ancho, alto y precio costo.');
      return;
    }

    const orderArea = this.calculateOrderArea(width, height, format);

    // Calcular precio con utilidad
    const basePriceWithProfit = this.calculateBasePriceWithProfit(cost_price, width, height, format, profit);

    // Calcular precio con margen
    const priceWithMargin = this.calculatePriceWithMargin(cost_price, width, height, format, margin);

    // Calcular descuento
    const discountValue = this.calculateDiscount(cost_price, width, height, discount, format);

    // Calcular precio final sin IVA
    const finalPriceWithoutIva = this.calculateFinalPriceWithoutIva(cost_price, width, height, discount, format);

    // Calcular IVA
    const iva = this.calculateIva(cost_price, width, height, discount, format);

    // Calcular precio con IVA
    const finalPriceWithIva = this.calculatePriceWithIva(cost_price, width, height, discount, format);

    this.calculationResult = {
      orderArea,
      basePriceWithProfit,
      appliedMargin: margin / 100, // Mostrar como fracción para consistencia
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

import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';

interface Acrylic {
  id_acrylics: string;
  width: number;
  height: number;
  color: string;
  gauge: number;
  cost_price: number;
  created_at: string;
}

@Component({
  selector: 'app-acrylics',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent],
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
  selectedFormat: string = '1 Lámina'; // Valor inicial del formato
  loading = true;
  searchTerm: string = ''; // Nueva propiedad para el término de búsqueda

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  // Mapa de formatos a sus factores y márgenes
  private formatFactors: { [key: string]: { factor: number; margin: number } } = {
    '1 Lámina': { factor: 1, margin: 0 },
    '1/2 (Media Lámina)': { factor: 1/2, margin: 0.10 },
    '1/3 (Tercio de Lámina)': { factor: 1/3, margin: 0.42 },
    '1/4 (Cuarto de Lámina)': { factor: 1/4, margin: 0.30 },
    '1/8 (Octavo de Lámina)': { factor: 1/8, margin: 0.40 },
    '1/16 (Dieciseisavo de Lámina)': { factor: 1/16, margin: 0.45 },
    '1/32 (Treintaydosavo de Lámina)': { factor: 1/32, margin: 0.48 },
  };

  constructor(private readonly supabase: SupabaseService) {
    this.formAcrylic = { id_acrylics: '', width: 0, height: 0, color: '', gauge: 0, cost_price: 0, created_at: '' };
  }

  ngOnInit(): void {
    this.getAcrylicItems();
  }

  async getAcrylicItems(): Promise<void> {
    this.loading = true;
    const { data, error } = await this.supabase
      .from('acrylics')
      .select('*')
      .order('width', { ascending: true })
      .order('height', { ascending: true })
      .order('color', { ascending: true })
      .order('gauge', { ascending: true });

    if (error) {
      console.error('Error al obtener acrílicos:', error);
      alert ('Error al cargar los datos.');
      return;
    }
    this.acrylicItems = data || [];
    this.filteredAcrylicItems = [...this.acrylicItems];
    this.currentPage = 1; // Reiniciamos la página al cargar nuevos datos
    this.updatePaginatedAcrylicItems();
    this.loading = false;
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

  async saveAcrylic(): Promise<void> {
    if (!this.formAcrylic.width || !this.formAcrylic.height || !this.formAcrylic.color || !this.formAcrylic.gauge || this.formAcrylic.cost_price <= 0) {
      alert ('Por favor, complete todos los campos requeridos.');
      return;
    }

    try {
      if (this.selectedAcrylic) {
        // Actualizar acrílico existente
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
          alert ('Error al actualizar el acrílico.');
          return;
        }

        alert ('Acrílico actualizado correctamente.');
      } else {
        // Crear nuevo acrílico
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
          alert ('Error al crear el acrílico.');
          return;
        }

        alert ('Acrílico creado correctamente.');
      }

      this.closeModal();
      await this.getAcrylicItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert ('Ocurrió un error inesperado.');
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
        alert ('Error al eliminar el acrílico.');
        return;
      }

      alert ('Acrílico eliminado correctamente.');
      await this.getAcrylicItems();
    } catch (error) {
      console.error('Error inesperado:', error);
      alert ('Ocurrió un error inesperado.');
    }
  }

   // Precio con 30% de utilidad SIN ajustar por formato (equivalente a columna F del Excel)
   calculateBasePriceWith30PercentProfit(costPrice: number): number {
    return Math.ceil((costPrice * 1.3) / 100) * 100;
  }

  // Precio con 30% de utilidad ajustado por formato (equivalente a columna H del Excel)
  calculateAdjustedPriceWith30PercentProfit(costPrice: number): number {
    const basePrice = costPrice * 1.3;
    const factor = this.formatFactors[this.selectedFormat].factor;
    return Math.ceil((basePrice * factor) / 100) * 100;
  }

  getAppliedMargin(): number {
    return this.formatFactors[this.selectedFormat].margin;
  }

  calculatePriceWithMargin(adjustedPriceWithProfit: number): number {
    const margin = this.getAppliedMargin();
    return Math.ceil((adjustedPriceWithProfit * (1 + margin)) / 100) * 100;
  }

  calculateFinalPriceWithoutIva(priceWithMargin: number): number {
    return Math.ceil(priceWithMargin / 100) * 100;
  }

  calculateIva(finalPriceWithoutIva: number): number {
    return Math.ceil((finalPriceWithoutIva * 0.19) / 100) * 100;
  }

  calculatePriceWithIva(finalPriceWithoutIva: number, iva: number): number {
    return finalPriceWithoutIva + iva;
  }

  // Paginación
  updatePaginatedAcrylicItems(): void {
    // Filtramos los elementos según el término de búsqueda
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredAcrylicItems = this.acrylicItems.filter(acrylic =>
      acrylic.width.toString().includes(term) ||
      acrylic.height.toString().includes(term) ||
      acrylic.color.toLowerCase().includes(term) ||
      acrylic.gauge.toString().includes(term)
    );

    // Calculamos el total de páginas con los elementos filtrados
    const itemsPerPageNum = Number(this.itemsPerPage);
    this.totalPages = Math.max(1, Math.ceil(this.filteredAcrylicItems.length / itemsPerPageNum));

    // Aseguramos que currentPage esté dentro de los límites
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calculamos los índices de inicio y fin
    const startIndex = (this.currentPage - 1) * itemsPerPageNum;
    const endIndex = startIndex + itemsPerPageNum;

    // Actualizamos paginatedAcrylicItems con el subconjunto correcto
    this.paginatedAcrylicItems = this.filteredAcrylicItems.slice(startIndex, endIndex);
  }

  // Método para manejar cambios en el término de búsqueda
  onSearchChange(): void {
    this.currentPage = 1; // Reiniciamos la página al buscar
    this.updatePaginatedAcrylicItems();
  }
}


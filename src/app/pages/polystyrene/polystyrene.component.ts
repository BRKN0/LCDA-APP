import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

interface Polystyrene {
  id_polystyrene?: string;
  created_at?: string;
  type: string;
  caliber: string;
  whole: number;
}

@Component({
  selector: 'app-polystyrene',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './polystyrene.component.html',
  styleUrl: './polystyrene.component.scss',
})
export class PolystyreneComponent implements OnInit {
  polystyrenes: Polystyrene[] = [];
  filteredPolystyrenes: Polystyrene[] = [];
  paginatedPolystyrenes: Polystyrene[] = [];
  selectedPolystyrene!: Polystyrene;
  availableTypes: string[] = [];

  searchType: string = '';
  searchCaliber: string = '';
  selectedFormat: string = '1 Lámina';
  showModal = false;
  isEditing = false;
  loading = true;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  private formatFactors: { [key: string]: { factor: number; margin: number } } = {
    '1 Lámina': { factor: 1, margin: 0 },
    '1/2 (Media Lámina)': { factor: 1 / 2, margin: 0.1 },
    '1/3 (Tercio de Lámina)': { factor: 1 / 3, margin: 0.42 },
    '1/4 (Cuarto de Lámina)': { factor: 1 / 4, margin: 0.3 },
    '1/8 (Octavo de Lámina)': { factor: 1 / 8, margin: 0.4 },
    '1/16 (Dieciseisavo de Lámina)': { factor: 1 / 16, margin: 0.45 },
    '1/32 (Treintaydosavo de Lámina)': { factor: 1 / 32, margin: 0.48 },
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
  }

  async loadPolystyrenes(): Promise<void> {
    const { error, data } = await this.supabase.from('polystyrene').select('*');
    if (error) {
      console.error('Error cargando:', error);
      return;
    }

    this.polystyrenes = (data as Polystyrene[]).sort((a, b) => a.type.localeCompare(b.type));

    const typesSet = new Set<string>();
    this.polystyrenes.forEach(p => {
      if (p.type) typesSet.add(p.type.toLowerCase());
    });
    this.availableTypes = Array.from(typesSet).sort();

    this.updateFilteredPolystyrenes();
    this.loading = false;
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
  calculateBasePriceWith30PercentProfit(cost: number): number {
    return Math.ceil((cost * 1.3) / 100) * 100;
  }

  calculateAdjustedPriceWith30PercentProfit(cost: number): number {
    const factor = this.formatFactors[this.selectedFormat].factor;
    const basePrice = cost * 1.3;
    return Math.ceil((basePrice * factor) / 100) * 100;
  }

  getAppliedMargin(): number {
    return this.formatFactors[this.selectedFormat].margin;
  }

  calculatePriceWithMargin(adjustedPrice: number): number {
    return Math.ceil((adjustedPrice * (1 + this.getAppliedMargin())) / 100) * 100;
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
}

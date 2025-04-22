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
  half: number;
  quarter: number;
  an_eighth: number;
  one_sixteenth: number;
  one_thirty_second: number;
  gain_half?: number;
  gain_quarter?: number;
  gain_eighth?: number;
  gain_sixteenth?: number;
  gain_thirty_second?: number;
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
  showModal = false;
  isEditing = false;
  loading = true;

  gainHalf = 1.1;
  gainQuarter = 1.3;
  gainEighth = 1.4;
  gainSixteenth = 1.6;
  gainThirtySecond = 1.99;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  

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
    (this.polystyrenes as Polystyrene[]).forEach(p => {
      if (p.type) typesSet.add(p.type.toLowerCase()); // ignorar mayúsculas
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
      caliber: '',
      whole: 0,
      half: 0,
      quarter: 0,
      an_eighth: 0,
      one_sixteenth: 0,
      one_thirty_second: 0,
    };
    this.gainHalf = 1.1;
    this.gainQuarter = 1.3;
    this.gainEighth = 1.4;
    this.gainSixteenth = 1.6;
    this.gainThirtySecond = 1.99;
    this.isEditing = false;
    this.showModal = true;
  }

  editPolystyrene(item: Polystyrene): void {
    this.selectedPolystyrene = { ...item };
    this.gainHalf = item.gain_half ?? 1.1;
    this.gainQuarter = item.gain_quarter ?? 1.3;
    this.gainEighth = item.gain_eighth ?? 1.4;
    this.gainSixteenth = item.gain_sixteenth ?? 1.6;
    this.gainThirtySecond = item.gain_thirty_second ?? 1.99;
    this.isEditing = true;
    this.showModal = true;
  }

  async savePolystyrene(): Promise<void> {
    const itemToSave = { 
      type: this.selectedPolystyrene.type,
      caliber: this.selectedPolystyrene.caliber,
      whole: this.selectedPolystyrene.whole,
      half: this.round(this.selectedPolystyrene.whole / 2 * this.gainHalf),
      quarter: this.round(this.selectedPolystyrene.whole / 4 * this.gainQuarter),
      an_eighth: this.round(this.selectedPolystyrene.whole / 8 * this.gainEighth),
      one_sixteenth: this.round(this.selectedPolystyrene.whole / 16 * this.gainSixteenth),
      one_thirty_second: this.round(this.selectedPolystyrene.whole / 32 * this.gainThirtySecond),
      gain_half: this.gainHalf,
      gain_quarter: this.gainQuarter,
      gain_eighth: this.gainEighth,
      gain_sixteenth: this.gainSixteenth,
      gain_thirty_second: this.gainThirtySecond
     };

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

  round(value: number): number {
    return Math.round(value);
  }

  resetGains(): void {
    this.gainHalf = 1.1;
    this.gainQuarter = 1.3;
    this.gainEighth = 1.4;
    this.gainSixteenth = 1.6;
    this.gainThirtySecond = 1.99;
  }
}

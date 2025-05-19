import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

interface VinylCut {
  id?: string;
  created_at?: string;
  supplier: string;
  unds_mts: number;
  type: string;
  description: string;
  costXmt: number;
  saleXmt: number;
  linearCm: number;
}

@Component({
  selector: 'app-vinyl-cuts',
  standalone: true,
  imports: [MainBannerComponent, CommonModule, FormsModule, RouterOutlet],
  templateUrl: './vinyl-cuts.component.html',
  styleUrl: './vinyl-cuts.component.scss'
})
export class VinylCutsComponent {
  vinylCuts: VinylCut[] = [];
  filteredVinylCuts: VinylCut[] = [];
  paginatedVinylCuts: VinylCut[] = [];
  availableTypes: string[] = [];
  selectedVinylCut!: VinylCut;

  searchType: string = '';
  searchSupplier: string = '';
  showModal = false;
  isEditing = false;
  loading = true;

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
          this.loadVinylCuts();
        });
      }
    });
  }

  async loadVinylCuts(): Promise<void> {
    const { error, data } = await this.supabase.from('vinyl_cuts').select('*');
    if (error) {
      console.error('Error cargando:', error);
      return;
    }

    this.vinylCuts = (data as VinylCut[]).sort((a, b) => a.type.localeCompare(b.type));

    const typesSet = new Set<string>();
    this.vinylCuts.forEach(p => {
      if (p.type) typesSet.add(p.type.toLowerCase());
    });
    this.availableTypes = Array.from(typesSet).sort();

    this.updateFilteredVinylCuts();
    this.loading = false;
  }

  updateFilteredVinylCuts(): void {
    this.filteredVinylCuts = this.vinylCuts.filter((item) => {
      const matchesType = item.type?.toLowerCase().includes(this.searchType.toLowerCase());
      const matchesSupplier = item.supplier?.toLowerCase().includes(this.searchSupplier.toLowerCase());
      return matchesType && matchesSupplier;
    });
    this.currentPage = 1;
    this.updatePaginatedVinylCuts();
  }

  updatePaginatedVinylCuts(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredVinylCuts.length / this.itemsPerPage));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    this.paginatedVinylCuts = this.filteredVinylCuts.slice(startIndex, endIndex);
  }

  addVinylCut(): void {
    this.selectedVinylCut = {
      supplier: '',
      unds_mts: 0,
      type: '',
      description: '',
      costXmt: 0,
      saleXmt: 0,
      linearCm: 0
    };
    this.isEditing = false;
    this.showModal = true;
  }

  editVinylCut(item: VinylCut): void {
    this.selectedVinylCut = { ...item };
    this.isEditing = true;
    this.showModal = true;
  }

  async saveVinylCut(): Promise<void> {
    this.selectedVinylCut.linearCm = this.round(this.selectedVinylCut.saleXmt / 100);

    if (!this.selectedVinylCut.supplier || !this.selectedVinylCut.unds_mts || 
        !this.selectedVinylCut.type || !this.selectedVinylCut.description ||
        !this.selectedVinylCut.costXmt || !this.selectedVinylCut.saleXmt || 
        !this.selectedVinylCut.linearCm) {
      alert ('Por favor, complete todos los campos.');
      return;
    }

    const itemToSave = {
      supplier: this.selectedVinylCut.supplier,
      unds_mts: this.selectedVinylCut.unds_mts,
      type: this.selectedVinylCut.type,
      description: this.selectedVinylCut.description,
      costXmt: this.selectedVinylCut.costXmt,
      saleXmt: this.selectedVinylCut.saleXmt,
      linearCm: this.selectedVinylCut.linearCm
    };

    if (this.isEditing && this.selectedVinylCut.id) {
      const { error } = await this.supabase
        .from('vinyl_cuts')
        .update(itemToSave)
        .eq('id', this.selectedVinylCut.id);

      if (error) {
        console.error('Error actualizando:', error);
      } else {
        alert('Registro actualizado');
        this.loadVinylCuts();
      }
    } else {
      const { error } = await this.supabase
        .from('vinyl_cuts')
        .insert([itemToSave]);

      if (error) {
        console.error('Error añadiendo:', error);
      } else {
        alert('Registro añadido');
        this.loadVinylCuts();
      }
    }
    this.closeModal();
  }

  async deleteVinylCut(item: VinylCut): Promise<void> {
    if (confirm(`¿Eliminar el tipo ${item.type} del proveedor ${item.supplier}?`)) {
      const { error } = await this.supabase
        .from('vinyl_cuts')
        .delete()
        .eq('id', item.id);

      if (error) {
        console.error('Error eliminando:', error);
      } else {
        alert('Registro eliminado');
        this.loadVinylCuts();
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
}

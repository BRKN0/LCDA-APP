import { Component, OnInit, NgZone } from '@angular/core';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';

interface mdf {
  id_mdf: string;
  thickness: string;
  cost: number;
  freight: number;
  created_at: string;
}

@Component({
  selector: 'app-mdf',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent],
  templateUrl: './mdf.component.html',
  styleUrl: './mdf.component.scss'
})

export class MDFComponent implements OnInit {

  mdfItems: mdf[] = [];
  filteredMdfItems: mdf[] = []; // Para soportar filtros futuros
  paginatedMdfItems: mdf[] = []; // Para paginación
  selectedMdf: mdf | null = null;
  showModal: boolean = false;
  newMdf: mdf = { id_mdf: '', thickness: '', cost: 0, freight: 0, created_at: '' };
  formMdf: mdf; // Nueva propiedad para el formulario
  loading = true;
  searchTerm: string = ''; // Nueva propiedad para el término de búsqueda

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  constructor(private readonly supabase: SupabaseService) {this.formMdf = { ...this.newMdf };}

  ngOnInit(): void {
    this.getMdfItems();
  }

  async getMdfItems(): Promise<void> {
    this.loading = true;
    const { data, error } = await this.supabase
      .from('mdf')
      .select('*')
      .order('thickness', { ascending: true });

    if (error) {
      console.error('Error al obtener MDF:', error);
      alert ('Error al cargar los datos.');
      return;
    }
    this.mdfItems = data || [];
    this.filteredMdfItems = this.mdfItems; // Inicialmente, no hay filtros
    this.updatePaginatedMdfItems();
    this.loading = false;
  }

  // Modificar openModal para manejar formMdf
  openModal(mdf?: mdf): void {
    if (mdf) {
      this.selectedMdf = { ...mdf };
      this.formMdf = { ...mdf };
    } else {
      this.selectedMdf = null;
      this.formMdf = { id_mdf: '', thickness: '', cost: 0, freight: 0, created_at: '' };
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedMdf = null;
    this.formMdf = { id_mdf: '', thickness: '', cost: 0, freight: 0, created_at: '' };
  }

  async saveMdf(): Promise<void> {
    if (!this.formMdf.thickness || this.formMdf.cost <= 0 || this.formMdf.freight <= 0) {
      alert ('Por favor, complete todos los campos.');
      return;
    }

    try {
      if (this.selectedMdf) {
        // Actualizar MDF existente
        const { error } = await this.supabase
          .from('mdf')
          .update({
            thickness: this.formMdf.thickness,
            cost: this.formMdf.cost,
            freight: this.formMdf.freight,
          })
          .eq('id_mdf', this.selectedMdf.id_mdf);

        if (error) {
          console.error('Error al actualizar MDF:', error);
          alert ('Error al actualizar el MDF.');
          return;
        }

        alert('MDF actualizado correctamente.');
      } else {
        // Crear nuevo MDF
        const { error } = await this.supabase
          .from('mdf')
          .insert([
            {
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



  // Funciones para calcular los valores derivados
  calculateEntera25Percent(cost: number): number {
    return cost + cost * 0.25;
  }

  calculateEntera20Percent(enter25: number): number {
    return enter25 + enter25 * 0.2;
  }

  calculateEntera15Percent(enter20: number): number {
    return enter20 + enter20 * 0.15;
  }

  calculateMedia(enter25: number): number {
    return (enter25 / 2) * 1.15;
  }

  calculateOneThird(enter25: number): number {
    return (enter25 / 3) * 1.3;
  }

  calculateOneFourth(enter25: number): number {
    return (enter25 / 4) * 1.4;
  }

  calculateOneEighth30x180(enter25: number): number {
    return (enter25 / 8) * 1.6;
  }

  calculateOneEighth90x60(enter25: number): number {
    return (enter25 / 16) * 1.7;
  }

  calculateOneEighth30x45(enter25: number): number {
    return (enter25 / 32) * 1.9;
  }

  // Paginación
  updatePaginatedMdfItems(): void {
    // Filtramos los elementos según el término de búsqueda
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredMdfItems = this.mdfItems.filter(mdf =>
      mdf.thickness.toLowerCase().includes(term) ||
      mdf.cost.toString().includes(term) ||
      mdf.freight.toString().includes(term)
    );

    // Calculamos el total de páginas con los elementos filtrados
    const itemsPerPageNum = Number(this.itemsPerPage);
    this.totalPages = Math.max(1, Math.ceil(this.filteredMdfItems.length / itemsPerPageNum));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = (this.currentPage - 1) * itemsPerPageNum;
    const endIndex = startIndex + itemsPerPageNum;
    this.paginatedMdfItems = this.filteredMdfItems.slice(startIndex, endIndex);
  }

  // Método para manejar cambios en el término de búsqueda
  onSearchChange(): void {
    this.currentPage = 1; // Reiniciamos la página al buscar
    this.updatePaginatedMdfItems();
  }
}

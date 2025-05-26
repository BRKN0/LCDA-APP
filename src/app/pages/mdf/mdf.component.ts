import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface mdf {
  id_mdf: string;
  thickness: string;
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
  costPlusFreight: number;
  entera25?: number;
  entera20?: number;
  entera15?: number;
  media?: number;
  oneThird?: number;
  oneFourth?: number;
  oneEighth30x180?: number;
  oneEighth90x60?: number;
  oneEighth30x45?: number;
}

@Component({
  selector: 'app-mdf',
  standalone: true,
  imports: [CommonModule, FormsModule, MainBannerComponent, RouterOutlet],
  templateUrl: './mdf.component.html',
  styleUrl: './mdf.component.scss'
})

export class MDFComponent implements OnInit {
  mdfItems: mdf[] = [];
  filteredMdfItems: mdf[] = [];
  paginatedMdfItems: mdf[] = [];
  selectedMdf: mdf | null = null;
  showModal: boolean = false;
  newMdf: mdf = { id_mdf: '', thickness: '', cost: 0, freight: 0, created_at: '' };
  formMdf: mdf;
  loading = true;
  searchTerm: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  // Propiedades para la calculadora
  showCalculatorModal: boolean = false;
  calculatorForm: {
    thickness: string;
    cost: number;
    freight: number;
    cutType: string;
  };
  calculationResult: CalculationResult | null = null;
  clients: Client[] = [];
  filteredClients: Client[] = [];
  clientSearchQuery: string = '';
  showClientDropdown: boolean = false;
  selectedClient: Client | null = null;

  constructor(private readonly supabase: SupabaseService) {
    this.formMdf = { ...this.newMdf };
    this.calculatorForm = {
      thickness: '',
      cost: 0,
      freight: 0,
      cutType: 'Entera'
    };
  }

  ngOnInit(): void {
    this.getMdfItems();
    this.getClients();
  }

  async getMdfItems(): Promise<void> {
    this.loading = true;
    const { data, error } = await this.supabase
      .from('mdf')
      .select('*');

    if (error) {
      console.error('Error al obtener MDF:', error);
      alert('Error al cargar los datos.');
      return;
    }
    this.mdfItems = data || [];
    this.filteredMdfItems = [...this.mdfItems];
    this.applyCurrentSort();
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
    // No se aplican márgenes ni descuentos actualmente
  }

  hideClientDropdown(): void {
    setTimeout(() => {
      this.showClientDropdown = false;
    }, 200);
  }

  private applyCurrentSort(): void {
    this.filteredMdfItems.sort((a, b) => {
      const valueA = parseFloat(a.thickness);
      const valueB = parseFloat(b.thickness);
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applyCurrentSort();
    this.updatePaginatedMdfItems();
  }

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

  openCalculatorModal(): void {
    this.showCalculatorModal = true;
    this.calculatorForm = {
      thickness: '',
      cost: 0,
      freight: 0,
      cutType: 'Entera'
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

  calculateMdfValues(): void {
    if (!this.calculatorForm.cost || !this.calculatorForm.freight) {
      alert('Por favor, ingrese el costo y el flete.');
      return;
    }

    const cost = this.calculatorForm.cost;
    const freight = this.calculatorForm.freight;
    const costPlusFreight = cost + freight;
    const entera25 = this.calculateEntera25Percent(cost);

    const result: CalculationResult = {
      costPlusFreight
    };

    switch (this.calculatorForm.cutType) {
      case 'Entera':
        result.entera25 = entera25;
        result.entera20 = this.calculateEntera20Percent(entera25);
        result.entera15 = this.calculateEntera15Percent(result.entera20);
        break;
      case 'Media':
        result.media = this.calculateMedia(entera25);
        break;
      case '1/3':
        result.oneThird = this.calculateOneThird(entera25);
        break;
      case '1/4':
        result.oneFourth = this.calculateOneFourth(entera25);
        break;
      case '1/8 30x180':
        result.oneEighth30x180 = this.calculateOneEighth30x180(entera25);
        break;
      case '1/8 90x60':
        result.oneEighth90x60 = this.calculateOneEighth90x60(entera25);
        break;
      case '1/8 30x45':
        result.oneEighth30x45 = this.calculateOneEighth30x45(entera25);
        break;
    }

    this.calculationResult = result;
  }

  async saveMdf(): Promise<void> {
    if (!this.formMdf.thickness || this.formMdf.cost <= 0 || this.formMdf.freight <= 0) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      if (this.selectedMdf) {
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
          alert('Error al actualizar el MDF.');
          return;
        }

        alert('MDF actualizado correctamente.');
      } else {
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

  updatePaginatedMdfItems(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const filtered = this.mdfItems.filter(mdf =>
      mdf.thickness.toLowerCase().includes(term) ||
      mdf.cost.toString().includes(term) ||
      mdf.freight.toString().includes(term)
    );

    this.filteredMdfItems = [...filtered];
    this.applyCurrentSort();

    const itemsPerPageNum = Number(this.itemsPerPage);
    this.totalPages = Math.max(1, Math.ceil(this.filteredMdfItems.length / itemsPerPageNum));
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    const startIndex = (this.currentPage - 1) * itemsPerPageNum;
    const endIndex = startIndex + itemsPerPageNum;
    this.paginatedMdfItems = this.filteredMdfItems.slice(startIndex, endIndex);
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePaginatedMdfItems();
  }
}

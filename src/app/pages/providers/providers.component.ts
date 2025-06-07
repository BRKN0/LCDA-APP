import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import * as XLSX from 'xlsx';

interface Providers {
  id_provider: string;
  created_at: Date;
  company_name: string;
  name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address1: string;
  address2: string;
  neighborhood: string;
  city: string;
  department: string;
  postal_code: string;
  country: string;
  comment: string;
  document_type: string;
  document_number: string;
  provider_type: string;
  regimen: string;
  responsibility: string;
  declares: string;
}

@Component({
  selector: 'app-providers',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './providers.component.html',
  styleUrls: ['./providers.component.scss'],
})
export class ProvidersComponent implements OnInit {
  nameSearchQuery: string = '';
  filteredProviders: Providers[] = [];
  paginatedProviders: Providers[] = [];
  currentPage: number = 1;
  totalPages: number = 1;
  itemsPerPage: number = 10;
  document_types = [
    'NIT',
    'Registro Civil',
    'Tarjeta de Identidad',
    'Cedula de Ciudadania',
    'Tarjeta de Extranjeria',
    'Cedula de Extranjeria',
    'Pasaporte',
    'Documento de Identificacion Extranjero',
    'NIT de otro pais',
    'NUIP*',
  ];
  provider_types = ['Juridico', 'Natural'];
  provider_regimen = ['IVA', 'No responsable de IVA'];
  provider_responsibilities = [
    'Regimen Simple de Tributacion',
    'Gran Contribuyente',
    'Autorretenedor',
    'Agente de Retencion en el Impuesto sobre las Ventas (IVA)',
    'Otro',
  ];
  provider_declarations = [
    'Retencion en Compras',
    'Retencion por Servicios',
    'RETFUENTE - Retencion sobre Renta',
    'RETICA - Retencion sobre Renta',
  ];
  loading: boolean = true;
  providers: Providers[] = [];
  selectedProvider: Partial<Providers> = this.resetProvider();
  selectedProviderDetails: Providers | null = null;
  showModal: boolean = false;
  isEditing: boolean = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getProviders();
        });
      }
    });
  }
  async getProviders() {
    this.loading = true;
    const { data, error } = await this.supabase.from('providers').select(`*`);
    if (error) {
      console.error('Error fetching providers:', error);
      this.loading = false;
      return;
    }

    this.providers = data as Providers[];
    this.updateFilteredProviders();
    this.loading = false;
  }
  viewProviderDetails(provider: Providers): void {
    this.selectedProviderDetails = provider;
  }

  closeProviderDetails(): void {
    this.selectedProviderDetails = null;
  }
  addProvider() {
    this.isEditing = false;
    this.selectedProvider = this.resetProvider();
    this.showModal = true;
  }

  editProvider(provider: Providers) {
    this.isEditing = true;
    this.selectedProvider = { ...provider };
    this.showModal = true;
  }

  async saveProvider() {
    if (this.isEditing && this.selectedProvider.id_provider) {
      const { error } = await this.supabase
        .from('providers')
        .update(this.selectedProvider)
        .eq('id_provider', this.selectedProvider.id_provider);

      if (error) {
        console.error('Error updating provider:', error);
      }
    } else {
      const { error } = await this.supabase
        .from('providers')
        .insert([this.selectedProvider]);

      if (error) {
        console.error('Error adding provider:', error);
      }
    }
    this.showModal = false;
    this.getProviders();
  }

  async deleteProvider(provider: Providers) {
    if (!provider.id_provider) return;
    const confirmed = confirm(
      `¿Estás seguro de eliminar el proveedor "${provider.company_name}"?`
    );
    if (confirmed) {
      const { error } = await this.supabase
        .from('providers')
        .delete()
        .eq('id_provider', provider.id_provider);

      if (error) {
        console.error('Error deleting provider:', error);
      } else {
        this.getProviders();
      }
    }
  }

  closeModal() {
    this.showModal = false;
  }

  resetProvider(): Partial<Providers> {
    return {
      company_name: '',
      name: '',
      last_name: '',
      email: '',
      phone_number: '',
      document_type: '',
      document_number: '',
      provider_type: '',
    };
  }
  updateFilteredProviders() {
    this.filteredProviders = this.providers.filter(
      (provider) =>
        (provider.name ?? '')
          .toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase()) ||
        (provider.company_name ?? '')
          .toLowerCase()
          .includes(this.nameSearchQuery.toLowerCase())
    );
    this.updatePaginatedProviders();
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedProviders(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredProviders.length / this.itemsPerPage)
    );

    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    this.paginatedProviders = this.paginateItems(
      this.filteredProviders,
      this.currentPage,
      this.itemsPerPage
    );
  }
  // Exportar proveedores a Excel
  exportToExcel(): void {
    // Construye un array de objetos para exportar
    const exportData = this.providers.map((provider) => ({
      ID: provider.id_provider,
      FechaCreacion: provider.created_at,
      Empresa: provider.company_name,
      Nombre: provider.name,
      Apellido: provider.last_name,
      Email: provider.email,
      Telefono: provider.phone_number,
      Direccion1: provider.address1,
      Direccion2: provider.address2,
      Barrio: provider.neighborhood,
      Ciudad: provider.city,
      Departamento: provider.department,
      CodigoPostal: provider.postal_code,
      Pais: provider.country,
      Comentario: provider.comment,
      TipoDocumento: provider.document_type,
      NumeroDocumento: provider.document_number,
      TipoProveedor: provider.provider_type,
      Regimen: provider.regimen,
      Responsabilidad: provider.responsibility,
      Declaraciones: provider.declares,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proveedores');

    // Descarga el archivo
    XLSX.writeFile(workbook, 'proveedores.xlsx');
  }

  // Importar proveedores desde Excel
  importFromExcel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Procesar los datos e insertar en la base de datos
        jsonData.forEach(async (item) => {
          // Ajusta aquí los nombres de las columnas si es necesario
          const newProvider: Partial<Providers> = {
            company_name: item['Empresa'] || '',
            name: item['Nombre'] || '',
            last_name: item['Apellido'] || '',
            email: item['Email'] || '',
            phone_number: item['Telefono'] || '',
            address1: item['Direccion1'] || '',
            address2: item['Direccion2'] || '',
            neighborhood: item['Barrio'] || '',
            city: item['Ciudad'] || '',
            department: item['Departamento'] || '',
            postal_code: item['CodigoPostal'] || '',
            country: item['Pais'] || '',
            comment: item['Comentario'] || '',
            document_type: item['TipoDocumento'] || '',
            document_number: item['NumeroDocumento'] || '',
            provider_type: item['TipoProveedor'] || '',
            regimen: item['Regimen'] || '',
            responsibility: item['Responsabilidad'] || '',
            declares: item['Declaraciones'] || '',
          };

          try {
            const { error } = await this.supabase
              .from('providers')
              .insert([newProvider]);
            if (error) {
              console.error('Error al importar proveedor:', error);
            }
          } catch (err) {
            console.error('Error inesperado al importar:', err);
          }
        });

        // Recargar la lista de proveedores
        this.getProviders();
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }
}

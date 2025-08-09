import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import * as XLSX from 'xlsx';

interface ThirdParty {
  id: string;
  created_at: Date;
  company_name: string;
  nit: string;
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
  cta_contable_expenses: string;
  cta_contable_to_pay: string;
}

@Component({
  selector: 'app-third-parties',
  imports: [
    CommonModule,
    MainBannerComponent,
    FormsModule,
    RouterOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './third-parties.component.html',
  styleUrl: './third-parties.component.scss',
})
export class ThirdPartiesComponent implements OnInit {
  nameSearchQuery: string = '';
  partyForm!: FormGroup;
  filteredParties: ThirdParty[] = [];
  paginatedParties: ThirdParty[] = [];
  currentPage: number = 1;
  totalPages: number = 1;
  itemsPerPage: number = 10;
  loading: boolean = true;
  parties: ThirdParty[] = [];
  selectedParty: Partial<ThirdParty> = this.resetParty();
  selectedPartyDetails: ThirdParty | null = null;
  showModal: boolean = false;
  isEditing: boolean = false;

  optionalFields = [
    'nit',
    'email',
    'phone_number',
    'address1',
    'address2',
    'neighborhood',
    'city',
    'department',
    'postal_code',
    'country',
    'comment',
    'cta_contable_expenses',
    'cta_contable_to_pay',
  ];

  colombianDepartments: string[] = [
    'Amazonas',
    'Antioquia',
    'Arauca',
    'Atlántico',
    'Bolívar',
    'Boyacá',
    'Caldas',
    'Caquetá',
    'Casanare',
    'Cauca',
    'Cesar',
    'Chocó',
    'Córdoba',
    'Cundinamarca',
    'Guainía',
    'Guaviare',
    'Huila',
    'La Guajira',
    'Magdalena',
    'Meta',
    'Nariño',
    'Norte de Santander',
    'Putumayo',
    'Quindío',
    'Risaralda',
    'San Andrés y Providencia',
    'Santander',
    'Sucre',
    'Tolima',
    'Valle del Cauca',
    'Vaupés',
    'Vichada',
  ];

  colombianCities: string[] = [
    'Bogotá',
    'Medellín',
    'Cali',
    'Barranquilla',
    'Cartagena',
    'Cúcuta',
    'Bucaramanga',
    'Pereira',
    'Santa Marta',
    'Ibagué',
    'Manizales',
    'Villavicencio',
    'Neiva',
    'Armenia',
    'Montería',
    'Pasto',
    'Sincelejo',
    'Popayán',
    'Valledupar',
    'Tunja',
  ];
  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: RouterOutlet,
    private readonly fb: FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.initForm();
          this.getParties();
        });
      }
    });
  }
  async getParties() {
    this.loading = true;
    const { data, error } = await this.supabase
      .from('thirdparties')
      .select(`*`);
    if (error) {
      console.error('Error fetching third parties:', error);
      this.loading = false;
      return;
    }
    this.parties = (data ?? []).sort((a, b) =>
      a.company_name.localeCompare(b.company_name)
    );
    this.updateFilteredParties();
    this.loading = false;
  }

  viewPartyDetails(party: ThirdParty): void {
    this.selectedPartyDetails = party;
  }
  closePartyDetails(): void {
    this.selectedPartyDetails = null;
  }
  addParty() {
    this.isEditing = false;
    this.selectedParty = this.resetParty();
    this.showModal = true;
  }
  initForm(party?: ThirdParty) {
    this.partyForm = this.fb.group({
      id: [party?.id ?? null], // 👈 asegúrate de incluir esto
      company_name: [party?.company_name || '', Validators.required],
      nit: [party?.nit || ''],
      email: [party?.email || ''],
      phone_number: [party?.phone_number || ''],
      address1: [party?.address1 || ''],
      address2: [party?.address2 || ''],
      neighborhood: [party?.neighborhood || ''],
      city: [party?.city || ''],
      department: [party?.department || ''],
      postal_code: [party?.postal_code || ''],
      country: [party?.country || 'Colombia'],
      comment: [party?.comment || ''],
      cta_contable_expenses: [party?.cta_contable_expenses || ''],
      cta_contable_to_pay: [party?.cta_contable_to_pay || ''],
    });
  }
  editParty(party: ThirdParty) {
    this.isEditing = true;
    this.partyForm.reset();
    this.partyForm.patchValue(party);
    this.initForm(party);
    this.showModal = true;
  }
  async saveParty() {
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      return;
    }
    const data: ThirdParty = this.partyForm.value;
    if (this.isEditing && this.selectedParty.id != '') {
      const { error } = await this.supabase
        .from('thirdparties')
        .update(data)
        .eq('id', data.id);
      if (error) {
        console.error('Error updating third party:', error);
        return;
      }
    } else {
      const { error } = await this.supabase.from('thirdparties').insert(data);

      if (error) {
        console.error('Error adding third party:', error);
        return;
      }
    }

    this.showModal = false;
    this.getParties();
  }
  async deleteParty(party: ThirdParty) {
    if (!party.id) return;
    const confirmed = confirm(
      `¿Estás seguro de eliminar el tercero "${party.company_name}"?`
    );
    if (confirmed) {
      const { error } = await this.supabase
        .from('thirdparties')
        .delete()
        .eq('id', party.id);

      if (error) {
        console.error('Error deleting third party:', error);
      } else {
        this.getParties();
      }
    }
  }
  closeModal() {
    this.showModal = false;
  }
  resetParty(): Partial<ThirdParty> {
    return {
      company_name: '',
      nit: '',
      email: '',
      phone_number: '',
      address1: '',
      address2: '',
      neighborhood: '',
      city: '',
      department: '',
      postal_code: '',
      country: '',
      comment: '',
      cta_contable_expenses: '',
      cta_contable_to_pay: '',
    };
  }
  updateFilteredParties() {
    this.filteredParties = this.parties.filter((party) =>
      (party.company_name ?? '')
        .toLowerCase()
        .includes(this.nameSearchQuery.toLowerCase())
    );
    this.updatePaginatedParties();
  }
  clearFilters(): void {
    this.nameSearchQuery = '';
    this.updateFilteredParties();
  }
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }
  updatePaginatedParties(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredParties.length / this.itemsPerPage)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    this.paginatedParties = this.paginateItems(
      this.filteredParties,
      this.currentPage,
      this.itemsPerPage
    );
  }
  exportToExcel(): void {
    const exportData = this.parties.map((party) => ({
      ID: party.id,
      FechaCreacion: party.created_at,
      Empresa: party.company_name,
      NIT: party.nit,
      Email: party.email,
      Telefono: party.phone_number,
      Direccion1: party.address1,
      Direccion2: party.address2,
      Barrio: party.neighborhood,
      Ciudad: party.city,
      Departamento: party.department,
      CodigoPostal: party.postal_code,
      Pais: party.country,
      Comentario: party.comment,
      CtaContableGasto: party.cta_contable_expenses,
      CtaContablePagar: party.cta_contable_to_pay,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terceros');
    XLSX.writeFile(workbook, 'terceros.xlsx');
  }
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

        jsonData.forEach(async (item) => {
          const newParty: Partial<ThirdParty> = {
            company_name: item['Empresa'] || '',
            nit: item['NIT'] || '',
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
            cta_contable_expenses: item['Cta Contable Gastos'] || '',
            cta_contable_to_pay: item['Cta Contable a Pagar'] || '',
          };

          try {
            const { error } = await this.supabase
              .from('thirdparties')
              .insert([newParty]);
            if (error) {
              console.error('Error al importar tercero:', error);
            }
          } catch (err) {
            console.error('Error inesperado al importar:', err);
          }
        });

        this.getParties();
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }
}

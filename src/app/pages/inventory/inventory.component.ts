import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

interface InventoryItem {
  id_material: string;
  category: string;
  type: string;
  caliber: string;
  material_quantity: number;
  color: string;
  code: number;
  cost: number;
  sale_price: number;
  status: string;
   // new fields
  standard_size?: string;   // '120x180', '130x190', ...
  custom_width?: number;
  custom_height?: number;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  isComparing: boolean = false;
  isEditing: boolean = false;
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  materialStatus = [
    { value: 'out', label: 'Fuera de Stock'},
    { value: 'low', label: 'Stock Bajo'},
    { value: 'ok', label: 'En Stock'},
  ]
  selectedItem: InventoryItem = {
    id_material: '',
    category: '',
    type: '',
    caliber: '',
    material_quantity: 0,
    color: '',
    code: 0,
    cost: 0,
    sale_price: 0,
    status: '',
    standard_size: '',
    custom_width: 0,
    custom_height: 0
  };
  loading = true;
  comparisonResult: any[] = [];
  showModal = false;

  selectedCategory: string = '';
  newCategory = '';

  selectedType: string = '';
  newType = '';

  categoryFeedback = '';
  categoryMode: 'select' | 'create' = 'select';
  typeFeedback = '';
  typeMode: 'select' | 'create' = 'select';

  filterCategory: string = '';
  searchCode: string = '';
  searchType: string = '';
  noResultsFound: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedInventory: InventoryItem[] = []; // Lista paginada

  selectedStandardSize = ''; // empty = custom

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.getInventory();
        });
      }
    });
  }

  async getInventory() {
    this.loading = true;
    const { data, error } = await this.supabase.from('materials').select('*');

    if (error) {
      console.error('Error fetching inventory:', error);
      this.loading = false;
      return;
    }

    this.inventory = data as InventoryItem[];
    // sorting materials by code
    this.inventory.sort((a, b) => b.code - a.code);
    this.updateFilteredInventory();
    this.loading = false;
  }

  normalizeCategory() {
    if (!this.selectedItem.category) return;
    this.selectedItem.category = this.selectedItem.category
      .trim()
      .toLowerCase();
  }

  getUniqueCategories(): string[] {
    return Array.from(
      new Set(
        this.inventory
          .map(i => i.category)
          .filter(c => !!c)
      )
    ).sort();
  }

  confirmNewCategory() {
    if (!this.newCategory) return;

    const normalized = this.newCategory.trim().toUpperCase();
    
    this.selectedCategory = normalized;
    this.selectedItem.category = normalized;
    this.categoryFeedback = `Categoría "${normalized}" seleccionada`;

    setTimeout(() => {
      this.categoryFeedback = '';
    }, 2000);
  }

  backToCategorySelect() {
    this.categoryMode = 'select';
    this.newCategory = '';
  }

  getUniqueTypes(): string[] {
    return Array.from(
      new Set(
        this.inventory
          .map(i => i.type)
          .filter(c => !!c)
      )
    ).sort();
  }

  confirmNewType() {
    if (!this.newType) return;

    const normalized = this.newType.trim().toUpperCase();
    
    this.selectedType = normalized;
    this.selectedItem.type = normalized;
    this.typeFeedback = `Tipo "${normalized}" seleccionado`;

    setTimeout(() => {
      this.typeFeedback = '';
    }, 2000);
  }

  backToTypeSelect() {
    this.typeMode = 'select';
    this.newType = '';
  }

  updateFilteredInventory(): void {

    this.filteredInventory = this.inventory.filter((item) => {
      const matchesCode = item.code.toString().includes(this.searchCode);
      const matchesType = item.type
        ?.toLowerCase()
        .includes(this.searchType.toLowerCase());

      const matchesCategory =
        !this.filterCategory || item.category === this.filterCategory;

      return matchesCode && matchesType && matchesCategory;
    });

    this.noResultsFound = this.filteredInventory.length === 0;
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedInventory(); // Actualizar la lista paginada
  }

  toggleDetails(item: InventoryItem): void {
    this.selectedItem =
      this.selectedItem === item
        ? {
            id_material: '',
            category: '',
            type: '',
            caliber: '',
            material_quantity: 0,
            color: '',
            code: 0,
            cost: 0,
            sale_price: 0,
            status: '',
            standard_size: '',
            custom_width: 0,
            custom_height: 0
          }
        : item;
  }
  getMaterialStatusLabel(type: string | null): string {
    const found = this.materialStatus.find(r => r.value === type);
    if (found) return found.label;
    return 'Desconocido';
  }
  generateKardex(): void {
    const currentDate = new Date().toISOString().split('T')[0];
    const csvHeader = [
      'Código',
      'Categoría',
      'Tipo',
      'Calibre',
      'Cantidad',
      'Color',
      'Costo',
      'Precio de Venta',
      'Saldo',
      'Fecha',
    ];

    const csvRows = this.filteredInventory.map((item) => {
      const saldo = item.sale_price * item.material_quantity;
      return [
        item.code,
        item.category || 'Sin Categoría',
        item.type || 'Sin Tipo',
        item.caliber || 'Sin Calibre',
        item.material_quantity,
        item.color || 'Sin Color',
        item.cost.toFixed(2),
        item.sale_price.toFixed(2),
        saldo.toFixed(2),
        currentDate,
      ].map((value) => `"${value}"`);
    });

    const csvContent = [csvHeader, ...csvRows]
      .map((row) => row.join(';'))
      .join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `kardex_${currentDate}.csv`;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  openComparisonModal(): void {
    this.isComparing = true;
    this.showModal = true;
    this.clearComparison();
  }

  compareCSV(): void {
    const file1 = (document.getElementById('file1') as HTMLInputElement)
      .files?.[0];
    const file2 = (document.getElementById('file2') as HTMLInputElement)
      .files?.[0];

    if (!file1 || !file2) {
      alert('Por favor, selecciona ambos archivos CSV.');
      return;
    }

    const readCSV = (file: File): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const rows = text.split('\r\n').filter((row) => row.trim() !== '');
          const headers = rows[0]
            .split(';')
            .map((header) => header.replace(/"/g, ''));
          const data = rows.slice(1).map((row) => {
            const values = row
              .split(';')
              .map((value) => value.replace(/"/g, ''));
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index];
              return obj;
            }, {} as Record<string, any>);
          });
          resolve(data);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file, 'UTF-8');
      });
    };

    Promise.all([readCSV(file1), readCSV(file2)])
      .then(([data1, data2]) => {
        this.comparisonResult = this.compareData(data1, data2);
      })
      .catch((error) => {
        console.error('Error leyendo los archivos CSV:', error);
        alert('Hubo un error al procesar los archivos CSV.');
      });
  }

  closeComparisonModal(): void {
    this.clearComparison();
    this.showModal = false;
    this.isComparing = false;
  }

  clearComparison(): void {
    this.comparisonResult = [];
    (document.getElementById('file1') as HTMLInputElement).value = '';
    (document.getElementById('file2') as HTMLInputElement).value = '';
  }

  compareData(data1: any[], data2: any[]): any[] {
    const results: any[] = [];

    const map1 = new Map(data1.map((item) => [item['Código'], item]));
    const map2 = new Map(data2.map((item) => [item['Código'], item]));

    const allCodes = new Set([...map1.keys(), ...map2.keys()]);

    allCodes.forEach((code) => {
      const product1 = map1.get(code);
      const product2 = map2.get(code);

      if (product1 && product2) {
        if (product1['Cantidad'] !== product2['Cantidad']) {
          results.push({
            product: code,
            change: 'Cambio en Cantidad',
            detail: `Antes: ${product1['Cantidad']}, Ahora: ${product2['Cantidad']}`,
          });
        }
        if (product1['Precio de Venta'] !== product2['Precio de Venta']) {
          results.push({
            product: code,
            change: 'Cambio en Precio de Venta',
            detail: `Antes: ${product1['Precio de Venta']}, Ahora: ${product2['Precio de Venta']}`,
          });
        }
        if (product1['Costo'] !== product2['Costo']) {
          results.push({
            product: code,
            change: 'Cambio en Costo',
            detail: `Antes: ${product1['Costo']}, Ahora: ${product2['Costo']}`,
          });
        }
      } else if (product1 && !product2) {
        results.push({
          product: code,
          change: 'Producto Eliminado',
          detail: 'El producto ya no está en el inventario actual',
        });
      } else if (!product1 && product2) {
        results.push({
          product: code,
          change: 'Producto Nuevo',
          detail: 'El producto fue añadido al inventario actual',
        });
      }
    });

    if (results.length === 0) {
      results.push({
        product: 'N/A',
        change: 'Sin cambios',
        detail: 'No se detectaron modificaciones en los archivos comparados.'
      });
    }

    return results;
  }

  getDetailColor(change: string): string {
    if (
      change.includes('Cambio en Cantidad') ||
      change.includes('Cambio en Costo') ||
      change.includes('Cambio en Precio de Venta')
    ) {
      return 'orange';
    }
    if (change.includes('Producto Eliminado')) {
      return 'red';
    }
    if (change.includes('Producto Nuevo')) {
      return 'green';
    }
    return 'black';
  }

  addNewItem(): void {
    this.selectedItem = {
      id_material: '',
      category: '',
      type: '',
      caliber: '',
      material_quantity: 0,
      color: '',
      code: 0,
      cost: 0,
      sale_price: 0,
      status: '',
      standard_size: '',
      custom_width: 0,
      custom_height: 0,
    };
    this.isEditing = false; // Indicar que no estamos editando
    this.showModal = true; // Mostrar el modal
    this.selectedStandardSize = '';
    this.categoryMode = 'select';
    this.typeMode = 'select';
    this.selectedCategory = '';
    this.newCategory = '';
    this.selectedType = '';
    this.newType = '';
  }

  editItem(item: InventoryItem): void {
    this.selectedItem = { ...item };
    this.selectedCategory = item.category;
    this.selectedType = item.type;
    this.selectedStandardSize = item.standard_size || ''
    // Si NO hay estándar, fuerza la vista “Personalizada” y carga los números
    if (!this.selectedStandardSize) {
      this.selectedStandardSize = ''; // activa la sección *ngIf
    }
    this.isEditing = true; // Indicar que estamos editando
    this.showModal = true; // Mostrar el modal
  }

  saveItem(): void {
    this.selectedItem.category = this.selectedCategory;
    this.selectedItem.type = this.selectedType;

    if (!this.selectedItem) return;

    if (!this.selectedItem.category) {
      alert('Por favor, digite la categoria del producto.');
      return;
    }

    if (!this.selectedItem.cost) {
      alert('Por favor, digite el costo del producto.');
      return;
    }

    if (this.selectedStandardSize) {
      const [w, h] = this.selectedStandardSize.split('x').map(Number);
      this.selectedItem.custom_width  = w;
      this.selectedItem.custom_height = h;
      this.selectedItem.standard_size = this.selectedStandardSize;
    } else {
      this.selectedItem.standard_size = 'custom';
    }

    const itemToSave = {
      category: this.selectedCategory,
      type: this.selectedType,
      caliber: this.selectedItem.caliber,
      material_quantity: this.selectedItem.material_quantity,
      color: this.selectedItem.color,
      cost: this.selectedItem.cost,
      sale_price: this.selectedItem.sale_price,
      status: this.selectedItem.status,
      standard_size: this.selectedItem.standard_size,
      custom_width: this.selectedItem.custom_width,
      custom_height: this.selectedItem.custom_height,
    };

    if (this.selectedItem.id_material) {
      // Actualizar
      this.supabase
        .from('materials')
        .update(itemToSave)
        .eq('id_material', this.selectedItem.id_material)
        .then(({ error }) => {
          if (error) {
            console.error('Error actualizando:', error);
          } else {
            alert('Artículo actualizado');
            this.getInventory();
          }
          this.closeModal();
        });
    } else {
      // Crear nuevo
      this.supabase
        .from('materials')
        .insert([itemToSave])
        .then(({ error }) => {
          if (error) {
            console.error('Error añadiendo:', error);
          } else {
            alert('Artículo añadido');
            this.getInventory();
          }
          this.closeModal();
        });
    }
  }

  deleteItem(item: InventoryItem): void {
    if (confirm(`¿Eliminar el artículo con código ${item.code}?`)) {
      this.supabase
        .from('materials')
        .delete()
        .eq('id_material', item.id_material)
        .then(({ error }) => {
          if (error) {
            console.error('Error eliminando:', error);
          } else {
            alert('Artículo eliminado');
            this.getInventory();
          }
        });
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.isComparing = false;
    this.isEditing = false; // Resetear el estado de edición
  }

  filterInventory(): void {
    this.filteredInventory = this.inventory.filter((item) => {
      const matchesCode = item.code.toString().includes(this.searchCode);
      const matchesType = item.type
        ?.toLowerCase()
        .includes(this.searchType.toLowerCase());

      return matchesCode && matchesType;
    });

    this.noResultsFound = this.filteredInventory.length === 0;
    this.currentPage = 1;
    this.updatePaginatedInventory();
  }

  clearFilters(): void {
    this.searchCode = '';
    this.searchType = '';
    this.filterCategory = '';
    this.updateFilteredInventory();
  }

  //Paginacion
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedInventory(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredInventory.length / this.itemsPerPage)
    );

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedInventory = this.filteredInventory.slice(
      startIndex,
      endIndex
    );
  }
}

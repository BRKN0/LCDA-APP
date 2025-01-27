import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';

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
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  isComparing: boolean = false;
  isEditing: boolean = false;
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
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
  };
  loading = true;
  comparisonResult: any[] = [];
  showModal = false;

  showVinyls = true;
  showCutVinyls = true;
  showAcrylic = true;
  showPolystyrene = true;
  showDieCut = true;
  showMDF = true;

  searchCode: string = '';
  searchCategory: string = '';
  noResultsFound: boolean = false;

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
    this.updateFilteredInventory();
    this.loading = false;
  }

  updateFilteredInventory(): void {
    this.filteredInventory = this.inventory.filter(item => {
      const matchesCode = item.code.toString().includes(this.searchCode);
      const matchesCategory = item.category?.toLowerCase().includes(this.searchCategory.toLowerCase());
      const normalizedCategory = (item.category || '').trim().toLowerCase();
      const categoryMatchesCheckboxes =
        (this.showVinyls && normalizedCategory === 'vinilo') ||
        (this.showCutVinyls && normalizedCategory === 'vinilo de corte') ||
        (this.showAcrylic && normalizedCategory === 'acrilico') ||
        (this.showPolystyrene && normalizedCategory === 'poliestireno') ||
        (this.showDieCut && normalizedCategory === 'troquelado') ||
        (this.showMDF && normalizedCategory === 'mdf');

      return matchesCode && matchesCategory && categoryMatchesCheckboxes;
    });
  }

  toggleDetails(item: InventoryItem): void {
    this.selectedItem = this.selectedItem === item ? {
      id_material: '',
      category: '',
      type: '',
      caliber: '',
      material_quantity: 0,
      color: '',
      code: 0,
      cost: 0,
      sale_price: 0,
      status: ''
    } : item;
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
      'Fecha'
    ];

    const csvRows = this.filteredInventory.map(item => {
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
        currentDate
      ].map(value => `"${value}"`);
    });

    const csvContent = [csvHeader, ...csvRows]
      .map(row => row.join(';'))
      .join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
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
    const file1 = (document.getElementById('file1') as HTMLInputElement).files?.[0];
    const file2 = (document.getElementById('file2') as HTMLInputElement).files?.[0];

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
          const headers = rows[0].split(';').map((header) => header.replace(/"/g, ''));
          const data = rows.slice(1).map((row) => {
            const values = row.split(';').map((value) => value.replace(/"/g, ''));
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
      code: Date.now(), // Usamos timestamp como código temporal
      cost: 0,
      sale_price: 0,
      status: ''
    };
    this.isEditing = false; // Indicar que no estamos editando
    this.showModal = true;  // Mostrar el modal
  }

  editItem(item: InventoryItem): void {
    this.selectedItem = { ...item };
    this.isEditing = true; // Indicar que estamos editando
    this.showModal = true;  // Mostrar el modal
  }

  saveItem(): void {
    if (!this.selectedItem) return;

    const itemToSave = {
      category: this.selectedItem.category,
      type: this.selectedItem.type,
      caliber: this.selectedItem.caliber,
      material_quantity: this.selectedItem.material_quantity,
      color: this.selectedItem.color,
      cost: this.selectedItem.cost,
      sale_price: this.selectedItem.sale_price,
      status: this.selectedItem.status
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
  this.filteredInventory = this.inventory.filter(item => {
    const matchesCode = item.code.toString().includes(this.searchCode);
    const matchesCategory = item.category?.toLowerCase().includes(this.searchCategory.toLowerCase());

    return matchesCode && matchesCategory;
  });

  this.noResultsFound = this.filteredInventory.length === 0;
}
}






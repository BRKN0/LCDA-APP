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
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  selectedItem: InventoryItem | null = null;
  loading = true;

  showVinyls = true;
  showCutVinyls = true;
  showAcrylic = true;
  showPolystyrene = true;
  showDieCut = true;
  showMDF = true;

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
    if (
      !this.showVinyls &&
      !this.showCutVinyls &&
      !this.showAcrylic &&
      !this.showPolystyrene &&
      !this.showDieCut &&
      !this.showMDF
    ) {
      this.filteredInventory = [];
      return;
    }

    this.filteredInventory = this.inventory.filter((item) => {
      const normalizedCategory = (item.category || '').trim().toLowerCase();

      return (
        (this.showVinyls && normalizedCategory === 'vinilo') ||
        (this.showCutVinyls && normalizedCategory === 'vinilo de corte') ||
        (this.showAcrylic && normalizedCategory === 'acrilico') ||
        (this.showPolystyrene && normalizedCategory === 'poliestireno') ||
        (this.showDieCut && normalizedCategory === 'troquelado') ||
        (this.showMDF && normalizedCategory === 'mdf')
      );
    });
  }

  toggleDetails(item: InventoryItem) {
    this.selectedItem = this.selectedItem === item ? null : item;
  }
}






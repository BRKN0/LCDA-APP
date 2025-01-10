import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';

interface InventoryItem {
  id_material: string;
  category: string;
  type: string;
  caliber: string;
  material_quantity: number;
  color: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MainBannerComponent],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  inventory: InventoryItem[] = [];
  selectedItem: InventoryItem | null = null;
  loading = true;

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
    const { data, error } = await this.supabase
      .from('materials')
      .select('*');

    if (error) {
      console.error('Error fetching inventory:', error);
      this.loading = false;
      return;
    }

    this.inventory = data as InventoryItem[];
    this.loading = false;
  }

  toggleDetails(item: InventoryItem) {
    this.selectedItem = this.selectedItem === item ? null : item;
  }
}





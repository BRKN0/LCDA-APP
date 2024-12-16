import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MainBannerComponent } from '../main-banner/main-banner.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, MainBannerComponent],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent {

  constructor(private readonly router: Router) {}

  goToHome() {
    this.router.navigate(['/']); // Redirect to root route
  }

  materials = [
    'Acrilico',
    'Poliestireno',
    'Vinilo',
    'Vinilo de corte',
    'MDF',
    'Troquelado'
  ];

  materialDetails: Record<string, { tipo: string; cantidad: number; precio: number; color: string }[]> = {
    Acrilico: [
      { tipo: 'Transparente', cantidad: 5, precio: 10.5, color: 'Claro' },
      { tipo: 'Opaco', cantidad: 3, precio: 12.0, color: 'Blanco' },
      { tipo: 'Texturizado', cantidad: 2, precio: 15.0, color: 'Negro' }
    ],
    Vinilo: [
      { tipo: 'Adhesivo', cantidad: 10, precio: 5.0, color: 'Rojo' },
      { tipo: 'Imprimible', cantidad: 8, precio: 7.5, color: 'Azul' },
      { tipo: 'Reflectante', cantidad: 6, precio: 12.0, color: 'Amarillo' }
    ],
    Poliestireno: [
      { tipo: 'Cristal', cantidad: 12, precio: 6.0, color: 'Blanco' },
      { tipo: 'Alto Impacto', cantidad: 24, precio: 134.5, color: 'Naranja' },
      { tipo: 'Expandido', cantidad: 48, precio: 89.0, color: 'Gris' }
    ],
    'Vinilo de corte': [
      { tipo: 'Opaco', cantidad: 13, precio: 34.0, color: 'Marron' },
      { tipo: 'Translucido', cantidad: 26, precio: 55.5, color: 'Negro' },
      { tipo: 'Reflectante', cantidad: 80, precio: 71.0, color: 'Verde' }
    ],
    Troquelado: [
      { tipo: 'Plano', cantidad: 16, precio: 66.0, color: 'Azul' },
      { tipo: 'Rotativo', cantidad: 37, precio: 42.5, color: 'Rosado' },
      { tipo: 'Simple', cantidad: 2, precio: 20, color: 'Rojo Metalizado' }
    ],
    MDF: [
      { tipo: 'Estandar', cantidad: 78, precio: 63.0, color: 'Blanco' },
      { tipo: 'Hidrófugo o RH', cantidad: 200, precio: 38.5, color: 'Verde' },
      { tipo: 'Ignífugo', cantidad: 69, precio: 90.5, color: 'Morado' }
    ],
    // If you want to add more materials with their details write here using the same structure
  };

  selectedMaterialDetails: { tipo: string; cantidad: number; precio: number; color: string }[] | null = null;

  selectMaterial(material: string) {
    this.selectedMaterialDetails = this.materialDetails[material] || null;
  }
}

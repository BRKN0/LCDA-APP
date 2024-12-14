import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { InventoryComponent } from './inventory/inventory.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => LoginComponent,
  },
  {
    path: 'inventory',
    loadComponent: () => InventoryComponent,
  }
];

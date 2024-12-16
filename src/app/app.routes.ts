import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => LoginComponent,
  },
  {
    path: 'inventory',
    loadComponent: () => InventoryComponent,
  },
  {
    path: 'home',
    loadComponent: () => HomeComponent,
  },
];

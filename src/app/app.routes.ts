import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { HomeComponent } from './pages/home/home.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { InvoiceComponent } from './pages/invoice/invoice.component';
import { ExpensesComponent } from './pages/expenses/expenses.component';
import { BankingComponent } from './pages/banking/banking.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => LoginComponent,
    pathMatch: 'full',
  },
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
  {
    path: 'clients',
    loadComponent: () => ClientsComponent,
  },
  {
    path: 'orders',
    loadComponent: () => OrdersComponent,
  },
  { path: 'invoice',
    loadComponent: () => InvoiceComponent,
  },
  {
    path: 'expenses',
    loadComponent: () => ExpensesComponent,
  },
  {
    path: 'banking',
    loadComponent: () => BankingComponent,
  },
  {
    path: 'notifications',
    loadComponent: () => NotificationsComponent,
  }
];

import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { ProductComponent } from './pages/product/product.component';
import { AcrylicsComponent } from './pages/acrylics/acrylics.component';
import { MDFComponent } from './pages/mdf/mdf.component';
import { PolystyreneComponent } from './pages/polystyrene/polystyrene.component';
import { VinylCutsComponent } from './pages/vinyl-cuts/vinyl-cuts.component';
import { HomeComponent } from './pages/home/home.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { InvoiceComponent } from './pages/invoice/invoice.component';
import { ExpensesComponent } from './pages/expenses/expenses.component';
import { BankingComponent } from './pages/banking/banking.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { BanksComponent } from './pages/banks/banks.component';
import { EmployeesComponent } from './pages/employees/employees.component';

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
    path: 'product',
    loadComponent: () => ProductComponent,
  },
  {
    path: 'pricing',
    children: [
      { path: 'mdf', component: MDFComponent },
      { path: 'acrylics', component: AcrylicsComponent },
      { path: 'polystyrene', component: PolystyreneComponent },
      { path: 'vinyl-cuts', component: VinylCutsComponent },

    ],
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
  { path: 'invoice', loadComponent: () => InvoiceComponent },
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
  },
  {
    path: 'banks',
    loadComponent: () => BanksComponent,
  },
  {
    path: 'employees',
    loadComponent: () => EmployeesComponent,
  },
];

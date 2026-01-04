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
import { ProvidersComponent } from './pages/providers/providers.component';
import { ControlPanelComponent } from './pages/control-panel/control-panel.component';
import { ThirdPartiesComponent } from './pages/third-parties/third-parties.component';
import { ScheduleComponent } from './pages/schedule/schedule.component';
import { QuotationComponent } from './pages/quotation/quotation.component';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'pricing',
    canMatch: [roleGuard],
    children: [
      { path: 'mdf', component: MDFComponent },
      { path: 'acrylics', component: AcrylicsComponent },
      { path: 'polystyrene', component: PolystyreneComponent },
      { path: 'vinyl-cuts', component: VinylCutsComponent },
    ],
  },
  {
    path: 'inventory',
    data: { roles: ['admin'] },
    children: [
      {
        path: 'materials',
        component: InventoryComponent,
        canMatch: [roleGuard],
      },
      { path: 'product', component: ProductComponent },
    ],
  },
  {
    path: 'bank',
    canMatch: [roleGuard],
    children: [
      { path: 'banks', component: BanksComponent },
      { path: 'banking', component: BankingComponent },
      { path: 'providers', component: ProvidersComponent },
      { path: 'third', component: ThirdPartiesComponent },
    ],
  },
  {
    path: 'clients',
    loadComponent: () => ClientsComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'scheduler'] },
  },
  {
    path: 'third-parties',
    loadComponent: () => ThirdPartiesComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'scheduler'] },
  },
  {
    path: 'orders',
    loadComponent: () => OrdersComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'scheduler', 'prints_employee', 'cuts_employee'] },
  },
  {
    path: 'schedule',
    loadComponent: () => ScheduleComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'scheduler'] },
  },
  {
    path: 'quotation',
    loadComponent: () => QuotationComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'scheduler', 'prints_employee', 'cuts_employee'] },
  },
  {
    path: 'invoice',
    loadComponent: () => InvoiceComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'expenses',
    loadComponent: () => ExpensesComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'banking',
    loadComponent: () => BankingComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'banks',
    loadComponent: () => BanksComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },

  {
    path: 'employees',
    loadComponent: () => EmployeesComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'providers',
    loadComponent: () => ProvidersComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'control-panel',
    loadComponent: () => ControlPanelComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'notifications',
    loadComponent: () => NotificationsComponent,
    canMatch: [roleGuard],
    data: { roles: ['admin', 'prints_employee', 'cuts_employee'] },
  },
  {
    path: 'login',
    loadComponent: () => LoginComponent,
  },
  {
    path: 'home',
    loadComponent: () => HomeComponent,
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];

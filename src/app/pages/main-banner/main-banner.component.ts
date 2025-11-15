import { Component, HostListener, OnInit, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RoleService } from '../../services/role.service';
import { SupabaseService } from '../../services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-main-banner',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterOutlet, FormsModule],
  templateUrl: './main-banner.component.html',
  styleUrl: './main-banner.component.scss',
})
export class MainBannerComponent implements OnInit {
  isLoggedIn$;
  userEmail: string | undefined = '';
  userRole: string | null = null;
  userId: string | null = null;
  userAdmin: boolean = false;
  message: string | null = null;
  financeDropdownOpen = false;
  priceDropdownOpen = false;
  inventoryDropdownOpen = false;
  quotationDropdownOpen = false;
  newNotification = false;
  constructor(
    private readonly supabase: SupabaseService,
    private readonly roleService: RoleService,
    public readonly router: Router,
    private readonly zone: NgZone
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }

  goToNotifications() {
    this.router.navigate(['/notifications']);
  }
   goToThirdParties() {
    this.router.navigate(['/third-parties'])
  }
  goToHome() {
    this.router.navigate(['/home']);
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
  goToInventory() {
    this.router.navigate(['/inventory/materials']);
  }
  goToProducts() {
    this.router.navigate(['/inventory/product']);
  }
  goToAcrylics() {
    this.router.navigate(['/pricing/acrylics']); 
  }
  goToMdf() {
    this.router.navigate(['/pricing/mdf']);
  }
  goTopolystyrene() {
    this.router.navigate(['/pricing/polystyrene']);
  }
  goToVinylCuts() {
    this.router.navigate(['/pricing/vinyl-cuts']);
  }
  goToClients() {
    this.router.navigate(['/clients']);
  }
  goToOrders() {
    this.router.navigate(['/orders']);
  }
  goToInvoices() {
    this.router.navigate(['/invoice']);
  }
  goToExpenses() {
    this.router.navigate(['/expenses']);
  }
  goToEmployees() {
    this.router.navigate(['/employees']);
  }
  goToProviders() {
    this.router.navigate(['/providers']);
  }
  goToControlPanel() {
    this.router.navigate(['/control-panel']);
  }
    goToSchedule() {
    this.router.navigate(['/schedule']);
  }
  goToQuotation() {
    this.router.navigate(['/quotation']);
  }
  signOut() {
    this.supabase.signOut().then(() =>
      this.router.navigate(['/login'], {
        queryParams: {},
        replaceUrl: true,
      })
    );
  }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges(async (_, session) => {
      if (session && !this.userId) {
        this.zone.run(async () => {
          this.userId = session.user.id;
          this.userEmail = session.user.email;

          const { data, error } = await this.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', this.userId.trim())
            .maybeSingle();

          if (data != undefined) {
            this.userAdmin = true;
          } else {
            this.userAdmin = false;
          }
          this.roleService.fetchAndSetUserRole(this.userId);
          this.roleService.role$.subscribe((role) => {
            this.userRole = role;
            this.getNotifications();
          });
        });
      }
    });
  }
  async getNotifications() {
    if (!this.userId || !this.userRole) return;

    let query = this.supabase.from('notifications').select('*');

    if (this.userRole === 'admin') {
      query = query.eq('id_user', this.userId);
    } else if (this.userRole === 'prints_employee') {
      query = query.eq('type', 'prints');
    } else if (this.userRole === 'cuts_employee') {
      query = query.eq('type', 'cuts');
    } else {
      this.newNotification = false;
      return;
    }

    const { error, data } = await query;

    if (error) {
      console.error('Error obteniendo notificaciones:', error);
      return;
    }

    this.newNotification = (data?.length ?? 0) > 0;
    return;
  }
  toggleFinanceDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.financeDropdownOpen = !this.financeDropdownOpen;
    this.priceDropdownOpen = false;
    this.inventoryDropdownOpen = false;
    this.quotationDropdownOpen = false;
  }

  async closeDropdowns() {
    this.financeDropdownOpen = false;
    this.priceDropdownOpen = false;
    this.inventoryDropdownOpen = false;
    this.quotationDropdownOpen = false;
  }
  togglePriceDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.priceDropdownOpen = !this.priceDropdownOpen;
    this.quotationDropdownOpen = false;
    this.financeDropdownOpen = false;
    this.inventoryDropdownOpen = false;
  }

  toggleInventoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.inventoryDropdownOpen = !this.inventoryDropdownOpen;
    this.quotationDropdownOpen = false;
    this.financeDropdownOpen = false;
    this.priceDropdownOpen = false;
  }

  toggleQuotationDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.quotationDropdownOpen = !this.quotationDropdownOpen;
    this.inventoryDropdownOpen = false;
    this.financeDropdownOpen = false;
    this.priceDropdownOpen = false;
  }

  // Detect clicks outside of dropdown
  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: Event): void {
    const clickedInside = (event.target as HTMLElement).closest('.nav-item');
    if (!clickedInside) {
      this.closeDropdowns();
    }
  }
  goToBanks(): void {
    this.router.navigate(['/banks']);
  }

  goToBanking(): void {
    this.router.navigate(['/banking']);
  }
}

import { Component, HostListener, OnInit, NgZone } from '@angular/core';
import { RoleService } from '../../services/role.service';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { map, firstValueFrom, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-main-banner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-banner.component.html',
  styleUrls: ['./main-banner.component.scss'],
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
  private authTimer: any;
  private roleSubscription: Subscription | null = null;
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
  goToBanks(): void {
    this.router.navigate(['/bank/banks']);
  }
  goToBanking(): void {
    this.router.navigate(['/bank/banking']);
  }
  goToProviders() {
    this.router.navigate(['/bank/providers']);
  }
  goToThirdParties() {
    this.router.navigate(['/bank/third']);
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
    this.roleService.role$.subscribe((role) => {
      this.zone.run(() => {
        if (this.userRole !== role) {
          console.log('UI Role Update:', role);
          this.userRole = role;

          if (role) {
            this.getNotifications();
          } else {
            this.newNotification = false;
          }
        }
      });
    });

    // auth logic
    this.supabase.authChanges(async (_, session) => {
      // cancel any previous pending execution and wait 300ms before handling
      if (this.authTimer) clearTimeout(this.authTimer);
      this.authTimer = setTimeout(() => {
        this.handleAuthChange(session);
      }, 300);
    });
  }

  // helper to handle the auth logic once
  private async handleAuthChange(session: any) {
    if (session) {
      if (this.userId !== session.user.id) {
        this.userId = session.user.id;

        this.zone.run(async () => {
          this.userEmail = session.user.email;

          // reset states
          this.userAdmin = false;
          this.roleService.resetRole();

          // run both checks in parallel
          const [adminCheck, _] = await Promise.all([
            // check admin and fetch role
            this.supabase
              .from('admins')
              .select('user_id')
              .eq('user_id', this.userId!.trim())
              .maybeSingle(),

            this.roleService.fetchAndSetUserRole(this.userId!),
          ]);

          this.userAdmin = adminCheck.data != undefined;

        });
      }
    } else {
      // logged out
      if (this.userId !== null) {
        this.zone.run(() => {
          this.userId = null;
          this.userEmail = '';
          this.userAdmin = false;
          this.newNotification = false;
          this.roleService.resetRole();
          this.closeDropdowns();
        });
      }
    }
  }
  async getNotifications() {
    if (!this.userId || !this.userRole) return;

    let query = this.supabase.from('notifications').select('*');

    if (this.userRole === 'admin') {
      query = query.eq('id_user', this.userId);
      this.runNotificationCheck();
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
  async runNotificationCheck() {
    try {
      const response = await firstValueFrom(
        this.supabase.rpc$('check_and_generate_notifications', {})
      );
      if (response.error) {
        console.error('Error running notification check', response.error);
      }
    } catch (err) {
      console.error('Observable error', err);
    }
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
}

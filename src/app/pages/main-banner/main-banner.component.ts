import { Component, HostListener, OnInit, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RoleService } from '../../services/role.service';
import { SupabaseService } from '../../services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-banner',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './main-banner.component.html',
  styleUrl: './main-banner.component.scss',
})
export class MainBannerComponent implements OnInit {
  isLoggedIn$;
  userRole: string | null = null;
  userId: string | null = null;
  message: string | null = null;
  financeDropdownOpen = false;
  inventoryDropdownOpen = false;
  newNotification = false;
  constructor(
    private readonly supabase: SupabaseService,
    private readonly roleService: RoleService,
    //private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly zone: NgZone
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }
  goToNotifications() {
    this.router.navigate(['/notifications']); // Redirect to root route
  }
  goToHome() {
    this.router.navigate(['/home']); // Redirect to root route
  }
  goToLogin() {
    this.router.navigate(['/login']); // Redirect to login route
  }
  goToInventory() {
    this.router.navigate(['/inventory']); // Redirect to inventory route
  }
  goToAcrylics() {
    this.router.navigate(['/acrylics']); // Redirect to acrylics route
  }
  goToMdf() {
    this.router.navigate(['/mdf']); // Redirect to mdf route
  }
  goTopolystyrene() {
    this.router.navigate(['/polystyrene']); // Redirect to polystyrene route
  }
  goToVinylCuts() {
    this.router.navigate(['/vinyl-cuts']); // Redirect to vinyl-cuts route
  }
  goToClients() {
    this.router.navigate(['/clients']); // Redirect to clients route
  }
  goToOrders() {
    this.router.navigate(['/orders']); // Redirect to orders route
  }
  goToInvoices() {
    this.router.navigate(['/invoice']); // Redirect to invoice route
  }
  goToExpenses() {
    this.router.navigate(['/expenses']); // Redirect to expenses route
  }
  goToEmployees() {
    this.router.navigate(['/employees']); // redirect to employees route
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
    this.supabase.authChanges((_, session) => {
      if (session && !this.userId) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.roleService.fetchAndSetUserRole(this.userId);
          this.roleService.role$.subscribe((role) => {
            this.userRole = role;
          });
          this.getNotifications();
        });
      }
    });

    /* I honestly don't even know what this is supposed to do here maybe it's important?
    const type = this.route.snapshot.queryParamMap.get('type');
    const token = this.route.snapshot.queryParamMap.get('token');
    // Check if it's a signup confirmation
    if (type === 'signup' && token) {
      // You'll need the email used during signup.
      // If you didn't store it anywhere, you might ask the user or store it in localStorage during signup.
      const userEmail = localStorage.getItem('pendingSignupEmail') || '';

      const { data, error } = await this.supabase['supabase'].auth.verifyOtp({
        type: 'signup',
        token,
        email: userEmail,
      });

      if (error) {
        console.error('Error verifying signup:', error);
        this.message = 'There was an issue confirming your email.';
      } else {
        this.message =
          'Your email has been successfully confirmed! You can now log in.';
      }

      // Remove query params from the URL
      this.router.navigate([], {
        queryParams: {},
        replaceUrl: true,
      });
    }
    */
  }
  async getNotifications() {
    if (!this.userId || !this.userRole) return;
  
    let query = this.supabase.from('notifications').select('*');
  
    if (this.userRole === 'admin') {
      query = query;
    } 
    else if (this.userRole === 'prints_employee') {
      query = query.eq('type', 'prints');
    } 

    else if (this.userRole === 'cuts_employee') {
      query = query.eq('type', 'cuts');
    } 

    else {
      this.newNotification = false;
      return;
    }
  
    const { error, data } = await query;
  
    if (error) {
      console.error('Error obteniendo notificaciones:', error);
      return;
    }
  
    console.log('Notificaciones:', data);
  
    this.newNotification = (data?.length ?? 0) > 0;
  }
  toggleFinanceDropdown(event: MouseEvent): void {
    event.stopPropagation(); // Prevents the document click listener from firing
    this.financeDropdownOpen = !this.financeDropdownOpen;
  }
  async closeFinanceDropdown() {
    this.financeDropdownOpen = false;
  }
  toggleInventoryDropdown(event: MouseEvent): void {
    event.stopPropagation(); // Prevents the document click listener from firing
    this.inventoryDropdownOpen = !this.inventoryDropdownOpen;
  }
  async closeInventoryDropdown() {
    this.inventoryDropdownOpen = false;
  }
  // Detect clicks outside of dropdown
  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: Event): void {
    const clickedInside = (event.target as HTMLElement).closest('.nav-item');
    if (!clickedInside) {
      this.closeFinanceDropdown();
    }
  }
  goToBanks(): void {
    this.router.navigate(['/banks']);
  }

  goToBanking(): void {
    this.router.navigate(['/banking']);
  }
}

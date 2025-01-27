import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-banner',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './main-banner.component.html',
  styleUrl: './main-banner.component.scss'
})
export class MainBannerComponent implements OnInit {

    isLoggedIn$;
    message: string | null = null;

    constructor(
      private readonly supabase: SupabaseService,
      private readonly route: ActivatedRoute,
      private readonly router: Router
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
    signOut() {
      this.supabase.signOut().then(() => this.router.navigate(['/login'], {
        queryParams: {},
        replaceUrl: true,
      }));
    }

    async ngOnInit(): Promise<void> {
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
    }
}

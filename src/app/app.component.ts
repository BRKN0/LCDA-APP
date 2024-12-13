import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';

interface Client {
  id: string;
  name: string;
  document_type: string;
  document_number: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoggedIn$;
  message: string | null = null;
  clients: Client[] = [];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }

  signOut() {
    this.supabase.signOut().then(() => this.router.navigate(['/login']));
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

    this.supabase.authChanges((_, session) => {
      console.log('Session: ', session);

      if (session) {
        this.getClients();
      }
    });
  }

  async getClients() {
    const { error, data } = await this.supabase
      .from('clients')
      .select<any, Client>('*');

    if (error) {
      return;
    }

    this.clients = data;
  }
}

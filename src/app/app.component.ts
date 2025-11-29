import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoggedIn$;
  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }
  // Check if the user is logged in and redirect to login otherwise don't
  async ngOnInit(): Promise<void> {
/*    if (!this.isLoggedIn$) {
      this.router.navigate(['/login'], {
        queryParams: {},
        replaceUrl: true,
      });
    }
*/
  }
}

import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
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

  constructor(
    private readonly router: Router
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.router.navigate(['/login'], {
      queryParams: {},
      replaceUrl: true,
    });

  }
}

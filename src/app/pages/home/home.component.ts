import { Component, OnInit, NgZone } from '@angular/core';
import { RoleService } from '../../services/role.service';
import { SupabaseService } from '../../services/supabase.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { Router, RouterOutlet } from '@angular/router';
import { CarouselComponent } from '../carousel/carousel.component';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, CarouselComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  userEmail: string | undefined = '';
  userId: string | null = null;
  userRole: string = 'visitor';
  isLoggedIn$;
 

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
    private readonly router: Router
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }
  ngAfterViewInit(): void {
    const targets = document.querySelectorAll('.hero-section-animate');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            el.classList.remove('hero-hide');
            el.classList.add('hero-animate');
          } else {
            el.classList.remove('hero-animate');
            el.classList.add('hero-hide');
          }
        });
      },
      {
        threshold: 0.2, // trigger when 20% is visible
      }
    );

    targets.forEach((el) => observer.observe(el));
  }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.userEmail = session.user.email;
          this.roleService.fetchAndSetUserRole(this.userId);
        });
      }
    });
  }
  goToProducts() {
    this.router.navigate(['/inventory/product']);
  }
  scrollToAbout(): void {
    const element = document.getElementById('about');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

}





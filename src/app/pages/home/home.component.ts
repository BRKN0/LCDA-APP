import { Component, OnInit, NgZone, HostListener } from '@angular/core';
import { RoleService } from '../../services/role.service';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [MainBannerComponent, CommonModule, FormsModule, RouterOutlet],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
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

  async onRoleChange() {
    const { data, error } = await this.supabase
      .from('roles')
      .select('id')
      .eq('name', this.userRole);
    if (error) {
      console.log('error finding new role: ', error);
      return;
    }
    const userToUpdate = {
      id: this.userId,
      email: this.userEmail,
      id_role: data[0].id,
    };
    console.log(userToUpdate);
    this.updateRole(userToUpdate);
  }
  async updateRole(userToUpdate: {
    id: any;
    email?: string | undefined;
    id_role?: any;
  }) {
    const { error } = await this.supabase
      .from('users')
      .update(userToUpdate)
      .eq('id', userToUpdate.id);

    if (error) {
      console.log('error updating role: ', error);
      return;
    }
    this.roleService.setRole(this.userRole);
  }
}

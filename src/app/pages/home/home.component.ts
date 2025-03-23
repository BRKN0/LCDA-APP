import { Component, OnInit, NgZone } from '@angular/core';
import { RoleService } from '../../services/role.service';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';

interface User {
  id: string;
  email: string;
  id_role: string;
}

@Component({
  selector: 'app-home',
  imports: [MainBannerComponent, CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  user: User | null = null;
  userId: string | null = null;
  userRole: string = 'visitor';
  isLoggedIn$;
  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.getUserRole();
        });
      }
    });
  }
  async getUserRole() {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', this.userId);

    if (error) {
      console.error('Error fetching user role: ', error);
      alert('Error al buscar el rol del usuario');
      return;
    }
    this.user = data[0];
  }
  // This doesn't matter right now but later this hides the role change buttons from other users
  async isAdmin() {
    const { data, error } = await this.supabase
      .from('roles')
      .select('id_role')
      .eq('id', this.userRole);
    if (error) {
      console.error('Error fetching user role: ', error);
      alert('Error al buscar el rol del usuario');
      return;
    }
    this.userRole = data[0].id_role;
    /* This could be implemented with an extra table 'admins' and check for specific ids/emails instead
    if( userRole == 'admin' ) {
    }
    */
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
      id: this.user?.id,
      email: this.user?.email,
      id_role: data[0].id,
    };
    console.log(userToUpdate);
    this.updateRole(userToUpdate);
  }
  async updateRole(userToUpdate: { id: any; email?: string | undefined; id_role?: any; }) {
    const { error } = await this.supabase
    .from('users')
    .update(userToUpdate)
    .eq('id', userToUpdate.id);
    
    if (error) {
      console.log('error updating role: ', error);
      return;
    }
    this.roleService.setRole(this.userRole)
  }
}

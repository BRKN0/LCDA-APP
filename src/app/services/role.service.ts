import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private roleSubject = new BehaviorSubject<string | null>(null);
  role$ = this.roleSubject.asObservable();

  constructor(private readonly supabase: SupabaseService) {}

  async fetchAndSetUserRole(userId: string): Promise<void> {
    if (!userId) {
      this.resetRole();
      return;
    }

    try {
      // fetch role id
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id_role')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !userData) {
        console.log('error fetching user role id', userError);
        this.roleSubject.next(null);
        return;
      }

      const roleId = userData.id_role;
      // fetch role name
      const { data: roleData, error: roleError } = await this.supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .single();

      if (roleError || !roleData) {
        console.log('error fetching user role name', roleError);
        return;
      }
      // update observable
      this.roleSubject.next(roleData.name);
    } catch (err) {
      console.error('Error fetching user role:', err);
      this.roleSubject.next(null);
    }
  }

  // getter in case there's a need for synchronous access
  get currentRole(): string | null {
    return this.roleSubject.value;
  }
  setRole(newRole: string) {
    this.roleSubject.next(newRole);
  }

  getCurrentRole() {
    return this.roleSubject.getValue();
  }
  resetRole() {
    this.roleSubject.next(null);
  }
}

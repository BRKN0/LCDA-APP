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
    try {
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id_role')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
         console.log("error fetching user role id", userError);
         return;
      };

      const roleId = userData.id_role;

      const { data: roleData, error: roleError } = await this.supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .single();

      if (roleError || !roleData) {
        console.log("error fetching user role name", roleError);
        return;
     };;

      // Update BehaviorSubject
      this.roleSubject.next(roleData.name);
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  }

  // Optional getter to retrieve the current role synchronously
  get currentRole(): string | null {
    return this.roleSubject.value;
  }
  setRole(newRole: string) {
    this.roleSubject.next(newRole);
  }

  getCurrentRole() {
    return this.roleSubject.getValue();
  }
}

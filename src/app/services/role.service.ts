import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private roleSubject = new BehaviorSubject<string>('visitor');
  role$ = this.roleSubject.asObservable();
  
  setRole(newRole: string) {
    this.roleSubject.next(newRole);
  }

  getCurrentRole(){
    return this.roleSubject.getValue();
  }
}

import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { RoleService } from '../../services/role.service';
import { map } from 'rxjs';

interface Variables {
  id: string;
  name: string;
  category: string;
  value: number;
  label: string;
}
interface VariableMap {
  iva: number;
  utility_margin: number;
  retefuente_bienes_declara: number;
  retefuente_bienes_no_declara: number;
  retefuente_servicios_declara: number;
  retefuente_servicios_no_declara: number;
  reteica_bienes: number;
  reteica_servicios: number;
  finalLaminationValue: number;
  finalPrintValue: number;
  finalStampingValue: number;
  finalAssembleValue: number;
  intermediaryLaminationValue: number;
  intermediaryPrintValue: number;
  intermediaryStampingValue: number;
  intermediaryAssembleValue: number;
  finalPerMinute: number;
  baseCutTimeValue: number;
  intermediaryPerMinute: number;
}
@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss',
})
export class ControlPanelComponent implements OnInit {
  userEmail: string | undefined = '';
  userRole: string | null = null;
  userId: string | null = null;
  variables: VariableMap = {
    iva: 0,
    utility_margin: 0,
    retefuente_bienes_declara: 0,
    retefuente_bienes_no_declara: 0,
    retefuente_servicios_declara: 0,
    retefuente_servicios_no_declara: 0,
    reteica_bienes: 0,
    reteica_servicios: 0,
    finalLaminationValue: 0,
    finalPrintValue: 0,
    finalStampingValue: 0,
    finalAssembleValue: 0,
    intermediaryAssembleValue: 0,
    intermediaryLaminationValue: 0,
    intermediaryPrintValue: 0,
    intermediaryStampingValue: 0,
    baseCutTimeValue: 0,
    finalPerMinute: 0,
    intermediaryPerMinute: 0,
  };
  variablesMap: Record<string, number> = {};
  originalMap: Record<string, number> = {};
  loading = false;
  isLoggedIn$;
  toastVisible = false; // Controla la animación
  toastDisplay = false; // Controla la presencia en el DOM
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private hiding = false;
  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
    private readonly router: Router,
    private readonly cd: ChangeDetectorRef
  ) {
    this.isLoggedIn$ = this.supabase
      .authChanges$()
      .pipe(map((session) => !!session));
  }

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.supabase.authChanges((_, session) => {
          if (session && !this.userId) {
            this.zone.run(() => {
              this.userId = session.user.id;
              this.roleService.fetchAndSetUserRole(this.userId);
              this.roleService.role$.subscribe((role) => {
                this.userRole = role;
              });
              this.userId = session.user.id;
              this.userEmail = session.user.email;
              this.roleService.fetchAndSetUserRole(this.userId);
            });
          }
        });
      }
    });
    this.getVariables();
  }
  async getVariables() {
    this.loading = true;
    const { data } = await this.supabase.from('variables').select('name,value');
    if (data) {
      for (const v of data) {
        if (v.name in this.variables) {
          this.variables[v.name as keyof VariableMap] = parseFloat(v.value);
        }
      }
    }
    this.loading = false;
  }
  groupByCategory(data: Variables[]) {
    const grouped: { [category: string]: Variables[] } = {};
    for (const item of data) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return Object.keys(grouped).map((key) => ({
      category: key,
      items: grouped[key],
    }));
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
    if (this.userRole) {
      this.roleService.setRole(this.userRole);
      this.router.navigate(['/home']);
    }
  }

  showToast(type: 'success' | 'error', message: string) {
    this.toastType = type;
    this.toastMessage = message;
    this.toastDisplay = true;

    // Animate in
    requestAnimationFrame(() => {
      this.toastVisible = true;
    });

    // Trigger fade out after X frames (simulates delay without setTimeout)
    let frames = 180; // ~3s at 60fps
    const fadeOut = () => {
      if (--frames <= 0) {
        this.toastVisible = false;
        this.hiding = true;
      } else {
        requestAnimationFrame(fadeOut);
      }
    };
    requestAnimationFrame(fadeOut);
  }

  onTransitionEnd() {
    if (this.hiding) {
      this.toastDisplay = false;
      this.hiding = false;
    }
  }

  async resetVariables() {
    this.variablesMap = { ...this.originalMap };
  }

  async saveChanges() {
    try {
      const updates = Object.entries(this.variables).map(([name, value]) => ({
        name,
        value: value.toString(),
      }));
      await Promise.all(
        updates.map((v) =>
          this.supabase
            .from('variables')
            .update({ value: v.value })
            .eq('name', v.name)
        )
      );
      this.showToast('success', 'Variables guardadas exitosamente');
    } catch (error) {
      this.showToast('error', 'Error al guardar las variables');
    }
  }
}

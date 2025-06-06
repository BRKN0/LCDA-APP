import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss',
})
export class ControlPanelComponent implements OnInit {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {});
      }
    });
  }
  variables = {
    iva: 19,
    margenUtilidad: 30,
    retefuente: 2.5,
    retica: 0.5,
    reteCompras: 4,
  };

  resetVariables() {
    this.variables = {
      iva: 19,
      margenUtilidad: 30,
      retefuente: 2.5,
      retica: 0.5,
      reteCompras: 4,
    };
  }

  guardarVariables() {}
}

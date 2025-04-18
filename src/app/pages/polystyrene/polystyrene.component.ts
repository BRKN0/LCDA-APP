import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';

@Component({
  selector: 'app-polystyrene',
  standalone: true,
  imports: [MainBannerComponent],
  templateUrl: './polystyrene.component.html',
  styleUrl: './polystyrene.component.scss'
})
export class PolystyreneComponent {

}

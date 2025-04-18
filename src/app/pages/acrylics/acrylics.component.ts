import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';

@Component({
  selector: 'app-acrylics',
  standalone: true,
  imports: [MainBannerComponent],
  templateUrl: './acrylics.component.html',
  styleUrl: './acrylics.component.scss'
})
export class AcrylicsComponent {

}

import { Component } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';

@Component({
  selector: 'app-home',
  imports: [MainBannerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

}

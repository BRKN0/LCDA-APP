import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [MainBannerComponent, CommonModule, FormsModule, RouterOutlet],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent implements OnInit, OnDestroy {
  showMdf = true;
  showAcrylic = true;
  showPolystyrene = true;
  showVinyl = true;

  slides = [
    { src: '/consultorio.jpg', alt: '1' },
    { src: '/nooolapolicia.jpg', alt: '2' },
    { src: '/plazacentral.jpg', alt: '3' },
    { src: '/Habbab.jpg', alt: '4' },
    { src: '/multic.jpg', alt: '5' }
  ];

  currentIndex = 0;
  private intervalId: any;

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.nextSlide();
    }, 5000); // Cambia cada 5 segundos (5000 ms)
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  toggleMdf() {
    this.showMdf = !this.showMdf;
  }
  toggleAcrylic() {
    this.showAcrylic = !this.showAcrylic;
  }
  togglePolystyrene() {
    this.showPolystyrene = !this.showPolystyrene;
  }
  toggleVinyl() {
    this.showVinyl = !this.showVinyl;
  }
  toggleFilter() {
    this.showMdf = true;
    this.showAcrylic = true;
    this.showPolystyrene = true;
    this.showVinyl = true;
  }

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }

  prevSlide() {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
  }

  goToSlide(index: number) {
    this.currentIndex = index;
  }

  getVisibleSlides() {
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    const nextIndex = (this.currentIndex + 1) % this.slides.length;

    return [
      { slide: this.slides[prevIndex], position: 'left' },
      { slide: this.slides[this.currentIndex], position: 'center' },
      { slide: this.slides[nextIndex], position: 'right' }
    ];
  }
}


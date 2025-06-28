import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [ CommonModule, FormsModule],
  templateUrl: './carousel.component.html',
  styleUrl: './carousel.component.scss',
})
export class CarouselComponent implements OnInit, OnDestroy {
  showMdf = true;
  showAcrylic = true;
  showPolystyrene = true;
  showVinyl = true;

  slides = [
    { src: '/consultorio.jpg', alt: '1' },
    { src: '/nooolapolicia.jpg', alt: '2' },
    { src: '/plazacentral.jpg', alt: '3' },
    { src: '/Habbab.jpg', alt: '4' },
    { src: '/multic.jpg', alt: '5' },
    { src: '/Alitas.jpg', alt: '6' },
    { src: '/barco.jpg', alt: '7' },
    { src: '/barco2.jpg', alt: '8' },
    { src: '/copacabana.jpg', alt: '9' },
    { src: '/BSL.jpg', alt: '10' },
    { src: '/bote.jpg', alt: '11' },
    { src: '/casa.jpg', alt: '12' },
    { src: '/cubiculos.jpg', alt: '13' },
    { src: '/Ditica.jpg', alt: '14' },
    { src: '/etilico.jpg', alt: '15' },
    { src: '/extrella.jpg', alt: '16' },
    { src: '/hospedaje.jpg', alt: '17' },
    { src: '/lancha.jpg', alt: '18' },
    { src: '/marco.jpg', alt: '19' },
    { src: '/ministerio.jpg', alt: '20' },
    { src: '/nails.jpg', alt: '21' },
    { src: '/plaza2.jpg', alt: '22' },
    { src: '/puertita.jpg', alt: '23' },
    
    

  ];

  galleryImages = [
    '/Alitas.jpg',
    '/barco.jpg',
    '/barco2.jpg',
    '/copacabana.jpg',
    '/Habbab.jpg',
    '/plazacentral.jpg',
    '/BSL.jpg',
    '/barco2.jpg',
    '/bote.jpg',
    '/casa.jpg',
    '/consultorio.jpg',
    '/cubiculos.jpg',
    '/Ditica.jpg',
    '/etilico.jpg',
    '/extrella.jpg',
    '/hospedaje.jpg',
    '/lancha.jpg',
    '/marco.jpg',
    '/ministerio.jpg',
    '/multic.jpg',
    '/nails.jpg',
    '/nooolapolicia.jpg',
    '/plaza2.jpg',
    '/puertita.jpg'
  
  ];

  currentIndex = 0;
  private intervalId: any;
  selectedImageIndex: number | null = null;

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

  openImageAt(index: number) {
    this.selectedImageIndex = index;
  }

  closeImage() {
    this.selectedImageIndex = null;
  }

  prevImage() {
    if (this.selectedImageIndex !== null && this.selectedImageIndex > 0) {
      this.selectedImageIndex--;
    }
  }

  nextImage() {
    if (
      this.selectedImageIndex !== null &&
      this.selectedImageIndex < this.galleryImages.length - 1
    ) {
      this.selectedImageIndex++;
    }
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
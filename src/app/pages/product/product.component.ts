import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { RoleService } from '../../services/role.service';

interface Product {
  id: string;
  created_at: string;
  code: number;
  name: string;
  description: string;
  category: string;
  stock: number;
  cost: number;
  price: number;
  utility_margin: number;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent implements OnInit, OnDestroy {
  showMdf = true;
  showAcrylic = true;
  showPolystyrene = true;
  showVinyl = true;
  userId: string | null = null;
  userRole: string | null = null;
  Products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProduct: Partial<Product> = {};
  loading = true;
  showModal = false;
  isEditing = false;
  searchQuery = '';
  noResultsFound = false;
  availableCategories: string[] = [];
  filterCategory: string = '';
  selectedCategory: string = '';
  newCategory = '';
  categoryFeedback = '';
  categoryMode: 'select' | 'create' = 'select';
  typeFeedback = '';
  typeMode: 'select' | 'create' = 'select';
  minPrice: number | null = null;
  maxPrice: number | null = null;
  filterStockAvailable: boolean = false;
  autoPrice = true;
  roundingStep = 50;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  paginatedProducts: Product[] = [];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly roleService: RoleService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          if (this.userId !== session.user.id) {
            this.userId = session.user.id;
            this.roleService.fetchAndSetUserRole(this.userId);
            this.roleService.role$.subscribe((role) => {
              this.userRole = role;
            });
            this.getProducts();
            this.getCategories();
          }
        });
      }
    });
  }

  async getProducts(): Promise<void> {
    this.loading = true;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .order('code', { ascending: false });

      if (error) {
        console.error('Error al obtener productos:', error);
        this.Products = [];
        return;
      }

      this.Products = (data as Product[]) ?? [];
      this.searchProduct?.();
    } finally {
      this.loading = false;
    }
  }

  async getCategories(): Promise<void> {
    const { data, error } = await this.supabase
      .from('products')
      .select('category', { count: 'exact', head: false });

    if (error) {
      console.error('Error obteniendo categorías:', error);
      return;
    }

    const categories = data
      .map((p: { category: string }) => p.category)
      .filter((c, i, arr) => c && arr.indexOf(c) === i); // Elimina duplicados

    this.availableCategories = categories.sort();
  }

  searchProduct(): void {
    const query = this.searchQuery.toLowerCase();

    this.filteredProducts = this.Products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(query);

      const matchesPrice =
        (this.minPrice === null || p.price >= this.minPrice) &&
        (this.maxPrice === null || p.price <= this.maxPrice);

      const matchesStock = this.filterStockAvailable ? p.stock > 0 : true;

      const matchsCategory = 
        !this.filterCategory || p.category === this.filterCategory;

      return matchesSearch && matchesPrice && matchesStock && matchsCategory;
    });

    this.noResultsFound = this.filteredProducts.length === 0;
    this.currentPage = 1;
    this.updatePaginatedProducts();
  }

  normalizeCategory() {
    if (!this.selectedProduct.category) return;
    this.selectedProduct.category = this.selectedProduct.category
      .trim()
      .toLowerCase();
  }

  getUniqueCategories(): string[] {
    return Array.from(
      new Set(
        this.Products
          .map(i => i.category)
          .filter(c => !!c)
      )
    ).sort();
  }

  confirmNewCategory() {
    if (!this.newCategory) return;

    const normalized = this.newCategory.trim().toUpperCase();
    
    this.selectedCategory = normalized;
    this.selectedProduct.category = normalized;
    this.categoryFeedback = `Categoría "${normalized}" seleccionada`;

    setTimeout(() => {
      this.categoryFeedback = '';
    }, 2000);
  }

  backToCategorySelect() {
    this.categoryMode = 'select';
    this.newCategory = '';
  }


  addNewProduct(): void {
    this.selectedProduct = {
      created_at: new Date().toISOString(),
      name: '',
      description: '',
      category: '',
      stock: 1,
      cost: 0,
      price: 0,
      utility_margin: 30,
    };
    this.categoryMode = 'select';
    this.selectedCategory = '';
    this.newCategory = '';
    this.autoPrice = true;
    this.isEditing = false;
    this.showModal = true;
    this.onAutoPriceToggle();
  }

  editProduct(product: Product): void {
    this.selectedProduct = { ...product };
    this.selectedCategory = product.category;
    const expected = this.calculatePrice(product.cost ?? 0, product.utility_margin ?? 0);
    this.autoPrice = Math.abs(expected - (product.price ?? 0)) <= 1;
    if (this.autoPrice) {
      this.selectedProduct.price = expected;
    }
    this.isEditing = true;
    this.showModal = true;
    this.onAutoPriceToggle();
  }

  saveProduct(): void {
    this.selectedProduct.category = this.selectedCategory;

    if (!this.selectedProduct.name || !this.selectedProduct.category) {
      alert('Por favor, complete todos los campos requeridos "*".');
      return;
    }

    if (this.autoPrice) {
      this.selectedProduct.price = this.calculatePrice(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.utility_margin ?? 0
      );
    } else {
      this.selectedProduct.utility_margin = this.calculateMarginPct(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.price ?? 0
      );
    }

    const productToSave = {
      name: this.selectedProduct.name,
      description: this.selectedProduct.description,
      category: this.selectedCategory,
      stock: this.selectedProduct.stock ?? 0,
      cost: this.selectedProduct.cost ?? 0,
      price: this.selectedProduct.price ?? 0,
      utility_margin: this.selectedProduct.utility_margin ?? 0,
    };

    if (this.isEditing && this.selectedProduct.id) {
      this.supabase
        .from('products')
        .update(productToSave)
        .eq('id', this.selectedProduct.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error actualizando producto:', error);
          } else {
            alert('Producto actualizado');
            this.getProducts();
          }
          this.closeModal();
        });
    } else {
      this.supabase
        .from('products')
        .insert([productToSave])
        .select()
        .then(({ error }) => {
          if (error) {
            console.error('Error añadiendo producto:', error);
          } else {
            alert('Producto añadido');
            this.getProducts();
          }
          this.closeModal();
        });
    }
  }

  deleteProduct(product: Product): void {
    if (confirm(`¿Eliminar el producto "${product.name}"?`)) {
      this.supabase
        .from('products')
        .delete()
        .eq('id', product.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error eliminando producto:', error);
          } else {
            alert('Producto eliminado');
            this.getProducts();
          }
        });
    }
  }

  private calculatePrice(cost: number, marginPct: number): number {
    const c = Number(cost) || 0;
    const m = Number(marginPct) || 0;

    if (m >= 100) return 0; // protección básica

    const raw = c / (1 - m / 100);
    return this.roundToStep(raw, this.roundingStep);
  }

  private calculateMarginPct(cost: number, price: number): number {
    const c = Number(cost) || 0;
    const p = Number(price) || 0;
    if (p <= 0) return 0;

    const margin = ((p - c) / p) * 100;
    return this.roundDecimals(margin, 2);
  }

  private roundToStep(value: number, step: number): number {
    const s = step > 0 ? step : 1;
    return Math.round(value / s) * s;
  }

  private roundDecimals(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  onAutoPriceToggle(): void {
    if (!this.selectedProduct) return;
    if (this.autoPrice) {
      // Pasas a modo margen: recalcula PRECIO basado en COSTO + MARGEN
      this.selectedProduct.price = this.calculatePrice(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.utility_margin ?? 0
      );
    } else {
      // Pasas a modo precio manual: recalcula MARGEN basado en COSTO + PRECIO
      this.selectedProduct.utility_margin = this.calculateMarginPct(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.price ?? 0
      );
    }
  }

  // Cuando cambia COSTO o MARGEN o PRECIO, recalcula el otro según el modo
  onCostChange(): void {
    if (!this.selectedProduct) return;
    if (this.autoPrice) {
      this.selectedProduct.price = this.calculatePrice(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.utility_margin ?? 0
      );
    } else {
      this.selectedProduct.utility_margin = this.calculateMarginPct(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.price ?? 0
      );
    }
  }

  onMarginChange(): void {
    if (!this.selectedProduct) return;
    if (this.autoPrice) {
      this.selectedProduct.price = this.calculatePrice(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.utility_margin ?? 0
      );
    }
    // si estás en precio manual, ignoras cambios de margen (está deshabilitado en UI)
  }

  onPriceChange(): void {
    if (!this.selectedProduct) return;
    if (!this.autoPrice) {
      this.selectedProduct.utility_margin = this.calculateMarginPct(
        this.selectedProduct.cost ?? 0,
        this.selectedProduct.price ?? 0
      );
    }
    // si estás en modo margen, el precio está deshabilitado en UI
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.filterStockAvailable = false;
    this.filterCategory = '';
    this.searchProduct();
  }

  updatePaginatedProducts(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredProducts.length / this.itemsPerPage)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedProducts = this.filteredProducts.slice(startIndex, endIndex);
  }

  slides = [
    { src: '/consultorio.jpg', alt: '1' },
    { src: '/nooolapolicia.jpg', alt: '2' },
    { src: '/plazacentral.jpg', alt: '3' },
    { src: '/Habbab.jpg', alt: '4' },
    { src: '/multic.jpg', alt: '5' }
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


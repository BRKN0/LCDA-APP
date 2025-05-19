import { Component, NgZone, OnInit } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

interface Bank {
  id: string;
  code: string;
  account_number: string;
  account_type: string;
  bank: string;
  ledger_account: string;
  balance: number;
}
@Component({
  selector: 'app-banks',
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss',
})
export class BanksComponent implements OnInit{
  banks: Bank[] = [];
  dateFrom: string = '';
  dateTo: string = '';
  selectedBank: string = '';
  loading = true;
  // Paginacion
  currentPage: number =1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedBanks: Bank[] = []; // Lista paginada

  constructor(
    private readonly router: Router,
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.loadBanks();
        })
      }
    });
  }

  async loadBanks(): Promise<void> {
    const { error, data } = await this.supabase.from('banks').select('*');

    if (error) {
      return;
    }
    this.banks = data as Bank[];
    this.calculateBalance();
    this.updatePaginatedBanks();
  }

  calculateBalance() {
    if (!this.selectedBank) {
      return this.banks.reduce((sum, bank) => sum + bank.balance, 0);
    }

    const bank = this.banks.find((b) => b.code === this.selectedBank);
    return bank ? bank.balance : 0;
  }

  goToTransactionsList(): void {
    this.router.navigate(['/banking']);
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedBanks(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(1, Math.ceil(this.banks.length / this.itemsPerPage));

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedBanks = this.banks.slice(startIndex, endIndex);
  }
}

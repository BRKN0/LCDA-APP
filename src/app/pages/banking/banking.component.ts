import { Component, NgZone, OnInit } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
interface Transaction {
  id: string;
  code: string;
  created_at: Date;
  bank: string;
  description: string;
  in: number;
  out: number;
  category: string;
  balance: number;
  id_bank: string;
}

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
  selector: 'app-banking',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './banking.component.html',
  styleUrls: ['./banking.component.scss'],
})
export class BankingComponent implements OnInit {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  banks: Bank[] = [];
  selectedBank: string = '';
  loading = true;
  startDate: string = '';
  endDate: string = '';
  // Paginacion
  currentPage: number =1;
  itemsPerPage: number = 10; // Elementos por página
  totalPages: number = 1; // Total de páginas
  paginatedBanking: Transaction[] = []; // Lista paginada

  constructor(
    private readonly router: Router,
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.loadTransactions();
          this.loadBanks();
        });
      }
    });
  }

  async loadTransactions(): Promise<void> {
    this.loading = true;
    const { error, data } = await this.supabase
      .from('transactions')
      .select('*');

    if (error) {
      return;
    }
    this.transactions = data as Transaction[];
    this.filteredTransactions = [...this.transactions];
    this.updatePaginatedBanking();
  }

  async loadBanks(): Promise<void> {
    const { error, data } = await this.supabase.from('banks').select('*');

    if (error) {
      return;
    }
    this.banks = data as Bank[];
    this.calculateBalance();
  }
  updateFilteredTransactions(): void {
    this.filteredTransactions = this.transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.created_at); // Convertir la fecha de la transacción a objeto Date

        const isWithinDateRange =
            (!this.startDate || transactionDate >= new Date(this.startDate)) &&
            (!this.endDate || transactionDate <= new Date(this.endDate + 'T23:59:59'));

        const isBankMatch = !this.selectedBank || transaction.id_bank === this.selectedBank;

        return isWithinDateRange && isBankMatch;
    });
    this.currentPage = 1; // Reiniciar a la primera página
    this.updatePaginatedBanking(); // Actualizar la lista paginada
  }

  calculateBalance() {
    if (!this.selectedBank) {
      return this.banks.reduce((sum, bank) => sum + bank.balance, 0);
    }

    const bank = this.banks.find((b) => b.id === this.selectedBank);
    return bank ? bank.balance : 0;
  }

  getBankName(bankCode: string): string {
    const bank = this.banks.find((b) => b.id === bankCode);
    return bank ? bank.bank : 'Desconocido';
  }

  goToBanksList(): void {
    this.router.navigate(['/banks']);
  }

  //Paginacion
  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedBanking(): void {
    // Calcular el número total de páginas
    this.totalPages = Math.max(1, Math.ceil(this.filteredTransactions.length / this.itemsPerPage));

    // Asegurar que currentPage no sea menor que 1 ni mayor que totalPages
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    // Calcular los índices de inicio y fin
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);

    // Obtener los elementos para la página actual
    this.paginatedBanking = this.filteredTransactions.slice(startIndex, endIndex);
  }
}

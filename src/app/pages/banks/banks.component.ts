import { Component, NgZone, OnInit } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { Router } from '@angular/router';
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
  imports: [CommonModule, MainBannerComponent, FormsModule],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss',
})
export class BanksComponent implements OnInit{
  banks: Bank[] = [];
  dateFrom: string = '';
  dateTo: string = '';
  selectedBank: string = '';
  loading = true;

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
}

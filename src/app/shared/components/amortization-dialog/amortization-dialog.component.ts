import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Transaction } from '../../../core/models/transaction.model';
import { CurrencyBrPipe } from '../../pipes/currency-br.pipe';

export interface AmortizationData {
  currentTransaction: Transaction;
  futureTransactions: Transaction[];
}

export interface AmortizationResult {
  amortizeCount: number;
}

@Component({
  selector: 'app-amortization-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatSliderModule, MatDividerModule, FormsModule, CurrencyBrPipe],
  templateUrl: './amortization-dialog.component.html',
  styleUrl: './amortization-dialog.component.scss'
})
export class AmortizationDialogComponent {
  amortizeCount = 0; // 0 means just pay the current one

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: AmortizationData,
    private readonly dialogRef: MatDialogRef<AmortizationDialogComponent, AmortizationResult>
  ) {}

  get maxAmortization(): number {
    return this.data.futureTransactions.length;
  }

  get totalValue(): number {
    let sum = Number(this.data.currentTransaction.amount);
    for (let i = 0; i < this.amortizeCount; i++) {
      sum += Number(this.data.futureTransactions[i].amount);
    }
    return sum;
  }

  confirm(): void {
    this.dialogRef.close({ amortizeCount: this.amortizeCount });
  }
}

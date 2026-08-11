import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { RecurringTransaction } from '../../../core/models/recurring-transaction.model';

export interface DeleteRecurringData {
  recurring: RecurringTransaction;
}

export interface DeleteRecurringResult {
  deleteFuture: boolean;
}

@Component({
  selector: 'app-delete-recurring-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatRadioModule, FormsModule],
  templateUrl: './delete-recurring-dialog.component.html',
  styleUrl: './delete-recurring-dialog.component.scss'
})
export class DeleteRecurringDialogComponent {
  selectedOption = 'cancel_only'; // 'cancel_only' | 'delete_future'

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: DeleteRecurringData,
    private readonly dialogRef: MatDialogRef<DeleteRecurringDialogComponent, DeleteRecurringResult>
  ) {}

  confirm(): void {
    this.dialogRef.close({ deleteFuture: this.selectedOption === 'delete_future' });
  }
}

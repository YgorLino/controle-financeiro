import { Transaction } from '../../core/models/transaction.model';
import { sortTransactionsForDisplay } from './transaction-order.utils';

function transaction(
  description: string,
  transactionType: Transaction['transaction_type'],
  categoryName?: string
): Transaction {
  return {
    id: description,
    user_id: 'user-id',
    description,
    transaction_type: transactionType,
    amount: 10,
    category_id: null,
    reference_month: '2026-09-01',
    due_date: null,
    status: 'pending',
    payment_date: null,
    notes: null,
    recurring_transaction_id: null,
    account_id: null,
    created_at: '2026-08-24T12:00:00Z',
    updated_at: '2026-08-24T12:00:00Z',
    category: categoryName
      ? {
          id: categoryName,
          user_id: 'user-id',
          name: categoryName,
          transaction_type: transactionType,
          color: '#000000',
          icon: 'payments',
          is_default: false,
          created_at: '2026-08-24T12:00:00Z',
          updated_at: '2026-08-24T12:00:00Z'
        }
      : null
  };
}

describe('sortTransactionsForDisplay', () => {
  it('lists salary first, then other income, then expenses', () => {
    const expense = transaction('Aluguel', 'expense');
    const newestIncome = transaction('Freela', 'income');
    const salary = transaction('Salário', 'income');
    const anotherExpense = transaction('Internet', 'expense');

    expect(sortTransactionsForDisplay([expense, newestIncome, anotherExpense, salary]))
      .toEqual([salary, newestIncome, expense, anotherExpense]);
  });

  it('recognizes salary by category and preserves the order inside each group', () => {
    const firstExpense = transaction('Mercado', 'expense');
    const firstIncome = transaction('Venda', 'income');
    const salary = transaction('Pagamento mensal', 'income', 'Salário');
    const secondIncome = transaction('Reembolso', 'income');
    const secondExpense = transaction('Lazer', 'expense');

    expect(sortTransactionsForDisplay([
      firstExpense,
      firstIncome,
      salary,
      secondIncome,
      secondExpense
    ])).toEqual([
      salary,
      firstIncome,
      secondIncome,
      firstExpense,
      secondExpense
    ]);
  });
});

import { Transaction } from '../../core/models/transaction.model';

function normalized(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function displayPriority(transaction: Transaction): number {
  const isSalary = transaction.transaction_type === 'income'
    && (
      normalized(transaction.description) === 'salario'
      || normalized(transaction.category?.name) === 'salario'
    );

  if (isSalary) return 0;
  if (transaction.transaction_type === 'income') return 1;
  return 2;
}

/**
 * Mantém a ordem original dentro de cada grupo, priorizando salário,
 * demais entradas e, por último, saídas.
 */
export function sortTransactionsForDisplay(transactions: Transaction[]): Transaction[] {
  return transactions
    .map((transaction, originalIndex) => ({ transaction, originalIndex }))
    .sort((a, b) => {
      const priorityDifference = displayPriority(a.transaction) - displayPriority(b.transaction);
      return priorityDifference || a.originalIndex - b.originalIndex;
    })
    .map(({ transaction }) => transaction);
}

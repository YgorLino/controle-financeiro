// src/app/shared/utils/csv-export.utils.ts
import { Transaction } from '../../core/models/transaction.model';
import { formatDatePtBr } from './date.utils';

const LABELS: Record<string, string> = {
  income: 'Entrada',
  expense: 'Saída',
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado',
  cancelled: 'Cancelado'
};

export function exportTransactionsToCsv(
  transactions: Transaction[],
  filename = 'movimentacoes'
): void {
  const headers = [
    'Descrição', 'Tipo', 'Valor', 'Categoria',
    'Mês de Referência', 'Vencimento', 'Status',
    'Data de Pagamento', 'Observação'
  ];

  const rows = transactions.map(t => [
    `"${t.description.replace(/"/g, '""')}"`,
    LABELS[t.transaction_type] ?? t.transaction_type,
    t.amount.toFixed(2).replace('.', ','),
    `"${((t.category as any)?.name ?? '').replace(/"/g, '""')}"`,
    formatDatePtBr(t.reference_month),
    formatDatePtBr(t.due_date),
    LABELS[t.status] ?? t.status,
    formatDatePtBr(t.payment_date),
    `"${(t.notes ?? '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\n');

  // BOM para Excel reconhecer UTF-8
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

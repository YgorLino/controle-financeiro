// src/app/shared/utils/date.utils.ts
import { format, startOfMonth, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toReferenceMonth(date: Date): string {
  return format(startOfMonth(date), 'yyyy-MM-dd');
}

export function formatDatePtBr(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false;
  return isBefore(parseISO(dueDate), new Date()) && (status === 'pending' || status === 'overdue');
}

export function formatMonthLabel(isoDate: string): string {
  try {
    const d = parseISO(isoDate);
    const label = format(d, 'MMMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return isoDate;
  }
}

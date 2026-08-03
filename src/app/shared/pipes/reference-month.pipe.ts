// src/app/shared/pipes/reference-month.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

@Pipe({ name: 'referenceMonth', standalone: true })
export class ReferenceMonthPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, pattern: string = 'MMMM yyyy'): string {
    if (!value) return '';
    try {
      const date = typeof value === 'string' ? parseISO(value) : value;
      const formatted = format(date, pattern, { locale: ptBR });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return String(value);
    }
  }
}

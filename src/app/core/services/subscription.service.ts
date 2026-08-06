import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

export interface PixPaymentResponse {
  payment_id: string;
  qr_code: string;
  qr_code_base64: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly supabase = inject(SupabaseService);

  async createPixPayment(plan: 'monthly' | 'annual'): Promise<PixPaymentResponse> {
    const { data: session } = await this.supabase.client.auth.getSession();
    const token = session.session?.access_token;
    
    if (!token) throw new Error('Usuário não autenticado');

    // As Edge Functions geralmente ficam na URL do Supabase + /functions/v1/nome-da-funcao
    // Para funcionar tanto em dev quanto em prod, a URL base vem do environment
    const functionUrl = `${environment.supabaseUrl}/functions/v1/create-payment`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao gerar o PIX');
    }

    return data as PixPaymentResponse;
  }
}

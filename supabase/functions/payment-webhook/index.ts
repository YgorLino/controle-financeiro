import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('data.id') || url.searchParams.get('id')

    let body = {}
    try {
      body = await req.json()
    } catch (e) {
      // Body may be empty if Mercado Pago uses query params
    }

    const action = body.action || topic
    const paymentId = body.data?.id || id

    // Se não for evento de pagamento ou não tiver ID, retornamos 200 para o MP parar de enviar
    if ((action !== 'payment.created' && action !== 'payment.updated') || !paymentId) {
      return new Response('Ignorado', { status: 200 })
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      throw new Error('Mercado Pago token not configured')
    }

    // 1. Buscar os detalhes REAIS do pagamento na API do MP
    // (Nunca confie apenas nos dados que chegam no webhook)
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`
      }
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      throw new Error('Failed to fetch payment details')
    }

    // 2. Checar se foi aprovado
    if (mpData.status === 'approved') {
      const externalReference = mpData.external_reference
      if (!externalReference) {
        throw new Error('No external_reference in payment')
      }

      // external_reference formato: "user_uuid___plan_type"
      const [userId, planType] = externalReference.split('___')

      if (!userId) {
        throw new Error('Invalid external_reference format')
      }

      // 3. Atualizar o Supabase usando a Service Role Key (bypassa RLS)
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Calcula os dias a adicionar
      const daysToAdd = planType === 'annual' ? 365 : 30
      
      // Buscar a data de expiração atual para ver se soma a partir de hoje ou do futuro
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_expires_at')
        .eq('id', userId)
        .single()

      let newExpiration = new Date()
      if (profile && profile.subscription_expires_at) {
        const currentExp = new Date(profile.subscription_expires_at)
        if (currentExp > newExpiration) {
          // Se ainda tem dias sobrando, soma a partir do vencimento futuro
          newExpiration = currentExp
        }
      }
      
      // Adicionar os dias
      newExpiration.setDate(newExpiration.getDate() + daysToAdd)

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_expires_at: newExpiration.toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Supabase update error:', updateError)
        throw new Error('Failed to update subscription status')
      }
    }

    // Retorna 200 sempre pro Mercado Pago saber que recebemos
    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    // Mesmo com erro, retornar 200 ou 400 dependendo. Vamos retornar 400 pra debug.
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})

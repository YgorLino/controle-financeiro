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
    console.log('Webhook URL:', req.url)
    
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('data.id') || url.searchParams.get('id')

    let body: any = {}
    try {
      body = await req.json()
      console.log('Webhook Body:', JSON.stringify(body))
    } catch (e) {
      console.log('No JSON body')
    }

    const action = body.action || topic
    const paymentId = body.data?.id || id

    // Se não for evento de pagamento ou não tiver ID, retornamos 200 para o MP parar de enviar
    if ((action !== 'payment.created' && action !== 'payment.updated' && action !== 'payment') || !paymentId) {
      console.log('Ignorado action:', action, 'paymentId:', paymentId)
      return new Response('Ignorado', { status: 200 })
    }

    console.log(`Processing paymentId: ${paymentId}, action: ${action}`)

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      console.error('Missing MP_ACCESS_TOKEN')
      throw new Error('Mercado Pago token not configured')
    }

    // 1. Buscar os detalhes REAIS do pagamento na API do MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`
      }
    })

    const mpData = await mpResponse.json()
    console.log('MP Payment Status:', mpData.status)

    if (!mpResponse.ok) {
      console.error('Failed to fetch from MP:', mpData)
      throw new Error('Failed to fetch payment details')
    }

    // 2. Checar se foi aprovado
    if (mpData.status === 'approved') {
      const externalReference = mpData.external_reference
      console.log('External Reference:', externalReference)
      
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
      
      // Buscar a data de expiração e o trial atual para ver se soma a partir de hoje ou do futuro
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_expires_at, trial_ends_at')
        .eq('id', userId)
        .single()

      let newExpiration = new Date()
      if (profile) {
        let maxDate = newExpiration.getTime()
        
        if (profile.subscription_expires_at) {
          const currentExp = new Date(profile.subscription_expires_at).getTime()
          if (currentExp > maxDate) maxDate = currentExp
        }
        
        if (profile.trial_ends_at) {
          const trialExp = new Date(profile.trial_ends_at).getTime()
          if (trialExp > maxDate) maxDate = trialExp
        }
        
        newExpiration = new Date(maxDate)
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

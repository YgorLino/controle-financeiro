import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Tratamento de preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { plan } = await req.json()
    
    // Obter o token JWT do header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }
    const token = authHeader.replace('Bearer ', '')

    // Inicializar Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Obter o usuário autenticado usando o token recebido
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      console.error('Auth Error:', userError)
      throw new Error('Unauthorized')
    }

    // Definir valores baseados no plano
    let transactionAmount = 9.90
    let description = 'Assinatura Mensal - Controle Financeiro'
    let planId = 'monthly'

    if (plan === 'annual') {
      transactionAmount = 80.00
      description = 'Assinatura Anual - Controle Financeiro'
      planId = 'annual'
    }

    // Chamar API do Mercado Pago
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      throw new Error('Mercado Pago token not configured')
    }

    const idempotencyKey = crypto.randomUUID()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const notificationUrl = `${supabaseUrl}/functions/v1/payment-webhook`

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'X-Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_amount: transactionAmount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: user.email
        },
        external_reference: `${user.id}___${planId}`,
        notification_url: notificationUrl
      })
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Mercado Pago Error:', mpData)
      throw new Error('Failed to generate PIX')
    }

    // O Mercado Pago retorna os dados do PIX dentro de point_of_interaction.transaction_data
    const pixData = mpData.point_of_interaction?.transaction_data

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        qr_code: pixData?.qr_code,
        qr_code_base64: pixData?.qr_code_base64
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

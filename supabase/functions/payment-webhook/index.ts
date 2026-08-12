import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-signature',
}

const planPrices = {
  monthly: 9.90,
  annual: 80.00,
} as const

type PlanType = keyof typeof planPrices

interface MercadoPagoPayment {
  id: number | string
  status?: string
  transaction_amount?: number
  currency_id?: string
  payment_method_id?: string
  external_reference?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function parseSignature(signature: string): { timestamp: string; hash: string } | null {
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    }),
  )

  if (!parts['ts'] || !parts['v1']) return null
  return { timestamp: parts['ts'], hash: parts['v1'].toLowerCase() }
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null

  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

async function hasValidSignature(
  dataId: string,
  requestId: string | null,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!requestId || !signature) return false

  const parsed = parseSignature(signature)
  if (!parsed) return false

  const receivedHash = hexToBytes(parsed.hash)
  if (!receivedHash) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const manifest = `id:${dataId};request-id:${requestId};ts:${parsed.timestamp};`

  return crypto.subtle.verify('HMAC', key, receivedHash, encoder.encode(manifest))
}

function parseExternalReference(reference: string): { userId: string; plan: PlanType } | null {
  const [userId, plan, extra] = reference.split('___')
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)

  if (extra || !isUuid || (plan !== 'monthly' && plan !== 'annual')) return null
  return { userId, plan }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get('type') || url.searchParams.get('topic')
    const queryPaymentId = url.searchParams.get('data.id') || url.searchParams.get('id')

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      // Some Mercado Pago notifications can arrive without a JSON body.
    }

    const action = typeof body['action'] === 'string' ? body['action'] : topic
    const bodyData = body['data'] as { id?: string | number } | undefined
    const paymentId = String(queryPaymentId || bodyData?.id || '')

    const isPaymentEvent = action === 'payment.created' ||
      action === 'payment.updated' ||
      action === 'payment'

    if (!isPaymentEvent || !paymentId) {
      return jsonResponse({ ignored: true })
    }

    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('Missing MP_WEBHOOK_SECRET')
      return jsonResponse({ error: 'Webhook secret not configured' }, 500)
    }

    const signatureIsValid = await hasValidSignature(
      paymentId,
      req.headers.get('x-request-id'),
      req.headers.get('x-signature'),
      webhookSecret,
    )
    if (!signatureIsValid) {
      console.warn(`Rejected notification with invalid signature for payment ${paymentId}`)
      return jsonResponse({ error: 'Invalid webhook signature' }, 401)
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      throw new Error('Mercado Pago token not configured')
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    })
    const mpData = await mpResponse.json() as MercadoPagoPayment

    if (!mpResponse.ok) {
      console.error(`Failed to fetch payment ${paymentId} from Mercado Pago (status ${mpResponse.status})`)
      throw new Error('Failed to fetch payment details')
    }

    if (String(mpData.id) !== paymentId) {
      throw new Error('Payment ID mismatch')
    }

    if (mpData.status !== 'approved') {
      return jsonResponse({ processed: false, status: mpData.status ?? 'unknown' })
    }

    const reference = mpData.external_reference
      ? parseExternalReference(mpData.external_reference)
      : null
    if (!reference) {
      throw new Error('Invalid external_reference')
    }

    const expectedAmount = planPrices[reference.plan]
    if (mpData.currency_id !== 'BRL' ||
        mpData.payment_method_id !== 'pix' ||
        Number(mpData.transaction_amount) !== expectedAmount) {
      console.error(`Payment ${paymentId} does not match the purchased plan`)
      throw new Error('Payment data does not match the purchased plan')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase admin credentials not configured')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabaseAdmin.rpc('apply_approved_payment', {
      p_payment_id: paymentId,
      p_user_id: reference.userId,
      p_plan_type: reference.plan,
      p_amount: expectedAmount,
      p_currency_id: mpData.currency_id,
    })

    if (error) {
      console.error(`Failed to apply payment ${paymentId}:`, error.message)
      throw new Error('Failed to apply approved payment')
    }

    const result = Array.isArray(data) ? data[0] : data
    return jsonResponse({
      processed: true,
      applied: Boolean(result?.applied),
      subscription_expires_at: result?.expires_at ?? null,
    })
  } catch (error) {
    console.error('Webhook error:', getErrorMessage(error))
    return jsonResponse({ error: 'Unable to process webhook' }, 500)
  }
})

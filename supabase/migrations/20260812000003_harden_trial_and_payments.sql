-- ============================================================
-- CONTROLE FINANCEIRO — Correções do trial e pagamentos
-- Migration: 20260812000003_harden_trial_and_payments.sql
-- ============================================================

BEGIN;

-- A migration anterior protegia os campos de assinatura com um trigger
-- baseado em auth.role(). Isso também bloqueava a RPC SECURITY DEFINER que
-- inicia o trial. A proteção passa a ser feita com privilégios por coluna.
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_fields();

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, avatar_url, theme, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- A condição no UPDATE torna a operação segura mesmo com chamadas
    -- simultâneas e impede que um trial já iniciado seja renovado.
    UPDATE public.profiles
    SET
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '3 days',
        updated_at = NOW()
    WHERE id = v_user_id
      AND trial_started_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_access_status()
RETURNS public.access_status_type
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile public.profiles%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_result public.access_status_type;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado';
    END IF;

    IF v_profile.subscription_status = 'active'
       AND v_profile.subscription_expires_at > v_now THEN
        v_result.access_kind := 'paid';
        v_result.time_remaining_ms := FLOOR(
            EXTRACT(EPOCH FROM (v_profile.subscription_expires_at - v_now)) * 1000
        )::BIGINT;
    ELSIF v_profile.trial_ends_at > v_now THEN
        v_result.access_kind := 'trial';
        v_result.time_remaining_ms := FLOOR(
            EXTRACT(EPOCH FROM (v_profile.trial_ends_at - v_now)) * 1000
        )::BIGINT;
    ELSE
        v_result.access_kind := 'expired';
        v_result.time_remaining_ms := 0;
    END IF;

    v_result.server_now := v_now;
    v_result.trial_ends_at := v_profile.trial_ends_at;
    v_result.subscription_expires_at := v_profile.subscription_expires_at;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_valid_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND (
              (profile.subscription_status = 'active'
               AND profile.subscription_expires_at > NOW())
              OR profile.trial_ends_at > NOW()
          )
    );
$$;

REVOKE ALL ON FUNCTION public.start_free_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_access_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_valid_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_access() TO authenticated;

-- Completa a mesma proteção do trial para as tabelas que ficaram de fora.
DROP POLICY IF EXISTS "accounts: usuário cria apenas suas contas" ON public.accounts;
CREATE POLICY "accounts: usuário cria apenas suas contas"
    ON public.accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "accounts: usuário atualiza apenas suas contas" ON public.accounts;
CREATE POLICY "accounts: usuário atualiza apenas suas contas"
    ON public.accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "credit_cards: usuário cria apenas seus cartões" ON public.credit_cards;
CREATE POLICY "credit_cards: usuário cria apenas seus cartões"
    ON public.credit_cards FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "credit_cards: usuário atualiza apenas seus cartões" ON public.credit_cards;
CREATE POLICY "credit_cards: usuário atualiza apenas seus cartões"
    ON public.credit_cards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

-- Registro imutável dos pagamentos aplicados. A chave primária impede que a
-- mesma cobrança seja creditada duas vezes, inclusive em chamadas simultâneas.
CREATE TABLE IF NOT EXISTS public.processed_payments (
    payment_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency_id TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subscription_expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.processed_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processed_payments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_approved_payment(
    p_payment_id TEXT,
    p_user_id UUID,
    p_plan_type TEXT,
    p_amount NUMERIC,
    p_currency_id TEXT
)
RETURNS TABLE (
    applied BOOLEAN,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_expiration TIMESTAMPTZ;
    v_trial_expiration TIMESTAMPTZ;
    v_new_expiration TIMESTAMPTZ;
    v_inserted_payment_id TEXT;
    v_existing_user_id UUID;
    v_existing_plan_type TEXT;
    v_expected_amount NUMERIC(10, 2);
BEGIN
    IF p_payment_id IS NULL OR BTRIM(p_payment_id) = '' THEN
        RAISE EXCEPTION 'ID do pagamento inválido';
    END IF;

    IF p_plan_type NOT IN ('monthly', 'annual') THEN
        RAISE EXCEPTION 'Plano inválido';
    END IF;

    v_expected_amount := CASE p_plan_type
        WHEN 'annual' THEN 80.00
        ELSE 9.90
    END;

    IF p_currency_id <> 'BRL' OR p_amount <> v_expected_amount THEN
        RAISE EXCEPTION 'Valor ou moeda do pagamento inválido';
    END IF;

    -- Serializa pagamentos do mesmo usuário para que duas compras diferentes
    -- acumulem seus períodos corretamente.
    SELECT profile.subscription_expires_at, profile.trial_ends_at
    INTO v_current_expiration, v_trial_expiration
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado';
    END IF;

    INSERT INTO public.processed_payments (
        payment_id,
        user_id,
        plan_type,
        amount,
        currency_id,
        subscription_expires_at
    )
    VALUES (
        p_payment_id,
        p_user_id,
        p_plan_type,
        p_amount,
        p_currency_id,
        NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING
    RETURNING payment_id INTO v_inserted_payment_id;

    IF v_inserted_payment_id IS NULL THEN
        SELECT
            payment.subscription_expires_at,
            payment.user_id,
            payment.plan_type
        INTO
            v_new_expiration,
            v_existing_user_id,
            v_existing_plan_type
        FROM public.processed_payments AS payment
        WHERE payment.payment_id = p_payment_id;

        IF v_existing_user_id <> p_user_id OR v_existing_plan_type <> p_plan_type THEN
            RAISE EXCEPTION 'Pagamento já registrado com dados diferentes';
        END IF;

        RETURN QUERY SELECT FALSE, v_new_expiration;
        RETURN;
    END IF;

    v_new_expiration := GREATEST(
        NOW(),
        COALESCE(v_current_expiration, NOW()),
        COALESCE(v_trial_expiration, NOW())
    ) + CASE p_plan_type
        WHEN 'annual' THEN INTERVAL '365 days'
        ELSE INTERVAL '30 days'
    END;

    UPDATE public.profiles
    SET
        subscription_status = 'active',
        subscription_expires_at = v_new_expiration,
        updated_at = NOW()
    WHERE id = p_user_id;

    UPDATE public.processed_payments
    SET subscription_expires_at = v_new_expiration
    WHERE payment_id = p_payment_id;

    RETURN QUERY SELECT TRUE, v_new_expiration;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_approved_payment(TEXT, UUID, TEXT, NUMERIC, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_approved_payment(TEXT, UUID, TEXT, NUMERIC, TEXT)
    TO service_role;

COMMIT;

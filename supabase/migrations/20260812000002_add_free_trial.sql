-- ============================================================
-- CONTROLE FINANCEIRO — Teste Gratuito de 3 dias e Proteções
-- Migration: 20260812000002_add_free_trial.sql
-- ============================================================

-- Configurar timezone da sessão
SET timezone = 'America/Maceio';

-- 1. Adicionar colunas de trial na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 2. Proteger colunas sensíveis via Trigger (RLS não suporta NEW/OLD diretamente)
DROP POLICY IF EXISTS "profiles: usuário atualiza apenas seu perfil seguro" ON public.profiles;

-- Restaura a política original de UPDATE (apenas garantindo que o usuário seja o dono)
CREATE POLICY "profiles: usuário atualiza apenas seu perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Cria a função do trigger para bloquear alterações de campos sensíveis
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se a alteração vier da API do cliente (role authenticated)
    IF auth.role() = 'authenticated' THEN
        -- Ignora qualquer tentativa de mudar esses campos, mantendo o valor antigo
        NEW.subscription_status = OLD.subscription_status;
        NEW.subscription_expires_at = OLD.subscription_expires_at;
        NEW.trial_started_at = OLD.trial_started_at;
        NEW.trial_ends_at = OLD.trial_ends_at;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();

-- 3. Função para iniciar o teste de 3 dias
-- Será chamada pelo frontend após o primeiro login
CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permite burlar a política RLS acima para alterar o trial
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_trial_started_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- Pega os dados atuais do profile
    SELECT trial_started_at INTO v_trial_started_at
    FROM public.profiles
    WHERE id = v_user_id;

    -- Só inicia se nunca foi iniciado
    IF v_trial_started_at IS NULL THEN
        UPDATE public.profiles
        SET 
            trial_started_at = NOW(),
            trial_ends_at = NOW() + INTERVAL '3 days',
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;
END;
$$;

-- 4. Tipo composto para retornar o status de acesso
DO $$ BEGIN
    CREATE TYPE access_status_type AS (
        access_kind TEXT, -- 'trial', 'paid', ou 'expired'
        server_now TIMESTAMPTZ,
        trial_ends_at TIMESTAMPTZ,
        subscription_expires_at TIMESTAMPTZ,
        time_remaining_ms BIGINT
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Função para consultar o status real do acesso
CREATE OR REPLACE FUNCTION public.get_access_status()
RETURNS access_status_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile public.profiles%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_access_kind TEXT := 'expired';
    v_time_remaining_ms BIGINT := 0;
    v_result access_status_type;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    -- Regra 1: Se tem assinatura válida
    IF v_profile.subscription_status = 'active' AND v_profile.subscription_expires_at > v_now THEN
        v_access_kind := 'paid';
        v_time_remaining_ms := EXTRACT(EPOCH FROM (v_profile.subscription_expires_at - v_now)) * 1000;
        
    -- Regra 2: Se está no período de teste
    ELSIF v_profile.trial_ends_at > v_now THEN
        v_access_kind := 'trial';
        v_time_remaining_ms := EXTRACT(EPOCH FROM (v_profile.trial_ends_at - v_now)) * 1000;
        
    -- Regra 3: Expirado
    ELSE
        v_access_kind := 'expired';
        v_time_remaining_ms := 0;
    END IF;

    v_result.access_kind := v_access_kind;
    v_result.server_now := v_now;
    v_result.trial_ends_at := v_profile.trial_ends_at;
    v_result.subscription_expires_at := v_profile.subscription_expires_at;
    v_result.time_remaining_ms := v_time_remaining_ms;

    RETURN v_result;
END;
$$;

-- 6. Função utilitária para verificar acesso (útil para uso dentro das políticas RLS)
CREATE OR REPLACE FUNCTION public.has_valid_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile public.profiles%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    IF v_profile.subscription_status = 'active' AND v_profile.subscription_expires_at > v_now THEN
        RETURN TRUE;
    END IF;

    IF v_profile.trial_ends_at > v_now THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 7. Modificar as políticas de inserção e atualização das tabelas de negócio para garantir que o usuário tenha acesso válido
-- (Se a assinatura e o trial expirarem, o usuário pode ver os dados (SELECT e DELETE), mas não pode adicionar (INSERT) ou editar (UPDATE))

-- categories
DROP POLICY IF EXISTS "categories: usuário cria apenas suas categorias" ON public.categories;
CREATE POLICY "categories: usuário cria apenas suas categorias"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "categories: usuário atualiza apenas suas categorias" ON public.categories;
CREATE POLICY "categories: usuário atualiza apenas suas categorias"
    ON public.categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

-- transactions
DROP POLICY IF EXISTS "transactions: usuário cria apenas suas transações" ON public.transactions;
CREATE POLICY "transactions: usuário cria apenas suas transações"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "transactions: usuário atualiza apenas suas transações" ON public.transactions;
CREATE POLICY "transactions: usuário atualiza apenas suas transações"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

-- recurring_transactions
DROP POLICY IF EXISTS "recurring: usuário cria apenas suas recorrências" ON public.recurring_transactions;
CREATE POLICY "recurring: usuário cria apenas suas recorrências"
    ON public.recurring_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

DROP POLICY IF EXISTS "recurring: usuário atualiza apenas suas recorrências" ON public.recurring_transactions;
CREATE POLICY "recurring: usuário atualiza apenas suas recorrências"
    ON public.recurring_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND public.has_valid_access());

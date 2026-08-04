-- ============================================================
-- CONTROLE MAGUINHO — Migration 002
-- Adicionando Contas (Origem do Dinheiro), Correção do Dashboard
-- ============================================================

-- 1. CRIAR TABELA DE CONTAS (ACCOUNTS)
CREATE TABLE public.accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL, -- Ex: Conta Corrente, Dinheiro Guardado
    color            TEXT NOT NULL DEFAULT '#6366F1',
    initial_balance  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.accounts IS 'Contas/Carteiras do usuário (Origem/Destino do dinheiro)';

-- Índices e Triggers para accounts
CREATE INDEX idx_accounts_user_id ON public.accounts (user_id);

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts: usuário vê apenas suas contas" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts: usuário cria apenas suas contas" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: usuário atualiza apenas suas contas" ON public.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: usuário exclui apenas suas contas" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.accounts TO authenticated;

-- 2. ALTERAR TABELA DE TRANSAÇÕES
-- Adicionar account_id às transações
ALTER TABLE public.transactions
    ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_account ON public.transactions (account_id);

-- Opcional: Adicionar na recorrência também
ALTER TABLE public.recurring_transactions
    ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;


-- 3. CORRIGIR E RECRIAR A VIEW DO DASHBOARD
DROP VIEW IF EXISTS public.dashboard_summary;

CREATE OR REPLACE VIEW public.dashboard_summary AS
SELECT
    user_id,
    reference_month,
    COUNT(*) FILTER (WHERE transaction_type = 'income')                                     AS total_income_count,
    COUNT(*) FILTER (WHERE transaction_type = 'expense')                                    AS total_expense_count,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0)                    AS total_income,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0)                   AS total_expense,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) -
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0)                   AS balance,
    COALESCE(SUM(amount) FILTER (WHERE status IN ('paid') AND transaction_type = 'expense'), 0)   AS total_paid,
    COALESCE(SUM(amount) FILTER (WHERE status IN ('pending', 'overdue') AND transaction_type = 'expense'), 0) AS total_pending,
    COUNT(*) FILTER (WHERE status IN ('pending', 'overdue') AND transaction_type = 'expense')      AS pending_count,
    COUNT(*) FILTER (WHERE status = 'overdue')                                              AS overdue_count
FROM public.transactions
GROUP BY user_id, reference_month;

ALTER VIEW public.dashboard_summary SET (security_invoker = true);
GRANT SELECT ON public.dashboard_summary TO authenticated;

-- 4. LIMPAR TODOS OS DADOS E USUÁRIOS (RESET COMPLETO)
-- ATENÇÃO: Isso apagará TODOS os usuários registrados e seus dados vinculados.
TRUNCATE auth.users CASCADE;

-- ============================================================
-- CONTROLE MAGUINHO — Schema Inicial
-- Migration: 001_initial_schema.sql
-- Banco: PostgreSQL (Supabase)
-- Fuso horário: America/Maceio
-- ============================================================

-- Configurar timezone da sessão
SET timezone = 'America/Maceio';

-- ============================================================
-- TIPOS ENUMERADOS
-- ============================================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TYPE transaction_status AS ENUM ('paid', 'pending', 'overdue', 'cancelled');

CREATE TYPE recurring_frequency AS ENUM ('monthly', 'weekly', 'yearly');

-- ============================================================
-- TABELA: profiles
-- Extensão da tabela auth.users do Supabase
-- ============================================================

CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT,
    theme       TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Dados públicos do perfil do usuário, extensão de auth.users';

-- ============================================================
-- TABELA: categories
-- Categorias financeiras por usuário
-- ============================================================

CREATE TABLE public.categories (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    color            TEXT NOT NULL DEFAULT '#6366F1',
    transaction_type TEXT NOT NULL DEFAULT 'both' CHECK (transaction_type IN ('income', 'expense', 'both')),
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_name_user_unique UNIQUE (user_id, name)
);

COMMENT ON TABLE public.categories IS 'Categorias financeiras por usuário. is_default=true para as pré-criadas pelo sistema.';
COMMENT ON COLUMN public.categories.color IS 'Cor hexadecimal ex: #6366F1';
COMMENT ON COLUMN public.categories.transaction_type IS 'income | expense | both';

-- ============================================================
-- TABELA: recurring_transactions
-- Templates de lançamentos recorrentes
-- ============================================================

CREATE TABLE public.recurring_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description      TEXT NOT NULL,
    transaction_type transaction_type NOT NULL,
    amount           NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    category_id      UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    start_date       DATE NOT NULL,
    end_date         DATE,
    due_day          SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    frequency        recurring_frequency NOT NULL DEFAULT 'monthly',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recurring_transactions IS 'Templates de lançamentos recorrentes. Não são as transações em si, apenas a configuração da recorrência.';
COMMENT ON COLUMN public.recurring_transactions.due_day IS 'Dia do mês de vencimento (1-31)';
COMMENT ON COLUMN public.recurring_transactions.amount IS 'Decimal(15,2) — nunca float para valores monetários';

-- ============================================================
-- TABELA: transactions
-- Lançamentos financeiros individuais
-- ============================================================

CREATE TABLE public.transactions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description              TEXT NOT NULL,
    transaction_type         transaction_type NOT NULL,
    amount                   NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    category_id              UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    reference_month          DATE NOT NULL,   -- sempre armazenado como primeiro dia do mês (YYYY-MM-01)
    due_date                 DATE,
    status                   transaction_status NOT NULL DEFAULT 'pending',
    payment_date             DATE,
    notes                    TEXT,
    recurring_transaction_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Lançamentos financeiros individuais. reference_month sempre em YYYY-MM-01.';
COMMENT ON COLUMN public.transactions.reference_month IS 'Mês de competência, armazenado como primeiro dia do mês. Ex: 2026-08-01 = Agosto/2026';
COMMENT ON COLUMN public.transactions.amount IS 'Decimal(15,2) — nunca float para valores monetários';
COMMENT ON COLUMN public.transactions.recurring_transaction_id IS 'Referência ao template de recorrência, se aplicável';

-- ============================================================
-- TABELA: credit_cards
-- Cartões de crédito do usuário
-- ============================================================

CREATE TABLE public.credit_cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    closing_day SMALLINT CHECK (closing_day BETWEEN 1 AND 31),
    due_day     SMALLINT CHECK (due_day BETWEEN 1 AND 31),
    color       TEXT NOT NULL DEFAULT '#6366F1',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.credit_cards IS 'Cartões de crédito do usuário. No MVP, faturas são lançamentos normais na categoria Cartão de Crédito.';

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Transactions: filtros mais comuns
CREATE INDEX idx_transactions_user_id          ON public.transactions (user_id);
CREATE INDEX idx_transactions_reference_month  ON public.transactions (user_id, reference_month);
CREATE INDEX idx_transactions_status           ON public.transactions (user_id, status);
CREATE INDEX idx_transactions_category         ON public.transactions (category_id);
CREATE INDEX idx_transactions_recurring        ON public.transactions (recurring_transaction_id);

-- Categories
CREATE INDEX idx_categories_user_id ON public.categories (user_id);

-- Recurring transactions
CREATE INDEX idx_recurring_user_id  ON public.recurring_transactions (user_id);
CREATE INDEX idx_recurring_active   ON public.recurring_transactions (user_id, is_active);

-- Credit cards
CREATE INDEX idx_credit_cards_user_id ON public.credit_cards (user_id);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Cria perfil automaticamente ao criar usuário no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    RETURN NEW;
END;
$$;

-- Garante que reference_month seja sempre o primeiro dia do mês
CREATE OR REPLACE FUNCTION public.normalize_reference_month()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.reference_month = DATE_TRUNC('month', NEW.reference_month)::DATE;
    RETURN NEW;
END;
$$;

-- Marca automaticamente como 'overdue' transações pendentes com vencimento passado
CREATE OR REPLACE FUNCTION public.update_overdue_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.transactions
    SET
        status = 'overdue',
        updated_at = NOW()
    WHERE
        status = 'pending'
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_reference_month
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.normalize_reference_month();

CREATE TRIGGER trg_recurring_updated_at
    BEFORE UPDATE ON public.recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credit_cards_updated_at
    BEFORE UPDATE ON public.credit_cards
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger que cria perfil ao cadastrar usuário
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards            ENABLE ROW LEVEL SECURITY;

-- -------- profiles --------
CREATE POLICY "profiles: usuário vê apenas seu perfil"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles: usuário atualiza apenas seu perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- -------- categories --------
CREATE POLICY "categories: usuário vê apenas suas categorias"
    ON public.categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "categories: usuário cria apenas suas categorias"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories: usuário atualiza apenas suas categorias"
    ON public.categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories: usuário exclui apenas suas categorias"
    ON public.categories FOR DELETE
    USING (auth.uid() = user_id);

-- -------- transactions --------
CREATE POLICY "transactions: usuário vê apenas suas transações"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "transactions: usuário cria apenas suas transações"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: usuário atualiza apenas suas transações"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: usuário exclui apenas suas transações"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- -------- recurring_transactions --------
CREATE POLICY "recurring: usuário vê apenas suas recorrências"
    ON public.recurring_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "recurring: usuário cria apenas suas recorrências"
    ON public.recurring_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring: usuário atualiza apenas suas recorrências"
    ON public.recurring_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring: usuário exclui apenas suas recorrências"
    ON public.recurring_transactions FOR DELETE
    USING (auth.uid() = user_id);

-- -------- credit_cards --------
CREATE POLICY "credit_cards: usuário vê apenas seus cartões"
    ON public.credit_cards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "credit_cards: usuário cria apenas seus cartões"
    ON public.credit_cards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_cards: usuário atualiza apenas seus cartões"
    ON public.credit_cards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_cards: usuário exclui apenas seus cartões"
    ON public.credit_cards FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- VIEW: dashboard_summary
-- Resumo financeiro por mês (seguro via RLS)
-- ============================================================

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

-- Aplicar RLS na view
ALTER VIEW public.dashboard_summary SET (security_invoker = true);

-- ============================================================
-- GRANTS (Supabase anon e authenticated roles)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.recurring_transactions TO authenticated;
GRANT ALL ON public.credit_cards TO authenticated;
GRANT SELECT ON public.dashboard_summary TO authenticated;

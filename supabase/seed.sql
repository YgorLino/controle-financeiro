-- ============================================================
-- CONTROLE MAGUINHO — Categorias Padrão + Seed de Teste
-- seed.sql — Execute APENAS em ambiente de desenvolvimento
-- ============================================================

-- ATENÇÃO: Este seed pressupõe que você já criou um usuário de teste
-- via Supabase Auth (painel ou API) e substituiu o UUID abaixo.
-- Substitua 'SEU-UUID-AQUI' pelo auth.uid() real do usuário de teste.

DO $$
DECLARE
    v_user_id UUID := 'SEU-UUID-AQUI'::UUID; -- <-- substitua pelo UUID real
    v_agosto DATE := '2026-08-01'::DATE;

    -- IDs das categorias para referência nos lançamentos
    cat_salario          UUID;
    cat_vale_alimentacao UUID;
    cat_renda_extra      UUID;
    cat_reembolso        UUID;
    cat_outros_rec       UUID;
    cat_moradia          UUID;
    cat_alimentacao      UUID;
    cat_transporte       UUID;
    cat_saude            UUID;
    cat_educacao         UUID;
    cat_assinaturas      UUID;
    cat_cartao           UUID;
    cat_financiamento    UUID;
    cat_lazer            UUID;
    cat_compras          UUID;
    cat_impostos         UUID;
    cat_outras_desp      UUID;
BEGIN

-- ============================================================
-- CATEGORIAS PADRÃO (income)
-- ============================================================

INSERT INTO public.categories (id, user_id, name, color, transaction_type, is_default)
VALUES
    (gen_random_uuid(), v_user_id, 'Salário',              '#10B981', 'income', TRUE),
    (gen_random_uuid(), v_user_id, 'Vale-alimentação',     '#34D399', 'income', TRUE),
    (gen_random_uuid(), v_user_id, 'Renda extra',          '#6EE7B7', 'income', TRUE),
    (gen_random_uuid(), v_user_id, 'Reembolso',            '#A7F3D0', 'income', TRUE),
    (gen_random_uuid(), v_user_id, 'Outros recebimentos',  '#D1FAE5', 'income', TRUE)
ON CONFLICT (user_id, name) DO NOTHING;

-- Recuperar IDs gerados
SELECT id INTO cat_salario          FROM public.categories WHERE user_id = v_user_id AND name = 'Salário';
SELECT id INTO cat_vale_alimentacao FROM public.categories WHERE user_id = v_user_id AND name = 'Vale-alimentação';
SELECT id INTO cat_renda_extra      FROM public.categories WHERE user_id = v_user_id AND name = 'Renda extra';
SELECT id INTO cat_reembolso        FROM public.categories WHERE user_id = v_user_id AND name = 'Reembolso';
SELECT id INTO cat_outros_rec       FROM public.categories WHERE user_id = v_user_id AND name = 'Outros recebimentos';

-- ============================================================
-- CATEGORIAS PADRÃO (expense)
-- ============================================================

INSERT INTO public.categories (id, user_id, name, color, transaction_type, is_default)
VALUES
    (gen_random_uuid(), v_user_id, 'Moradia',          '#6366F1', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Alimentação',      '#F59E0B', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Transporte',       '#3B82F6', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Saúde',            '#EC4899', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Educação',         '#8B5CF6', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Assinaturas',      '#14B8A6', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Cartão de crédito','#EF4444', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Financiamento',    '#F97316', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Lazer',            '#A855F7', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Compras',          '#84CC16', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Impostos',         '#64748B', 'expense', TRUE),
    (gen_random_uuid(), v_user_id, 'Outras despesas',  '#94A3B8', 'expense', TRUE)
ON CONFLICT (user_id, name) DO NOTHING;

SELECT id INTO cat_moradia       FROM public.categories WHERE user_id = v_user_id AND name = 'Moradia';
SELECT id INTO cat_alimentacao   FROM public.categories WHERE user_id = v_user_id AND name = 'Alimentação';
SELECT id INTO cat_transporte    FROM public.categories WHERE user_id = v_user_id AND name = 'Transporte';
SELECT id INTO cat_saude         FROM public.categories WHERE user_id = v_user_id AND name = 'Saúde';
SELECT id INTO cat_educacao      FROM public.categories WHERE user_id = v_user_id AND name = 'Educação';
SELECT id INTO cat_assinaturas   FROM public.categories WHERE user_id = v_user_id AND name = 'Assinaturas';
SELECT id INTO cat_cartao        FROM public.categories WHERE user_id = v_user_id AND name = 'Cartão de crédito';
SELECT id INTO cat_financiamento FROM public.categories WHERE user_id = v_user_id AND name = 'Financiamento';
SELECT id INTO cat_lazer         FROM public.categories WHERE user_id = v_user_id AND name = 'Lazer';
SELECT id INTO cat_compras       FROM public.categories WHERE user_id = v_user_id AND name = 'Compras';
SELECT id INTO cat_impostos      FROM public.categories WHERE user_id = v_user_id AND name = 'Impostos';
SELECT id INTO cat_outras_desp   FROM public.categories WHERE user_id = v_user_id AND name = 'Outras despesas';

-- ============================================================
-- LANÇAMENTOS DE DEMONSTRAÇÃO — Agosto/2026
-- ============================================================

INSERT INTO public.transactions
    (user_id, description, transaction_type, amount, category_id, reference_month, due_date, status, notes)
VALUES
    -- Entradas
    (v_user_id, 'Salário',              'income',  4733.00, cat_salario,          v_agosto, '2026-08-05', 'paid',    'Salário mensal'),
    (v_user_id, 'Vale-alimentação',     'income',   550.00, cat_vale_alimentacao, v_agosto, '2026-08-05', 'paid',    'VA mensal'),

    -- Saídas — Cartões
    (v_user_id, 'Cartão Nubank',        'expense', 1902.22, cat_cartao,           v_agosto, '2026-08-15', 'pending', 'Fatura Nubank agosto'),
    (v_user_id, 'Cartão Inter',         'expense',  762.38, cat_cartao,           v_agosto, '2026-08-20', 'pending', 'Fatura Inter agosto'),

    -- Saídas — Saúde
    (v_user_id, 'Uniodonto',            'expense',   68.00, cat_saude,            v_agosto, '2026-08-10', 'pending', 'Plano odontológico'),

    -- Saídas — Assinaturas / Internet
    (v_user_id, 'Internet residencial', 'expense',   93.00, cat_assinaturas,      v_agosto, '2026-08-10', 'pending', 'Provedor residencial'),
    (v_user_id, 'Internet celular',     'expense',   50.00, cat_assinaturas,      v_agosto, '2026-08-10', 'pending', 'Plano celular'),

    -- Saídas — Moradia
    (v_user_id, 'Condomínio',           'expense',  260.00, cat_moradia,          v_agosto, '2026-08-10', 'pending', 'Taxa condominial'),
    (v_user_id, 'Financiamento entrada','expense',  239.80, cat_financiamento,    v_agosto, '2026-08-15', 'pending', 'Parcela entrada imóvel'),
    (v_user_id, 'Taxa de obra',         'expense',  487.73, cat_moradia,          v_agosto, '2026-08-15', 'pending', 'Taxa de obra do condomínio')
;

RAISE NOTICE '✅ Seed concluído! Categorias e lançamentos de demonstração inseridos para o usuário %', v_user_id;

END $$;

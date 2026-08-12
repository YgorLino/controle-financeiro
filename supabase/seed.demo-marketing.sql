-- ============================================================
-- SEED DE DEMONSTRAÇÃO E MARKETING
-- supabase/seed.demo-marketing.sql
-- ============================================================
-- Instruções:
-- Execute este arquivo no seu ambiente local (ou ambiente de teste isolado) 
-- apenas para gerar dados que fiquem bem nas telas de demonstração.
-- Não rode em produção real.
-- 
-- Após inserir, crie uma conta ou use uma conta que não tenha restrições, 
-- insira o uuid dessa conta no script ou relacione os dados nela.
-- 
-- Abaixo, utilize uma substituição rápida para gerar para um 'user_id' específico, 
-- ou gere os registros setando para todos os usuários se for ambiente local descartável.
-- Para facilitar, esse seed cria um usuário fixo fictício para a sessão de fotos.
-- ============================================================

DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- UUID fake fixo, mude para o UUID da sua conta de teste se necessário
    v_cat_salario UUID := gen_random_uuid();
    v_cat_renda_extra UUID := gen_random_uuid();
    v_cat_moradia UUID := gen_random_uuid();
    v_cat_alimentacao UUID := gen_random_uuid();
    v_cat_transporte UUID := gen_random_uuid();
    v_cat_assinaturas UUID := gen_random_uuid();
    v_cat_lazer UUID := gen_random_uuid();
    v_month DATE := DATE_TRUNC('month', CURRENT_DATE);
    v_last_month DATE := v_month - INTERVAL '1 month';
BEGIN
    -- ATENÇÃO: Substitua v_user_id pelo UUID real da sua conta de testes, 
    -- ou deixe como está se for rodar o insert de user tbm (requer auth.users insert - mais complexo).
    -- Sugestão: crie a conta na interface, pegue o UUID e substitua aqui.
    -- Como é um script de conveniência, deixarei preparado para UPDATE baseado em e-mail se desejar,
    -- mas o uso mais prático é substituir a variável acima.

    -- Excluir categorias antigas caso já existam para não duplicar (opcional)
    -- DELETE FROM public.categories WHERE user_id = v_user_id;
    -- DELETE FROM public.transactions WHERE user_id = v_user_id;
    -- DELETE FROM public.recurring_transactions WHERE user_id = v_user_id;

    -- Categorias de Entrada
    INSERT INTO public.categories (id, user_id, name, color, transaction_type)
    VALUES 
        (v_cat_salario, v_user_id, 'Salário', '#10B981', 'income'),
        (v_cat_renda_extra, v_user_id, 'Renda Extra', '#34D399', 'income');

    -- Categorias de Saída
    INSERT INTO public.categories (id, user_id, name, color, transaction_type)
    VALUES 
        (v_cat_moradia, v_user_id, 'Moradia', '#6366F1', 'expense'),
        (v_cat_alimentacao, v_user_id, 'Alimentação', '#F59E0B', 'expense'),
        (v_cat_transporte, v_user_id, 'Transporte', '#3B82F6', 'expense'),
        (v_cat_assinaturas, v_user_id, 'Assinaturas', '#8B5CF6', 'expense'),
        (v_cat_lazer, v_user_id, 'Lazer', '#EC4899', 'expense');

    -- Lançamentos: Mês Atual
    INSERT INTO public.transactions (user_id, description, transaction_type, amount, category_id, reference_month, due_date, status, payment_date)
    VALUES
        (v_user_id, 'Salário TechCorp', 'income', 5200.00, v_cat_salario, v_month, v_month + INTERVAL '5 days', 'paid', v_month + INTERVAL '5 days'),
        (v_user_id, 'Freelance App', 'income', 800.00, v_cat_renda_extra, v_month, v_month + INTERVAL '12 days', 'pending', NULL),
        (v_user_id, 'Aluguel e Condomínio', 'expense', 1500.00, v_cat_moradia, v_month, v_month + INTERVAL '10 days', 'paid', v_month + INTERVAL '9 days'),
        (v_user_id, 'Mercado Mensal', 'expense', 650.00, v_cat_alimentacao, v_month, v_month + INTERVAL '8 days', 'paid', v_month + INTERVAL '8 days'),
        (v_user_id, 'Combustível', 'expense', 220.00, v_cat_transporte, v_month, v_month + INTERVAL '15 days', 'pending', NULL),
        (v_user_id, 'Uber/App', 'expense', 200.00, v_cat_transporte, v_month, v_month + INTERVAL '20 days', 'pending', NULL),
        (v_user_id, 'Netflix e Spotify', 'expense', 119.90, v_cat_assinaturas, v_month, v_month + INTERVAL '15 days', 'pending', NULL),
        (v_user_id, 'Restaurante FDS', 'expense', 180.00, v_cat_lazer, v_month, v_month + INTERVAL '22 days', 'pending', NULL),
        (v_user_id, 'Cinema', 'expense', 120.00, v_cat_lazer, v_month, v_month + INTERVAL '25 days', 'pending', NULL);

    -- Recorrências (Para tela de assinaturas/recorrências)
    INSERT INTO public.recurring_transactions (user_id, description, transaction_type, amount, category_id, start_date, due_day, frequency, is_active)
    VALUES
        (v_user_id, 'Aluguel', 'expense', 1500.00, v_cat_moradia, v_last_month, 10, 'monthly', true),
        (v_user_id, 'Netflix Premium', 'expense', 59.90, v_cat_assinaturas, v_last_month, 15, 'monthly', true),
        (v_user_id, 'Internet 500MB', 'expense', 120.00, v_cat_moradia, v_last_month, 8, 'monthly', true);
        
END $$;

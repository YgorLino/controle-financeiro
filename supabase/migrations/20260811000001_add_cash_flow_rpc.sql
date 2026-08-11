-- Função para calcular o Fluxo de Caixa (Regime de Caixa) de um mês específico
-- Soma todas as transações pagas onde a data de pagamento caiu no mês desejado, independentemente da competência.
CREATE OR REPLACE FUNCTION public.get_cash_flow_summary(target_month DATE)
RETURNS TABLE (
    realized_income NUMERIC,
    realized_expense NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'income'), 0) AS realized_income,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'expense'), 0) AS realized_expense
    FROM public.transactions
    WHERE user_id = auth.uid()
      AND status = 'paid'
      AND payment_date IS NOT NULL
      AND date_trunc('month', payment_date)::DATE = date_trunc('month', target_month)::DATE;
END;
$$;

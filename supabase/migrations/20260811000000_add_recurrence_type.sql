-- Adicionar campos para separar Assinaturas de Parcelamentos
ALTER TABLE public.recurring_transactions
ADD COLUMN recurrence_type TEXT DEFAULT 'subscription',
ADD COLUMN installments INTEGER DEFAULT NULL;

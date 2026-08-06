-- Adicionar campos de assinatura na tabela de perfis
ALTER TABLE public.profiles
ADD COLUMN subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;

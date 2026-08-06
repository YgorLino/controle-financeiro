// src/app/core/models/user.model.ts
export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  theme: 'light' | 'dark' | 'system';
  subscription_status?: 'active' | 'inactive';
  subscription_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

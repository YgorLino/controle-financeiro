// src/app/core/models/user.model.ts

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile?: Profile;
}

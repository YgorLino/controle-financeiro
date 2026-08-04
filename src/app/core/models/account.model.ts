// src/app/core/models/account.model.ts

export interface Account {
  id: string;
  user_id: string;
  name: string;
  color: string;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

export interface AccountFormData {
  name: string;
  color: string;
  initial_balance: number;
}

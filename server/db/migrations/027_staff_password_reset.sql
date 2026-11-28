-- Secure single-use password reset tokens for admin/staff accounts.
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS reset_token_hash text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz

-- Additive upgrade for the inspected existing shopping_agent canonical schema.
-- Run as the schema owner, once, after taking a backup. No existing rows are deleted.
-- Existing customers intentionally have NULL email/phone until an administrator
-- associates a verified address; never claim legacy customer IDs from a browser.
BEGIN;
SET LOCAL search_path TO shopping_agent, public;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email varchar(254);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key ON customers(email);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_key ON customers(phone);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_details jsonb;

CREATE TABLE IF NOT EXISTS veyrix_addresses (
  id text PRIMARY KEY,
  customer_id varchar(100) NOT NULL REFERENCES customers(id),
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veyrix_addresses_customer_id_idx ON veyrix_addresses(customer_id);
CREATE TABLE IF NOT EXISTS veyrix_chats (
  id text PRIMARY KEY,
  customer_id varchar(100) NOT NULL REFERENCES customers(id),
  cart jsonb NOT NULL DEFAULT '{}',
  pending jsonb NOT NULL DEFAULT '{}',
  messages jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active',
  lease_token text,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veyrix_chats_customer_id_idx ON veyrix_chats(customer_id);
CREATE TABLE IF NOT EXISTS veyrix_auth_sessions (
  token_hash text PRIMARY KEY,
  customer_id varchar(100) NOT NULL REFERENCES customers(id),
  chat_id text NOT NULL REFERENCES veyrix_chats(id),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veyrix_auth_sessions_customer_id_idx ON veyrix_auth_sessions(customer_id);
CREATE TABLE IF NOT EXISTS veyrix_otp_challenges (
  id text PRIMARY KEY,
  identity_hash text NOT NULL,
  ip_hash text NOT NULL,
  code_hash text NOT NULL,
  email varchar(254),
  customer_id varchar(100) REFERENCES customers(id),
  profile jsonb NOT NULL DEFAULT '{}',
  purpose text NOT NULL DEFAULT 'login',
  chat_id text,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veyrix_otp_challenges_identity_hash_created_at_idx ON veyrix_otp_challenges(identity_hash,created_at);
CREATE INDEX IF NOT EXISTS veyrix_otp_challenges_ip_hash_created_at_idx ON veyrix_otp_challenges(ip_hash,created_at);

-- Browser clients never query these private records directly. The private
-- Prisma server connects using the schema-owner database role.
ALTER TABLE veyrix_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE veyrix_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE veyrix_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE veyrix_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON veyrix_addresses,veyrix_chats,veyrix_auth_sessions,veyrix_otp_challenges FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON veyrix_addresses,veyrix_chats,veyrix_auth_sessions,veyrix_otp_challenges FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON veyrix_addresses,veyrix_chats,veyrix_auth_sessions,veyrix_otp_challenges FROM authenticated;
  END IF;
END $$;
COMMIT;

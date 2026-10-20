CREATE TABLE IF NOT EXISTS t08_accounts (
  id UUID PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE CHECK (handle IN ('owner', 'reviewer')),
  display_name TEXT NOT NULL,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS t08_notes (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES t08_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS t08_notes_owner_idx ON t08_notes(account_id);
CREATE TABLE IF NOT EXISTS t08_passkeys (
  id TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES t08_accounts(id) ON DELETE CASCADE,
  public_key_b64url TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports JSONB NOT NULL DEFAULT '[]'::jsonb,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS t08_passkeys_owner_idx ON t08_passkeys(account_id);
CREATE TABLE IF NOT EXISTS t08_invites (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES t08_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS t08_challenges (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES t08_accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('register', 'authenticate')),
  challenge TEXT NOT NULL UNIQUE,
  invite_id UUID REFERENCES t08_invites(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS t08_challenges_idx ON t08_challenges(account_id,kind);
CREATE TABLE IF NOT EXISTS t08_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES t08_accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS t08_sessions_account_idx ON t08_sessions(account_id);

-- Supabase: no browser/anon/authenticated role may read WebAuthn credentials,
-- invitations, challenges, sessions, or private notes through PostgREST.
-- Only the server's PostgreSQL connection is used for this T08 application.
ALTER TABLE public.t08_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t08_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t08_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t08_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t08_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t08_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.t08_accounts, public.t08_notes, public.t08_passkeys,
  public.t08_invites, public.t08_challenges, public.t08_sessions FROM anon, authenticated;

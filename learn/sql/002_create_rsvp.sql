-- LAMBDA Analytics · RSVP eventos (invitación only)
-- Migration 002: tablas rsvp_invitees + rsvp_responses
-- Vive en la MISMA base Neon que los leads de cursos (reuso de infra, sin servicio nuevo).
-- Aplicar en Neon: psql "$DATABASE_URL" -f sql/002_create_rsvp.sql
-- O desde el SQL Editor de Neon: copiar/pegar y Run. Idempotente.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- =========================================================================
-- 1) Invitados precargados (fuente de verdad de los códigos personales)
-- =========================================================================
CREATE TABLE IF NOT EXISTS rsvp_invitees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Código personal (alta entropía, un código por invitado). Case-insensitive en el lookup.
  code          TEXT NOT NULL,
  event_slug    TEXT NOT NULL DEFAULT 'the-ai-edge',

  -- Datos precargados que se muestran en el formulario
  nombre        TEXT NOT NULL,            -- nombre completo, se precarga (read-only)
  empresa       TEXT,                     -- opcional, precargado si se conoce
  email         TEXT,                     -- opcional, si ya lo conocemos

  -- Control de uso (código de un solo uso)
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  responded_at  TIMESTAMPTZ,
  notes         TEXT
);

-- El código debe ser único por evento. Lookup case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rsvp_invitees_code
  ON rsvp_invitees (event_slug, LOWER(code));

CREATE INDEX IF NOT EXISTS idx_rsvp_invitees_used
  ON rsvp_invitees (event_slug, used);

-- =========================================================================
-- 2) Respuestas de RSVP
-- =========================================================================
CREATE TABLE IF NOT EXISTS rsvp_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  invitee_id    UUID REFERENCES rsvp_invitees(id) ON DELETE SET NULL,
  code          TEXT NOT NULL,
  event_slug    TEXT NOT NULL DEFAULT 'the-ai-edge',
  event_name    TEXT,

  -- Datos del participante
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefono      TEXT,
  empresa       TEXT,

  -- Confirmación de asistencia: 'yes' (confirma) | 'no' (declina)
  attending     TEXT NOT NULL DEFAULT 'yes'
                CHECK (attending IN ('yes','no')),

  -- Invitados sugeridos: array de { nombre, email }
  suggested_guests JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata técnica
  ip            INET,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_created ON rsvp_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event   ON rsvp_responses (event_slug);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_invitee ON rsvp_responses (invitee_id);

-- Trigger updated_at para rsvp_invitees
CREATE OR REPLACE FUNCTION rsvp_invitees_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rsvp_invitees_updated_at ON rsvp_invitees;
CREATE TRIGGER trg_rsvp_invitees_updated_at
  BEFORE UPDATE ON rsvp_invitees
  FOR EACH ROW EXECUTE FUNCTION rsvp_invitees_set_updated_at();

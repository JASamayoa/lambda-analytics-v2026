-- lambda Learn · captura de leads
-- Migration 001: tabla leads
-- Aplicar en Neon: psql "$DATABASE_URL" -f sql/001_create_leads.sql
-- O desde Neon SQL Editor: copiar/pegar el contenido y Run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Curso al que se inscribe el lead
  course_slug     TEXT NOT NULL,           -- ej: 'ia-rrhh', 'fundamentos-ia'
  course_name     TEXT NOT NULL,           -- ej: 'IA aplicada a RRHH y Gestión del Talento - Junio 2026'

  -- Identidad del lead
  nombre          TEXT NOT NULL,
  apellido        TEXT NOT NULL,
  email           TEXT NOT NULL,
  telefono        TEXT NOT NULL,
  empresa         TEXT NOT NULL,
  cargo           TEXT NOT NULL,
  origen          TEXT,                    -- ¿Cómo nos conociste?
  mensaje         TEXT,                    -- Mensaje libre opcional

  -- Atribución de marketing (UTM)
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  referrer        TEXT,
  landing_path    TEXT,

  -- Metadata técnica
  ip              INET,
  user_agent      TEXT,

  -- Estado comercial
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','qualified','enrolled','lost','duplicate')),
  notes           TEXT
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_course_slug ON leads (course_slug);
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_email       ON leads (LOWER(email));

-- Trigger para mantener updated_at sincronizado
CREATE OR REPLACE FUNCTION leads_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_set_updated_at();

-- View útil: leads activos (no perdidos / no duplicados) ordenados por fecha
CREATE OR REPLACE VIEW leads_active AS
SELECT *
FROM leads
WHERE status NOT IN ('lost', 'duplicate')
ORDER BY created_at DESC;

COMMENT ON TABLE leads IS 'Inscripciones recibidas desde learn.lambda-analytics.net';
COMMENT ON COLUMN leads.status IS 'Funnel comercial: new → contacted → qualified → enrolled / lost / duplicate';

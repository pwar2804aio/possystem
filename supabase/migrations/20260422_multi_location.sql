-- v4.6.22 Multi-location reports
-- Run in Supabase SQL Editor BEFORE deploying v4.6.22 app code to production.
-- Additive and idempotent — safe to re-run.
--
-- Adds a many-to-many user ↔ location junction so a single user can belong to
-- multiple sites. Preserves backward compatibility: existing user_profiles rows
-- are seeded into the junction as 'manager' role so nothing breaks on day one.
--
-- Also adds additive RLS policies so a user can read closed_checks and
-- kds_tickets for any location listed in their user_locations rows. Existing
-- policies (if any) are left untouched — PostgreSQL ORs permissive policies,
-- so adding this only grants access, never removes it.

-- ── 1. Junction table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_locations (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid        NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'manager' CHECK (role IN ('owner','manager','staff','viewer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user     ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON user_locations(location_id);

COMMENT ON TABLE  user_locations IS 'Many-to-many user -> location mapping for multi-site owners. v4.6.22.';
COMMENT ON COLUMN user_locations.role IS 'owner | manager | staff | viewer. Controls report + settings visibility per location.';

-- ── 2. Seed from existing single-location profiles ────────────────────────────
-- Every user_profiles row with a location_id becomes a user_locations row as
-- manager. ON CONFLICT DO NOTHING makes this re-runnable.
INSERT INTO user_locations (user_id, location_id, role)
SELECT p.id, p.location_id, 'manager'
  FROM user_profiles p
 WHERE p.location_id IS NOT NULL
ON CONFLICT (user_id, location_id) DO NOTHING;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Users can see their own junction rows
DO $$ BEGIN
  CREATE POLICY user_locations_select_own
    ON user_locations FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Additive policy on closed_checks: permit access to any location in user_locations.
-- If an older policy already grants access (e.g. via user_profiles.location_id),
-- both remain — PostgreSQL ORs permissive policies.
DO $$ BEGIN
  CREATE POLICY closed_checks_select_by_user_locations
    ON closed_checks FOR SELECT
    USING (
      location_id IN (
        SELECT location_id FROM user_locations WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY kds_tickets_select_by_user_locations
    ON kds_tickets FOR SELECT
    USING (
      location_id IN (
        SELECT location_id FROM user_locations WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Note: write policies (INSERT / UPDATE / DELETE) are NOT changed here. A user
-- writing to a location they don't operate from is a separate permission story
-- that belongs in Wave 7 with the location switcher.

-- ── 4. Post-migration roadmap ─────────────────────────────────────────────────
-- Wave 7 will add:
--   - Location picker in the BO topbar (switches the "active" location used by
--     single-location reports and the POS itself).
--   - RLS writes scoped to active location with role-based permissions.
--   - user_locations management UI (owner can invite users to additional sites).

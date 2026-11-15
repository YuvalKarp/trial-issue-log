-- Issues found during a clinical trial site visit.

CREATE TABLE issues (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) > 0),
  site        TEXT NOT NULL CHECK (char_length(btrim(site)) > 0),
  -- CHECK on text rather than a Postgres ENUM: adding a value later is a one-line migration.
  severity    TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list is always sorted newest first; id breaks ties so the order is stable.
CREATE INDEX issues_created_at_idx ON issues (created_at DESC, id DESC);

-- updated_at is maintained by the database, so no query can forget to set it.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_set_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

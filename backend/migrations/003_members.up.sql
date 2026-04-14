-- Add username to users (nullable first, then backfill, then constrain)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- Backfill: generate a unique username from email local-part + short id suffix
UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_]', '', 'g'))
           || '_' || SUBSTRING(id::text, 1, 4)
WHERE username IS NULL;

-- Enforce not-null
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Add unique constraint only if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;

-- Create member role type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE project_role AS ENUM ('owner', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       project_role NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- Seed existing projects: owner becomes a member with role 'owner'
INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_id, 'owner' FROM projects
ON CONFLICT DO NOTHING;

-- Drop is_shared column if it exists
ALTER TABLE projects DROP COLUMN IF EXISTS is_shared;

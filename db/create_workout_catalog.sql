-- Create the workout_catalog table to store structured workouts
CREATE TABLE workout_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  label text,
  workout_data jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Enable Row Level Security (optional depending on app structure)
-- ALTER TABLE workout_catalog ENABLE ROW LEVEL SECURITY;

-- Index for searching by label or name
CREATE INDEX idx_workout_catalog_label ON workout_catalog (label);
CREATE INDEX idx_workout_catalog_name ON workout_catalog (name);

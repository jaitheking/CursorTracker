-- 1. Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the table for your training logs (both running and strength)
CREATE TABLE training_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL, -- e.g., 'Running' or 'Strength'
  details text NOT NULL, -- The manual text or Coros summary
  embedding vector(3072), -- Gemini's embedding size
  created_at timestamp DEFAULT now()
);

-- 3. Create a function to search for similar past workouts
CREATE OR REPLACE FUNCTION match_training_logs (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  activity_type text,
  details text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    training_logs.id,
    training_logs.activity_type,
    training_logs.details,
    1 - (training_logs.embedding <=> query_embedding) AS similarity
  FROM training_logs
  WHERE 1 - (training_logs.embedding <=> query_embedding) > match_threshold
  ORDER BY training_logs.embedding <=> query_embedding
  LIMIT match_count;
$$;
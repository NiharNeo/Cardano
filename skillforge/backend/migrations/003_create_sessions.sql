CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid REFERENCES users(id),
  provider_id uuid REFERENCES providers(id),
  skill text,
  budget numeric,
  duration integer,
  status text CHECK (status IN ('initiated','active','completed','paid')),
  created_at timestamp DEFAULT now()
);

-- Create index on learner_id
CREATE INDEX IF NOT EXISTS idx_sessions_learner_id ON sessions(learner_id);

-- Create index on provider_id
CREATE INDEX IF NOT EXISTS idx_sessions_provider_id ON sessions(provider_id);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

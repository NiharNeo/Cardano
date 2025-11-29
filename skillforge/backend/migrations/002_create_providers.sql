CREATE TABLE providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  skills text[],
  rating numeric,
  cost_per_hour numeric,
  availability text[],
  timezone text
);

-- Create index on skills for faster matching
CREATE INDEX IF NOT EXISTS idx_providers_skills ON providers USING GIN(skills);

-- Create index on cost_per_hour for budget filtering
CREATE INDEX IF NOT EXISTS idx_providers_cost ON providers(cost_per_hour);

-- Create index on rating for sorting
CREATE INDEX IF NOT EXISTS idx_providers_rating ON providers(rating DESC);

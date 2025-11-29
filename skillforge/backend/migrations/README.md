# Database Migrations

Run migrations in order:

1. `001_create_users.sql` - Creates users table
2. `002_create_providers.sql` - Creates providers table
3. `003_create_sessions.sql` - Creates sessions table
4. `004_create_escrow_state.sql` - Creates escrow_state table
5. `005_create_nft_metadata.sql` - Creates nft_metadata table

## Running Migrations

```bash
# Using psql
psql -d skillforge -f migrations/001_create_users.sql
psql -d skillforge -f migrations/002_create_providers.sql
psql -d skillforge -f migrations/003_create_sessions.sql
psql -d skillforge -f migrations/004_create_escrow_state.sql
psql -d skillforge -f migrations/005_create_nft_metadata.sql
```

## Schema Overview

### users
- `id` (uuid, PK)
- `wallet_address` (text, UNIQUE)
- `created_at` (timestamp)

### providers
- `id` (uuid, PK)
- `name` (text)
- `skills` (text[])
- `rating` (numeric)
- `cost_per_hour` (numeric)
- `availability` (text[])
- `timezone` (text)

### sessions
- `id` (uuid, PK)
- `learner_id` (uuid, FK → users.id)
- `provider_id` (uuid, FK → providers.id)
- `skill` (text)
- `budget` (numeric)
- `duration` (integer)
- `status` (text: 'initiated', 'active', 'completed', 'paid')
- `created_at` (timestamp)

### escrow_state
- `session_id` (uuid, PK, FK → sessions.id)
- `utxo` (text)
- `status` (text)
- `updated_at` (timestamp)

### nft_metadata
- `session_id` (uuid, PK, FK → sessions.id)
- `ipfs_hash` (text)
- `metadata_json` (jsonb)
- `minted` (boolean, default false)
- `minted_at` (timestamp)

## Seeding Data

After running migrations, you may want to seed the providers table:

```sql
INSERT INTO providers (name, skills, rating, cost_per_hour, availability, timezone)
VALUES
  ('AdaLabs Collective', ARRAY['cardano', 'plutus', 'smart contract', 'nft'], 4.9, 80.00, ARRAY['today', 'this week'], 'UTC'),
  ('DeFi Sherpa', ARRAY['defi', 'smart contract', 'haskell'], 4.7, 60.00, ARRAY['evenings', 'weekends'], 'UTC-5'),
  ('React Dapp Studio', ARRAY['react', 'typescript', 'wallet', 'dapp', 'ux'], 4.6, 45.00, ARRAY['today', 'this week'], 'UTC');
```

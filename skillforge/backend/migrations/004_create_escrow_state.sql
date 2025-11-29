CREATE TABLE escrow_state (
  session_id uuid PRIMARY KEY REFERENCES sessions(id),
  utxo text,
  status text,
  updated_at timestamp DEFAULT now()
);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_escrow_state_status ON escrow_state(status);

-- Create index on utxo
CREATE INDEX IF NOT EXISTS idx_escrow_state_utxo ON escrow_state(utxo);

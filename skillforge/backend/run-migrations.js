const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skillforge',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      console.log(`Running ${file}...`);
      await pool.query(sql);
      console.log(`✓ ${file} completed`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠ ${file} - tables already exist, skipping`);
      } else {
        console.error(`✗ ${file} failed:`, error.message);
        throw error;
      }
    }
  }

  // Insert sample providers
  try {
    const result = await pool.query('SELECT COUNT(*) FROM providers');
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.log('Inserting sample providers...');
      await pool.query(`
        INSERT INTO providers (name, skills, rating, cost_per_hour, availability, timezone)
        VALUES 
          ('Alice Mentor', ARRAY['javascript', 'react', 'typescript'], 4.8, 50, ARRAY['today', 'this week'], 'UTC'),
          ('Bob Developer', ARRAY['python', 'django', 'postgresql'], 4.9, 45, ARRAY['today'], 'UTC'),
          ('Carol Expert', ARRAY['cardano', 'plutus', 'blockchain'], 5.0, 60, ARRAY['this week'], 'UTC')
        ON CONFLICT DO NOTHING;
      `);
      console.log('✓ Sample providers inserted');
    } else {
      console.log(`✓ Providers table already has ${count} providers`);
    }
  } catch (error) {
    console.error('Error inserting sample providers:', error.message);
  }

  await pool.end();
  console.log('✓ All migrations completed');
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});


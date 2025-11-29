import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skillforge',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Use DATABASE_URL if provided (for production)
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection with better diagnostics
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Database config:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      hasPassword: !!poolConfig.password
    });
  } else {
    console.log('✅ Database connected successfully');
    console.log('Database time:', res.rows[0].now);
  }
});

// Test table existence on startup
pool.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('users', 'providers', 'sessions', 'escrow_state', 'nft_metadata')
  ORDER BY table_name
`, (err, res) => {
  if (err) {
    console.error('❌ Error checking tables:', err.message);
  } else {
    const tables = res.rows.map(r => r.table_name);
    console.log('📊 Found tables:', tables.length > 0 ? tables.join(', ') : 'None');
    if (tables.length < 5) {
      console.warn('⚠️  Warning: Some tables are missing. Run migrations: npm run migrate:up');
    }
  }
});

export default pool;


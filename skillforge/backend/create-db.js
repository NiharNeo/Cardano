const { Pool } = require('pg');
require('dotenv').config();

// Connect to default postgres database to create skillforge
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres', // Connect to default database
  user: process.env.DB_USER || 'niharchavan',
  password: process.env.DB_PASSWORD || '',
});

async function createDatabase() {
  try {
    // Check if database exists
    const result = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'skillforge'"
    );

    if (result.rows.length > 0) {
      console.log('✓ Database "skillforge" already exists');
      await adminPool.end();
      return;
    }

    // Create database
    await adminPool.query('CREATE DATABASE skillforge');
    console.log('✓ Database "skillforge" created successfully');
    await adminPool.end();
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Database "skillforge" already exists');
    } else {
      console.error('✗ Error creating database:', error.message);
      console.error('Make sure PostgreSQL is running and you have permission to create databases');
      process.exit(1);
    }
    await adminPool.end();
  }
}

createDatabase();


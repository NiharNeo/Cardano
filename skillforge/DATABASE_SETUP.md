# Database Setup Guide

## Issue: PostgreSQL User Not Found

The migration script failed because the default PostgreSQL user `postgres` doesn't exist on your system.

## Quick Fix Options

### Option 1: Use Your System Username (macOS default)

On macOS, PostgreSQL often uses your system username as the default database user. Update `skillforge/backend/.env`:

```env
DB_USER=your_username_here  # Replace with your macOS username
DB_PASSWORD=  # Leave empty if no password is set
```

To find your username:
```bash
whoami
```

### Option 2: Create the postgres User

If you want to use the `postgres` user, create it:

```bash
# Connect to PostgreSQL as superuser (replace with your actual user)
psql postgres

# Then run:
CREATE USER postgres WITH PASSWORD 'postgres';
ALTER USER postgres CREATEDB;
\q
```

### Option 3: Use Existing PostgreSQL Setup

If you have PostgreSQL installed via Homebrew or another method, check your existing setup:

```bash
# Check PostgreSQL status
brew services list | grep postgres

# Or check running processes
ps aux | grep postgres
```

## Running Migrations

After updating `.env` with the correct database credentials, run:

```bash
cd skillforge/backend
node run-migrations.js
```

This will:
1. Create all required tables
2. Insert sample providers

## Manual Database Creation

If you prefer to create the database manually:

```bash
# Connect to PostgreSQL
psql -U your_username -d postgres

# Create database
CREATE DATABASE skillforge;

# Exit
\q
```

Then run the migrations as above.

## Verify Setup

Check that tables were created:

```bash
psql -U your_username -d skillforge -c "\dt"
```

You should see:
- users
- providers
- sessions
- escrow_state
- nft_metadata

## Sample Data

The migration script automatically inserts 3 sample providers. You can verify:

```bash
psql -U your_username -d skillforge -c "SELECT name, skills, rating FROM providers;"
```


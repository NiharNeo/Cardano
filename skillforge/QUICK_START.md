# Quick Start Guide

## Current Status

✅ **Frontend**: Running on http://localhost:5173
⚠️ **Backend**: May need database configuration
⚠️ **Database**: PostgreSQL user needs to be configured

## Steps to Complete Setup

### 1. Configure Database User

The backend needs to connect to PostgreSQL. Update `skillforge/backend/.env`:

```env
DB_USER=your_username  # Your macOS username (run 'whoami' to find it)
DB_PASSWORD=           # Leave empty if no password
```

### 2. Create Database (if needed)

```bash
# Connect to PostgreSQL
psql -U your_username -d postgres

# Create database
CREATE DATABASE skillforge;
\q
```

### 3. Run Migrations

```bash
cd skillforge/backend
node run-migrations.js
```

### 4. Start Backend Server

If not already running:

```bash
cd skillforge/backend
npm run dev
```

The backend should start on http://localhost:3000

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/

## Troubleshooting

### Backend Not Starting

1. Check database connection in `.env`
2. Ensure PostgreSQL is running: `brew services list | grep postgres`
3. Check backend logs for errors

### "Failed to fetch" Errors

1. Ensure backend is running on port 3000
2. Check `VITE_BACKEND_URL` in `skillforge/frontend/.env`
3. Check browser console for CORS errors

### Database Connection Errors

See `DATABASE_SETUP.md` for detailed database setup instructions.

## Testing

Once everything is running:

1. Open http://localhost:5173 in your browser
2. Try entering a skill request like: "I need help with JavaScript, budget 50 ADA"
3. Check browser console and backend terminal for logs
4. Verify providers are returned from `/match` endpoint


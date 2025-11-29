# SkillForge Debugging Fixes

## Issues Fixed

### 1. Frontend API URL Configuration ✅
- **Changed**: `VITE_API_BASE_URL` → `VITE_BACKEND_URL`
- **Changed**: Default port from `4000` → `3000`
- **File**: `skillforge/frontend/src/services/api.ts`
- **Action Required**: Create `skillforge/frontend/.env` with:
  ```
  VITE_BACKEND_URL=http://localhost:3000
  ```

### 2. Backend Port Configuration ✅
- **Changed**: Default port from `4000` → `3000`
- **File**: `skillforge/backend/src/index.ts`
- **Action Required**: Create `skillforge/backend/.env` with:
  ```
  PORT=3000
  ```

### 3. CORS Configuration ✅
- **Added**: Explicit CORS configuration with methods and headers
- **File**: `skillforge/backend/src/index.ts`
- **Configuration**:
  ```typescript
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }));
  ```

### 4. Route Path Fix ✅
- **Fixed**: Removed double `/match` path
- **Changed**: `router.post('/match', ...)` → `router.post('/', ...)`
- **File**: `skillforge/backend/src/routes/match.ts`
- **Result**: `/match` endpoint now works correctly

### 5. Error Handling & Logging ✅
- **Added**: Request logging middleware
- **Added**: Console logging for all routes (request body, errors, stack traces)
- **Added**: Proper error responses with `{ success: false, error, message }`
- **Files**: All route files in `skillforge/backend/src/routes/`

### 6. JSON Response Format ✅
- **Changed**: All routes now return `{ success: true, data: ... }` format
- **Updated**: Frontend API service to handle both formats (backward compatible)
- **Files**: 
  - All backend route files
  - `skillforge/frontend/src/services/api.ts`

### 7. Database Diagnostics ✅
- **Added**: Enhanced database connection diagnostics
- **Added**: Table existence check on startup
- **File**: `skillforge/backend/src/config/database.ts`

### 8. Frontend Error Handling ✅
- **Added**: Better error messages for network failures
- **Added**: Console logging for API calls
- **File**: `skillforge/frontend/src/App.tsx`

## Setup Instructions

### 1. Create Frontend .env File
Create `skillforge/frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
```

### 2. Create Backend .env File
Create `skillforge/backend/.env`:
```env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=skillforge
DB_USER=postgres
DB_PASSWORD=postgres
# Or use DATABASE_URL for production:
# DATABASE_URL=postgresql://user:password@localhost:5432/skillforge

# Blockfrost API (for Cardano blockchain queries)
BLOCKFROST_API_KEY=your_blockfrost_api_key_here
BLOCKFROST_NETWORK=preview  # or 'mainnet'

# Pinata IPFS Configuration
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
```

### 3. Ensure Database is Running
- Make sure PostgreSQL is running
- Run migrations: `cd skillforge/backend && npm run migrate:up`
- Verify tables exist: `users`, `providers`, `sessions`, `escrow_state`, `nft_metadata`

### 4. Insert Sample Providers (if needed)
```sql
INSERT INTO providers (name, skills, rating, cost_per_hour, availability, timezone)
VALUES 
  ('Alice Mentor', ARRAY['javascript', 'react', 'typescript'], 4.8, 50, ARRAY['today', 'this week'], 'UTC'),
  ('Bob Developer', ARRAY['python', 'django', 'postgresql'], 4.9, 45, ARRAY['today'], 'UTC'),
  ('Carol Expert', ARRAY['cardano', 'plutus', 'blockchain'], 5.0, 60, ARRAY['this week'], 'UTC');
```

### 5. Start Backend Server
```bash
cd skillforge/backend
npm install  # if needed
npm run dev
```

### 6. Start Frontend Server
```bash
cd skillforge/frontend
npm install  # if needed
npm run dev
```

## Testing

1. **Test Backend Health**: `curl http://localhost:3000/`
2. **Test Match Endpoint**: 
   ```bash
   curl -X POST http://localhost:3000/match \
     -H "Content-Type: application/json" \
     -d '{"skill": "javascript", "budget": 50}'
   ```
3. **Check Browser Console**: Look for API call logs and errors
4. **Check Backend Console**: Look for request logs and database connection status

## Common Issues

### "Failed to fetch"
- **Cause**: Backend not running or wrong URL
- **Fix**: Ensure backend is running on port 3000, check `VITE_BACKEND_URL` in frontend `.env`

### CORS Errors
- **Cause**: CORS not configured or wrong origin
- **Fix**: Check `CORS_ORIGIN` in backend `.env` matches frontend URL

### Database Connection Errors
- **Cause**: PostgreSQL not running or wrong credentials
- **Fix**: Check database is running, verify credentials in backend `.env`

### Route Not Found (404)
- **Cause**: Route path mismatch
- **Fix**: Verify route definitions match API calls in frontend

## Verification Checklist

- [ ] Frontend `.env` file created with `VITE_BACKEND_URL=http://localhost:3000`
- [ ] Backend `.env` file created with database and API keys
- [ ] PostgreSQL is running
- [ ] Database migrations have been run
- [ ] Sample providers exist in database
- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Backend health check returns 200
- [ ] `/match` endpoint returns providers
- [ ] No CORS errors in browser console
- [ ] No "Failed to fetch" errors


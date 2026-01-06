# MFS Inventory Tracker v2

Process Room Scanning System for MFS Global LTD.

## New in v2

- **🔐 User Login** - Secure access with username/password
- **🔊 Sound Feedback** - Audio confirmation on successful scans
- **📴 Offline Mode** - Queue scans when WiFi drops, auto-sync when back online
- **↩️ Undo Last Scan** - Quick button to remove the last entry

## Features

- **Lamb Inventory** (Active)
  - Goods In: Scan carcass tags, auto-extract kill date/number, manual weight entry
  - Goods Produced: Scan Avery Berkel labels, auto-extract PLU and weight

- **Beef & Poultry** (Coming Soon)

- **Admin Dashboard** (Admin users only)
  - View reports with date filtering
  - Export to CSV
  - Upload PLU list from MXi Pro
  - Yield calculations
  - User management (add/remove users)

## Default Users

| Username | Password | Role |
|----------|----------|------|
| admin | mfs2026 | Admin |
| butcher1 | lamb123 | Butcher |
| butcher2 | lamb123 | Butcher |

**⚠️ Change these passwords in production!**

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase (PostgreSQL database)
- Vercel (hosting)

## Deployment

### Update Existing Deployment

1. Replace the files in your local repository with these new files
2. Commit and push:
   ```bash
   git add .
   git commit -m "Add login, sound, offline mode, undo features"
   git push
   ```
3. Vercel will auto-deploy

### Fresh Deployment

1. Push to GitHub
2. Import to Vercel
3. Deploy

## Database Tables Required

Run this SQL in Supabase if not already done:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'butcher',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON users FOR ALL USING (true);

-- Default users
INSERT INTO users (username, password, role) VALUES 
  ('admin', 'mfs2026', 'admin'),
  ('butcher1', 'lamb123', 'butcher'),
  ('butcher2', 'lamb123', 'butcher');
```

## User Roles

| Role | Access |
|------|--------|
| **admin** | Full access - scanning, reports, user management, PLU upload |
| **butcher** | Scanning only - Goods In and Goods Produced |

## Offline Mode

When WiFi drops:
- Scans are saved locally in browser storage
- Yellow "Offline" indicator appears
- When back online, data auto-syncs to database
- Pending items show "⏳ Pending sync" label

## Sound Feedback

- ✅ **Success beep** - Barcode parsed correctly
- ❌ **Error beep** - Barcode could not be parsed
- 🗑️ **Delete beep** - Entry deleted

Also vibrates on mobile devices if supported.

## Barcode Formats

### Carcass Tags (Code 128)
Format: `PA2YYYYMMDDXXXXNNN`
- PA2 = Prefix
- YYYYMMDD = Kill date
- XXXX = Kill number
- NNN = Sequence

### Product Labels (EAN-13, Avery Berkel Format 14)
Format: `26PPPPVWWWWWC`
- 26 = Prefix
- PPPP = PLU (4 digits)
- V = Verifier
- WWWWW = Weight (divide by 1000 for kg)
- C = Checksum

## Support

Contact MFS Global for support.

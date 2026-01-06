# MFS Inventory Tracker

Process Room Scanning System for MFS Global LTD.

## Features

- **Lamb Inventory** (Active)
  - Goods In: Scan carcass tags, auto-extract kill date/number, manual weight entry
  - Goods Produced: Scan Avery Berkel labels, auto-extract PLU and weight

- **Beef & Poultry** (Coming Soon)

- **Admin Dashboard**
  - View reports with date filtering
  - Export to CSV
  - Upload PLU list from MXi Pro
  - Yield calculations

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase (PostgreSQL database)
- Vercel (hosting)

## Deployment to Vercel

### Option 1: GitHub (Recommended)

1. Create a GitHub repository
2. Push this code to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/mfs-inventory-tracker.git
   git push -u origin main
   ```

3. Go to [vercel.com](https://vercel.com)
4. Sign up / Log in with GitHub
5. Click "New Project"
6. Import your GitHub repository
7. Click "Deploy"
8. Done! Your app will be live at `https://your-project.vercel.app`

### Option 2: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Run in the project directory:
   ```bash
   vercel
   ```

3. Follow the prompts

## Local Development

```bash
npm install
npm run dev
```

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
- WWWWW = Weight (5 digits, divide by 1000 for kg)
- C = Checksum

## Avery Berkel Configuration

Change barcode format to **ID 14**:
1. System Setup > Configuration > Barcode Configuration
2. Set "Add Label Single Item Barcode Format" to ID 14

## Support

Contact MFS Global for support.

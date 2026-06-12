# HHOF Database

Tools and scripts for managing the USA 80-Plus Hockey Hall of Fame inductee database, backed by [Supabase](https://supabase.com).

## Scripts

### `migrate-photos.js`

Migrates inductee profile photos from the legacy website (`usa80plushockeyhalloffame.com`) into Supabase Storage and updates the `inductees.photo_url` column with the new URLs.

It is safe to re-run — it only processes rows where `photo_url` still points to the old website.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Get your credentials from:  
**Supabase Dashboard → Project Settings → API**

- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_KEY` — your service role key (keep this secret)

### 3. Run the migration

```bash
npm run migrate
```

## Database

The `inductees` table includes:

| Column | Description |
|---|---|
| `id` | Primary key |
| `first_name` | Inductee first name |
| `last_name` | Inductee last name |
| `induction_year` | Year inducted |
| `photo_url` | URL to profile photo (Supabase Storage) |
| `deleted_at` | Soft delete timestamp |

## Storage

Photos are stored in the `inductee-photos` Supabase Storage bucket under the path:

```
{first-last}/profile/{timestamp}-{first-last}.{ext}
```

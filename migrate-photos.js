// ============================================================
// HHOF Photo Migration Script
// Moves profile photos from website /images/ folder
// into Supabase Storage and updates inductees.photo_url
// ============================================================
// BEFORE RUNNING:
//   npm install @supabase/supabase-js node-fetch
// RUN WITH:
//   node migrate-photos.js
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ── SUPABASE CREDENTIALS (loaded from .env) ───────────────────
// Create a .env file with:
//   SUPABASE_URL=https://your-project.supabase.co
//   SUPABASE_SERVICE_KEY=your-service-role-key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────

const BUCKET = 'inductee-photos';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── HELPER: slugify a name for the storage folder path ────────
// Example: "Larry Bergeron" → "larry-bergeron"
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── HELPER: get file extension from URL ──────────────────────
// Example: "Bergeron_Larry.png" → "png"
function getExtension(url) {
  const parts = url.split('.');
  return parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
}

// ── MAIN MIGRATION FUNCTION ───────────────────────────────────
async function migratePhotos() {

  console.log('========================================');
  console.log('  HHOF Photo Migration Starting...');
  console.log('========================================\n');

  // Step 1: Fetch all inductees whose photo_url is still on the website
  console.log('Step 1: Fetching inductees with website photo URLs...');
  const { data: inductees, error: fetchError } = await supabase
    .from('inductees')
    .select('id, first_name, last_name, induction_year, photo_url')
    .like('photo_url', '%usa80plushockeyhalloffame.com%')
    .is('deleted_at', null);

  if (fetchError) {
    console.error('ERROR fetching inductees:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${inductees.length} inductees to migrate.\n`);

  // Step 2: Loop through each inductee and migrate their photo
  let successCount = 0;
  let failCount = 0;

  for (const inductee of inductees) {

    const fullName = `${inductee.first_name} ${inductee.last_name}`;
    console.log(`Processing: ${fullName} (${inductee.induction_year})...`);

    try {
      // Step 2a: Download the photo from the website
      const response = await fetch(inductee.photo_url);
      if (!response.ok) {
        throw new Error(`Could not download photo — HTTP ${response.status}`);
      }
      const photoBuffer = await response.buffer();

      // Step 2b: Build the storage path
      // Format: lastname-firstname/profile/timestamp-lastname-firstname.ext
      const slug = slugify(fullName);
      const ext = getExtension(inductee.photo_url);
      const timestamp = Date.now();
      const storagePath = `${slug}/profile/${timestamp}-${slug}.${ext}`;

      // Step 2c: Determine content type
      const contentType = ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : 'image/png';

      // Step 2d: Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, photoBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed — ${uploadError.message}`);
      }

      // Step 2e: Get the new public URL from Supabase Storage
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      const newPhotoUrl = urlData.publicUrl;

      // Step 2f: Update the inductee record with the new URL
      const { error: updateError } = await supabase
        .from('inductees')
        .update({ photo_url: newPhotoUrl })
        .eq('id', inductee.id);

      if (updateError) {
        throw new Error(`Database update failed — ${updateError.message}`);
      }

      console.log(`  ✓ SUCCESS: ${newPhotoUrl}\n`);
      successCount++;

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}\n`);
      failCount++;
    }
  }

  // Step 3: Print summary
  console.log('========================================');
  console.log('  Migration Complete!');
  console.log('========================================');
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ✗ Failed:     ${failCount}`);
  console.log(`  Total:        ${inductees.length}`);
  console.log('========================================');

  if (failCount > 0) {
    console.log('\nFor any failed photos, check the errors above.');
    console.log('You can re-run this script safely — it only');
    console.log('processes photos still on the website URL.');
  } else {
    console.log('\nAll photos are now in Supabase Storage!');
  }
}

// ── RUN IT ────────────────────────────────────────────────────
migratePhotos();

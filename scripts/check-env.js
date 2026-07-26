// Fails the build loudly if a required env var is missing, instead of only
// surfacing later when a specific feature breaks for a real user (this is
// how SUPABASE_SERVICE_ROLE_KEY went missing from Production undetected).
// Reads required var names from .env.example so there's a single source of
// truth -- add a var there and it's automatically enforced here too.
const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');

// Load .env.local/.env exactly the way Next.js itself does -- this script
// runs as a separate `prebuild` process, outside Next's own env loading.
// On Vercel this is a no-op (env vars are already real process env vars),
// but it's what makes local `npm run build` see .env.local correctly.
loadEnvConfig(path.join(__dirname, '..'));

const envExamplePath = path.join(__dirname, '..', '.env.example');
const envExample = fs.readFileSync(envExamplePath, 'utf8');

const required = envExample
  .split('\n')
  .map((line) => line.match(/^([A-Z0-9_]+)=/))
  .filter(Boolean)
  .map((match) => match[1]);

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('\nMissing required environment variables:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error(`\nSee .env.example for what each one is for.\n`);
  process.exit(1);
}

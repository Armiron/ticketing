import { existsSync } from 'fs';
import { join } from 'path';

// Load payments/.env (gitignored — see .env.example) before any test file
// imports the app, so the Stripe client is constructed with STRIPE_KEY set.
// Node >= 20.6 provides process.loadEnvFile natively — no dotenv needed.
const envPath = join(__dirname, '..', '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load the repo-root .env so DATABASE_URL (and friends) are available to
// integration tests. pnpm runs package scripts with cwd = the package dir, so
// the root .env is two levels up. Missing file is fine — dotenv ignores it, and
// DB integration tests self-skip when DATABASE_URL is unset.
config({ path: resolve(process.cwd(), '../../.env') });

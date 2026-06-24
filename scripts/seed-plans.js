#!/usr/bin/env node

/**
 * Seed pricing plans with updated values
 * Run with: node scripts/seed-plans.js
 */

import { seedPlans } from '../lib/handlers/pricing.js';

async function main() {
  console.log('[Seed] Starting plan seeding...');
  await seedPlans();
  console.log('[Seed] ✅ Complete! Plans have been updated with new pricing.');
  process.exit(0);
}

main().catch(err => {
  console.error('[Seed] ❌ Error:', err);
  process.exit(1);
});

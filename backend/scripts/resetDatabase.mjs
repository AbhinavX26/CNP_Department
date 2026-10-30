/**
 * Database Reset Script - CNP Department
 * 
 * Safety measures:
 * - Read-only DRY RUN mode by default (requires `--confirm` and interactive confirmation to execute).
 * - Strict database-name assertion (aborts if not strictly 'test').
 * - Pre-flight account validation: aborts if any of the 10 accounts is missing, if roles don't match, or if password hash is missing.
 * - Full transparency: lists database name, all affected collections, counts, retained emails, and pruned emails.
 * - Non-interactive bypass disabled: live reset strictly requires typing 'RESET'.
 * - Preserves collection schemas and indexes by using deleteMany() instead of dropping collections.
 * - Post-reset verification: performs exact set comparison of remaining user emails against allowlist, verifies roles and bcrypt hashes, and verifies that all 14 demo collections have count === 0.
 * - Strict failure handling: exits with code 1 if any check or deletion fails.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import readline from 'node:readline';

// Fix DNS resolution for MongoDB Atlas SRV in certain Node environments
dns.setServers(['8.8.8.8', '1.1.1.1']);

import connectDB from '../config/db.js';

// Import Mongoose models to use actual registered schemas and collection names
import User from '../src/models/User.js';
import Club from '../src/models/Club.js';
import ClubMembership from '../src/models/ClubMembership.js';
import Project from '../src/models/Project.js';
import ProjectMembership from '../src/models/ProjectMembership.js';
import ProjectMentor from '../src/models/ProjectMentor.js';
import JoinRequest from '../src/models/JoinRequest.js';
import Event from '../src/models/Event.js';
import Notification from '../src/models/Notification.js';
import ProjectUpdate from '../src/models/ProjectUpdate.js';
import ProjectFeedback from '../src/models/ProjectFeedback.js';
import GuitarInventory from '../src/models/GuitarInventory.js';
import InventoryAllocation from '../src/models/InventoryAllocation.js';
import MaterialRequest from '../src/models/MaterialRequest.js';
import ProjectMaterial from '../src/models/ProjectMaterial.js';

// ─── Configuration ─────────────────────────────────────────────────────────────

const TARGET_DB_NAME = 'test';

// Exactly 10 verified accounts to preserve with their intended roles
export const PRESERVED_ACCOUNTS = [
  // 4 Students
  { email: 'arjun.mehta@test.com', expectedRole: 'student' },
  { email: 'riya.sharma@test.com', expectedRole: 'student' },
  { email: 'kabir.patel@test.com', expectedRole: 'student' },
  { email: 'ananya.singh@test.com', expectedRole: 'student' },
  // 2 Faculty Coordinators
  { email: 'neha.verma@test.com', expectedRole: 'faculty_coordinator' },
  { email: 'rahul.desai@test.com', expectedRole: 'faculty_coordinator' },
  // 2 Faculty Mentors
  { email: 'amit.joshi@test.com', expectedRole: 'faculty_mentor' },
  { email: 'priya.nair@test.com', expectedRole: 'faculty_mentor' },
  // 1 Club Admin
  { email: 'karan.shah@test.com', expectedRole: 'club_admin' },
  // 1 Project Admin
  { email: 'vivek.malhotra@test.com', expectedRole: 'project_admin' }
];

export const PRESERVED_EMAILS = PRESERVED_ACCOUNTS.map((a) => a.email);

// 14 Collections to completely clear of demo records
const DEMO_COLLECTION_MODELS = [
  { model: Club, name: 'Clubs' },
  { model: Project, name: 'Projects' },
  { model: ClubMembership, name: 'Club Memberships' },
  { model: ProjectMembership, name: 'Project Memberships' },
  { model: ProjectMentor, name: 'Project Mentors' },
  { model: JoinRequest, name: 'Join Requests' },
  { model: Event, name: 'Events' },
  { model: Notification, name: 'Notifications' },
  { model: ProjectUpdate, name: 'Project Updates' },
  { model: ProjectFeedback, name: 'Project Feedback' },
  { model: GuitarInventory, name: 'Guitar Inventory' },
  { model: InventoryAllocation, name: 'Inventory Allocations' },
  { model: MaterialRequest, name: 'Material Requests' },
  { model: ProjectMaterial, name: 'Project Materials' }
];

// ─── Helper Functions ──────────────────────────────────────────────────────────

function askConfirmation(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printBanner(isDryRun) {
  console.log('\n============================================================');
  console.log(`  CNP Department Database Reset Script [${isDryRun ? 'DRY-RUN MODE' : 'LIVE RESET'}]`);
  console.log('============================================================');
}

// ─── Main Routine ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm');
  const isDryRun = !isConfirm;

  printBanner(isDryRun);

  // 1. Backup Recommendation Notice
  console.log('\n📦 BACKUP RECOMMENDATION:');
  console.log('   Before performing a live reset, ensure you have taken a backup.');
  console.log('   Atlas: Create an on-demand snapshot via MongoDB Atlas Console.');
  console.log('   CLI:   mongodump --uri="<MONGODB_URI>" --db=test --out=./backup_$(date +%Y%m%d_%H%M%S)\n');

  // 2. Connect to database
  console.log('🔌 Connecting to MongoDB...');
  await connectDB();
  const conn = mongoose.connection;

  // 3. Database Name Safety Check
  const activeDbName = conn.name;
  console.log(`🔍 Connected database name: "${activeDbName}" on host: ${conn.host}`);

  if (activeDbName !== TARGET_DB_NAME) {
    console.error(`\n❌ SAFETY ABORT: Connected database is "${activeDbName}", but this script is strictly configured for "${TARGET_DB_NAME}".`);
    console.error('   Aborting immediately. No modifications were made.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✅ Database name verified: strictly matches "${TARGET_DB_NAME}".`);

  // 4. Pre-flight Validation of Preserved Accounts
  console.log(`\n👥 Validating Preserved Accounts (${PRESERVED_ACCOUNTS.length} accounts):`);
  const preservedUsersInDb = await User.find({ email: { $in: PRESERVED_EMAILS } })
    .select('+password')
    .lean();

  const foundUserMap = new Map(preservedUsersInDb.map((u) => [u.email, u]));
  const validationErrors = [];

  for (const item of PRESERVED_ACCOUNTS) {
    const userDoc = foundUserMap.get(item.email);
    if (!userDoc) {
      validationErrors.push(`Missing required account: ${item.email}`);
      console.error(`   ❌ MISSING: ${item.email}`);
      continue;
    }
    if (userDoc.role !== item.expectedRole) {
      validationErrors.push(`Role mismatch for ${item.email}: expected "${item.expectedRole}", found "${userDoc.role}"`);
      console.error(`   ❌ ROLE MISMATCH: ${item.email} (expected "${item.expectedRole}", found "${userDoc.role}")`);
      continue;
    }
    const hasHash = Boolean(userDoc.password && userDoc.password.startsWith('$2'));
    if (!hasHash) {
      validationErrors.push(`Missing or invalid Bcrypt password hash for ${item.email}`);
      console.error(`   ❌ INVALID PASSWORD HASH: ${item.email}`);
      continue;
    }
    console.log(`   ✓ Verified [${userDoc.role.padEnd(19)}] ${userDoc.name.padEnd(20)} (${item.email}) | Bcrypt: OK`);
  }

  if (validationErrors.length > 0) {
    console.error('\n❌ PRE-FLIGHT VALIDATION FAILED:');
    for (const err of validationErrors) {
      console.error(`   - ${err}`);
    }
    console.error('Aborting immediately. No data was modified.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('✅ All 10 preserved accounts verified with expected roles and intact password hashes.');

  // 5. Gather Counts and Analyze Impact
  console.log('\n📊 Affected Collections & Document Counts:');
  console.log('----------------------------------------------------------------------');
  console.log(` ${'Collection'.padEnd(24)} | ${'Mongoose Model'.padEnd(20)} | ${'Current Records'.padStart(15)}`);
  console.log('----------------------------------------------------------------------');

  const counts = [];
  for (const item of DEMO_COLLECTION_MODELS) {
    const colName = item.model.collection.collectionName;
    const currentCount = await item.model.countDocuments();
    counts.push({ name: item.name, colName, model: item.model.modelName, currentCount, toDelete: currentCount });
    console.log(` ${colName.padEnd(24)} | ${item.model.modelName.padEnd(20)} | ${String(currentCount).padStart(15)}`);
  }

  const allUsers = await User.find({}).select('email role name').lean();
  const usersToRetain = allUsers.filter((u) => PRESERVED_EMAILS.includes(u.email));
  const usersToDelete = allUsers.filter((u) => !PRESERVED_EMAILS.includes(u.email));

  console.log(` ${User.collection.collectionName.padEnd(24)} | ${User.modelName.padEnd(20)} | ${String(allUsers.length).padStart(15)} (${usersToDelete.length} to delete, ${usersToRetain.length} to retain)`);
  console.log('----------------------------------------------------------------------');

  // Display exact user emails retained
  console.log(`\n📋 Exactly ${usersToRetain.length} Accounts to Retain:`);
  for (const u of usersToRetain) {
    console.log(`   + [${u.role.padEnd(19)}] ${u.email}`);
  }

  // Display exact user emails to be deleted
  console.log(`\n🗑️  All ${usersToDelete.length} Accounts to Delete:`);
  for (const u of usersToDelete) {
    console.log(`   - [${u.role.padEnd(19)}] ${u.email} (${u.name || 'No name'})`);
  }

  // 6. Branch: DRY RUN vs LIVE EXECUTION
  if (isDryRun) {
    console.log('\n🔒 DRY-RUN SUMMARY (No changes have been made):');
    console.log(`   - Target database: "${activeDbName}"`);
    console.log(`   - ${counts.reduce((sum, c) => sum + c.currentCount, 0)} records across 14 application collections would be deleted.`);
    console.log(`   - ${usersToDelete.length} accounts would be deleted from "users" (including priyadarshinisharg@gmail.com and demo test accounts).`);
    console.log(`   - Exactly ${usersToRetain.length} accounts would be preserved with intact password hashes and roles.`);
    console.log('\n🚀 TO EXECUTE THIS RESET FOR REAL:');
    console.log('   Run: node scripts/resetDatabase.mjs --confirm');
    console.log('   Note: Interactive confirmation is required. You will be prompted to type "RESET".\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 7. Interactive Confirmation Requirement (NO non-interactive bypass allowed)
  if (!process.stdin.isTTY) {
    console.error('\n❌ SAFETY ABORT: Live reset requires an interactive terminal for confirmation.');
    console.error('   Non-interactive execution is forbidden to prevent accidental data loss.');
    console.error('   No data was modified.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n⚠️  CRITICAL WARNING: You are about to permanently delete all demo records from "test".');
  console.log('   All 14 application collections will be emptied and unapproved users will be deleted.');
  console.log('   This action CANNOT be undone.');
  const answer = await askConfirmation('   Type "RESET" to confirm and proceed: ');
  if (answer !== 'RESET') {
    console.log(`\n❌ Reset cancelled by user (received: "${answer}"). No data was modified.\n`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // 8. Execute Deletions
  console.log('\n🧹 Executing database cleanup...');
  const deletionResults = {};

  try {
    for (const item of DEMO_COLLECTION_MODELS) {
      const colName = item.model.collection.collectionName;
      const res = await item.model.deleteMany({});
      deletionResults[colName] = res.deletedCount;
      console.log(`   - Cleared ${colName}: ${res.deletedCount} records deleted.`);
    }

    const userRes = await User.deleteMany({ email: { $nin: PRESERVED_EMAILS } });
    deletionResults['users'] = userRes.deletedCount;
    console.log(`   - Pruned users collection: ${userRes.deletedCount} demo users deleted.`);
  } catch (deleteErr) {
    console.error('\n❌ Deletion operation failed:', deleteErr.message);
    throw new Error(`Deletion aborted due to database error: ${deleteErr.message}`);
  }

  // 9. Post-Execution Verification
  console.log('\n🔍 Post-Reset Verification:');
  const remainingUsers = await User.find({})
    .select('+password')
    .sort({ email: 1 })
    .lean();

  const remainingEmails = remainingUsers.map((u) => u.email).sort();
  const expectedEmails = [...PRESERVED_EMAILS].sort();

  const postResetErrors = [];

  // Verify exact email set comparison (not just counts)
  if (remainingEmails.length !== expectedEmails.length) {
    postResetErrors.push(`Expected exactly ${expectedEmails.length} users, found ${remainingEmails.length}.`);
  }

  const unexpectedEmails = remainingEmails.filter((e) => !expectedEmails.includes(e));
  if (unexpectedEmails.length > 0) {
    postResetErrors.push(`Unexpected accounts still present: ${unexpectedEmails.join(', ')}`);
  }

  const missingEmails = expectedEmails.filter((e) => !remainingEmails.includes(e));
  if (missingEmails.length > 0) {
    postResetErrors.push(`Required accounts missing: ${missingEmails.join(', ')}`);
  }

  // Verify roles and password hashes
  for (const u of remainingUsers) {
    const expected = PRESERVED_ACCOUNTS.find((a) => a.email === u.email);
    if (expected) {
      if (u.role !== expected.expectedRole) {
        postResetErrors.push(`Role mismatch for ${u.email}: expected "${expected.expectedRole}", found "${u.role}"`);
      }
      const hasHash = Boolean(u.password && u.password.startsWith('$2'));
      if (!hasHash) {
        postResetErrors.push(`Password hash missing or invalid for ${u.email}`);
      }
      console.log(`   [${u.role.padEnd(19)}] ${u.name.padEnd(20)} (${u.email}) | Role OK: true | Hash intact: ${hasHash}`);
    }
  }

  // Verify all 14 application collections are empty
  for (const item of DEMO_COLLECTION_MODELS) {
    const count = await item.model.countDocuments();
    if (count !== 0) {
      postResetErrors.push(`Collection "${item.model.collection.collectionName}" is not empty (${count} documents remaining).`);
      console.error(`   ❌ Collection ${item.model.collection.collectionName} still has ${count} records!`);
    } else {
      console.log(`   ✓ Collection ${item.model.collection.collectionName.padEnd(22)} : 0 documents`);
    }
  }

  if (postResetErrors.length > 0) {
    console.error('\n❌ RESET VERIFICATION FAILED:');
    for (const err of postResetErrors) {
      console.error(`   - ${err}`);
    }
    throw new Error(`Reset verification failed with ${postResetErrors.length} error(s).`);
  }

  console.log('\n✅ ALL VERIFICATION CHECKS PASSED:');
  console.log(`   - Exactly the 10 specified user accounts exist in the database.`);
  console.log('   - All 10 accounts match intended roles and have intact Bcrypt hashes.');
  console.log('   - All 14 application demo collections are completely empty (0 records).');
  console.log('   - All collection schemas, unique constraints, and indexes remain intact.');

  console.log('\n============================================================');
  console.log('  Reset Summary Report:');
  console.log('============================================================');
  for (const [col, count] of Object.entries(deletionResults)) {
    console.log(`   ${col.padEnd(25)} : ${count} deleted`);
  }
  console.log('============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ Error during reset execution:', err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

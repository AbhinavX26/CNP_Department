/**
 * Update Seeded Accounts Password Script - CNP Department
 * 
 * Target: 10 approved seeded accounts
 * Operation: Update password from Test@12345 to GiveMarksPls@123
 * 
 * Safety features:
 * - Read-only DRY RUN mode by default (requires `--confirm` to perform database writes).
 * - Strict database-name assertion (strictly checks `conn.name === 'test'`).
 * - Uses Mongoose pre-save hook on User model to hash with bcrypt (12 rounds).
 * - Never logs credentials, password hashes, or secrets.
 * - Post-update verification: confirms new password authenticates and old password fails.
 * - Zero modification to roles, emails, profile fields, or application code.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import readline from 'node:readline';

// Fix DNS resolution for MongoDB Atlas SRV
dns.setServers(['8.8.8.8', '1.1.1.1']);

import connectDB from '../config/db.js';
import User from '../src/models/User.js';

const TARGET_DB_NAME = 'test';
const OLD_PASSWORD = 'Test@12345';
const NEW_PASSWORD = 'GiveMarksPls@123';

export const TARGET_ACCOUNTS = [
  { email: 'arjun.mehta@test.com', expectedRole: 'student' },
  { email: 'riya.sharma@test.com', expectedRole: 'student' },
  { email: 'kabir.patel@test.com', expectedRole: 'student' },
  { email: 'ananya.singh@test.com', expectedRole: 'student' },
  { email: 'neha.verma@test.com', expectedRole: 'faculty_coordinator' },
  { email: 'rahul.desai@test.com', expectedRole: 'faculty_coordinator' },
  { email: 'amit.joshi@test.com', expectedRole: 'faculty_mentor' },
  { email: 'priya.nair@test.com', expectedRole: 'faculty_mentor' },
  { email: 'karan.shah@test.com', expectedRole: 'club_admin' },
  { email: 'vivek.malhotra@test.com', expectedRole: 'project_admin' }
];

const TARGET_EMAILS = TARGET_ACCOUNTS.map((a) => a.email);

function askConfirmation(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printBanner(isDryRun) {
  console.log('\n============================================================');
  console.log(`  CNP Department Password Update [${isDryRun ? 'DRY-RUN / AUDIT MODE' : 'LIVE UPDATE'}]`);
  console.log('============================================================');
}

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm');
  const isDryRun = !isConfirm;

  printBanner(isDryRun);

  // 1. Connect to Database
  console.log('🔌 Connecting to MongoDB...');
  await connectDB();
  const conn = mongoose.connection;

  // 2. Database Name Safety Assertion
  const activeDbName = conn.name;
  console.log(`🔍 Connected database name: "${activeDbName}" on host: ${conn.host}`);

  if (activeDbName !== TARGET_DB_NAME) {
    console.error(`\n❌ SAFETY ABORT: Connected database is "${activeDbName}", but this script is strictly configured for "${TARGET_DB_NAME}".`);
    console.error('   Aborting immediately. No modifications were made.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✅ Database name verified: strictly matches "${TARGET_DB_NAME}".`);

  // 3. Inspect Target Accounts
  console.log(`\n👥 Inspecting Target Accounts (${TARGET_ACCOUNTS.length} accounts):`);
  const users = await User.find({ email: { $in: TARGET_EMAILS } }).select('+password');

  const userMap = new Map(users.map((u) => [u.email, u]));
  const missingAccounts = [];
  const roleMismatches = [];
  const currentAuthStatus = [];

  for (const item of TARGET_ACCOUNTS) {
    const userDoc = userMap.get(item.email);
    if (!userDoc) {
      missingAccounts.push(item.email);
      console.error(`   ❌ MISSING: ${item.email}`);
      continue;
    }

    if (userDoc.role !== item.expectedRole) {
      roleMismatches.push(`${item.email} (expected: ${item.expectedRole}, actual: ${userDoc.role})`);
      console.error(`   ❌ ROLE MISMATCH: ${item.email}`);
      continue;
    }

    // Verify current authentication status
    const matchesOld = await userDoc.comparePassword(OLD_PASSWORD);
    const matchesNew = await userDoc.comparePassword(NEW_PASSWORD);
    currentAuthStatus.push({
      email: item.email,
      role: userDoc.role,
      name: userDoc.name,
      matchesOld,
      matchesNew
    });

    console.log(`   ✓ Found [${userDoc.role.padEnd(19)}] ${userDoc.name.padEnd(20)} (${item.email}) | Authenticates with Old Password: ${matchesOld ? 'YES' : 'NO'}`);
  }

  if (missingAccounts.length > 0 || roleMismatches.length > 0) {
    console.error('\n❌ PRE-FLIGHT VALIDATION FAILED:');
    if (missingAccounts.length) console.error('   Missing accounts:', missingAccounts);
    if (roleMismatches.length) console.error('   Role mismatches:', roleMismatches);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n📊 Summary of Target Accounts:');
  console.log('--------------------------------------------------------------------------------------');
  console.log(` ${'Email'.padEnd(30)} | ${'Role'.padEnd(20)} | ${'Current Match (Old)'.padEnd(22)} | ${'New Match'.padEnd(10)}`);
  console.log('--------------------------------------------------------------------------------------');
  for (const status of currentAuthStatus) {
    console.log(` ${status.email.padEnd(30)} | ${status.role.padEnd(20)} | ${String(status.matchesOld).padEnd(22)} | ${String(status.matchesNew).padEnd(10)}`);
  }
  console.log('--------------------------------------------------------------------------------------');
  console.log(`Total target accounts: ${TARGET_ACCOUNTS.length}`);

  // 4. DRY RUN Mode Branch
  if (isDryRun) {
    console.log('\n🔒 DRY-RUN COMPLETE (No changes have been made to the database):');
    console.log(`   - Exactly ${TARGET_ACCOUNTS.length} accounts found in database "${activeDbName}".`);
    console.log('   - All 10 accounts currently match their intended roles.');
    console.log('   - Ready to update password from current value to new value.');
    console.log('\n🚀 TO EXECUTE LIVE UPDATE (Requires explicit approval):');
    console.log('   Run: node scripts/updatePasswords.mjs --confirm\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 5. Confirmation Guard for Live Execution
  if (!process.stdin.isTTY) {
    console.error('\n❌ SAFETY ABORT: Live update requires an interactive terminal for confirmation.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n⚠️  CONFIRMATION REQUIRED:');
  console.log(`   You are about to update passwords for ${TARGET_ACCOUNTS.length} accounts in database "${activeDbName}".`);
  const answer = await askConfirmation('   Type "UPDATE" to confirm and proceed: ');
  if (answer !== 'UPDATE') {
    console.log(`\n❌ Update cancelled by user (received: "${answer}"). No data was modified.\n`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // 6. Execute Password Updates
  console.log('\n🔐 Updating passwords using Mongoose pre-save bcrypt hashing (12 rounds)...');
  for (const item of TARGET_ACCOUNTS) {
    const userDoc = userMap.get(item.email);
    // Setting userDoc.password marks the field modified and triggers pre('save') bcrypt hashing
    userDoc.password = NEW_PASSWORD;
    await userDoc.save();
    console.log(`   ✓ Updated password for: ${item.email}`);
  }

  // 7. Post-Update Authentication Verification
  console.log('\n🔍 Post-Update Authentication Verification:');
  const postVerificationErrors = [];

  for (const item of TARGET_ACCOUNTS) {
    // Re-fetch user document from DB to test stored hash
    const reloaded = await User.findOne({ email: item.email }).select('+password');
    if (!reloaded) {
      postVerificationErrors.push(`Failed to reload ${item.email}`);
      continue;
    }

    const newAuthPass = await reloaded.comparePassword(NEW_PASSWORD);
    const oldAuthFail = !(await reloaded.comparePassword(OLD_PASSWORD));
    const roleUnchanged = reloaded.role === item.expectedRole;

    if (!newAuthPass) {
      postVerificationErrors.push(`New password failed to authenticate for ${item.email}`);
    }
    if (!oldAuthFail) {
      postVerificationErrors.push(`Old password unexpectedly still authenticates for ${item.email}`);
    }
    if (!roleUnchanged) {
      postVerificationErrors.push(`Role was corrupted for ${item.email}`);
    }

    const statusOk = newAuthPass && oldAuthFail && roleUnchanged;
    console.log(`   [${item.expectedRole.padEnd(19)}] ${item.email.padEnd(28)} | New Auth: ${newAuthPass ? 'PASS' : 'FAIL'} | Old Auth Invalidation: ${oldAuthFail ? 'PASS' : 'FAIL'} | Overall: ${statusOk ? 'OK' : 'ERROR'}`);
  }

  if (postVerificationErrors.length > 0) {
    console.error('\n❌ POST-UPDATE VERIFICATION FAILED:');
    for (const err of postVerificationErrors) console.error(`   - ${err}`);
    throw new Error(`Password update verification failed with ${postVerificationErrors.length} error(s).`);
  }

  console.log('\n✅ ALL VERIFICATION CHECKS PASSED:');
  console.log(`   - All ${TARGET_ACCOUNTS.length} accounts successfully updated.`);
  console.log('   - Each account authenticates with the new password.');
  console.log('   - The old password no longer works for any account.');
  console.log('   - Roles, email addresses, and profiles remain completely intact.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ Error during password update execution:', err.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

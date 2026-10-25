/**
 * smoke_test_reminders_auth.mjs
 *
 * Authorization smoke-test for:
 *   POST /api/events/reminders/process
 *
 * Authorization rule (verified from source code — NOT assumed):
 *   requireAuth → requireAnyRole('club_admin', 'faculty_coordinator') → handler
 *
 *   Access is based ENTIRELY on the `role` field stored in the database and
 *   retrieved via JWT userId lookup. No email address, allowlist, or per-user
 *   special case exists anywhere in requireAuth or requireAnyRole.
 *
 * Permitted roles  : club_admin, faculty_coordinator
 * Denied roles     : student, faculty_mentor, project_admin
 * No token / bad   : 401 Unauthorized
 *
 * Profile-completeness interaction (requireAuth lines 76-86):
 *   POST routes also produce HTTP 403 with code PROFILE_INCOMPLETE if a user's
 *   name/dept/phone are missing — BEFORE requireAnyRole is even called.
 *   All seed accounts have complete profiles, so this cannot interfere with
 *   any of the tests below. Tests that expect 403 from role denial verify
 *   the `message` field does NOT contain 'PROFILE_INCOMPLETE'.
 *
 * Body/header spoofing (verified):
 *   The handler receives req.user from the middleware chain (DB lookup).
 *   Sending a `role` field in the request body or a custom header does not
 *   affect req.user.role. Tests 6a-6c confirm this.
 *
 * Idempotency note:
 *   The test does NOT assert processed === 0 on repeat calls. Whether processed
 *   is 0 or >0 depends on live DB state. Idempotency is verified structurally:
 *   a second call to an authorized account returns HTTP 200 with a numeric
 *   `processed` field, regardless of the count.
 *
 * Requires the backend server to be running on port 5000.
 * No direct DB connection needed — HTTP only.
 */

const BASE = 'http://127.0.0.1:5000/api';
let passed = 0;
let failed = 0;

function assert(cond, msg, detail = '') {
  if (cond) {
    console.log(`  ✅ PASS — ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL — ${msg}${detail ? ' | ' + detail : ''}`);
    failed++;
  }
}

async function login(email, password = 'Test@12345') {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

async function triggerReminders({ token = null, extraHeaders = {}, body = null } = {}) {
  const headers = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts = { method: 'POST', headers };
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(`${BASE}/events/reminders/process`, opts);
}

function assertRoleDenied(res, data, label) {
  assert(res.status === 403, `${label}: HTTP ${res.status} (expected 403)`);
  assert(
    data.success === false,
    `${label}: body.success === false`,
    JSON.stringify(data)
  );
  // Distinguish role-denial 403 from profile-incomplete 403
  assert(
    data.code !== 'PROFILE_INCOMPLETE',
    `${label}: denied by role check, NOT by profile incompleteness`
  );
}

async function run() {
  console.log('\n======================================================================');
  console.log(' POST /api/events/reminders/process — Authorization Smoke Test');
  console.log('======================================================================\n');

  // ── Login all seed accounts ───────────────────────────────────────────────

  const accounts = {
    student1: await login('arjun.mehta@test.com'),      // student
    student2: await login('riya.sharma@test.com'),       // student
    student3: await login('kabir.patel@test.com'),       // student
    student4: await login('ananya.singh@test.com'),      // student
    coord1: await login('neha.verma@test.com'),        // faculty_coordinator
    coord2: await login('rahul.desai@test.com'),       // faculty_coordinator
    mentor1: await login('amit.joshi@test.com'),        // faculty_mentor
    mentor2: await login('priya.nair@test.com'),        // faculty_mentor
    clubAdmin: await login('karan.shah@test.com'),        // club_admin
    projAdmin: await login('vivek.malhotra@test.com'),    // project_admin
  };

  console.log('--- Account login verification ---');
  assert(accounts.student1.user?.role === 'student', 'Login: arjun.mehta  → student');
  assert(accounts.student2.user?.role === 'student', 'Login: riya.sharma  → student');
  assert(accounts.student3.user?.role === 'student', 'Login: kabir.patel  → student');
  assert(accounts.student4.user?.role === 'student', 'Login: ananya.singh → student');
  assert(accounts.coord1.user?.role === 'faculty_coordinator', 'Login: neha.verma   → faculty_coordinator');
  assert(accounts.coord2.user?.role === 'faculty_coordinator', 'Login: rahul.desai  → faculty_coordinator');
  assert(accounts.mentor1.user?.role === 'faculty_mentor', 'Login: amit.joshi   → faculty_mentor');
  assert(accounts.mentor2.user?.role === 'faculty_mentor', 'Login: priya.nair   → faculty_mentor');
  assert(accounts.clubAdmin.user?.role === 'club_admin', 'Login: karan.shah   → club_admin');
  assert(accounts.projAdmin.user?.role === 'project_admin', 'Login: vivek.malhotra → project_admin');

  // ── 1. Unauthenticated & invalid-token cases ─────────────────────────────
  console.log('\n--- 1. Missing / invalid / malformed tokens (expected 401) ---');

  const noHeader = await triggerReminders();
  assert(noHeader.status === 401, '1a: No Authorization header → 401');

  const emptyBearer = await triggerReminders({ extraHeaders: { Authorization: 'Bearer ' } });
  assert(emptyBearer.status === 401, '1b: "Bearer " (empty token string) → 401');

  const badSig = await triggerReminders({ token: 'this.is.not.a.valid.jwt' });
  assert(badSig.status === 401, '1c: Syntactically invalid JWT → 401');

  // A well-formed JWT signed with the wrong secret — still must be 401
  // We construct a plausible-looking but wrong-secret token (base64-encoded parts)
  const fakePayload = Buffer.from(JSON.stringify({ userId: '000000000000000000000001', iat: 1 })).toString('base64url');
  const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${fakePayload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  const wrongSecret = await triggerReminders({ token: fakeToken });
  assert(wrongSecret.status === 401, '1d: JWT signed with wrong secret → 401');

  // ── 2. Role spoofing via request body (must NOT bypass authorization) ─────
  console.log('\n--- 2. Role spoofing — body / custom headers must NOT grant access ---');

  // 2a. Student sends body claiming club_admin role
  const spoof2a = await triggerReminders({
    token: accounts.student1.token,
    body: { role: 'club_admin' },
  });
  const spoof2aData = await spoof2a.json();
  assertRoleDenied(spoof2a, spoof2aData, '2a: student + body{role:"club_admin"}');

  // 2b. Student sends a custom x-role header claiming club_admin
  const spoof2b = await triggerReminders({
    token: accounts.student2.token,
    extraHeaders: { 'x-role': 'club_admin' },
  });
  const spoof2bData = await spoof2b.json();
  assertRoleDenied(spoof2b, spoof2bData, '2b: student + X-Role:club_admin header');

  // 2c. faculty_mentor claims faculty_coordinator in body
  const spoof2c = await triggerReminders({
    token: accounts.mentor1.token,
    body: { role: 'faculty_coordinator' },
  });
  const spoof2cData = await spoof2c.json();
  assertRoleDenied(spoof2c, spoof2cData, '2c: faculty_mentor + body{role:"faculty_coordinator"}');

  // ── 3. Unauthorized roles — ALL accounts of each role must be denied ──────
  console.log('\n--- 3. Unauthorized roles → 403 (all accounts of each role, not just one) ---');

  // 3a-3d: All 4 student accounts
  for (const [key, label] of [
    ['student1', 'arjun.mehta  (student)'],
    ['student2', 'riya.sharma  (student)'],
    ['student3', 'kabir.patel  (student)'],
    ['student4', 'ananya.singh (student)'],
  ]) {
    const res = await triggerReminders({ token: accounts[key].token });
    const data = await res.json();
    assertRoleDenied(res, data, `3-${key}: ${label}`);
  }

  // 3e-3f: Both faculty_mentor accounts
  for (const [key, label] of [
    ['mentor1', 'amit.joshi (faculty_mentor)'],
    ['mentor2', 'priya.nair (faculty_mentor)'],
  ]) {
    const res = await triggerReminders({ token: accounts[key].token });
    const data = await res.json();
    assertRoleDenied(res, data, `3-${key}: ${label}`);
  }

  // 3g: The single project_admin account
  {
    const res = await triggerReminders({ token: accounts.projAdmin.token });
    const data = await res.json();
    assertRoleDenied(res, data, '3-projAdmin: vivek.malhotra (project_admin)');
  }

  // ── 4. Authorized roles — ALL accounts must be allowed ───────────────────
  console.log('\n--- 4. Authorized roles → 200 (all accounts of each role) ---');

  // 4a: club_admin (single account)
  {
    const res = await triggerReminders({ token: accounts.clubAdmin.token });
    const data = await res.json();
    assert(res.status === 200, '4a: karan.shah (club_admin) → HTTP 200');
    assert(data.success === true, '4a: karan.shah → body.success === true');
    assert(typeof data.processed === 'number', `4a: karan.shah → processed is a number (${data.processed})`);
    assert(typeof data.message === 'string' && data.message.length > 0,
      '4a: karan.shah → body.message is a non-empty string');
  }

  // 4b: faculty_coordinator #1
  {
    const res = await triggerReminders({ token: accounts.coord1.token });
    const data = await res.json();
    assert(res.status === 200, '4b: neha.verma (faculty_coordinator) → HTTP 200');
    assert(data.success === true, '4b: neha.verma → body.success === true');
    assert(typeof data.processed === 'number', `4b: neha.verma → processed is a number (${data.processed})`);
  }

  // 4c: faculty_coordinator #2 — second account with the SAME role, different email
  {
    const res = await triggerReminders({ token: accounts.coord2.token });
    const data = await res.json();
    assert(res.status === 200, '4c: rahul.desai (faculty_coordinator) → HTTP 200');
    assert(data.success === true, '4c: rahul.desai → body.success === true');
    assert(typeof data.processed === 'number', `4c: rahul.desai → processed is a number (${data.processed})`);
  }

  // ── 5. Response shape is consistent regardless of caller identity ─────────
  console.log('\n--- 5. Response shape is consistent for all authorized callers ---');
  {
    const resCA = await triggerReminders({ token: accounts.clubAdmin.token });
    const dataCA = await resCA.json();
    const resC2 = await triggerReminders({ token: accounts.coord2.token });
    const dataC2 = await resC2.json();

    const hasExpectedKeys = (d) =>
      'success' in d && 'message' in d && 'processed' in d;

    assert(hasExpectedKeys(dataCA), '5a: club_admin response has {success, message, processed}');
    assert(hasExpectedKeys(dataC2), '5b: faculty_coordinator response has {success, message, processed}');
    assert(
      dataCA.message === dataC2.message ||
      (dataCA.message.includes('Processed') && dataC2.message.includes('Processed')),
      '5c: message format is consistent between club_admin and faculty_coordinator callers'
    );
  }

  // ── 6. Idempotency — structural check without hardcoding processed count ──
  console.log('\n--- 6. Idempotency — repeated calls return valid 200 (count may vary by DB state) ---');
  {
    const r1 = await triggerReminders({ token: accounts.clubAdmin.token });
    const d1 = await r1.json();
    const r2 = await triggerReminders({ token: accounts.clubAdmin.token });
    const d2 = await r2.json();

    assert(r1.status === 200 && r2.status === 200, '6a: Both calls return HTTP 200');
    assert(typeof d1.processed === 'number' && typeof d2.processed === 'number',
      '6b: Both calls return numeric processed field');
    assert(d2.processed <= d1.processed,
      `6c: Second call processed (${d2.processed}) ≤ first call processed (${d1.processed}) — no new work created between calls`
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });

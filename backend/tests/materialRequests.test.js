import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { __setTransporterForTests } from '../src/services/emailService.js';
import { authHeader } from './helpers/auth.js';
import {
  makeMentor,
  makeProjectMentor,
  makeStudent,
  makeTeamScenario,
  GuitarInventory,
  InventoryAllocation,
  MaterialRequest,
  Notification,
  Project,
  ProjectMaterial,
} from './helpers/fixtures.js';

useTestDB();

let teamAdmin;
let teamLeader;
let member;
let mentor;
let project;
let inventoryItem;
let outsider;
let admin;

beforeEach(async () => {
  const scenario = await makeTeamScenario();
  teamAdmin = scenario.projectAdmin;
  teamLeader = scenario.teamLeader;
  member = scenario.member;
  mentor = scenario.mentor;
  project = scenario.project;
  inventoryItem = scenario.inventoryItem;

  // A second project admin so we can prove every admin is notified, and an
  // unrelated student for the 403 paths.
  admin = teamAdmin;
  outsider = await makeStudent();
});

const createRequest = (body, user = teamLeader) =>
  request(app).post('/api/material-requests').set(authHeader(user)).send(body);

const validBody = () => ({
  projectId: project._id.toString(),
  inventoryItemId: inventoryItem._id.toString(),
  quantity: 3,
  reason: 'Needed for the prototype',
});

const approve = (id, user = admin) =>
  request(app).patch(`/api/material-requests/${id}/approve`).set(authHeader(user));

const reject = (id, body, user = admin) =>
  request(app).patch(`/api/material-requests/${id}/reject`).set(authHeader(user)).send(body);

describe('POST /api/material-requests', () => {
  it('creates a pending request for the team leader, copying the item name', async () => {
    const res = await createRequest(validBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'pending',
      quantity: 3,
      reason: 'Needed for the prototype',
      materialName: inventoryItem.name,
    });
    expect(res.body.data.requestedBy._id).toBe(teamLeader._id.toString());

    const notification = await Notification.findOne({
      userId: admin._id,
      type: 'material_request_submitted',
    });
    expect(notification).toBeTruthy();
  });

  it('blocks a member who is not the team leader', async () => {
    const res = await createRequest(validBody(), member);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Team Leader/i);
  });

  it('validates the body', async () => {
    for (const body of [
      { ...validBody(), quantity: undefined },
      { ...validBody(), quantity: 0 },
      { ...validBody(), quantity: 1.5 },
      { ...validBody(), reason: '' },
      { ...validBody(), reason: undefined },
    ]) {
      const res = await createRequest(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('rejects a quantity above available stock', async () => {
    const res = await createRequest({ ...validBody(), quantity: 99 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds available stock/i);
  });

  it('returns 404 for an unknown project or inventory item', async () => {
    const unknownProject = await createRequest({
      ...validBody(),
      projectId: '000000000000000000000000',
    });
    expect(unknownProject.status).toBe(404);

    const unknownItem = await createRequest({
      ...validBody(),
      inventoryItemId: '000000000000000000000000',
    });
    expect(unknownItem.status).toBe(404);
  });
});

describe('PATCH /api/material-requests/:requestId/approve', () => {
  it('decrements stock exactly once and creates the material + allocation', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    const res = await approve(requestId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.request.status).toBe('approved');
    expect(res.body.data.request.reviewedBy._id).toBe(admin._id.toString());
    expect(res.body.data.inventory.availableQuantity).toBe(7);
    expect(res.body.data.allocation.quantity).toBe(3);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(7);
    expect(item.totalQuantity).toBe(10);

    const material = await ProjectMaterial.findOne({
      materialRequestId: requestId,
    });
    expect(material).toBeTruthy();
    expect(material).toMatchObject({ source: 'guitar', quantity: 3 });
    expect(material.projectId.toString()).toBe(project._id.toString());

    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(1);

    // Fire-and-forget notification for the team leader.
    await vi.waitFor(async () => {
      expect(
        await Notification.findOne({
          userId: teamLeader._id,
          type: 'material_request_approved',
        })
      ).toBeTruthy();
    });
  });

  it('rejects the second approval with 409 and does not decrement again', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await approve(requestId);
    const second = await approve(requestId);

    expect(second.status).toBe(409);
    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(7);
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(1);
  });

  it('refuses to approve when stock is no longer sufficient and leaves the request pending', async () => {
    const created = await createRequest({ ...validBody(), quantity: 4 });
    const requestId = created.body.data._id;

    // Admin docks stock after the request was submitted.
    const reduce = await request(app)
      .patch(`/api/inventory/${inventoryItem._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'decrease', amount: 8 });
    expect(reduce.status).toBe(200);
    expect(reduce.body.data.availableQuantity).toBe(2);

    const res = await approve(requestId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient inventory/i);

    const stored = await MaterialRequest.findById(requestId);
    expect(stored.status).toBe('pending');
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(0);
  });

  it('refuses when the requester is no longer the team leader', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await Project.findByIdAndUpdate(project._id, { teamLeaderId: member._id });

    const res = await approve(requestId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer the Team Leader/i);
    expect((await MaterialRequest.findById(requestId)).status).toBe('pending');
  });

  it('returns 404 for an unknown request and 400 for a malformed id', async () => {
    expect((await approve('000000000000000000000000')).status).toBe(404);
    expect((await approve('nope')).status).toBe(400);
  });
});

describe('PATCH /api/material-requests/:requestId/reject', () => {
  it('rejects with a reason, leaves stock untouched and creates no allocation', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    const res = await reject(requestId, { rejectionReason: 'Not in scope this semester' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Not in scope this semester');

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(10);
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(0);

    await vi.waitFor(async () => {
      const notification = await Notification.findOne({
        userId: teamLeader._id,
        type: 'material_request_rejected',
      });
      expect(notification).toBeTruthy();
      expect(notification.message).toContain('Not in scope this semester');
    });
  });

  it('requires a rejection reason', async () => {
    const created = await createRequest(validBody());
    const res = await reject(created.body.data._id, {});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rejectionReason is required/i);
  });

  it('rejects a second decision with 409', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await reject(requestId, { rejectionReason: 'No' });
    const again = await reject(requestId, { rejectionReason: 'Still no' });

    expect(again.status).toBe(409);
  });
});

describe('GET /api/material-requests', () => {
  it('lists requests for project_admin with filters and pagination', async () => {
    await createRequest(validBody());

    const list = await request(app)
      .get('/api/material-requests')
      .set(authHeader(admin));
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.data[0].projectId.name).toBe(project.name);
    expect(list.body.data[0].inventoryItemId.name).toBe(inventoryItem.name);

    const pending = await request(app)
      .get('/api/material-requests?status=pending')
      .set(authHeader(admin));
    expect(pending.body.data).toHaveLength(1);

    const approved = await request(app)
      .get('/api/material-requests?status=approved')
      .set(authHeader(admin));
    expect(approved.body.data).toHaveLength(0);

    const invalid = await request(app)
      .get('/api/material-requests?status=lost')
      .set(authHeader(admin));
    expect(invalid.status).toBe(400);

    const limited = await request(app)
      .get('/api/material-requests?limit=1')
      .set(authHeader(admin));
    expect(limited.body.data).toHaveLength(1);
  });

  it('scopes /project/:projectId to members, the assigned mentor and admins', async () => {
    await createRequest(validBody());

    for (const actor of [teamLeader, member, mentor, admin]) {
      const res = await request(app)
        .get(`/api/material-requests/project/${project._id}`)
        .set(authHeader(actor));
      expect(res.status, `project requests as ${actor.role}`).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }

    const denied = await request(app)
      .get(`/api/material-requests/project/${project._id}`)
      .set(authHeader(outsider));
    expect(denied.status).toBe(403);

    const unassignedMentor = await makeMentor();
    const mentorDenied = await request(app)
      .get(`/api/material-requests/project/${project._id}`)
      .set(authHeader(unassignedMentor));
    expect(mentorDenied.status).toBe(403);
  });

  it('serves the summary aggregate', async () => {
    await createRequest({ ...validBody(), quantity: 2 });
    const second = await createRequest({ ...validBody(), quantity: 1 });
    await reject(second.body.data._id, { rejectionReason: 'Duplicate' });

    const res = await request(app)
      .get('/api/material-requests/summary')
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      pending: 1,
      approved: 0,
      rejected: 1,
      unitsPending: 2,
      resolved: 1,
    });
  });
});

describe('bulk material request decisions', () => {
  it('approves a batch atomically and decrements stock by the batch total', async () => {
    const first = await createRequest({ ...validBody(), quantity: 2 });
    const second = await createRequest({ ...validBody(), quantity: 3 });

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(2);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(5);
    expect(await InventoryAllocation.countDocuments({})).toBe(2);
  });

  it('rejects the whole batch (422) when any request is not pending', async () => {
    const first = await createRequest({ ...validBody(), quantity: 1 });
    const second = await createRequest({ ...validBody(), quantity: 1 });
    await approve(first.body.data._id);

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    // Nothing changed.
    expect((await MaterialRequest.findById(second.body.data._id)).status).toBe('pending');
    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(9);
  });

  it('rejects the whole batch (422) when the batch total exceeds stock', async () => {
    await request(app)
      .patch(`/api/inventory/${inventoryItem._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'set', amount: 4, availableAmount: 4 });

    // Each request is individually valid (3 <= 4), together they need 6.
    const first = await createRequest({ ...validBody(), quantity: 3 });
    const second = await createRequest({ ...validBody(), quantity: 3 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(4);
    expect((await MaterialRequest.findById(first.body.data._id)).status).toBe('pending');
    expect((await MaterialRequest.findById(second.body.data._id)).status).toBe('pending');
  });

  it('rejects a batch with a reason and leaves inventory untouched', async () => {
    const first = await createRequest({ ...validBody(), quantity: 1 });
    const second = await createRequest({ ...validBody(), quantity: 2 });

    const res = await request(app)
      .post('/api/material-requests/bulk-reject')
      .set(authHeader(admin))
      .send({
        requestIds: [first.body.data._id, second.body.data._id],
        rejectionReason: 'Duplicate order',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toBe(2);
    expect((await MaterialRequest.findById(first.body.data._id)).status).toBe('rejected');
    expect((await GuitarInventory.findById(inventoryItem._id)).availableQuantity).toBe(10);
  });

  it('validates the batch ids and reason', async () => {
    const missing = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [] });
    expect(missing.status).toBe(400);

    const noReason = await request(app)
      .post('/api/material-requests/bulk-reject')
      .set(authHeader(admin))
      .send({ requestIds: ['000000000000000000000000'] });
    expect(noReason.status).toBe(400);
  });
});


// ── Budget routing, multi-item submissions, mentor review and email ──────────

describe('budget routing', () => {
  let sent;

  beforeEach(async () => {
    process.env.MATERIAL_REQUEST_BUDGET_LIMIT = '1000';
    sent = [];
    __setTransporterForTests({ sendMail: async (message) => { sent.push(message); } });
    await GuitarInventory.updateOne({ _id: inventoryItem._id }, { $set: { unitCost: 100 } });
  });

  afterEach(() => {
    delete process.env.MATERIAL_REQUEST_BUDGET_LIMIT;
    __setTransporterForTests(null);
  });

  const submit = (items, reason = 'Needed for the prototype', user = teamLeader) =>
    createRequest({ projectId: project._id.toString(), reason, items }, user);

  it('sends a within-budget submission to the faculty mentor, not the admin', async () => {
    const res = await submit([{ inventoryItemId: inventoryItem._id.toString(), quantity: 3 }]);

    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({ route: 'mentor', routeReason: 'within_budget', total: 300 });

    const saved = await MaterialRequest.findOne({ projectId: project._id });
    expect(saved).toMatchObject({ route: 'mentor', unitCost: 100, submissionTotal: 300 });

    expect(await Notification.countDocuments({ userId: mentor._id, type: 'material_request_submitted' })).toBe(1);
    expect(await Notification.countDocuments({ userId: admin._id, type: 'material_request_submitted' })).toBe(0);

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].to).toBe(mentor.email);
    expect(sent[0].subject).toMatch(/Material request/);
    expect(sent[0].text).toContain(inventoryItem.name);
    expect(sent[0].html).toContain(inventoryItem.name);
  });

  it('treats a total exactly at the limit as within budget', async () => {
    const res = await submit([{ inventoryItemId: inventoryItem._id.toString(), quantity: 10 }]);
    expect(res.body.submission).toMatchObject({ route: 'mentor', total: 1000 });
  });

  it('requires a written justification above the limit, then sends it to the admin', async () => {
    await GuitarInventory.updateOne({ _id: inventoryItem._id }, { $set: { unitCost: 400 } });
    const items = [{ inventoryItemId: inventoryItem._id.toString(), quantity: 3 }];

    const short = await submit(items, 'Needed');
    expect(short.status).toBe(400);
    expect(short.body.code).toBe('JUSTIFICATION_REQUIRED');
    expect(await MaterialRequest.countDocuments({ projectId: project._id })).toBe(0);

    const reason = 'We are building the sensor array for the final prototype and need three units for redundancy.';
    const ok = await submit(items, reason);
    expect(ok.status).toBe(201);
    expect(ok.body.submission).toMatchObject({ route: 'admin', routeReason: 'over_budget', total: 1200 });
    expect(await Notification.countDocuments({ userId: admin._id, type: 'material_request_submitted' })).toBe(1);
    expect(await Notification.countDocuments({ userId: mentor._id, type: 'material_request_submitted' })).toBe(0);

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].to).toBe(admin.email);
    expect(sent[0].text).toContain(reason);
  });

  it('sends an unpriced item to the admin', async () => {
    await GuitarInventory.updateOne({ _id: inventoryItem._id }, { $set: { unitCost: null } });
    const res = await submit([{ inventoryItemId: inventoryItem._id.toString(), quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({ route: 'admin', routeReason: 'unpriced_item', total: null });
  });

  it('falls back to the admin when the project has no mentor', async () => {
    await mongoose.model('ProjectMentor').deleteMany({ projectId: project._id });
    const res = await submit([{ inventoryItemId: inventoryItem._id.toString(), quantity: 1 }]);
    expect(res.body.submission).toMatchObject({ route: 'admin', routeReason: 'no_mentor' });
  });

  it('files several items as one submission with one email', async () => {
    const second = await GuitarInventory.create({
      name: 'Second part', totalQuantity: 5, availableQuantity: 5, unitCost: 50, createdBy: admin._id,
    });
    const res = await submit([
      { inventoryItemId: inventoryItem._id.toString(), quantity: 2 },
      { inventoryItemId: second._id.toString(), quantity: 4, specifications: 'Blue' },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({ itemCount: 2, total: 400, route: 'mentor' });
    const rows = await MaterialRequest.find({ projectId: project._id });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => String(row.submissionId))).size).toBe(1);

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].text).toContain('Second part');
    expect(sent[0].text).toContain('Blue');
  });

  it('rejects duplicate items, and stock shortfalls anywhere in the list', async () => {
    const id = inventoryItem._id.toString();
    expect((await submit([{ inventoryItemId: id, quantity: 1 }, { inventoryItemId: id, quantity: 1 }])).status).toBe(400);
    expect((await submit([{ inventoryItemId: id, quantity: 999 }])).status).toBe(400);
    expect(await MaterialRequest.countDocuments({ projectId: project._id })).toBe(0);
  });

  it('still never fails the request when the mail transport is down', async () => {
    __setTransporterForTests({ sendMail: async () => { throw new Error('smtp down'); } });
    const res = await submit([{ inventoryItemId: inventoryItem._id.toString(), quantity: 1 }]);
    expect(res.status).toBe(201);
  });
});

describe('faculty mentor review', () => {
  const mentorApprove = (id, user = mentor) => approve(id, user);

  const mentorRequest = (overrides = {}) =>
    MaterialRequest.create({
      projectId: project._id,
      requestedBy: teamLeader._id,
      inventoryItemId: inventoryItem._id,
      materialName: inventoryItem.name,
      quantity: 2,
      reason: 'Needed for the prototype',
      status: 'pending',
      route: 'mentor',
      ...overrides,
    });

  it('lets the assigned mentor approve a within-budget request, with the usual stock effect', async () => {
    const doc = await mentorRequest();
    const res = await mentorApprove(doc._id);

    expect(res.status).toBe(200);
    expect((await MaterialRequest.findById(doc._id)).reviewedBy.toString()).toBe(mentor._id.toString());
    expect((await GuitarInventory.findById(inventoryItem._id)).availableQuantity).toBe(inventoryItem.availableQuantity - 2);
  });

  it('lets the assigned mentor reject with a reason', async () => {
    const doc = await mentorRequest();
    const res = await reject(doc._id, { rejectionReason: 'Use what the lab already has' }, mentor);
    expect(res.status).toBe(200);
    expect((await MaterialRequest.findById(doc._id)).status).toBe('rejected');
  });

  it('keeps over-budget requests with the admin', async () => {
    const doc = await mentorRequest({ route: 'admin' });
    const res = await mentorApprove(doc._id);
    expect(res.status).toBe(403);
    expect((await MaterialRequest.findById(doc._id)).status).toBe('pending');
  });

  it('refuses a mentor who is not assigned to the project', async () => {
    const stranger = await makeMentor();
    const doc = await mentorRequest();
    expect((await mentorApprove(doc._id, stranger)).status).toBe(403);
    expect((await reject(doc._id, { rejectionReason: 'no' }, stranger)).status).toBe(403);
  });

  it('refuses students on the decision routes', async () => {
    const doc = await mentorRequest();
    expect((await mentorApprove(doc._id, teamLeader)).status).toBe(403);
  });

  it('blocks a bulk decision that includes a request the mentor may not decide', async () => {
    const allowed = await mentorRequest();
    const blocked = await mentorRequest({ route: 'admin' });
    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(mentor))
      .send({ requestIds: [allowed._id.toString(), blocked._id.toString()] });

    expect(res.status).toBe(422);
    expect((await MaterialRequest.findById(allowed._id)).status).toBe('pending');
  });

  it('serves the mentor queue only for their projects and the mentor route', async () => {
    await mentorRequest();
    await mentorRequest({ route: 'admin' });
    const otherScenario = await makeTeamScenario();
    await MaterialRequest.create({
      projectId: otherScenario.project._id,
      requestedBy: otherScenario.teamLeader._id,
      inventoryItemId: otherScenario.inventoryItem._id,
      materialName: 'x', quantity: 1, reason: 'r', route: 'mentor',
    });

    const res = await request(app).get('/api/material-requests/assigned').set(authHeader(mentor));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].route).toBe('mentor');

    expect((await request(app).get('/api/material-requests/assigned').set(authHeader(teamLeader))).status).toBe(403);
  });

  it('exposes the budget limit to signed-in users', async () => {
    process.env.MATERIAL_REQUEST_BUDGET_LIMIT = '750';
    const res = await request(app).get('/api/material-requests/config').set(authHeader(teamLeader));
    delete process.env.MATERIAL_REQUEST_BUDGET_LIMIT;
    expect(res.body.data.budgetLimit).toBe(750);
  });
});

describe('inventory unit cost', () => {
  it('lets the admin set, clear and validate unitCost', async () => {
    const put = (body) => request(app).put(`/api/inventory/${inventoryItem._id}`).set(authHeader(admin)).send(body);

    expect((await put({ unitCost: 249.5 })).body.data.unitCost).toBe(249.5);
    expect((await put({ unitCost: '' })).body.data.unitCost).toBeNull();
    expect((await put({ unitCost: -1 })).status).toBe(400);
    expect((await put({ unitCost: 'abc' })).status).toBe(400);
  });
});

# Material request budget routing and email

A Team Leader can submit **one or several items** in a single material request. Each item stays its own
`MaterialRequest` row (so approval, stock and allocation work as before); rows submitted together share a
`submissionId`, a `submissionTotal`, the same `route` and the same written reason.

## Who reviews it

| Condition | Route | Reviewer |
|---|---|---|
| Total ≤ limit, project has a faculty mentor | `mentor` | The project's primary mentor (any assigned mentor may decide it) |
| Total > limit | `admin` | Project admin, with a mandatory justification (≥ 50 characters) |
| Any item has no `unitCost` | `admin` | Project admin |
| Project has no mentor | `admin` | Project admin |

The total is computed on the server from `GuitarInventory.unitCost × quantity`; the client's numbers are never trusted.
Approving, whoever does it, has the same effect as before: stock is deducted and the material is allocated.
The project admin can always decide any request.

## Configuration (backend `.env`)

```
MATERIAL_REQUEST_BUDGET_LIMIT=5000     # default 5000
SMTP_USER=yourname@gmail.com           # empty = emails off
SMTP_PASS=xxxx xxxx xxxx xxxx          # a Gmail App Password, not the account password
MAIL_FROM="CNP Department <yourname@gmail.com>"   # optional
MAIL_TIMEZONE=Asia/Kolkata             # optional
CLIENT_URL=https://your-frontend       # used for the "Review and decide" link
```

Gmail App Password: Google Account → Security → turn on 2-Step Verification → App passwords.
After pulling, run `npm install` in `backend/` (adds `nodemailer`).

## Email

One email per recipient, sent right after the request is saved: project, requester, date and time (IST),
item list with quantities and costs, estimated total, why it was routed to them, the team's reason/justification
and a link to review. A mail failure is logged and never fails the request. In-app notifications still go out.

## API

- `POST /api/material-requests` — `{ projectId, reason, items: [{ inventoryItemId, quantity, specifications? }] }`
  (the old single-item body still works). Returns `submission: { id, total, route, routeReason, limit, itemCount }`.
  Over the limit without a long enough `reason` → `400` with `code: "JUSTIFICATION_REQUIRED"`.
- `GET /api/material-requests/config` — `{ budgetLimit, minJustificationLength }`.
- `GET /api/material-requests/assigned` — faculty mentor's queue.
- `PATCH /:id/approve`, `PATCH /:id/reject`, `POST /bulk-approve`, `POST /bulk-reject` — now also open to the assigned
  mentor, for `route: "mentor"` requests on their projects only (anything else is `403`, or `422` in a bulk call).
- `PUT /api/inventory/:id` and `POST /api/inventory` accept `unitCost` (blank clears it).

Existing requests keep working: they have no route data and default to `route: "admin"`.

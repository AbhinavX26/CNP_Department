import mongoose from 'mongoose';

// ── Material Request ──────────────────────────────────────────────────────────
// Only the Team Leader of a project can create a request.
// Project Admin can approve or reject.
//
// Statuses:
//   pending   — awaiting admin review
//   approved  — admin approved; inventory deducted; project material auto-created
//   rejected  — admin rejected; rejectionReason REQUIRED
//
// Do NOT add given / returned statuses — approval IS the allocation.

const STATUSES = ['pending', 'approved', 'rejected'];

const materialRequestSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'requestedBy is required'],
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuitarInventory',
      required: [true, 'inventoryItemId is required'],
    },
    materialName: {
      type: String,
      trim: true,
      default: '',
    },
    specifications: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: STATUSES,
        message: `status must be one of: ${STATUSES.join(', ')}`,
      },
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // ── Budget routing ───────────────────────────────────────────────────────
    // Requests submitted together share a submissionId (one email, one decision).
    submissionId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    // Price of one unit when the request was made (snapshot: later price edits don't rewrite history).
    unitCost: { type: Number, default: null, min: 0 },
    // Total of the WHOLE submission at submit time; null when any item was unpriced.
    submissionTotal: { type: Number, default: null, min: 0 },
    // Who reviews it: the project's faculty mentor, or the project admin.
    route: { type: String, enum: ['mentor', 'admin'], default: 'admin', index: true },
    // Why it went where it did: within_budget | over_budget | unpriced_item | no_mentor | legacy
    routeReason: { type: String, default: 'legacy' },
    documentUrl: {
      type: String,
      default: null,
    },
    documentPublicId: {
      type: String,
      default: null,
    },
    documentOriginalName: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

materialRequestSchema.index({ projectId: 1, createdAt: -1 });
materialRequestSchema.index({ status: 1, createdAt: -1 });

const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema);

export default MaterialRequest;

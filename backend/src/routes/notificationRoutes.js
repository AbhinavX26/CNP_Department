/**
 * Task 2I — Notification Routes (SECURED in 2J Part 2)
 * Mounted at: /api/notifications  (see server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication via requireAuth.
 *   - User identity derived from req.user.userId (JWT) — NEVER from body/query.
 *   - A user can ONLY read/mark their OWN notifications.
 *   - Ownership is enforced server-side: notification.userId === req.user.userId.
 *
 * Routes:
 *   GET    /                     — get current user's notifications (newest first)
 *   GET    /unread-count         — count of unread notifications for current user
 *   PATCH  /read-all             — mark ALL of current user's notifications as read
 *   PATCH  /:notificationId/read — mark one notification as read (owner only)
 */

import express from 'express';
import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import MaterialRequest from '../models/MaterialRequest.js';
import ProjectUpdate from '../models/ProjectUpdate.js';
import ProjectFeedback from '../models/ProjectFeedback.js';
import JoinRequest from '../models/JoinRequest.js';
import ProjectMaterial from '../models/ProjectMaterial.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

/**
 * Dynamically enrich notifications with real project context, action links,
 * and rejection reasons when legacy or sparsely populated notifications are loaded.
 */
async function enrichNotification(notif, userId) {
  const obj = notif.toObject ? notif.toObject() : { ...notif };
  obj.metadata = obj.metadata || {};

  const isRejectedMR = obj.type === 'material_request_rejected';
  const isApprovedMR = obj.type === 'material_request_approved';
  const isSubmittedMR = obj.type === 'material_request_submitted' || obj.type === 'material_request_created' || obj.type === 'material_request';
  const isMaterialAdded = obj.type === 'material_added' || obj.type === 'project_material_added';
  const isProjectUpdate = obj.type === 'project_update';

  // 1a. Enrich Material Request Submission notifications (for Project Admin)
  if (isSubmittedMR) {
    if (!obj.actionText) {
      obj.actionText = 'Review Request';
    }
    if (!obj.link) {
      obj.link = '/material-requests';
    }
    try {
      let mr = null;
      if (obj.relatedId) {
        mr = await MaterialRequest.findById(obj.relatedId).populate('projectId inventoryItemId requestedBy');
      }
      if (mr) {
        obj.metadata.status = mr.status;
        if (!obj.metadata.projectName && mr.projectId?.name) {
          obj.metadata.projectName = mr.projectId.name;
        }
        if (!obj.metadata.entityName) {
          obj.metadata.entityName = mr.inventoryItemId?.name || mr.materialName || 'Guitar Item';
        }
        if (!obj.metadata.quantity) {
          obj.metadata.quantity = mr.quantity;
        }
        if (!obj.metadata.actorName && mr.requestedBy?.name) {
          obj.metadata.actorName = mr.requestedBy.name;
        }
        if (!obj.metadata.actorEmail && mr.requestedBy?.email) {
          obj.metadata.actorEmail = mr.requestedBy.email;
        }
        if (!obj.metadata.reason && mr.reason) {
          obj.metadata.reason = mr.reason;
        }
      }
    } catch { }
  }

  // 1b. Enrich Material Addition notifications (for Project Admin and Mentors)
  if (isMaterialAdded) {
    if (!obj.actionText) {
      obj.actionText = 'View Materials';
    }
    if (!obj.link) {
      obj.link = obj.metadata.projectId ? `/projects/${obj.metadata.projectId}` : '/projects';
    }
    try {
      let mat = null;
      if (obj.relatedId) {
        mat = await ProjectMaterial.findById(obj.relatedId).populate('projectId addedBy');
      }
      if (mat) {
        if (!obj.metadata.projectName && mat.projectId?.name) {
          obj.metadata.projectName = mat.projectId.name;
        }
        if (!obj.metadata.entityName) {
          obj.metadata.entityName = mat.name;
        }
        if (!obj.metadata.quantity) {
          obj.metadata.quantity = mat.quantity;
        }
        if (!obj.metadata.source && mat.source) {
          obj.metadata.source = mat.source;
        }
        if (!obj.metadata.creationTime && mat.createdAt) {
          obj.metadata.creationTime = mat.createdAt;
        }
        if (!obj.metadata.actorName && mat.addedBy?.name) {
          obj.metadata.actorName = mat.addedBy.name;
        }
        if (!obj.metadata.actorEmail && mat.addedBy?.email) {
          obj.metadata.actorEmail = mat.addedBy.email;
        }
        if (!obj.metadata.department && mat.addedBy?.department) {
          obj.metadata.department = mat.addedBy.department;
        }
        if (!obj.metadata.semester && mat.addedBy?.semester) {
          obj.metadata.semester = mat.addedBy.semester;
        }
        if (!obj.link && mat.projectId?._id) {
          obj.link = `/projects/${mat.projectId._id}`;
        }
      }
    } catch { }
  }

  // 1c. Enrich Material Request approval/rejection notifications
  if (isRejectedMR || isApprovedMR) {
    if (!obj.actionText) {
      obj.actionText = isApprovedMR ? 'View Materials' : 'View Request History';
    }

    // If rejection reason is missing or message is generic
    if (isRejectedMR && (!obj.metadata.reason || obj.message === 'Your material request was rejected.')) {
      try {
        let mr = null;
        if (obj.relatedId) {
          mr = await MaterialRequest.findById(obj.relatedId).populate('projectId inventoryItemId reviewedBy');
        }
        if (!mr) {
          const userProj = await Project.findOne({ teamLeaderId: userId });
          if (userProj) {
            mr = await MaterialRequest.findOne({ projectId: userProj._id, status: 'rejected' })
              .populate('projectId inventoryItemId reviewedBy')
              .sort({ updatedAt: -1 });
          }
        }
        if (mr) {
          const pName = mr.projectId?.name || 'your project';
          const iName = mr.inventoryItemId?.name || 'material';
          const rName = mr.reviewedBy?.name || 'Project Admin';
          const reason = mr.rejectionReason || '';
          obj.metadata.reason = reason;
          obj.metadata.projectName = pName;
          obj.metadata.entityName = iName;
          obj.metadata.quantity = mr.quantity;
          obj.metadata.actorName = rName;
          if (!obj.link && mr.projectId?._id) {
            obj.link = `/projects/${mr.projectId._id}`;
          }
          if (reason && (!obj.message || obj.message === 'Your material request was rejected.')) {
            obj.message = `Your request for ${mr.quantity}x "${iName}" for project "${pName}" was rejected by ${rName}. Reason: ${reason}`;
          }
        }
      } catch { }
    } else if (isApprovedMR && (!obj.metadata.projectName || !obj.link)) {
      try {
        let mr = null;
        if (obj.relatedId) {
          mr = await MaterialRequest.findById(obj.relatedId).populate('projectId inventoryItemId reviewedBy');
        }
        if (!mr) {
          const userProj = await Project.findOne({ teamLeaderId: userId });
          if (userProj) {
            mr = await MaterialRequest.findOne({ projectId: userProj._id, status: 'approved' })
              .populate('projectId inventoryItemId reviewedBy')
              .sort({ updatedAt: -1 });
          }
        }
        if (mr) {
          const pName = mr.projectId?.name || 'your project';
          const iName = mr.inventoryItemId?.name || 'material';
          const rName = mr.reviewedBy?.name || 'Project Admin';
          obj.metadata.projectName = pName;
          obj.metadata.entityName = iName;
          obj.metadata.quantity = mr.quantity;
          obj.metadata.actorName = rName;
          if (!obj.link && mr.projectId?._id) {
            obj.link = `/projects/${mr.projectId._id}`;
          }
          if (!obj.message || obj.message === 'Your material request was approved.') {
            obj.message = `Project Admin ${rName} approved your request for ${mr.quantity}x "${iName}" for project "${pName}".`;
          }
        }
      } catch { }
    }

    if (!obj.link && obj.metadata.projectId) {
      obj.link = `/projects/${obj.metadata.projectId}`;
    }
  }

  // 2. Enrich Project Update / Feedback notifications
  if (isProjectUpdate) {
    const isFeedback = obj.title?.toLowerCase().includes('feedback') || obj.message?.toLowerCase().includes('feedback');
    if (!obj.actionText) {
      obj.actionText = isFeedback ? 'View Feedback' : 'View Update';
    }
    if (!obj.link && obj.metadata.projectId) {
      obj.link = `/projects/${obj.metadata.projectId}${obj.relatedId ? `#update-${obj.relatedId}` : ''}`;
    }
    if (!obj.link) {
      try {
        if (obj.relatedId) {
          const upd = await ProjectUpdate.findById(obj.relatedId);
          if (upd?.projectId) {
            obj.link = `/projects/${upd.projectId}#update-${upd._id}`;
          } else {
            const fb = await ProjectFeedback.findById(obj.relatedId);
            if (fb?.projectId) {
              obj.link = `/projects/${fb.projectId}#update-${fb.updateId || ''}`;
            }
          }
        }
        if (!obj.link) {
          const p = await Project.findOne({ teamLeaderId: userId });
          if (p) obj.link = `/projects/${p._id}`;
        }
      } catch { }
    }

    if (isFeedback && (!obj.metadata.feedbackText || obj.message === 'You have new feedback from your mentor.')) {
      try {
        let fb = null;
        if (obj.relatedId) {
          fb = await ProjectFeedback.findById(obj.relatedId).populate('mentorId projectId updateId');
        }
        if (!fb) {
          const userProj = await Project.findOne({ teamLeaderId: userId });
          if (userProj) {
            fb = await ProjectFeedback.findOne({ projectId: userProj._id }).populate('mentorId projectId updateId').sort({ createdAt: -1 });
          }
        }
        if (fb) {
          const mName = fb.mentorId?.name || 'Faculty Mentor';
          const pName = fb.projectId?.name || 'Project';
          const uTitle = fb.updateId?.title || 'Project Update';
          const text = fb.feedbackText || '';
          obj.metadata.actorName = mName;
          obj.metadata.projectName = pName;
          obj.metadata.entityName = uTitle;
          obj.metadata.feedbackText = text;
          if (text && (!obj.message || obj.message === 'You have new feedback from your mentor.')) {
            const preview = text.length > 120 ? `${text.substring(0, 117)}...` : text;
            obj.message = `${mName} provided feedback on update "${uTitle}" for project "${pName}": "${preview}"`;
          }
        }
      } catch { }
    } else if (!isFeedback && obj.relatedId) {
      try {
        const upd = await ProjectUpdate.findById(obj.relatedId).populate('projectId studentId');
        if (upd) {
          if (!obj.metadata.projectName && upd.projectId?.name) {
            obj.metadata.projectName = upd.projectId.name;
          }
          if (!obj.metadata.entityName) {
            obj.metadata.entityName = upd.title;
          }
          if (!obj.metadata.actorName && upd.studentId?.name) {
            obj.metadata.actorName = upd.studentId.name;
          }
          if (!obj.metadata.actorEmail && upd.studentId?.email) {
            obj.metadata.actorEmail = upd.studentId.email;
          }
          if (!obj.metadata.department && upd.studentId?.department) {
            obj.metadata.department = upd.studentId.department;
          }
          if (!obj.metadata.semester && upd.studentId?.semester) {
            obj.metadata.semester = upd.studentId.semester;
          }
          if (obj.metadata.hasAttachments === undefined && upd.files) {
            obj.metadata.hasAttachments = upd.files.length > 0;
            obj.metadata.attachmentCount = upd.files.length;
          }
          if (!obj.metadata.submissionTime && upd.createdAt) {
            obj.metadata.submissionTime = upd.createdAt;
          }
        }
      } catch { }
    }
  }

  // 3. Enrich Club and Project Join Request notifications
  if (obj.type === 'club_join_request' || obj.type === 'project_join_request') {
    if (!obj.actionText) {
      obj.actionText = 'Review Request';
    }
    if (!obj.metadata) {
      obj.metadata = {};
    }
    if (!obj.metadata.status) {
      obj.metadata.status = 'pending';
    }
    if (!obj.metadata.requestDate) {
      obj.metadata.requestDate = obj.createdAt;
    }

    if (obj.relatedId) {
      try {
        const jr = await JoinRequest.findById(obj.relatedId)
          .populate('studentId', 'name email department semester')
          .populate('clubId', 'name')
          .populate('projectId', 'name');
        if (jr && jr.studentId) {
          obj.metadata.actorName = obj.metadata.actorName || jr.studentId.name;
          obj.metadata.actorEmail = obj.metadata.actorEmail || jr.studentId.email;
          obj.metadata.department = obj.metadata.department || jr.studentId.department || null;
          obj.metadata.semester = obj.metadata.semester || jr.studentId.semester || null;
          obj.metadata.status = jr.status;
          obj.metadata.requestDate = jr.createdAt;
          if (jr.requestType === 'club') {
            obj.metadata.clubId = obj.metadata.clubId || jr.clubId?._id || jr.clubId;
            if (jr.clubId?.name) {
              obj.metadata.clubName = jr.clubId.name;
            }
          } else if (jr.requestType === 'project') {
            obj.metadata.projectId = obj.metadata.projectId || jr.projectId?._id || jr.projectId;
            if (jr.projectId?.name) {
              obj.metadata.projectName = jr.projectId.name;
            }
          }
        }
      } catch { }
    }

    if (obj.type === 'club_join_request') {
      if (!obj.title) {
        obj.title = 'New Club Join Request';
      }
      if (!obj.message || obj.message === 'A student has requested to join this club.') {
        if (obj.metadata.actorName && obj.metadata.clubName) {
          obj.message = `${obj.metadata.actorName} has requested to join ${obj.metadata.clubName}.`;
        } else if (obj.metadata.actorName) {
          obj.message = `${obj.metadata.actorName} has requested to join this club.`;
        } else {
          obj.message = 'A student has requested to join this club.';
        }
      }
    } else if (obj.type === 'project_join_request') {
      if (!obj.title) {
        obj.title = 'New Project Join Request';
      }
      if (!obj.message || obj.message === 'A student has requested to join this project.') {
        if (obj.metadata.actorName && obj.metadata.projectName) {
          obj.message = `${obj.metadata.actorName} has requested to join ${obj.metadata.projectName}.`;
        } else if (obj.metadata.actorName) {
          obj.message = `${obj.metadata.actorName} has requested to join this project.`;
        } else {
          obj.message = 'A student has requested to join this project.';
        }
      }
    }

    if (!obj.link) {
      if (obj.type === 'club_join_request') {
        obj.link = obj.metadata.clubId ? `/clubs/${obj.metadata.clubId}#join-requests` : '/clubs';
      } else {
        obj.link = obj.metadata.projectId ? `/projects/${obj.metadata.projectId}#join-requests` : '/projects';
      }
    }
  }

  // 4. Fallbacks for other types
  if (!obj.link) {
    if (obj.type.startsWith('club_join')) {
      obj.link = obj.metadata.clubId ? `/clubs/${obj.metadata.clubId}` : '/clubs';
      obj.actionText = obj.actionText || 'View Club';
    } else if (obj.type.startsWith('project_join')) {
      obj.link = obj.metadata.projectId ? `/projects/${obj.metadata.projectId}` : '/projects';
      obj.actionText = obj.actionText || 'View Project';
    } else if (obj.type === 'mentor_assigned') {
      obj.link = obj.relatedId ? `/projects/${obj.relatedId}` : '/projects';
      obj.actionText = obj.actionText || 'View Project';
    }
  }

  return obj;
}

// ── GET /api/notifications?limit= ────────────────────────────────────────────
// Returns the authenticated user's notifications, newest first.
// SECURITY: userId comes from req.user.userId (JWT) — query param userId IGNORED.
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT, never from query
    const { limit } = req.query;

    const pageLimit = Math.min(parseInt(limit) || 50, 100); // cap at 100

    // SECURITY: always filter by the JWT-derived userId
    const rawNotifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(pageLimit);

    const notifications = await Promise.all(
      rawNotifications.map((n) => enrichNotification(n, userId))
    );

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────────
// Returns only the unread count for the current user.
// IMPORTANT: This route MUST be defined BEFORE /:notificationId/read
// so Express doesn't match "unread-count" as a :notificationId param.
// SECURITY: userId from JWT — no query param needed.
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT

    const count = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({ success: true, count });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark ALL of the current user's unread notifications as read.
// SECURITY: userId from JWT — body userId IGNORED.
// IMPORTANT: Must be before /:notificationId/read to avoid route collision.
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT, never from body

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} notification(s) as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/:notificationId/read ────────────────────────────
// Mark a single notification as read.
// SECURITY:
//   - Requires authentication.
//   - Ownership enforced: notification.userId must equal req.user.userId.
//   - Body userId is IGNORED — identity comes from JWT.
router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId; // SECURITY: from JWT, never from body

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // SECURITY: only the owner can mark their notification as read
    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark your own notifications as read',
      });
    }

    await Notification.updateOne(
      { _id: notification._id },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

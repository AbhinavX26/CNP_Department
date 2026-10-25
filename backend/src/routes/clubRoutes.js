import express from 'express';
import Club from '../models/Club.js';
import ClubMembership from '../models/ClubMembership.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAnyRole } from '../middleware/requireRole.js';
import { uploadImages, handleUploadError } from '../middleware/upload.js';
import { replaceEntityImage } from '../services/cloudinaryService.js';

const router = express.Router();

// ── POST /api/clubs/:id/logo ──────────────────────────────────────────────
router.post(
  '/:id/logo',
  requireAuth,
  requireAnyRole('club_admin', 'faculty_coordinator'),
  uploadImages.single('logo'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }

      const club = await Club.findById(req.params.id);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      // Authorization: Faculty Coordinator can only update their assigned club
      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not assigned as the coordinator for this club',
          });
        }
      }

      await replaceEntityImage({
        document: club,
        file: req.file,
        folder: 'cnp/clubs',
        urlField: 'logo',
        publicIdField: 'logoPublicId',
        logLabel: 'club logo',
      });

      res.status(200).json({
        success: true,
        message: 'Club logo updated successfully',
        data: { logo: club.logo },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── POST /api/clubs/:id/cover_image ───────────────────────────────────────
router.post(
  '/:id/cover_image',
  requireAuth,
  requireAnyRole('club_admin', 'faculty_coordinator'),
  uploadImages.single('coverImage'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }

      const club = await Club.findById(req.params.id);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      // Authorization: Faculty Coordinator can only update their assigned club
      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not assigned as the coordinator for this club',
          });
        }
      }

      await replaceEntityImage({
        document: club,
        file: req.file,
        folder: 'cnp/clubs/covers',
        urlField: 'coverImage',
        publicIdField: 'coverImagePublicId',
        logLabel: 'club cover image',
      });

      res.status(200).json({
        success: true,
        message: 'Club cover image updated successfully',
        data: { coverImage: club.coverImage },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── POST /api/clubs ───────────────────────────────────────────────────────────
// Create a new club.
// Only club_admin can create clubs.
// createdBy is derived from the authenticated user — never trusted from client.
router.post('/', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { name, description, logo, images, facultyCoordinatorId } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, never from body

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
    }

    const club = await Club.create({
      name,
      description,
      logo: logo || null,
      images: images || [],
      facultyCoordinatorId: facultyCoordinatorId || null,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      data: club,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── PATCH /api/clubs/:clubId ──────────────────────────────────────────────────
// Edit club details. Only club_admin can edit club details.
router.patch('/:clubId', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const { clubId } = req.params;

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    if (name !== undefined) club.name = name;
    if (description !== undefined) club.description = description;

    await club.save();

    res.status(200).json({
      success: true,
      message: 'Club details updated successfully',
      data: club,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/clubs/:clubId/coordinator ──────────────────────────────────────
// Reassign Faculty Coordinator. Only club_admin can do this.
router.patch('/:clubId/coordinator', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { facultyCoordinatorId } = req.body;
    const { clubId } = req.params;

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    // If they want to unset the coordinator
    if (facultyCoordinatorId === null || facultyCoordinatorId === '') {
      club.facultyCoordinatorId = null;
    } else {
      const fcUser = await User.findById(facultyCoordinatorId);
      if (!fcUser) {
        return res.status(404).json({ success: false, message: 'Supplied facultyCoordinatorId user not found' });
      }
      if (fcUser.role !== 'faculty_coordinator') {
        return res.status(400).json({ success: false, message: 'Supplied user is not a faculty_coordinator' });
      }
      club.facultyCoordinatorId = facultyCoordinatorId;
    }

    await club.save();
    await club.populate('facultyCoordinatorId', 'name email role profileImage department semester');

    res.status(200).json({
      success: true,
      message: 'Faculty Coordinator updated successfully',
      data: club,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Attaches membership counts (totalMembers, memberCount, coreTeamCount, regularMemberCount)
 * to an array of Club documents.
 */
async function attachMembershipCounts(clubs) {
  if (!clubs || clubs.length === 0) return [];
  const clubIds = clubs.map((c) => c._id);
  const memberships = await ClubMembership.aggregate([
    { $match: { clubId: { $in: clubIds } } },
    {
      $group: {
        _id: '$clubId',
        totalMembers: { $sum: 1 },
        coreTeamCount: {
          $sum: { $cond: [{ $eq: ['$membershipType', 'core_team'] }, 1, 0] },
        },
        regularMemberCount: {
          $sum: { $cond: [{ $ne: ['$membershipType', 'core_team'] }, 1, 0] },
        },
      },
    },
  ]);

  const statsMap = new Map();
  for (const m of memberships) {
    statsMap.set(m._id.toString(), m);
  }

  return clubs.map((c) => {
    const cObj = typeof c.toObject === 'function' ? c.toObject() : { ...c };
    const stats = statsMap.get(cObj._id.toString()) || {
      totalMembers: 0,
      coreTeamCount: 0,
      regularMemberCount: 0,
    };
    cObj.totalMembers = stats.totalMembers;
    cObj.memberCount = stats.totalMembers;
    cObj.coreTeamCount = stats.coreTeamCount;
    cObj.regularMemberCount = stats.regularMemberCount;
    return cObj;
  });
}

// ── GET /api/clubs ────────────────────────────────────────────────────────────
// Return clubs — publicly readable (any authenticated user).
// Optional query parameter: ?coordinatorId=<userId|me>
// SECURITY:
//   - faculty_coordinator can ONLY view their own assigned clubs.
//   - club_admin / project_admin can query any coordinator's assigned clubs.
//   - Other roles filtering by coordinator receive 403 Forbidden.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { coordinatorId } = req.query;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;

    const filter = {};

    if (coordinatorId) {
      const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

      if (actingRole === 'faculty_coordinator') {
        if (targetCoordinatorId !== actingUserId) {
          return res.status(403).json({
            success: false,
            message: 'You can only view your own assigned clubs',
          });
        }
      } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view coordinator club assignments',
        });
      }

      filter.facultyCoordinatorId = targetCoordinatorId;
    }

    const clubs = await Club.find(filter)
      .populate('facultyCoordinatorId', 'name email role profileImage department semester')
      .populate('createdBy', 'name email role profileImage department semester')
      .sort({ createdAt: -1 });

    const clubsWithStats = await attachMembershipCounts(clubs);

    res.status(200).json({
      success: true,
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── GET /api/clubs/coordinator/:coordinatorId ─────────────────────────────────
// Return all clubs assigned to a specific coordinator.
// SECURITY:
//   - faculty_coordinator: can only view their own assigned clubs
//   - club_admin / project_admin: can view any coordinator's assigned clubs
router.get('/coordinator/:coordinatorId', requireAuth, async (req, res) => {
  try {
    const { coordinatorId } = req.params;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;
    const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

    if (actingRole === 'faculty_coordinator') {
      if (targetCoordinatorId !== actingUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own assigned clubs',
        });
      }
    } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view coordinator club assignments',
      });
    }

    const coordinator = await User.findById(targetCoordinatorId);
    if (!coordinator) {
      return res.status(404).json({ success: false, message: 'Coordinator not found' });
    }

    const clubs = await Club.find({ facultyCoordinatorId: targetCoordinatorId })
      .populate('facultyCoordinatorId', 'name email role profileImage department semester')
      .populate('createdBy', 'name email role profileImage department semester')
      .sort({ createdAt: -1 });

    const clubsWithStats = await attachMembershipCounts(clubs);

    res.status(200).json({
      success: true,
      coordinator: { id: coordinator._id, name: coordinator.name, email: coordinator.email, role: coordinator.role },
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/clubs/:clubId/members ───────────────────────────────────────────
// Add a student to a club (administrative add, not via join request).
// SECURITY:
//   - faculty_coordinator: can only add to their assigned club
//   - club_admin: can add to any club
router.post(
  '/:clubId/members',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId } = req.params;
      const { studentId, membershipType, position } = req.body;

      if (!studentId || !membershipType) {
        return res.status(400).json({
          success: false,
          message: 'studentId and membershipType are required',
        });
      }

      // Verify the club exists
      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      // Faculty Coordinator: must be the assigned coordinator of THIS club
      if (req.user.role === 'faculty_coordinator') {
        if (
          !club.facultyCoordinatorId ||
          club.facultyCoordinatorId.toString() !== req.user.userId
        ) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to manage this club',
          });
        }
      }

      // Verify student user exists
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student (User) not found',
        });
      }

      // Verify user has student role
      if (student.role !== 'student') {
        return res.status(400).json({
          success: false,
          message: 'Only users with role "student" can be added to a club',
        });
      }

      // Check existing membership (duplicate check)
      const existing = await ClubMembership.findOne({ studentId, clubId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This student is already a member of this club. Duplicate membership is not allowed.',
        });
      }

      const membership = await ClubMembership.create({
        studentId,
        clubId,
        membershipType,
        position: position || null,
      });

      // Populate student info before returning
      await membership.populate('studentId', 'name email role profileImage department semester enrollmentNumber');
      await membership.populate('clubId', 'name');

      res.status(201).json({
        success: true,
        message: 'Member added to club successfully',
        data: membership,
      });
    } catch (error) {
      // MongoDB duplicate key error code
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'This student is already a member of this club. Duplicate membership is not allowed.',
        });
      }
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ── GET /api/clubs/:clubId/members ────────────────────────────────────────────
// Return all members of a club — readable by any authenticated user.
router.get('/:clubId/members', requireAuth, async (req, res) => {
  try {
    const { clubId } = req.params;

    // Verify the club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const members = await ClubMembership.find({ clubId })
      .populate('studentId', 'name email role profileImage department semester enrollmentNumber') // Only safe fields — no passwords
      .sort({ joinedAt: 1 });

    res.status(200).json({
      success: true,
      club: { id: club._id, name: club.name },
      count: members.length,
      data: members,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── DELETE /api/clubs/:clubId/members/:studentId ──────────────────────────────
router.delete(
  '/:clubId/members/:studentId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId, studentId } = req.params;

      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({ success: false, message: 'You are not authorized to manage this club' });
        }
      }

      const membership = await ClubMembership.findOneAndDelete({ clubId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── PATCH /api/clubs/:clubId/members/:studentId ───────────────────────────────
router.patch(
  '/:clubId/members/:studentId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId, studentId } = req.params;
      const { membershipType, position } = req.body;

      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({ success: false, message: 'You are not authorized to manage this club' });
        }
      }

      if (membershipType && !['member', 'core_team'].includes(membershipType)) {
        return res.status(400).json({ success: false, message: 'Invalid membershipType' });
      }

      const membership = await ClubMembership.findOne({ clubId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      if (membershipType !== undefined) {
        membership.membershipType = membershipType;
      }
      
      if (position !== undefined) {
        membership.position = position || null;
      }

      await membership.save();
      await membership.populate('studentId', 'name email role profileImage department semester');
      await membership.populate('clubId', 'name');

      res.status(200).json({ success: true, message: 'Membership updated successfully', data: membership });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─── Router scoped to /api/coordinators ───────────────────────────────────────
const coordinatorRouter = express.Router();

// ── GET /api/coordinators/:coordinatorId/clubs ─────────────────────────────────
// Return all clubs assigned to a specific coordinator.
coordinatorRouter.get('/:coordinatorId/clubs', requireAuth, async (req, res) => {
  try {
    const { coordinatorId } = req.params;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;
    const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

    if (actingRole === 'faculty_coordinator') {
      if (targetCoordinatorId !== actingUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own assigned clubs',
        });
      }
    } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view coordinator club assignments',
      });
    }

    const coordinator = await User.findById(targetCoordinatorId);
    if (!coordinator) {
      return res.status(404).json({ success: false, message: 'Coordinator not found' });
    }

    const clubs = await Club.find({ facultyCoordinatorId: targetCoordinatorId })
      .populate('facultyCoordinatorId', 'name email role profileImage department semester')
      .populate('createdBy', 'name email role profileImage department semester')
      .sort({ createdAt: -1 });

    const clubsWithStats = await attachMembershipCounts(clubs);

    res.status(200).json({
      success: true,
      coordinator: { id: coordinator._id, name: coordinator.name, email: coordinator.email, role: coordinator.role },
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export { coordinatorRouter };
export default router;

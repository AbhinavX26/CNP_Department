/**
 * User Routes (SECURED in 2J Part 2)
 *
 * Routes:
 *   POST /api/users/test          — DEV ONLY: create test users without auth
 *   GET  /api/users/:userId/projects — get projects for a user
 *
 * SECURITY (2J Part 2):
 *   - GET /:userId/projects now requires authentication.
 *   - A student can only see their own project memberships.
 *   - project_admin and faculty_mentor can look up any user's projects.
 *   - Other roles (club_admin, faculty_coordinator) can only see their own.
 *   - POST /test remains dev-only (blocked in production).
 *
 * NOTE: POST /api/users/test is a DEV-ONLY convenience endpoint.
 * It is guarded inside this file based on NODE_ENV.
 */

import express from 'express';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadImages, handleUploadError } from '../middleware/upload.js';
import { replaceEntityImage } from '../services/cloudinaryService.js';

const router = express.Router();

const VALID_ROLES = ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'];
const ADMIN_ROLES = ['project_admin', 'club_admin', 'faculty_coordinator'];

// ── GET /api/users ───────────────────────────────────────────────────────────
// List registered users filtered by role.
// Used for searchable user dropdowns across admin & coordinator assignment workflows.
// SECURITY:
//   - Requires authentication (JWT).
//   - Only project_admin, club_admin, and faculty_coordinator can access.
//   - faculty_coordinator can ONLY query students.
//   - Passwords and sensitive fields are excluded.
router.get('/', requireAuth, async (req, res) => {
  try {
    const callerRole = req.user.role;

    // 1. Authorization: Only administrative roles can list users
    if (!ADMIN_ROLES.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: administrative role required',
      });
    }

    const filter = {};

    // 2. Role filtering & scoping
    if (callerRole === 'faculty_coordinator') {
      // Faculty coordinators are strictly limited to querying students
      if (req.query.role && req.query.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Faculty coordinators are only authorized to query students',
        });
      }
      filter.role = 'student';
    } else if (req.query.role) {
      if (!VALID_ROLES.includes(req.query.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role filter. Allowed values: ${VALID_ROLES.join(', ')}`,
        });
      }
      filter.role = req.query.role;
    }

    // 3. Search filtering (name, email, department)
    if (req.query.search && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { department: searchRegex },
        { enrollmentNumber: searchRegex },
      ];
    }

    // 4. Query DB excluding password
    const users = await User.find(filter)
      .select('_id name email role department semester universityId enrollmentNumber profileImage phone')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/users/test ─────────────────────────────────────────────────────
// DEV ONLY: Create a user without authentication.
// Returns existing user if the email is already registered (idempotent).
// Restricted to non-production environments.
router.post('/test', async (req, res) => {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and role are required',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'User already exists — returning existing record',
        data: existing,
      });
    }

    const user = await User.create({ name, email, role });

    res.status(201).json({
      success: true,
      message: 'Test user created successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/users/profile-image ──────────────────────────────────────────
// Upload/update authenticated user's profile image
router.post(
  '/profile-image',
  requireAuth,
  uploadImages.single('image'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }

      const userId = req.user.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      await replaceEntityImage({
        document: user,
        file: req.file,
        folder: 'cnp/users',
        urlField: 'profileImage',
        publicIdField: 'profileImagePublicId',
        logLabel: `profile image for user ${userId}`,
      });

      res.status(200).json({
        success: true,
        message: 'Profile image updated successfully',
        data: {
          profileImage: user.profileImage,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── PATCH /api/users/profile ─────────────────────────────────────────────────
// Update authenticated user's profile details.
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, department, universityId, semester, phone, bio, enrollmentNumber } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      user.name = name.trim();
    }
    if (department !== undefined) user.department = department.trim();
    if (universityId !== undefined) user.universityId = universityId.trim();
    if (semester !== undefined) {
      if (semester === '' || semester === null) {
        user.semester = null;
      } else {
        user.semester = Number(semester);
      }
    }
    if (phone !== undefined) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (enrollmentNumber !== undefined) {
      // Enrollment Number only applies to students
      if (user.role === 'student') {
        user.enrollmentNumber = enrollmentNumber === '' || enrollmentNumber === null ? null : enrollmentNumber.trim();
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/users/:userId/projects ──────────────────────────────────────────
// Return all projects a student belongs to (populated project documents).
// SECURITY (2J Part 2):
//   - Requires authentication.
//   - Students can only see their own project memberships.
//   - project_admin and faculty_mentor can look up any user's projects.
//   - Other roles (club_admin, faculty_coordinator) can only see their own.
router.get('/:userId/projects', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const actingUser = req.user; // SECURITY: JWT-derived identity

    // Authorization: restrict access based on role
    if (
      actingUser.role !== 'project_admin' &&
      actingUser.role !== 'faculty_mentor' &&
      actingUser.userId !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own project memberships',
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const memberships = await ProjectMembership.find({ studentId: userId })
      .populate('projectId', 'name description image status teamLeaderId createdAt updatedAt')
      .sort({ joinedAt: 1 });

    // Return the project documents directly (not the membership wrappers)
    const projects = memberships.map((m) => ({
      membershipId: m._id,
      joinedAt: m.joinedAt,
      project: m.projectId,
    }));

    res.status(200).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

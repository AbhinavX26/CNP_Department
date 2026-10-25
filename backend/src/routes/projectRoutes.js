import express from 'express';
import Project from '../models/Project.js';
import ProjectMembership from '../models/ProjectMembership.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole, requireAnyRole } from '../middleware/requireRole.js';
import { uploadImages, handleUploadError } from '../middleware/upload.js';
import { replaceEntityImage } from '../services/cloudinaryService.js';

const router = express.Router();

const VALID_STATUSES = ['active', 'completed', 'inactive'];

// ── POST /api/projects/:id/image ──────────────────────────────────────────
router.post(
  '/:id/image',
  requireAuth,
  requireRole('project_admin'),
  uploadImages.single('image'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }

      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      await replaceEntityImage({
        document: project,
        file: req.file,
        folder: 'cnp/projects',
        urlField: 'image',
        publicIdField: 'imagePublicId',
        logLabel: 'project image',
      });

      res.status(200).json({
        success: true,
        message: 'Project image updated successfully',
        data: { image: project.image },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── POST /api/projects ────────────────────────────────────────────────────────
// Create a new project.
// Only project_admin can create projects.
// createdBy is derived from req.user.userId — never trusted from client.
router.post('/', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { name, description, image, status } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, not from body

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
    }

    const project = await Project.create({
      name,
      description,
      image: image || null,
      status: status || 'active',
      createdBy,
    });

    await project.populate('createdBy', 'name email role profileImage department semester');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
// Return all projects — readable by any authenticated user.
router.get('/', requireAuth, async (_req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name email role profileImage department semester')
      .populate('teamLeaderId', 'name email role profileImage department semester enrollmentNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId ──────────────────────────────────────────────
// Return a single project by ID — readable by any authenticated user.
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('createdBy', 'name email role profileImage department semester')
      .populate('teamLeaderId', 'name email role profileImage department semester enrollmentNumber');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    // Catch malformed ObjectId (CastError)
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/projects/:projectId ────────────────────────────────────────────
// Update project details (name, description).
// Only project_admin can update details.
router.patch(
  '/:projectId',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email role profileImage department semester');

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Project details updated successfully',
        data: project,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── PATCH /api/projects/:projectId/status ─────────────────────────────────────
// Update project status only.
// Only project_admin can change project status.
router.patch(
  '/:projectId/status',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: 'status is required' });
      }

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }

      const project = await Project.findByIdAndUpdate(
        projectId,
        { status },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email role profileImage department semester');

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      res.status(200).json({
        success: true,
        message: `Project status updated to "${status}"`,
        data: project,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── POST /api/projects/:projectId/members ─────────────────────────────────────
// Add a student to a project (administrative add, not via join request).
// Only project_admin can directly add members.
// SECURITY: studentId in body is the target (who to add), NOT the actor.
router.post(
  '/:projectId/members',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ success: false, message: 'studentId is required' });
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // Verify student exists
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student (User) not found' });
      }

      // Verify user is a student
      if (student.role !== 'student') {
        return res.status(400).json({
          success: false,
          message: 'Only users with role "student" can be added as project members',
        });
      }

      // Check existing membership (duplicate check)
      const existing = await ProjectMembership.findOne({ studentId, projectId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            'This student is already a member of this project. Duplicate membership is not allowed.',
        });
      }

      const membership = await ProjectMembership.create({ studentId, projectId });

      await membership.populate('studentId', 'name email role profileImage department semester enrollmentNumber');
      await membership.populate('projectId', 'name status');

      res.status(201).json({
        success: true,
        message: 'Student added to project successfully',
        data: membership,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            'This student is already a member of this project. Duplicate membership is not allowed.',
        });
      }
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── DELETE /api/projects/:projectId/members/:studentId ────────────────────────
// Remove a student from a project.
// Only project_admin can remove members.
router.delete(
  '/:projectId/members/:studentId',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId, studentId } = req.params;

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      if (project.teamLeaderId && project.teamLeaderId.toString() === studentId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the current Team Leader. Please assign a new Team Leader first.',
        });
      }

      const membership = await ProjectMembership.findOneAndDelete({ projectId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Student removed from project successfully',
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── GET /api/projects/:projectId/members ──────────────────────────────────────
// Return all students in a project — readable by any authenticated user.
router.get('/:projectId/members', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const members = await ProjectMembership.find({ projectId })
      .populate('studentId', 'name email role profileImage department semester enrollmentNumber') // Safe fields only
      .sort({ joinedAt: 1 });

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: members.length,
      data: members,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

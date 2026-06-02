const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Call = require('../models/Call');
const Notification = require('../models/Notification');
const { auth, adminOnly, superAdminOnly } = require('../middleware/auth');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

// All admin routes require auth + admin role
router.use(auth, adminOnly);

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      onlineUsers,
      totalMessages,
      totalConversations,
      totalCalls,
      newUsersToday,
      suspendedUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnline: true }),
      Message.countDocuments(),
      Conversation.countDocuments(),
      Call.countDocuments(),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      User.countDocuments({ status: 'suspended' })
    ]);

    // Users by role
    const usersByRole = await User.collection().aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]).toArray();

    res.json({
      totalUsers,
      onlineUsers,
      totalMessages,
      totalConversations,
      totalCalls,
      newUsersToday,
      suspendedUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id || 'user'] = item.count;
        return acc;
      }, {}),
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── LIST ALL USERS (with full details) ─────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status, sort = 'createdAt' } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.collection().find(query, {
      projection: { password: 0, refreshToken: 0 }
    })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ [sort]: -1 })
      .toArray();

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET SINGLE USER FULL DETAILS ──────────────────────────────────────────

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { projection: { password: 0, refreshToken: 0 } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's message count
    const messageCount = await Message.countDocuments({ sender: toObjectId(req.params.id) });

    // Get user's conversation count
    const conversationCount = await Conversation.countDocuments({
      participants: toObjectId(req.params.id)
    });

    // Get user's call count
    const callCount = await Call.countDocuments({
      $or: [
        { caller: toObjectId(req.params.id) },
        { receivers: toObjectId(req.params.id) }
      ]
    });

    // Get recent messages (last 10)
    const recentMessages = await Message.collection().find({
      sender: toObjectId(req.params.id)
    }).sort({ createdAt: -1 }).limit(10).toArray();

    // Get contacts count
    const contactsCount = (user.contacts || []).length;

    res.json({
      ...user,
      stats: {
        messageCount,
        conversationCount,
        callCount,
        contactsCount
      },
      recentMessages
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── CREATE NEW USER (super_admin only) ─────────────────────────────────────

router.post('/users', superAdminOnly, async (req, res) => {
  try {
    const { email, username, password, displayName, role, phone, bio } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Email, username, and password are required' });
    }

    const newUser = await User.insertOne({
      email,
      username,
      password,
      displayName: displayName || username,
      role: role || 'user',
      phone: phone || '',
      bio: bio || '',
      status: 'active'
    });

    const safeUser = User.sanitize(newUser);
    logger.info(`[Admin] User created by super_admin: @${username} (role: ${role || 'user'})`);

    res.status(201).json(safeUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: error.keyPattern?.email ? 'Email already exists' : 'Username already taken'
      });
    }
    logger.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── MODIFY USER ────────────────────────────────────────────────────────────

router.put('/users/:id', async (req, res) => {
  try {
    const { displayName, email, username, phone, bio, role, avatar, preferences } = req.body;
    const userId = req.params.id;

    // Only super_admin can change roles to super_admin
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can assign super_admin role' });
    }

    // Prevent modifying another super_admin unless you are super_admin
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot modify a super admin' });
    }

    const update = {};
    if (displayName !== undefined) update.displayName = displayName;
    if (email !== undefined) update.email = email;
    if (username !== undefined) update.username = username;
    if (phone !== undefined) update.phone = phone;
    if (bio !== undefined) update.bio = bio;
    if (role !== undefined) update.role = role;
    if (avatar !== undefined) update.avatar = avatar;
    if (preferences !== undefined) update.preferences = preferences;

    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    const safeUser = User.sanitize(updated);

    logger.info(`[Admin] User @${targetUser.username} modified by @${req.user.username}`);

    res.json(safeUser);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: error.keyPattern?.email ? 'Email already exists' : 'Username already taken'
      });
    }
    logger.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── UPDATE USER ROLE ──────────────────────────────────────────────────────

router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    // Only super_admin can assign super_admin role
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can assign super_admin role' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot modify a super admin role' });
    }

    const updated = await User.findByIdAndUpdate(userId, { role }, { new: true });
    const safeUser = User.sanitize(updated);

    logger.info(`[Admin] Role changed for @${targetUser.username} to ${role} by @${req.user.username}`);

    res.json(safeUser);
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── HOLD/SUSPEND/ACTIVATE USER ────────────────────────────────────────────

router.put('/users/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const userId = req.params.id;

    if (!['active', 'suspended', 'held'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use: active, suspended, or held' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot change a super admin status' });
    }

    const update = {
      status,
      statusReason: reason || '',
      statusChangedAt: new Date(),
      statusChangedBy: req.user._id
    };

    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    const safeUser = User.sanitize(updated);

    logger.info(`[Admin] Status changed for @${targetUser.username} to ${status} by @${req.user.username}. Reason: ${reason || 'N/A'}`);

    res.json(safeUser);
  } catch (error) {
    logger.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── RESET USER PASSWORD (super_admin only) ────────────────────────────────

router.put('/users/:id/reset-password', superAdminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    logger.info(`[Admin] Password reset for user ${userId} by @${req.user.username}`);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE USER ────────────────────────────────────────────────────────────

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot delete a super admin' });
    }

    await User.findByIdAndDelete(userId);

    // Clean up: remove user from conversations, contacts, etc.
    await User.collection().updateMany(
      { contacts: toObjectId(userId) },
      { $pull: { contacts: toObjectId(userId) } }
    );

    logger.info(`[Admin] User @${targetUser.username} deleted by @${req.user.username}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── BULK ACTIONS (super_admin only) ───────────────────────────────────────

router.post('/users/bulk', superAdminOnly, async (req, res) => {
  try {
    const { userIds, action, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const objectIds = userIds.map(id => toObjectId(id)).filter(Boolean);
    let result;

    switch (action) {
      case 'delete':
        // Prevent deleting super_admins
        const superAdmins = await User.find({ _id: { $in: objectIds }, role: 'super_admin' });
        if (superAdmins.length > 0) {
          return res.status(403).json({ message: 'Cannot delete super admin accounts' });
        }
        result = await User.collection().deleteMany({ _id: { $in: objectIds } });
        break;

      case 'suspend':
        result = await User.collection().updateMany(
          { _id: { $in: objectIds }, role: { $ne: 'super_admin' } },
          { $set: { status: 'suspended', statusReason: data?.reason || 'Bulk suspension', statusChangedAt: new Date() } }
        );
        break;

      case 'activate':
        result = await User.collection().updateMany(
          { _id: { $in: objectIds } },
          { $set: { status: 'active', statusReason: '', statusChangedAt: new Date() } }
        );
        break;

      case 'role':
        if (!data?.role) return res.status(400).json({ message: 'Role is required' });
        result = await User.collection().updateMany(
          { _id: { $in: objectIds }, role: { $ne: 'super_admin' } },
          { $set: { role: data.role } }
        );
        break;

      default:
        return res.status(400).json({ message: 'Invalid action. Use: delete, suspend, activate, role' });
    }

    logger.info(`[Admin] Bulk action "${action}" on ${userIds.length} users by @${req.user.username}`);

    res.json({ message: `Bulk ${action} completed`, affected: result?.modifiedCount || result?.deletedCount || 0 });
  } catch (error) {
    logger.error('Bulk action error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── NEW USERS (recent registrations) ──────────────────────────────────────

router.get('/new-users', async (req, res) => {
  try {
    const { days = 7, limit = 50 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const newUsers = await User.collection().find(
      { createdAt: { $gte: since } },
      { projection: { password: 0, refreshToken: 0 } }
    ).sort({ createdAt: -1 }).limit(parseInt(limit)).toArray();

    res.json({ newUsers, count: newUsers.length, days: parseInt(days) });
  } catch (error) {
    logger.error('Get new users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET MESSAGES ──────────────────────────────────────────────────────────

router.get('/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50, userId } = req.query;
    const query = {};
    if (userId) query.sender = toObjectId(userId);

    const messages = await Message.collection().find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(messages.map(async msg => {
      const sender = await User.findById(msg.sender, { username: 1, email: 1, displayName: 1 });
      return { ...msg, sender };
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET CONVERSATIONS ─────────────────────────────────────────────────────

router.get('/conversations', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const conversations = await Conversation.collection().find({})
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = await Promise.all(conversations.map(async conv => {
      const participants = await User.collection().find(
        { _id: { $in: conv.participants.map(p => toObjectId(p)).filter(Boolean) } },
        { projection: { username: 1, email: 1, displayName: 1 } }
      ).toArray();
      return { ...conv, participants };
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── BROADCAST MESSAGE ─────────────────────────────────────────────────────

router.post('/broadcast', superAdminOnly, async (req, res) => {
  try {
    const { message, type = 'info' } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get all users
    const allUsers = await User.find({}, { projection: { _id: 1 } });

    // Create notification for each user
    const notifications = allUsers.map(u => ({
      userId: u._id,
      type: 'admin_broadcast',
      title: 'Admin Announcement',
      body: message,
      data: { type, from: req.user.username },
      read: false,
      createdAt: new Date()
    }));

    if (notifications.length > 0) {
      await Notification.collection().insertMany(notifications);
    }

    logger.info(`[Admin] Broadcast sent to ${allUsers.length} users by @${req.user.username}`);

    res.json({ message: 'Broadcast sent', recipients: allUsers.length });
  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── REPORTS (placeholder) ─────────────────────────────────────────────────

router.get('/reports', async (req, res) => {
  try {
    res.json({ message: 'Reports endpoint - implement reporting system' });
  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Channel = require('../models/Channel');
const GroupInvite = require('../models/GroupInvite');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const logger = require('../utils/logger');
const { toObjectId } = require('../database/database');

const hasRole = async (groupId, userId, allowed = []) => {
  const member = await GroupMember.findOne({ group: toObjectId(groupId), user: toObjectId(userId) });
  if (!member) return false;
  if (allowed.length === 0) return true;
  return allowed.includes(member.role) || member.role === 'owner';
};

const createGroup = async (req, res) => {
  try {
    const { name, description, isPublic = true, tags = [], theme = {}, memberIds = [], adminIds = [], moderatorIds = [], avatar } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Group name required' });

    // Resolve unique member IDs (dedup by _id)
    const allMemberIds = [req.user._id, ...memberIds];
    const uniqueMemberIds = [];
    const seen = new Set();
    for (const id of allMemberIds) {
      const str = id?.toString();
      if (str && !seen.has(str)) { seen.add(str); uniqueMemberIds.push(toObjectId(id)); }
    }

    if (uniqueMemberIds.length < 2) {
      return res.status(400).json({ message: 'Select at least one other member.' });
    }

    const conversation = await Conversation.insertOne({
      type: 'group',
      name,
      description: description || '',
      avatar: avatar || null,
      participants: uniqueMemberIds,
      createdBy: toObjectId(req.user._id)
    });

    const memberCount = uniqueMemberIds.length;

    const group = await Group.insertOne({
      name: name.trim(),
      description: description || '',
      avatar: avatar || null,
      isPublic: !!isPublic,
      tags: Array.isArray(tags) ? tags : [],
      theme: theme || {},
      owner: req.user._id,
      createdBy: req.user._id,
      conversation: conversation._id,
      memberCount
    });

    // Add creator as owner
    await GroupMember.insertOne({
      group: group._id,
      user: req.user._id,
      role: 'owner',
      joinedAt: new Date()
    });

    // Add selected members with their roles
    const adminSet = new Set((adminIds || []).map(id => id?.toString()));
    const modSet = new Set((moderatorIds || []).map(id => id?.toString()));

    for (const memberId of memberIds) {
      const mid = memberId?.toString();
      if (!mid || mid === req.user._id.toString()) continue;
      let role = 'member';
      if (adminSet.has(mid)) role = 'admin';
      else if (modSet.has(mid)) role = 'moderator';

      await GroupMember.insertOne({
        group: group._id,
        user: toObjectId(memberId),
        role,
        joinedAt: new Date()
      });
    }

    await Channel.insertOne({
      group: group._id,
      name: 'general',
      type: 'text',
      order: 0,
      createdBy: req.user._id
    });

    const owner = await User.findById(group.owner, { username: 1, displayName: 1, avatar: 1 });
    res.json({ group: { ...group, owner }, channel: null });
  } catch (error) {
    // MongoDB duplicate key error (e.g. duplicate username in a user document referenced elsewhere)
    if (error?.code === 11000 || error?.message?.includes('duplicate key')) {
      const keyPattern = error?.keyPattern || {};
      const field = Object.keys(keyPattern)[0] || 'field';
      return res.status(400).json({ message: `Duplicate ${field} — a record with that value already exists.` });
    }
    // Validation error
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    logger.error('Create group error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

const getGroup = async (req, res) => {
  try {
    const { id } = req.params;
    if (!toObjectId(id)) return res.status(400).json({ message: 'Invalid group id' });

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const owner = await User.findById(group.owner, { username: 1, displayName: 1, avatar: 1 });
    const channels = await Channel.find({ group: group._id });

    res.json({ group: { ...group, owner }, channels });
  } catch (error) {
    logger.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!toObjectId(id)) return res.status(400).json({ message: 'Invalid group id' });

    const allowed = await hasRole(id, req.user._id, ['owner', 'admin']);
    if (!allowed) return res.status(403).json({ message: 'Insufficient permissions' });

    const update = {};
    ['name', 'description', 'isPublic', 'tags', 'theme', 'settings'].forEach(k => {
      if (payload[k] !== undefined) update[k] = payload[k];
    });

    const group = await Group.findByIdAndUpdate(id, { $set: update, $currentDate: { updatedAt: true } }, { new: true });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const owner = await User.findById(group.owner, { username: 1, displayName: 1, avatar: 1 });
    res.json({ group: { ...group, owner } });
  } catch (error) {
    logger.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
};

const createInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresAt, maxUses = 0 } = req.body;
    if (!toObjectId(id)) return res.status(400).json({ message: 'Invalid group id' });

    const allowed = await hasRole(id, req.user._id, ['owner', 'admin', 'moderator']);
    if (!allowed) return res.status(403).json({ message: 'Insufficient permissions' });

    const code = GroupInvite.generateCode();
    const invite = await GroupInvite.insertOne({
      group: id,
      code,
      createdBy: req.user._id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxUses: parseInt(maxUses, 10) || 0
    });

    await Group.findByIdAndUpdate(id, {
      $addToSet: { inviteCodes: code }
    });

    const configuredClientUrl = process.env.CLIENT_URL || '';
    const requestOrigin = req.get('origin');
    const fallbackClientUrl = `${req.protocol}://${req.hostname}:3000`;
    const host = requestOrigin || (configuredClientUrl.includes('localhost') ? fallbackClientUrl : configuredClientUrl) || fallbackClientUrl;
    const url = `${host}/groups/join/${invite.code}`;

    res.json({ invite: { code: invite.code, url, expiresAt: invite.expiresAt, maxUses: invite.maxUses } });
  } catch (error) {
    logger.error('Create invite error:', error);
    res.status(500).json({ message: 'Failed to create invite' });
  }
};

const joinByInvite = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Invite code required' });

    const invite = await GroupInvite.findOne({ code });
    if (!invite || invite.isRevoked) return res.status(404).json({ message: 'Invite not found or revoked' });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return res.status(410).json({ message: 'Invite expired' });
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return res.status(410).json({ message: 'Invite consumed' });

    const existing = await GroupMember.findOne({ group: invite.group, user: toObjectId(req.user._id) });
    if (existing) return res.status(200).json({ message: 'Already a member' });

    await GroupMember.insertOne({
      group: invite.group,
      user: req.user._id,
      role: 'member',
      joinedAt: new Date()
    });

    const group = await Group.findById(invite.group);
    if (group && group.conversation) {
      await Conversation.findByIdAndUpdate(group.conversation, {
        $addToSet: { participants: toObjectId(req.user._id) }
      });
    }

    await GroupInvite.collection().updateOne(
      { _id: invite._id },
      { $inc: { uses: 1 } }
    );

    await Group.findByIdAndUpdate(invite.group, { $inc: { memberCount: 1 } });

    res.json({ message: 'Joined group' });
  } catch (error) {
    logger.error('Join by invite error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
};

const listMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10));

    if (!toObjectId(id)) return res.status(400).json({ message: 'Invalid group id' });

    const query = { group: toObjectId(id) };
    const total = await GroupMember.countDocuments(query);
    const members = await GroupMember.collection().find(query)
      .sort({ joinedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const userIds = members.map(m => m.user).filter(Boolean);
    const users = await User.collection().find(
      { _id: { $in: userIds } },
      { projection: { username: 1, displayName: 1, avatar: 1 } }
    ).toArray();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const enrichedMembers = members.map(m => ({
      ...m,
      user: userMap[m.user.toString()] || m.user
    }));

    res.json({ total, page, limit, members: enrichedMembers });
  } catch (error) {
    logger.error('List members error:', error);
    res.status(500).json({ message: 'Failed to list members' });
  }
};

const kickMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!toObjectId(id) || !userId) return res.status(400).json({ message: 'Invalid group or user' });

    const caller = await GroupMember.findOne({ group: toObjectId(id), user: toObjectId(req.user._id) });
    if (!caller) return res.status(403).json({ message: 'Not a member' });
    if (caller.role !== 'owner' && caller.role !== 'admin') return res.status(403).json({ message: 'Insufficient permissions' });

    const target = await GroupMember.findOne({ group: toObjectId(id), user: toObjectId(userId) });
    if (!target) return res.status(404).json({ message: 'User not in group' });
    if (target.role === 'owner') return res.status(403).json({ message: 'Cannot kick the owner' });
    if (caller.role === 'admin' && (target.role === 'admin' || target.role === 'moderator')) {
      return res.status(403).json({ message: 'Admins cannot kick other admins or moderators' });
    }

    await GroupMember.collection().deleteOne({ group: toObjectId(id), user: toObjectId(userId) });
    await Group.findByIdAndUpdate(id, { $inc: { memberCount: -1 } });

    const group = await Group.findById(id);
    if (group && group.conversation) {
      await Conversation.findByIdAndUpdate(group.conversation, {
        $pull: { participants: toObjectId(userId) }
      });
    }

    res.json({ message: 'Member removed' });
  } catch (error) {
    logger.error('Kick member error:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;
    if (!toObjectId(id) || !userId || !role) return res.status(400).json({ message: 'Invalid data' });
    if (!['admin', 'moderator', 'member'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const caller = await GroupMember.findOne({ group: toObjectId(id), user: toObjectId(req.user._id) });
    if (!caller || caller.role !== 'owner') return res.status(403).json({ message: 'Only the owner can change roles' });

    const target = await GroupMember.findOne({ group: toObjectId(id), user: toObjectId(userId) });
    if (!target) return res.status(404).json({ message: 'User not in group' });
    if (target.role === 'owner') return res.status(403).json({ message: 'Cannot change owner role' });

    await GroupMember.collection().updateOne(
      { group: toObjectId(id), user: toObjectId(userId) },
      { $set: { role } }
    );

    res.json({ message: 'Role updated', role });
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ message: 'Failed to update role' });
  }
};

module.exports = { createGroup, getGroup, updateGroup, createInvite, joinByInvite, listMembers, kickMember, updateMemberRole };

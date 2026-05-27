const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'conversations';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ participants: 1 }),
  collection().createIndex({ lastMessageAt: -1 })
]);

const findById = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOne({ _id });
};

const findOne = async (filter, opts) => collection().findOne(filter, opts || {});

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const now = new Date();
  const conversation = {
    ...doc,
    participants: doc.participants ? doc.participants.map(p => toObjectId(p)).filter(Boolean) : [],
    admin: doc.admin ? doc.admin.map(a => toObjectId(a)).filter(Boolean) : [],
    createdBy: doc.createdBy ? toObjectId(doc.createdBy) : null,
    lastMessage: doc.lastMessage ? toObjectId(doc.lastMessage) : null,
    lastMessageAt: doc.lastMessageAt || null,
    unreadCount: doc.unreadCount || {},
    isArchived: doc.isArchived || {},
    isPinned: doc.isPinned || {},
    isMuted: doc.isMuted || {},
    type: doc.type || 'direct',
    name: doc.name || null,
    createdAt: now,
    updatedAt: now
  };

  const result = await collection().insertOne(conversation);
  return { ...conversation, _id: result.insertedId };
};

const findByIdAndUpdate = async (id, update, opts) => {
  const _id = toObjectId(id);
  if (!_id) return null;

  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet || update.$currentDate) {
    command = { ...update };
    if (!command.$currentDate) command.$currentDate = { updatedAt: true };
  } else {
    command = { $set: { ...update, updatedAt: new Date() } };
  }

  return collection().findOneAndUpdate(
    { _id },
    command,
    { returnDocument: opts?.new ? 'after' : 'before', ...(opts || {}) }
  );
};

const updateMany = async (filter, update) => {
  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet || update.$currentDate) {
    command = { ...update };
    if (!command.$currentDate) command.$currentDate = { updatedAt: true };
  } else {
    command = { $set: { ...update, updatedAt: new Date() } };
  }
  return collection().updateMany(filter, command);
};

const countDocuments = async (filter) => collection().countDocuments(filter || {});

module.exports = {
  COLLECTION,
  collection,
  indexes,
  findById,
  findOne,
  find,
  insertOne,
  findByIdAndUpdate,
  updateMany,
  countDocuments
};

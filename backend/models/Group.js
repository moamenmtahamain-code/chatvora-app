const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'groups';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ owner: 1 }),
  collection().createIndex({ tags: 1 }),
  collection().createIndex({ conversation: 1 })
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
  const group = {
    ...doc,
    owner: toObjectId(doc.owner),
    createdBy: toObjectId(doc.createdBy),
    conversation: doc.conversation ? toObjectId(doc.conversation) : null,
    admins: (doc.admins || []).map(a => toObjectId(a)).filter(Boolean),
    members: (doc.members || []).map(m => toObjectId(m)).filter(Boolean),
    messages: (doc.messages || []).map(m => toObjectId(m)).filter(Boolean),
    inviteCodes: doc.inviteCodes || [],
    memberCount: doc.memberCount || 1,
    isPublic: doc.isPublic !== undefined ? doc.isPublic : true,
    tags: doc.tags || [],
    theme: doc.theme || { colorPrimary: '#4f46e5', colorAccent: '#06b6d4' },
    settings: doc.settings || { joinApprovalRequired: false, allowGuestMessages: false },
    archived: false,
    createdAt: now,
    updatedAt: now
  };

  const result = await collection().insertOne(group);
  return { ...group, _id: result.insertedId };
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
  countDocuments
};

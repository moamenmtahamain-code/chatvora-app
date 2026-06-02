const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'messages';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ conversationId: 1, createdAt: -1 }),
  collection().createIndex({ sender: 1 }),
  collection().createIndex({ 'reactions.user': 1 }),
  collection().createIndex(
    { conversationId: 1, sender: 1, clientMessageId: 1 },
    { unique: true, sparse: true }
  )
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
  const message = {
    ...doc,
    conversationId: toObjectId(doc.conversationId),
    sender: toObjectId(doc.sender),
    replyTo: doc.replyTo ? toObjectId(doc.replyTo) : null,
    clientMessageId: doc.clientMessageId || null,
    type: doc.type || 'text',
    status: doc.status || 'sending',
    isEdited: false,
    isDeleted: false,
    isPinned: false,
    isStarred: doc.isStarred || {},
    reactions: doc.reactions || [],
    deleteFor: doc.deleteFor || [],
    media: doc.media || null,
    disappearAt: doc.disappearAt || null,
    createdAt: now,
    updatedAt: now
  };

  if (doc.metadata) message.metadata = doc.metadata;

  const result = await collection().insertOne(message);
  return { ...message, _id: result.insertedId };
};

const updateById = async (id, update, opts) => {
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
    { returnDocument: 'after', ...(opts || {}) }
  );
};

const findByIdAndUpdate = updateById;

const countDocuments = async (filter) => collection().countDocuments(filter || {});

const findByIdAndDelete = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOneAndDelete({ _id });
};

const aggregate = async (pipeline) => collection().aggregate(pipeline).toArray();

const populateUser = async (userId) => {
  if (!userId) return null;
  return getDb().collection('users').findOne(
    { _id: toObjectId(userId) },
    { projection: { _id: 1, username: 1, displayName: 1, avatar: 1, isOnline: 1 } }
  );
};

module.exports = {
  COLLECTION,
  collection,
  indexes,
  findById,
  findOne,
  find,
  insertOne,
  updateById,
  findByIdAndUpdate,
  countDocuments,
  findByIdAndDelete,
  aggregate,
  populateUser
};

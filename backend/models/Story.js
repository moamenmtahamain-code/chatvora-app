const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'stories';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ user: 1, createdAt: -1 }),
  collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
]);

const findById = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOne({ _id });
};

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const story = {
    ...doc,
    user: toObjectId(doc.user),
    type: doc.type || 'image',
    views: doc.views || [],
    reactions: doc.reactions || [],
    isExpired: false,
    media: doc.media || null,
    expiresAt: doc.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date()
  };
  if (doc.background) story.background = doc.background;
  if (doc.duration) story.duration = doc.duration;

  const result = await collection().insertOne(story);
  return { ...story, _id: result.insertedId };
};

const findByIdAndUpdate = async (id, update, opts) => {
  const _id = toObjectId(id);
  if (!_id) return null;

  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet || update.$currentDate) {
    command = { ...update };
  } else {
    command = { $set: { ...update } };
  }

  return collection().findOneAndUpdate(
    { _id },
    command,
    { returnDocument: opts?.new ? 'after' : 'before', ...(opts || {}) }
  );
};

const findOneAndDelete = async (filter) => collection().findOneAndDelete(filter);

const deleteOne = async (filter) => collection().deleteOne(filter);

const countDocuments = async (filter) => collection().countDocuments(filter || {});

module.exports = {
  COLLECTION,
  collection,
  indexes,
  findById,
  find,
  insertOne,
  findByIdAndUpdate,
  findOneAndDelete,
  deleteOne,
  countDocuments
};

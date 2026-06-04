const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'friend_requests';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ from: 1, to: 1 }, { unique: true }),
  collection().createIndex({ to: 1, status: 1 }),
  collection().createIndex({ from: 1, status: 1 }),
  collection().createIndex({ createdAt: -1 })
]);

const create = async (fromId, toId) => {
  const now = new Date();
  const doc = {
    from: toObjectId(fromId),
    to: toObjectId(toId),
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };
  const result = await collection().insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

const findById = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOne({ _id });
};

const findBetween = async (fromId, toId) => {
  return collection().findOne({
    from: toObjectId(fromId),
    to: toObjectId(toId)
  });
};

const findPendingTo = async (userId) => {
  return collection().find({
    to: toObjectId(userId),
    status: 'pending'
  }).sort({ createdAt: -1 }).toArray();
};

const findPendingFrom = async (userId) => {
  return collection().find({
    from: toObjectId(userId),
    status: 'pending'
  }).sort({ createdAt: -1 }).toArray();
};

const updateStatus = async (id, status) => {
  const _id = toObjectId(id);
  return collection().findOneAndUpdate(
    { _id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
};

const deleteById = async (id) => {
  const _id = toObjectId(id);
  return collection().findOneAndDelete({ _id });
};

const getMutualFriends = async (userId1, userId2) => {
  const db = getDb();
  const usersCol = db.collection('users');
  const user1 = await usersCol.findOne({ _id: toObjectId(userId1) });
  const user2 = await usersCol.findOne({ _id: toObjectId(userId2) });
  if (!user1?.contacts || !user2?.contacts) return [];
  const set1 = new Set(user1.contacts.map(c => c.toString()));
  const mutualIds = user2.contacts.filter(c => set1.has(c.toString()));
  if (mutualIds.length === 0) return [];
  return usersCol.find({
    _id: { $in: mutualIds }
  }).project({ password: 0, refreshToken: 0 }).toArray();
};

module.exports = {
  COLLECTION, collection, indexes,
  create, findById, findBetween, findPendingTo, findPendingFrom,
  updateStatus, deleteById, getMutualFriends
};
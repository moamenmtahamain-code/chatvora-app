const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'group_members';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ group: 1, user: 1 }, { unique: true }),
  collection().createIndex({ group: 1 }),
  collection().createIndex({ user: 1 })
]);

const findById = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOne({ _id });
};

const findOne = async (filter, opts) => collection().findOne(filter, opts || {});

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const member = {
    ...doc,
    group: toObjectId(doc.group),
    user: toObjectId(doc.user),
    role: doc.role || 'member',
    joinedAt: doc.joinedAt || new Date(),
    isBanned: false,
    isMuted: false,
    permissions: doc.permissions || {}
  };

  const result = await collection().insertOne(member);
  return { ...member, _id: result.insertedId };
};

const insertMany = async (docs) => {
  const members = docs.map(doc => ({
    ...doc,
    group: toObjectId(doc.group),
    user: toObjectId(doc.user),
    role: doc.role || 'member',
    joinedAt: doc.joinedAt || new Date(),
    isBanned: false,
    isMuted: false,
    permissions: doc.permissions || {}
  }));

  const result = await collection().insertMany(members);
  return result;
};

const findOneAndDelete = async (filter) => collection().findOneAndDelete(filter);

const countDocuments = async (filter) => collection().countDocuments(filter || {});

const deleteMany = async (filter) => collection().deleteMany(filter);

module.exports = {
  COLLECTION,
  collection,
  indexes,
  findById,
  findOne,
  find,
  insertOne,
  insertMany,
  findOneAndDelete,
  countDocuments,
  deleteMany
};

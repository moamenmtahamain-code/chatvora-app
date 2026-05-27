const bcrypt = require('bcryptjs');
const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'users';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ email: 1 }, { unique: true }),
  collection().createIndex({ username: 1 }, { unique: true }),
  collection().createIndex({ contacts: 1 }),
  collection().createIndex({ createdAt: -1 })
]);

const findById = async (id, projection) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOne({ _id }, projection ? { projection } : {});
};

const findOne = async (filter, opts) => collection().findOne(filter, opts || {});

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  // Strict pre-insert duplicate check for username and email
  if (doc.username) {
    const existing = await collection().findOne({ username: doc.username });
    if (existing) {
      const err = new Error(`Duplicate username — '@${doc.username}' is already taken.`);
      err.code = 11000;
      err.keyPattern = { username: 1 };
      throw err;
    }
  }
  if (doc.email) {
    const existing = await collection().findOne({ email: doc.email });
    if (existing) {
      const err = new Error(`Duplicate email — '${doc.email}' is already registered.`);
      err.code = 11000;
      err.keyPattern = { email: 1 };
      throw err;
    }
  }

  const now = new Date();
  const user = {
    ...doc,
    role: doc.role || 'user',
    isOnline: false,
    lastSeen: now,
    contacts: doc.contacts || [],
    blockedUsers: doc.blockedUsers || [],
    preferences: doc.preferences || { theme: 'dark', notifications: true, sound: true, vibration: true },
    createdAt: now,
    updatedAt: now
  };

  if (user.password) {
    user.password = await bcrypt.hash(user.password, 12);
  }

  const result = await collection().insertOne(user);
  return { ...user, _id: result.insertedId };
};

const updateById = async (id, update, opts) => {
  const _id = toObjectId(id);
  if (!_id) return null;

  const $set = { ...update, updatedAt: new Date() };
  return collection().findOneAndUpdate(
    { _id },
    { $set },
    { returnDocument: 'after', ...(opts || {}) }
  );
};

const findByIdAndUpdate = async (id, update, opts) => {
  const _id = toObjectId(id);
  if (!_id) return null;

  const now = new Date();
  let command = {};

  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet || update.$currentDate) {
    command = { ...update };
    if (!command.$currentDate) command.$currentDate = { updatedAt: true };
    else if (typeof command.$currentDate === 'object') command.$currentDate.updatedAt = true;
  } else {
    command = { $set: { ...update, updatedAt: now } };
  }

  return collection().findOneAndUpdate(
    { _id },
    command,
    { returnDocument: opts?.new ? 'after' : 'before', ...(opts || {}) }
  );
};

const countDocuments = async (filter) => collection().countDocuments(filter || {});

const findByIdAndDelete = async (id) => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collection().findOneAndDelete({ _id });
};

const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

const sanitize = (user) => {
  if (!user) return null;
  const { password, refreshToken, ...safe } = user;
  return safe;
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
  comparePassword,
  sanitize
};

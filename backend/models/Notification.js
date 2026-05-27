const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'notifications';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ user: 1, createdAt: -1 }),
  collection().createIndex({ isRead: 1 })
]);

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const notification = {
    ...doc,
    user: toObjectId(doc.user),
    isRead: false,
    createdAt: new Date()
  };

  const result = await collection().insertOne(notification);
  return { ...notification, _id: result.insertedId };
};

const findOneAndUpdate = async (filter, update, opts) => {
  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet) {
    command = { ...update };
  } else {
    command = { $set: { ...update } };
  }

  return collection().findOneAndUpdate(
    filter,
    command,
    { returnDocument: 'after', ...(opts || {}) }
  );
};

const updateMany = async (filter, update) => {
  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet) {
    command = { ...update };
  } else {
    command = { $set: { ...update } };
  }
  return collection().updateMany(filter, command);
};

const countDocuments = async (filter) => collection().countDocuments(filter || {});

const findOneAndDelete = async (filter) => collection().findOneAndDelete(filter);

module.exports = {
  COLLECTION,
  collection,
  indexes,
  find,
  insertOne,
  findOneAndUpdate,
  updateMany,
  countDocuments,
  findOneAndDelete
};

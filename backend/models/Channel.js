const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'channels';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ group: 1, order: 1 }),
  collection().createIndex({ group: 1 })
]);

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const channel = {
    ...doc,
    group: toObjectId(doc.group),
    createdBy: doc.createdBy ? toObjectId(doc.createdBy) : null,
    type: doc.type || 'text',
    isPrivate: false,
    order: doc.order || 0,
    allowedRoles: doc.allowedRoles || [],
    createdAt: new Date()
  };

  const result = await collection().insertOne(channel);
  return { ...channel, _id: result.insertedId };
};

module.exports = {
  COLLECTION,
  collection,
  indexes,
  find,
  insertOne
};

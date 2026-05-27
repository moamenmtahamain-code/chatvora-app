const crypto = require('crypto');
const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'group_invites';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ group: 1 }),
  collection().createIndex({ code: 1 }, { unique: true })
]);

const findOne = async (filter, opts) => collection().findOne(filter, opts || {});

const find = async (filter, opts) => collection().find(filter, opts || {}).toArray();

const insertOne = async (doc) => {
  const invite = {
    ...doc,
    group: toObjectId(doc.group),
    createdBy: doc.createdBy ? toObjectId(doc.createdBy) : null,
    code: doc.code || generateCode(),
    uses: 0,
    isRevoked: false,
    createdAt: new Date()
  };

  if (doc.expiresAt) invite.expiresAt = new Date(doc.expiresAt);
  if (doc.maxUses !== undefined) invite.maxUses = doc.maxUses;

  const result = await collection().insertOne(invite);
  return { ...invite, _id: result.insertedId };
};

const generateCode = () => {
  return crypto.randomBytes(6).toString('base64').replace(/\W/g, '').slice(0, 10);
};

module.exports = {
  COLLECTION,
  collection,
  indexes,
  findOne,
  find,
  insertOne,
  generateCode
};

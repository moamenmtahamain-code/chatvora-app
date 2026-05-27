const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'calls';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ group: 1, isActive: 1 }),
  collection().createIndex({ conversation: 1, isActive: 1 }),
  collection().createIndex({ callId: 1 }, { unique: true, sparse: true })
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
  const call = {
    ...doc,
    callId: doc.callId || null,
    type: doc.type || 'audio',
    status: doc.status || 'initiated',
    group: doc.group ? toObjectId(doc.group) : null,
    conversation: doc.conversation ? toObjectId(doc.conversation) : null,
    conversationId: doc.conversationId ? toObjectId(doc.conversationId) : null,
    initiator: doc.initiator ? toObjectId(doc.initiator) : null,
    caller: doc.caller ? toObjectId(doc.caller) : null,
    receivers: (doc.receivers || []).map(r => toObjectId(r)).filter(Boolean),
    participants: (doc.participants || []).map(p => toObjectId(p)).filter(Boolean),
    duration: 0,
    isGroup: doc.isGroup || false,
    isActive: doc.isActive !== undefined ? doc.isActive : true,
    startedAt: now,
    endedAt: null
  };

  const result = await collection().insertOne(call);
  return { ...call, _id: result.insertedId };
};

const findOneAndUpdate = async (filter, update, opts) => {
  let command;
  if (update.$set || update.$push || update.$pull || update.$inc || update.$addToSet || update.$currentDate) {
    command = { ...update };
  } else {
    command = { $set: { ...update } };
  }

  return collection().findOneAndUpdate(
    filter,
    command,
    { returnDocument: 'after', upsert: opts?.upsert || false, ...(opts || {}) }
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
  findOneAndUpdate,
  countDocuments
};

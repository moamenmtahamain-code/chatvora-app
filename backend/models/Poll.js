const { getDb, toObjectId } = require('../database/database');

const COLLECTION = 'polls';

const collection = () => getDb().collection(COLLECTION);

const indexes = () => Promise.all([
  collection().createIndex({ conversationId: 1, createdAt: -1 }),
  collection().createIndex({ createdBy: 1 }),
  collection().createIndex({ createdAt: -1 })
]);

const create = async (data) => {
  const now = new Date();
  const doc = {
    conversationId: toObjectId(data.conversationId),
    question: data.question,
    options: data.options.map(opt => ({
      text: opt,
      votes: [],
      createdAt: now
    })),
    createdBy: toObjectId(data.createdBy),
    isMultiChoice: data.isMultiChoice || false,
    isAnonymous: data.isAnonymous || false,
    closesAt: data.closesAt ? new Date(data.closesAt) : null,
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

const findByConversation = async (conversationId) => {
  return collection().find({
    conversationId: toObjectId(conversationId)
  }).sort({ createdAt: -1 }).toArray();
};

const addVote = async (pollId, optionIndex, userId) => {
  const poll = await findById(pollId);
  if (!poll) return null;

  // Check if poll is closed
  if (poll.closesAt && new Date() > new Date(poll.closesAt)) {
    const err = new Error('Poll is closed');
    err.status = 400;
    throw err;
  }

  // Remove previous votes by this user if not multi-choice
  if (!poll.isMultiChoice) {
    poll.options.forEach((opt, idx) => {
      poll.options[idx].votes = opt.votes.filter(v => v.toString() !== userId.toString());
    });
  }

  // Add vote
  const existingVotes = poll.options[optionIndex].votes || [];
  if (!existingVotes.some(v => v.toString() === userId.toString())) {
    poll.options[optionIndex].votes.push(toObjectId(userId));
  }

  await collection().updateOne(
    { _id: toObjectId(pollId) },
    { $set: { options: poll.options, updatedAt: new Date() } }
  );

  return findById(pollId);
};

const removeVote = async (pollId, optionIndex, userId) => {
  const poll = await findById(pollId);
  if (!poll) return null;

  poll.options[optionIndex].votes = (poll.options[optionIndex].votes || [])
    .filter(v => v.toString() !== userId.toString());

  await collection().updateOne(
    { _id: toObjectId(pollId) },
    { $set: { options: poll.options, updatedAt: new Date() } }
  );

  return findById(pollId);
};

const deleteById = async (id) => {
  const _id = toObjectId(id);
  return collection().findOneAndDelete({ _id });
};

module.exports = {
  COLLECTION, collection, indexes,
  create, findById, findByConversation,
  addVote, removeVote, deleteById
};
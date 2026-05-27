const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      ret._id = ret._id.toString();
      if (ret.participants) {
        ret.participants = ret.participants.map(p => p.toString ? p.toString() : p);
      }
      return ret;
    }
  }
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);

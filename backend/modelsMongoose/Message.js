const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
    default: 'text'
  },
  media: {
    url: String,
    filename: String,
    mimeType: String,
    size: Number
  },
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read'],
    default: 'sent'
  },
  clientMessageId: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      ret._id = ret._id.toString();
      ret.roomId = ret.roomId ? (ret.roomId.toString ? ret.roomId.toString() : ret.roomId) : null;
      ret.senderId = ret.senderId ? (ret.senderId.toString ? ret.senderId.toString() : ret.senderId) : null;
      return ret;
    }
  }
});

messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ roomId: 1, senderId: 1, clientMessageId: 1 }, { sparse: true });

module.exports = mongoose.model('Message', messageSchema);

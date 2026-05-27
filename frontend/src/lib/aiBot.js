export const AI_BOT = {
  _id: 'ai-nexus',
  username: 'nexus-ai',
  displayName: 'Nexus AI',
  avatar: null,
  isOnline: true,
  isAIBot: true,
};

export const AI_CONVERSATION = {
  _id: 'ai-nexus-conversation',
  type: 'ai',
  name: 'Nexus AI',
  isAIConversation: true,
  participants: [AI_BOT],
  lastMessage: { content: '✨ I can generate images from your prompts. Try "create a cyberpunk city!"' },
  lastMessageAt: new Date().toISOString(),
  unreadCount: 0,
};

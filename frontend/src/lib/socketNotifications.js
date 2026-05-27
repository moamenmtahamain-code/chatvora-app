import { showBrowserNotification, playNotificationSound } from './notifications';
import socketEvents from './socket';
import useAuthStore from '../stores/authStore';

export function setupSocketNotifications() {
  const user = useAuthStore.getState().user;
  if (!user) return;

  socketEvents.onMessage((payload) => {
    const message = payload?.message || payload;
    if (!message || !message.conversationId) return;
    if (message.sender?._id === user._id || message.sender === user._id) return;

    const senderName = message.sender?.displayName || message.sender?.username || 'Someone';
    const text = message.type === 'text'
      ? message.content?.substring(0, 100)
      : message.type === 'image' ? '📷 Image'
      : message.type === 'video' ? '🎥 Video'
      : message.type === 'audio' ? '🎵 Voice message'
      : message.type === 'document' ? '📄 Document'
      : 'New message';

    showBrowserNotification(senderName, {
      body: text,
      tag: `chat-${message.conversationId}`,
      data: {
        url: '/',
        conversationId: message.conversationId
      }
    });

    playNotificationSound('message');
  });

  socketEvents.onCallIncoming((callData) => {
    const callerName = callData.caller?.displayName || callData.caller?.username || 'Someone';
    const callType = callData.type === 'video' ? 'video call' : 'voice call';

    showBrowserNotification(`📞 ${callerName}`, {
      body: `Incoming ${callType}...`,
      tag: `call-${callData.callId}`,
      requireInteraction: true,
      data: { url: '/' }
    });

    playNotificationSound('call');
  });

  socketEvents.onUserOnline(({ userId }) => {
    if (userId !== user._id) {
      playNotificationSound('online');
    }
  });
}

export function teardownSocketNotifications() {
  socketEvents.offMessage();
  socketEvents.offCallIncoming();
  socketEvents.offUserOnline();
}

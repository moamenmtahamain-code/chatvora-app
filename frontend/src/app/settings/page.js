'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '../../stores/authStore';
import usePremiumStore from '../../stores/premiumStore';
import ThemeSwitcher from '../../components/ThemeSwitcher';

const SECTIONS = [
  { id: 'chat', label: '💬 Chat', icon: '💬' },
  { id: 'social', label: '👥 Social', icon: '👥' },
  { id: 'ai', label: '🤖 AI', icon: '🤖' },
  { id: 'customize', label: '🎨 Customize', icon: '🎨' },
  { id: 'pro', label: '⚡ Professional', icon: '⚡' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const premium = usePremiumStore();
  const [section, setSection] = useState('chat');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyMsg, setAutoReplyMsg] = useState('');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [supportInput, setSupportInput] = useState('');
  const [supportChat, setSupportChat] = useState([]);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [quickReplyText, setQuickReplyText] = useState('');
  const [quickReplyShortcut, setQuickReplyShortcut] = useState('');
  const [language, setLanguage] = useState('en');
  const [analytics, setAnalytics] = useState(null);
  const [summaryResult, setSummaryResult] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const [translateFrom, setTranslateFrom] = useState('');
  const [translateResult, setTranslateResult] = useState('');
  const [targetLang, setTargetLang] = useState('ar');

  useEffect(() => {
    premium.loadAutoReply().then(() => {
      setAutoReplyEnabled(premium.autoReply.enabled);
      setAutoReplyMsg(premium.autoReply.message);
    });
    premium.loadQuickReplies();
    premium.loadScheduled();
    premium.loadThemes();
    premium.loadAnalytics().then(() => setAnalytics(premium.analytics));
    setLanguage(premium.language);
  }, []);

  const handleAutoReply = async () => {
    await premium.setAutoReply(autoReplyEnabled, autoReplyMsg);
  };

  const handleAddQuickReply = async () => {
    if (!quickReplyText.trim()) return;
    await premium.addQuickReply(quickReplyText, quickReplyShortcut);
    setQuickReplyText('');
    setQuickReplyShortcut('');
  };

  const handleSupport = async () => {
    if (!supportInput.trim()) return;
    const chat = [...supportChat, { from: 'user', text: supportInput }];
    setSupportChat(chat);
    setSupportInput('');
    const reply = await premium.sendSupportMessage(supportInput);
    setSupportChat([...chat, { from: 'bot', text: reply }]);
  };

  const handleTranslate = async () => {
    const result = await premium.translateMessage(translateFrom, targetLang);
    setTranslateResult(result);
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <button className="back-btn" onClick={() => router.push('/')}>← Back</button>
        <h1>⚙️ Settings</h1>
        <div className="header-actions">
          <ThemeSwitcher />
          <button className="logout-btn" onClick={() => { logout(); router.push('/login'); }}>Logout</button>
        </div>
      </header>

      <div className="settings-layout">
        {/* Sidebar Navigation */}
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`nav-item ${section === s.id ? 'active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="settings-content">
          {/* ═══ CHAT EXPERIENCE ═══ */}
          {section === 'chat' && (
            <div className="settings-section">
              <h2>💬 Chat Experience</h2>

              {/* Auto Reply */}
              <div className="setting-card">
                <h3>🔄 Auto-Reply</h3>
                <p className="setting-desc">Automatically reply when you're busy</p>
                <label className="toggle-row">
                  <span>Enable Auto-Reply</span>
                  <input type="checkbox" checked={autoReplyEnabled} onChange={(e) => setAutoReplyEnabled(e.target.checked)} />
                </label>
                {autoReplyEnabled && (
                  <div className="input-group">
                    <input type="text" placeholder="Auto-reply message..." value={autoReplyMsg} onChange={(e) => setAutoReplyMsg(e.target.value)} className="setting-input" />
                    <button className="btn-primary" onClick={handleAutoReply}>Save</button>
                  </div>
                )}
              </div>

              {/* Quick Replies */}
              <div className="setting-card">
                <h3>⚡ Quick Replies</h3>
                <p className="setting-desc">Create shortcuts for frequent messages</p>
                <div className="input-group">
                  <input type="text" placeholder="Shortcut (e.g. /hello)" value={quickReplyShortcut} onChange={(e) => setQuickReplyShortcut(e.target.value)} className="setting-input small" />
                  <input type="text" placeholder="Message text..." value={quickReplyText} onChange={(e) => setQuickReplyText(e.target.value)} className="setting-input" />
                  <button className="btn-primary" onClick={handleAddQuickReply}>Add</button>
                </div>
                <div className="quick-reply-list">
                  {(premium.quickReplies || []).map((r) => (
                    <div key={r._id} className="quick-reply-item">
                      <code>/{r.shortcut || 'n/a'}</code> → {r.text}
                      <button className="btn-icon" onClick={() => premium.removeQuickReply(r._id)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduled Messages */}
              <div className="setting-card">
                <h3>📅 Scheduled Messages</h3>
                <p className="setting-desc">Schedule messages to be sent later</p>
                <button className="btn-secondary" onClick={() => setScheduleModal(true)}>+ Schedule Message</button>
                <div className="scheduled-list">
                  {(premium.scheduledMessages || []).map((s) => (
                    <div key={s._id} className="scheduled-item">
                      <span className="scheduled-text">{s.content}</span>
                      <span className="scheduled-date">{new Date(s.scheduledAt).toLocaleString()}</span>
                      <button className="btn-icon" onClick={() => premium.cancelScheduled(s._id)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disappearing Messages */}
              <div className="setting-card">
                <h3>⏱️ Disappearing Messages</h3>
                <p className="setting-desc">Set a timer for messages to auto-delete</p>
                <select className="setting-select" onChange={(e) => premium.setDisappearing('current', parseInt(e.target.value))}>
                  <option value="0">Off</option>
                  <option value="60">1 Minute</option>
                  <option value="3600">1 Hour</option>
                  <option value="86400">24 Hours</option>
                  <option value="604800">7 Days</option>
                </select>
              </div>

              {/* Text Formatting Guide */}
              <div className="setting-card">
                <h3>✏️ Text Formatting</h3>
                <p className="setting-desc">Use these formatting codes in your messages:</p>
                <div className="format-guide">
                  <div className="format-item"><code>*bold*</code> → <strong>bold</strong></div>
                  <div className="format-item"><code>_italic_</code> → <em>italic</em></div>
                  <div className="format-item"><code>~strikethrough~</code> → <del>strikethrough</del></div>
                  <div className="format-item"><code>`code`</code> → <code>code</code></div>
                  <div className="format-item"><code>```code block```</code> → code block</div>
                </div>
              </div>

              {/* Export */}
              <div className="setting-card">
                <h3>📤 Export Conversation</h3>
                <p className="setting-desc">Download current conversation as a text file</p>
                <button className="btn-secondary" onClick={() => premium.exportConversation('current')}>📥 Export Chat</button>
              </div>

              {/* Read Receipts Info */}
              <div className="setting-card">
                <h3>✓✓ Read Receipts</h3>
                <p className="setting-desc">Blue double check marks show when your message has been read</p>
                <div className="receipt-preview">
                  <span className="read-receipt">✓✓</span> Read
                  <span className="delivered-receipt">✓✓</span> Delivered
                  <span className="sent-receipt">✓</span> Sent
                </div>
              </div>

              {/* Voice & Files */}
              <div className="setting-card">
                <h3>🎤 Voice & Files</h3>
                <p className="setting-desc">Send voice notes, images, videos, documents (PDF, DOC)</p>
                <div className="feature-badges">
                  <span className="badge">🎙️ Voice Notes</span>
                  <span className="badge">📄 PDF</span>
                  <span className="badge">📝 DOC</span>
                  <span className="badge">🖼️ Images</span>
                  <span className="badge">🎥 Video</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SOCIAL ═══ */}
          {section === 'social' && (
            <div className="settings-section">
              <h2>👥 Social Features</h2>

              {/* QR Friend */}
              <div className="setting-card">
                <h3>📱 Add Friend via QR Code</h3>
                <p className="setting-desc">Share your QR code to quickly add friends</p>
                <div className="qr-section">
                  <div className="qr-placeholder" onClick={() => setQrModal(!qrModal)}>
                    <div className="qr-grid">
                      {Array.from({ length: 49 }).map((_, i) => (
                        <div key={i} className={`qr-cell ${Math.random() > 0.5 ? 'filled' : ''}`} />
                      ))}
                    </div>
                    <p>Your QR Code</p>
                  </div>
                  <button className="btn-secondary">📷 Scan QR Code</button>
                </div>
              </div>

              {/* Last Seen */}
              <div className="setting-card">
                <h3>🕐 Last Seen</h3>
                <p className="setting-desc">Control who can see your last seen</p>
                <select className="setting-select" defaultValue="everyone">
                  <option value="everyone">Everyone</option>
                  <option value="friends">Friends Only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              {/* Stories */}
              <div className="setting-card">
                <h3>📸 Stories</h3>
                <p className="setting-desc">Share moments that disappear after 24 hours</p>
                <button className="btn-primary">+ Add Story</button>
              </div>

              {/* Notifications */}
              <div className="setting-card">
                <h3>🔔 Push Notifications</h3>
                <p className="setting-desc">Get notified about new messages instantly</p>
                <label className="toggle-row">
                  <span>Enable Notifications</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="toggle-row">
                  <span>Sound</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="toggle-row">
                  <span>Message Preview</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>

              {/* Block Users */}
              <div className="setting-card">
                <h3>🚫 Block Users</h3>
                <p className="setting-desc">Manage your blocked users list</p>
                <div className="input-group">
                  <input type="text" placeholder="Enter username to block..." className="setting-input" />
                  <button className="btn-danger">Block</button>
                </div>
              </div>

              {/* Location */}
              <div className="setting-card">
                <h3>📍 Location Sharing</h3>
                <p className="setting-desc">Share your live location with friends</p>
                <button className="btn-secondary" onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => alert(`Location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
                      () => alert('Location access denied')
                    );
                  }
                }}>📍 Share Current Location</button>
              </div>

              {/* Search */}
              <div className="setting-card">
                <h3>🔍 Advanced Search</h3>
                <p className="setting-desc">Search through messages, media, and files</p>
                <div className="input-group">
                  <input type="text" placeholder="Search messages..." className="setting-input" />
                  <button className="btn-primary">Search</button>
                </div>
                <div className="search-filters">
                  <button className="filter-tag">📄 Files</button>
                  <button className="filter-tag">🖼️ Media</button>
                  <button className="filter-tag">🔗 Links</button>
                  <button className="filter-tag">🎙️ Voice</button>
                </div>
              </div>

              {/* Report */}
              <div className="setting-card">
                <h3>⚠️ Report Content</h3>
                <p className="setting-desc">Report inappropriate content or users</p>
                <button className="btn-danger" onClick={() => setReportModal(true)}>🚩 Report</button>
              </div>

              {/* Groups */}
              <div className="setting-card">
                <h3>👥 Groups</h3>
                <p className="setting-desc">Create and manage group conversations</p>
                <button className="btn-primary">+ Create Group</button>
                <div className="feature-badges">
                  <span className="badge">📷 Group Photo</span>
                  <span className="badge">📝 Description</span>
                  <span className="badge">🔗 Invite Link</span>
                  <span className="badge">👑 Admin Controls</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ AI FEATURES ═══ */}
          {section === 'ai' && (
            <div className="settings-section">
              <h2>🤖 AI Features</h2>

              {/* Summarize */}
              <div className="setting-card">
                <h3>📋 Conversation Summary</h3>
                <p className="setting-desc">AI summarizes long conversations for you</p>
                <button className="btn-primary" onClick={async () => {
                  const result = await premium.summarizeConversation('current');
                  setSummaryResult(result);
                }}>Summarize Current Chat</button>
                {summaryResult && <div className="ai-result-box">{summaryResult}</div>}
              </div>

              {/* Smart Replies */}
              <div className="setting-card">
                <h3>💡 Smart Reply Suggestions</h3>
                <p className="setting-desc">AI suggests quick replies based on context</p>
                <div className="input-group">
                  <input type="text" placeholder="Enter a message to get suggestions..." className="setting-input" onKeyDown={async (e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      const replies = await premium.getSmartReplies(e.target.value);
                      setSmartReplies(replies);
                    }
                  }} />
                  <button className="btn-primary" onClick={async () => {
                    const replies = await premium.getSmartReplies('hello');
                    setSmartReplies(replies);
                  }}>Get Suggestions</button>
                </div>
                {smartReplies.length > 0 && (
                  <div className="smart-replies-list">
                    {smartReplies.map((r, i) => (
                      <button key={i} className="smart-reply-chip">{r}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Translation */}
              <div className="setting-card">
                <h3>🌐 Instant Translation</h3>
                <p className="setting-desc">Translate messages in real-time using AI</p>
                <div className="input-group">
                  <select className="setting-select small" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                  <input type="text" placeholder="Text to translate..." value={translateFrom} onChange={(e) => setTranslateFrom(e.target.value)} className="setting-input" />
                  <button className="btn-primary" onClick={handleTranslate}>Translate</button>
                </div>
                {translateResult && <div className="ai-result-box">{translateResult}</div>}
              </div>

              {/* Speech to Text */}
              <div className="setting-card">
                <h3>🎤 Speech to Text</h3>
                <p className="setting-desc">Convert voice messages to text automatically</p>
                <label className="toggle-row">
                  <span>Auto-transcribe voice notes</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>

              {/* Text to Speech */}
              <div className="setting-card">
                <h3>🔊 Text to Speech</h3>
                <p className="setting-desc">Have messages read aloud to you</p>
                <button className="btn-secondary" onClick={() => {
                  const u = new SpeechSynthesisUtterance('Hello! This is the text to speech feature of Chatvora.');
                  speechSynthesis.speak(u);
                }}>▶ Test TTS</button>
              </div>

              {/* Content Detection */}
              <div className="setting-card">
                <h3>🛡️ Content Detection</h3>
                <p className="setting-desc">AI automatically detects and flags inappropriate content</p>
                <label className="toggle-row">
                  <span>Enable content detection</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>

              {/* OCR */}
              <div className="setting-card">
                <h3>🔍 Image Text Recognition (OCR)</h3>
                <p className="setting-desc">Extract text from images automatically</p>
                <span className="badge">Available when AI provider is connected</span>
              </div>

              {/* AI Assistant */}
              <div className="setting-card">
                <h3>🤖 AI Chat Assistant</h3>
                <p className="setting-desc">Ask questions to an AI assistant right inside your chat</p>
                <button className="btn-secondary" onClick={() => router.push('/ai')}>Open AI Assistant</button>
              </div>

              {/* Custom Emoji */}
              <div className="setting-card">
                <h3>🎨 AI Custom Emoji</h3>
                <p className="setting-desc">Generate custom emoji using AI</p>
                <div className="input-group">
                  <input type="text" placeholder="Describe your emoji..." className="setting-input" />
                  <button className="btn-primary">Generate</button>
                </div>
              </div>

              {/* Image Edit */}
              <div className="setting-card">
                <h3>✂️ Image Editor</h3>
                <p className="setting-desc">Edit photos before sending them</p>
                <div className="feature-badges">
                  <span className="badge">✂️ Crop</span>
                  <span className="badge">🖊️ Draw</span>
                  <span className="badge">📝 Text</span>
                  <span className="badge">🎨 Filters</span>
                </div>
              </div>

              {/* Voice Changer */}
              <div className="setting-card">
                <h3>🎵 Voice Effects</h3>
                <p className="setting-desc">Apply fun effects to your voice notes</p>
                <div className="feature-badges">
                  <span className="badge">🤖 Robot</span>
                  <span className="badge">👻 Echo</span>
                  <span className="badge">🎵 Pitch</span>
                  <span className="badge">🐢 Slow</span>
                  <span className="badge">🐇 Fast</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ CUSTOMIZATION ═══ */}
          {section === 'customize' && (
            <div className="settings-section">
              <h2>🎨 Customization</h2>

              {/* Multi Themes */}
              <div className="setting-card">
                <h3>🎨 Themes</h3>
                <p className="setting-desc">Choose from 10 beautiful themes</p>
                <div className="theme-grid">
                  {(premium.themes || []).map((t) => (
                    <button
                      key={t.id}
                      className={`theme-card ${premium.currentTheme === t.id ? 'active' : ''}`}
                      onClick={() => premium.setTheme(t.id)}
                      style={{ background: t.bg, borderColor: t.primary }}
                    >
                      <div className="theme-preview" style={{ background: t.surface }}>
                        <div className="theme-accent" style={{ background: t.primary }} />
                      </div>
                      <span style={{ color: t.primary }}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper */}
              <div className="setting-card">
                <h3>🖼️ Chat Wallpaper</h3>
                <p className="setting-desc">Customize your chat background</p>
                <div className="wallpaper-grid">
                  {['linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#f093fb,#f5576c)', 'linear-gradient(135deg,#4facfe,#00f2fe)', 'linear-gradient(135deg,#43e97b,#38f9d7)', 'linear-gradient(135deg,#fa709a,#fee140)', 'linear-gradient(135deg,#a18cd1,#fbc2eb)', '#1a1a2e', '#0a0a0a', '#f8fafc'].map((bg, i) => (
                    <div key={i} className="wallpaper-option" style={{ background: bg }} />
                  ))}
                </div>
                <button className="btn-secondary">📷 Upload Custom Wallpaper</button>
              </div>

              {/* Chat Lock */}
              <div className="setting-card">
                <h3>🔒 Safe Mode (Chat Lock)</h3>
                <p className="setting-desc">Lock specific chats with a PIN code</p>
                <div className="input-group">
                  <input type="password" placeholder="Enter 4-digit PIN" maxLength={4} className="setting-input small" id="lock-pin" />
                  <button className="btn-primary" onClick={() => {
                    const pin = document.getElementById('lock-pin')?.value;
                    if (pin?.length === 4) premium.lockChat('current', pin);
                  }}>Lock Chat</button>
                </div>
              </div>

              {/* Data Saver */}
              <div className="setting-card">
                <h3>📶 Data Saver</h3>
                <p className="setting-desc">Reduce data usage by compressing images</p>
                <label className="toggle-row">
                  <span>Compress images before sending</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="toggle-row">
                  <span>Auto-download media on Wi-Fi only</span>
                  <input type="checkbox" />
                </label>
              </div>

              {/* Archive */}
              <div className="setting-card">
                <h3>📦 Archive Chats</h3>
                <p className="setting-desc">Hide chats from your main list without deleting them</p>
                <div className="archived-count">0 archived chats</div>
              </div>

              {/* Pin Chats */}
              <div className="setting-card">
                <h3>📌 Pin Chats</h3>
                <p className="setting-desc">Pin important conversations to the top</p>
                <div className="feature-badges">
                  <span className="badge">📌 Pin up to 5 chats</span>
                  <span className="badge">🔄 Reorder pinned</span>
                </div>
              </div>

              {/* Admin Panel */}
              <div className="setting-card">
                <h3>👑 Admin Panel</h3>
                <p className="setting-desc">Manage users, content, and analytics</p>
                <button className="btn-secondary" onClick={() => router.push('/admin')}>Open Admin Panel</button>
              </div>
            </div>
          )}

          {/* ═══ PROFESSIONAL ═══ */}
          {section === 'pro' && (
            <div className="settings-section">
              <h2>⚡ Professional</h2>

              {/* Profile Status */}
              <div className="setting-card">
                <h3>📊 Profile Status</h3>
                <p className="setting-desc">Set your availability status</p>
                <div className="status-options">
                  {['🟢 Available', '🌙 Busy', '🔴 Do Not Disturb', '⚪ Offline'].map((s) => (
                    <button key={s} className="status-option">{s}</button>
                  ))}
                </div>
              </div>

              {/* Google Login */}
              <div className="setting-card">
                <h3>🔑 Login Methods</h3>
                <p className="setting-desc">Connected login methods</p>
                <div className="login-methods">
                  <div className="method-item connected">
                    <span>📧 Email & Password</span>
                    <span className="badge green">Connected</span>
                  </div>
                  <div className="method-item">
                    <span>🔍 Google</span>
                    <button className="btn-secondary small">Connect</button>
                  </div>
                </div>
              </div>

              {/* 2FA */}
              <div className="setting-card">
                <h3>🔐 Two-Factor Authentication (2FA)</h3>
                <p className="setting-desc">Add an extra layer of security</p>
                <button className="btn-primary" onClick={() => alert('2FA setup: Connect an authenticator app')}>Enable 2FA</button>
              </div>

              {/* Language */}
              <div className="setting-card">
                <h3>🌍 Language</h3>
                <p className="setting-desc">Change the app language</p>
                <select className="setting-select" value={language} onChange={(e) => {
                  setLanguage(e.target.value);
                  premium.setLanguage(e.target.value);
                }}>
                  <option value="en">🇺🇸 English</option>
                  <option value="ar">🇸🇦 العربية</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="ja">🇯🇵 日本語</option>
                  <option value="ko">🇰🇷 한국어</option>
                  <option value="zh">🇨🇳 中文</option>
                  <option value="pt">🇧🇷 Português</option>
                  <option value="tr">🇹🇷 Türkçe</option>
                </select>
              </div>

              {/* Analytics */}
              <div className="setting-card">
                <h3>📊 Your Analytics</h3>
                <p className="setting-desc">Your messaging activity overview</p>
                {analytics ? (
                  <div className="analytics-grid">
                    <div className="stat-card">
                      <div className="stat-number">{analytics.totalMessages?.toLocaleString() || 0}</div>
                      <div className="stat-label">Total Messages</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{analytics.messagesLast30d?.toLocaleString() || 0}</div>
                      <div className="stat-label">Last 30 Days</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{analytics.conversations || 0}</div>
                      <div className="stat-label">Conversations</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{analytics.avgPerDay || 0}</div>
                      <div className="stat-label">Avg/Day</div>
                    </div>
                  </div>
                ) : (
                  <button className="btn-secondary" onClick={async () => {
                    await premium.loadAnalytics();
                    setAnalytics(premium.analytics);
                  }}>Load Analytics</button>
                )}
              </div>

              {/* Notifications Tones */}
              <div className="setting-card">
                <h3>🔔 Notification Tones</h3>
                <p className="setting-desc">Customize notification sounds</p>
                <select className="setting-select">
                  <option>Default</option>
                  <option>Chime</option>
                  <option>Ping</option>
                  <option>Bubble</option>
                  <option>Coin</option>
                  <option>Silent</option>
                </select>
              </div>

              {/* Focus/DND */}
              <div className="setting-card">
                <h3>🌙 Focus Mode (DND)</h3>
                <p className="setting-desc">Silence all notifications temporarily</p>
                <label className="toggle-row">
                  <span>Enable Focus Mode</span>
                  <input type="checkbox" checked={dndEnabled} onChange={(e) => {
                    setDndEnabled(e.target.checked);
                    premium.setDnd(e.target.checked);
                  }} />
                </label>
              </div>

              {/* Support */}
              <div className="setting-card">
                <h3>💬 Help & Support</h3>
                <p className="setting-desc">Chat with our support team</p>
                <div className="support-chat-box">
                  <div className="support-messages">
                    {supportChat.map((m, i) => (
                      <div key={i} className={`support-msg ${m.from}`}>{m.text}</div>
                    ))}
                  </div>
                  <div className="input-group">
                    <input type="text" placeholder="Ask for help..." value={supportInput} onChange={(e) => setSupportInput(e.target.value)} className="setting-input" onKeyDown={(e) => e.key === 'Enter' && handleSupport()} />
                    <button className="btn-primary" onClick={handleSupport}>Send</button>
                  </div>
                </div>
              </div>

              {/* Cloud Sync */}
              <div className="setting-card">
                <h3>☁️ Cloud Sync & Backup</h3>
                <p className="setting-desc">Sync your data across devices</p>
                <button className="btn-secondary">🔄 Backup Now</button>
                <button className="btn-secondary">📥 Restore Backup</button>
              </div>

              {/* Group Calls */}
              <div className="setting-card">
                <h3>📞 Group Voice Calls</h3>
                <p className="setting-desc">Start voice calls with multiple participants</p>
                <div className="feature-badges">
                  <span className="badge">📞 Voice Calls</span>
                  <span className="badge">🖥️ Screen Share</span>
                  <span className="badge">👥 Group Calls</span>
                </div>
              </div>

              {/* In-App Browser */}
              <div className="setting-card">
                <h3>🌐 In-App Browser</h3>
                <p className="setting-desc">Open links without leaving the app</p>
                <label className="toggle-row">
                  <span>Open links in-app</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="modal-overlay" onClick={() => setScheduleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📅 Schedule Message</h3>
            <textarea placeholder="Message content..." value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} className="setting-textarea" />
            <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="setting-input" />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setScheduleModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                if (scheduleText && scheduleDate) {
                  premium.scheduleMessage('current', scheduleText, scheduleDate);
                  setScheduleModal(false);
                  setScheduleText('');
                  setScheduleDate('');
                }
              }}>Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div className="modal-overlay" onClick={() => setReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🚩 Report Content</h3>
            <select className="setting-select">
              <option>Spam</option>
              <option>Harassment</option>
              <option>Inappropriate Content</option>
              <option>Violence</option>
              <option>Other</option>
            </select>
            <textarea placeholder="Additional details (optional)..." className="setting-textarea" />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setReportModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={async () => {
                await premium.reportContent('report', 'spam', '');
                setReportModal(false);
              }}>Submit Report</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: var(--bg-primary, #0f0f1a);
          color: var(--text-primary, #e2e8f0);
        }
        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
          background: var(--surface, #1a1a2e);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .settings-header h1 { font-size: 20px; margin: 0; }
        .back-btn {
          background: none;
          border: none;
          color: var(--primary, #6366f1);
          font-size: 16px;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 8px;
        }
        .back-btn:hover { background: var(--hover, rgba(99,102,241,0.1)); }
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .logout-btn {
          background: rgba(239,68,68,0.15);
          color: #ef4444;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .settings-layout { display: flex; min-height: calc(100vh - 64px); }
        .settings-nav {
          width: 220px;
          padding: 16px 8px;
          border-right: 1px solid var(--border, rgba(255,255,255,0.1));
          background: var(--surface, #1a1a2e);
          flex-shrink: 0;
        }
        .nav-item {
          display: block;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          color: var(--text-secondary, #94a3b8);
          text-align: left;
          cursor: pointer;
          border-radius: 10px;
          font-size: 15px;
          transition: all 0.2s;
          margin-bottom: 4px;
        }
        .nav-item:hover { background: var(--hover, rgba(99,102,241,0.1)); color: var(--text-primary, #e2e8f0); }
        .nav-item.active { background: var(--primary, #6366f1); color: white; font-weight: 600; }
        .settings-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          max-height: calc(100vh - 64px);
        }
        .settings-section h2 { font-size: 24px; margin: 0 0 24px; }
        .setting-card {
          background: var(--surface, #1a1a2e);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .setting-card h3 { margin: 0 0 8px; font-size: 17px; }
        .setting-desc { color: var(--text-secondary, #94a3b8); font-size: 13px; margin: 0 0 12px; }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
          cursor: pointer;
        }
        .toggle-row input[type="checkbox"] {
          width: 44px;
          height: 24px;
          appearance: none;
          background: var(--border, rgba(255,255,255,0.2));
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: all 0.3s;
        }
        .toggle-row input[type="checkbox"]:checked { background: var(--primary, #6366f1); }
        .toggle-row input[type="checkbox"]::after {
          content: '';
          position: absolute;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: all 0.3s;
        }
        .toggle-row input[type="checkbox"]:checked::after { left: 23px; }
        .input-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .setting-input {
          flex: 1;
          padding: 10px 14px;
          background: var(--bg-primary, #0f0f1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 10px;
          color: var(--text-primary, #e2e8f0);
          font-size: 14px;
          min-width: 120px;
        }
        .setting-input.small { max-width: 140px; }
        .setting-textarea {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-primary, #0f0f1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 10px;
          color: var(--text-primary, #e2e8f0);
          font-size: 14px;
          min-height: 80px;
          resize: vertical;
          margin-bottom: 8px;
        }
        .setting-select {
          padding: 10px 14px;
          background: var(--bg-primary, #0f0f1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 10px;
          color: var(--text-primary, #e2e8f0);
          font-size: 14px;
          cursor: pointer;
        }
        .setting-select.small { max-width: 120px; }
        .btn-primary {
          padding: 10px 20px;
          background: var(--primary, #6366f1);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-secondary {
          padding: 10px 20px;
          background: var(--hover, rgba(99,102,241,0.1));
          color: var(--primary, #6366f1);
          border: 1px solid var(--primary, #6366f1);
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-secondary:hover { background: var(--primary, #6366f1); color: white; }
        .btn-danger {
          padding: 10px 20px;
          background: rgba(239,68,68,0.15);
          color: #ef4444;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        }
        .btn-danger:hover { background: #ef4444; color: white; }
        .btn-icon {
          background: none;
          border: none;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 14px;
        }
        .btn-icon:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          background: var(--hover, rgba(99,102,241,0.1));
          border-radius: 20px;
          font-size: 12px;
          color: var(--text-secondary, #94a3b8);
          margin: 2px;
        }
        .badge.green { background: rgba(16,185,129,0.15); color: #10b981; }
        .feature-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .quick-reply-list { margin-top: 8px; }
        .quick-reply-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 8px;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .quick-reply-item code {
          background: var(--primary, #6366f1);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        .scheduled-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 8px;
          margin-top: 8px;
          font-size: 13px;
        }
        .scheduled-text { flex: 1; }
        .scheduled-date { color: var(--text-secondary, #94a3b8); font-size: 12px; }
        .format-guide { display: grid; gap: 6px; margin-top: 8px; }
        .format-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
        }
        .format-item code {
          background: var(--bg-primary, #0f0f1a);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 13px;
        }
        .receipt-preview { display: flex; gap: 16px; margin-top: 8px; align-items: center; font-size: 13px; }
        .read-receipt { color: #3b82f6; font-weight: bold; margin-right: 4px; }
        .delivered-receipt { color: #94a3b8; font-weight: bold; margin-right: 4px; margin-left: 12px; }
        .sent-receipt { color: #94a3b8; margin-right: 4px; margin-left: 12px; }
        .qr-section { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        .qr-placeholder {
          width: 140px;
          height: 160px;
          background: white;
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .qr-placeholder p { color: #333; font-size: 11px; margin: 6px 0 0; }
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          width: 100px;
          height: 100px;
        }
        .qr-cell { border-radius: 1px; }
        .qr-cell.filled { background: #1a1a2e; }
        .status-options { display: flex; flex-wrap: wrap; gap: 8px; }
        .status-option {
          padding: 10px 16px;
          background: var(--bg-primary, #0f0f1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 10px;
          color: var(--text-primary, #e2e8f0);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .status-option:hover { border-color: var(--primary, #6366f1); }
        .login-methods { display: flex; flex-direction: column; gap: 8px; }
        .method-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--bg-primary, #0f0f1a);
          border-radius: 10px;
        }
        .analytics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 8px; }
        .stat-card {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .stat-number { font-size: 28px; font-weight: 700; color: var(--primary, #6366f1); }
        .stat-label { font-size: 12px; color: var(--text-secondary, #94a3b8); margin-top: 4px; }
        .theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 8px; }
        .theme-card {
          padding: 10px;
          border-radius: 12px;
          border: 2px solid transparent;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          background: var(--bg-primary, #0f0f1a);
          font-size: 12px;
        }
        .theme-card.active { border-width: 3px; }
        .theme-card:hover { transform: translateY(-2px); }
        .theme-preview {
          height: 40px;
          border-radius: 8px;
          margin-bottom: 6px;
          position: relative;
          overflow: hidden;
        }
        .theme-accent {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 8px;
        }
        .wallpaper-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; margin-bottom: 12px; }
        .wallpaper-option {
          height: 60px;
          border-radius: 10px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
        }
        .wallpaper-option:hover { border-color: var(--primary, #6366f1); transform: scale(1.05); }
        .ai-result-box {
          margin-top: 10px;
          padding: 14px;
          background: var(--bg-primary, #0f0f1a);
          border-left: 3px solid var(--primary, #6366f1);
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        .smart-replies-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .smart-reply-chip {
          padding: 8px 14px;
          background: var(--primary, #6366f1);
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .smart-reply-chip:hover { filter: brightness(1.15); transform: scale(1.03); }
        .search-filters { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
        .filter-tag {
          padding: 6px 12px;
          background: var(--bg-primary, #0f0f1a);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          border-radius: 20px;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          font-size: 12px;
        }
        .filter-tag:hover { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); }
        .support-chat-box {
          background: var(--bg-primary, #0f0f1a);
          border-radius: 12px;
          padding: 12px;
          margin-top: 8px;
        }
        .support-messages { max-height: 200px; overflow-y: auto; margin-bottom: 8px; }
        .support-msg {
          padding: 8px 12px;
          border-radius: 10px;
          margin-bottom: 6px;
          font-size: 13px;
          max-width: 80%;
        }
        .support-msg.user {
          background: var(--primary, #6366f1);
          color: white;
          margin-left: auto;
          text-align: right;
        }
        .support-msg.bot {
          background: var(--surface, #1a1a2e);
          border: 1px solid var(--border, rgba(255,255,255,0.1));
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--surface, #1a1a2e);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 440px;
          border: 1px solid var(--border, rgba(255,255,255,0.1));
        }
        .modal-content h3 { margin: 0 0 16px; }
        .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
        @media (max-width: 768px) {
          .settings-layout { flex-direction: column; }
          .settings-nav {
            width: 100%;
            display: flex;
            overflow-x: auto;
            border-right: none;
            border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
            padding: 8px;
            gap: 4px;
          }
          .nav-item { white-space: nowrap; padding: 8px 14px; font-size: 13px; margin: 0; }
          .settings-content { max-height: none; padding: 16px; }
        }
      `}</style>
    </div>
  );
}
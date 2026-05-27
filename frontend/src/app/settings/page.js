'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FiArrowLeft, FiMoon, FiSun, FiBell, FiBellOff,
  FiMessageCircle, FiPhone, FiUsers, FiVolume2, FiEye,
  FiUser, FiGlobe, FiMonitor, FiType, FiSend,
  FiCamera, FiSmartphone, FiRefreshCw, FiCheck,
  FiLock, FiActivity, FiStar
} from 'react-icons/fi';
import useAuthStore from '../../stores/authStore';
import useSettingsStore from '../../stores/settingsStore';
import Toggle from '../../components/ui/Toggle';
import Button from '../../components/ui/Button';
import Skeleton, { ProfileSkeleton } from '../../components/ui/Skeleton';

// ─── SECTION COMPONENT ──────────────────────────────────────────────────

function Section({ icon: Icon, title, description, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background: 'linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.5))',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{ color: 'var(--primary)', display: 'flex', fontSize: 18 }}>
          <Icon />
        </span>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
          {description && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 24px 16px' }}>
        {children}
      </div>
    </motion.div>
  );
}

// ─── SETTING ROW ────────────────────────────────────────────────────────

function SettingRow({ icon: Icon, label, description, control }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--text-muted)', display: 'flex', fontSize: 15, flexShrink: 0 }}>
          <Icon />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dark)' }}>{label}</div>
          {description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: 12 }}>{control}</div>
    </div>
  );
}

// ─── SETTINGS PAGE ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const settings = useSettingsStore();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--gradient-dark)',
        padding: '80px 24px 40px',
      }}>
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--gradient-dark)',
      color: 'var(--text-dark)',
    }}>
      {/* ─── HEADER ─────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(15,15,26,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={handleBack}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'none',
            color: 'var(--text-dark)', cursor: 'pointer',
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
        >
          <FiArrowLeft />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Settings</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ─── PROFILE ──────────────────────────────────────── */}
        <Section icon={FiUser} title="Profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 22, fontWeight: 700,
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user?.avatar ? (
                <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user?.displayName || user?.username || 'U')[0].toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.displayName || user?.username || 'User'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {user?.email || 'No email'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                @{user?.username || 'unknown'}
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={<FiCamera />}
              onClick={() => router.push('/login')}
            >
              Edit
            </Button>
          </div>
        </Section>

        {/* ─── APPEARANCE ────────────────────────────────────── */}
        <Section icon={FiMonitor} title="Appearance" description="Customize how ChatWave looks">
          <SettingRow
            icon={settings.theme === 'dark' ? FiMoon : FiSun}
            label="Theme"
            description={settings.theme === 'dark' ? 'Dark mode' : 'Light mode'}
            control={
              <Toggle
                checked={settings.theme === 'dark'}
                onChange={() => settings.toggleTheme()}
              />
            }
          />
          <SettingRow
            icon={FiSmartphone}
            label="Compact mode"
            description="Reduce spacing for a denser layout"
            control={
              <Toggle
                checked={settings.compactMode}
                onChange={settings.setCompactMode}
              />
            }
          />
          <SettingRow
            icon={FiType}
            label="Message font size"
            control={
              <select
                value={settings.messageFontSize}
                onChange={(e) => settings.setMessageFontSize(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-dark)',
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            }
          />
        </Section>

        {/* ─── NOTIFICATIONS ────────────────────────────────── */}
        <Section icon={FiBell} title="Notifications" description="Control what you hear and see">
          <SettingRow
            icon={settings.notificationsEnabled ? FiBell : FiBellOff}
            label="Enable notifications"
            description="Master toggle for all notifications"
            control={
              <Toggle
                checked={settings.notificationsEnabled}
                onChange={settings.setNotificationsEnabled}
              />
            }
          />
          {settings.notificationsEnabled && (
            <>
              <SettingRow
                icon={FiMessageCircle}
                label="Message notifications"
                description="Alert on new direct messages"
                control={
                  <Toggle
                    checked={settings.notifyMessages}
                    onChange={settings.setNotifyMessages}
                  />
                }
              />
              <SettingRow
                icon={FiPhone}
                label="Call notifications"
                description="Alert on incoming calls"
                control={
                  <Toggle
                    checked={settings.notifyCalls}
                    onChange={settings.setNotifyCalls}
                  />
                }
              />
              <SettingRow
                icon={FiUsers}
                label="Group notifications"
                description="Alert on group messages"
                control={
                  <Toggle
                    checked={settings.notifyGroups}
                    onChange={settings.setNotifyGroups}
                  />
                }
              />
              <SettingRow
                icon={FiVolume2}
                label="Notification sound"
                description="Play sound for notifications"
                control={
                  <Toggle
                    checked={settings.notifySound}
                    onChange={settings.setNotifySound}
                  />
                }
              />
              <SettingRow
                icon={FiEye}
                label="Message preview"
                description="Show message content in notifications"
                control={
                  <Toggle
                    checked={settings.notifyPreview}
                    onChange={settings.setNotifyPreview}
                  />
                }
              />
            </>
          )}
        </Section>

        {/* ─── CALLING ─────────────────────────────────────── */}
        <Section icon={FiPhone} title="Calling" description="Call preferences">
          <SettingRow
            icon={FiCamera}
            label="Preferred call type"
            control={
              <select
                value={settings.preferredCallType}
                onChange={(e) => settings.setPreferredCallType(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-dark)',
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="audio">Voice only</option>
                <option value="video">Video</option>
              </select>
            }
          />
        </Section>

        {/* ─── PRIVACY ──────────────────────────────────────── */}
        <Section icon={FiLock} title="Privacy" description="Control your visibility">
          <SettingRow
            icon={FiCheck}
            label="Read receipts"
            description="Let others know when you've read messages"
            control={
              <Toggle
                checked={settings.readReceipts}
                onChange={settings.setReadReceipts}
              />
            }
          />
          <SettingRow
            icon={FiActivity}
            label="Show online status"
            description="Let others see when you're online"
            control={
              <Toggle
                checked={settings.showOnlineStatus}
                onChange={settings.setShowOnlineStatus}
              />
            }
          />
          <SettingRow
            icon={FiStar}
            label="Last seen"
            description="Show when you were last active"
            control={
              <Toggle
                checked={settings.lastSeen}
                onChange={settings.setLastSeen}
              />
            }
          />
        </Section>

        {/* ─── CHAT ─────────────────────────────────────────── */}
        <Section icon={FiMessageCircle} title="Chat" description="Message preferences">
          <SettingRow
            icon={FiSend}
            label="Enter to send"
            description="Send messages with Enter (Shift+Enter for new line)"
            control={
              <Toggle
                checked={settings.enterToSend}
                onChange={settings.setEnterToSend}
              />
            }
          />
          <SettingRow
            icon={FiUsers}
            label="Typing indicators"
            description="Show when others are typing"
            control={
              <Toggle
                checked={settings.showTypingIndicators}
                onChange={settings.setShowTypingIndicators}
              />
            }
          />
        </Section>

        {/* ─── RESET ────────────────────────────────────────── */}
        <div style={{ padding: '12px 0', textAlign: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<FiRefreshCw />}
            onClick={settings.resetSettings}
          >
            Reset all settings to defaults
          </Button>
        </div>

        {/* ─── FOOTER ───────────────────────────────────────── */}
        <div style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
          ChatWave v1.0.0
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCamera, FiUser, FiMail, FiPhone, FiEdit3, FiSave, FiImage, FiAward, FiShield, FiStar } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import { uploadAPI, premiumAPI } from '../lib/api';

const BadgeIcons = ({ badges }) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
    {badges?.isAdmin && <span title="Admin" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: 11, fontWeight: 700 }}><FiShield size={12} /> Admin</span>}
    {badges?.isVerified && <span title="Verified" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: 11, fontWeight: 700 }}><FiAward size={12} /> Verified</span>}
    {badges?.isPremium && <span title="Premium" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontSize: 11, fontWeight: 700 }}><FiStar size={12} /> Premium</span>}
  </div>
);

export default function ProfileManager({ isOpen, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    phone: '',
    email: '',
    username: '',
    customStatus: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        phone: user.phone || '',
        email: user.email || '',
        username: user.username || '',
        customStatus: user.customStatus || ''
      });
      setAvatarPreview(user.avatar || null);
      setCoverPreview(user.coverPhoto || null);
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      let avatarUrl = formData.avatar;
      let coverUrl = coverPreview;
      if (avatarFile) {
        const res = await uploadAPI.avatar(avatarFile);
        avatarUrl = res.data.url;
      }
      if (coverFile) {
        const res = await uploadAPI.single(coverFile);
        coverUrl = res.data.url;
      }
      const updateData = { ...formData, avatar: avatarUrl, coverPhoto: coverUrl };
      await updateProfile(updateData);
      await premiumAPI.updateProfile(updateData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Failed to update profile' });
    }
    setIsSaving(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="profile-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="profile-modal"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="profile-modal-header">
              <h2>Profile Settings</h2>
              <button className="profile-close-btn" onClick={onClose}>
                <FiX />
              </button>
            </div>

            {/* Cover Photo */}
            <div style={{ position: 'relative', height: 120, background: 'var(--gradient-primary)', borderRadius: '12px 12px 0 0', overflow: 'hidden', margin: '0 -24px' }}>
              {coverPreview && <img src={coverPreview} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <button onClick={() => coverInputRef.current?.click()} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <FiCamera size={14} /> Cover
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
            </div>

            <div className="profile-avatar-section" style={{ marginTop: -40 }}>
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar" style={{ width: 80, height: 80, fontSize: 28, border: '3px solid var(--dark-surface)' }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" />
                  ) : (
                    <FiUser size={32} />
                  )}
                </div>
                <button className="profile-camera-btn" onClick={() => fileInputRef.current?.click()}>
                  <FiCamera />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>

            {/* Badges */}
            {user?.badges && (user.badges.isAdmin || user.badges.isVerified || user.badges.isPremium) && (
              <div style={{ textAlign: 'center' }}>
                <BadgeIcons badges={user.badges} />
              </div>
            )}

            <div className="profile-form">
              <div className="profile-field">
                <label><FiUser size={14} /> Username</label>
                <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="@username" />
              </div>
              <div className="profile-field">
                <label><FiUser size={14} /> Display Name</label>
                <input value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="Your display name" />
              </div>
              <div className="profile-field">
                <label><FiEdit3 size={14} /> Custom Status</label>
                <input value={formData.customStatus} onChange={(e) => setFormData({ ...formData, customStatus: e.target.value })} placeholder="What's on your mind?" />
              </div>
              <div className="profile-field">
                <label><FiMail size={14} /> Email</label>
                <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" type="email" />
              </div>
              <div className="profile-field">
                <label><FiPhone size={14} /> Phone</label>
                <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="profile-field">
                <label><FiEdit3 size={14} /> Bio</label>
                <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} placeholder="Tell us about yourself..." rows={3} />
              </div>
            </div>

            {message && (
              <div className={`profile-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="profile-actions">
              <button className="profile-cancel-btn" onClick={onClose}>Cancel</button>
              <button className="profile-save-btn" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <span className="profile-saving-spinner" /> : <><FiSave /> Save Changes</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
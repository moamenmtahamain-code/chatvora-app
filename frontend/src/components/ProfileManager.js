'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCamera, FiUser, FiMail, FiPhone, FiEdit3, FiSave, FiImage } from 'react-icons/fi';
import useAuthStore from '../stores/authStore';
import { uploadAPI } from '../lib/api';

export default function ProfileManager({ isOpen, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    phone: '',
    email: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        phone: user.phone || '',
        email: user.email || ''
      });
      setAvatarPreview(user.avatar || null);
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

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      if (avatarFile) {
        const res = await uploadAPI.avatar(avatarFile);
        await updateProfile({ ...formData, avatar: res.data.url });
      } else {
        await updateProfile(formData);
      }
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

            <div className="profile-avatar-section">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" />
                  ) : (
                    <FiUser size={40} />
                  )}
                </div>
                <button
                  className="profile-camera-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiCamera />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />
            </div>

            <div className="profile-form">
              <div className="profile-field">
                <label><FiUser size={14} /> Display Name</label>
                <input
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Your display name"
                />
              </div>

              <div className="profile-field">
                <label><FiMail size={14} /> Email</label>
                <input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  type="email"
                />
              </div>

              <div className="profile-field">
                <label><FiPhone size={14} /> Phone</label>
                <input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="profile-field">
                <label><FiEdit3 size={14} /> Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
              </div>
            </div>

            {message && (
              <div className={`profile-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="profile-actions">
              <button className="profile-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="profile-save-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="profile-saving-spinner" />
                ) : (
                  <><FiSave /> Save Changes</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCamera, FiCheck, FiSearch, FiShield, FiStar, FiUserMinus, FiUsers, FiX } from 'react-icons/fi';
import { uploadAPI, userAPI } from '../lib/api';
import useChatStore from '../stores/chatStore';

const getName = (user) => user?.displayName || user?.username || 'Unknown';

export default function CreateGroupModal({ currentUser, isOpen, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const { createGroup } = useChatStore();

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDescription('');
    setAvatar('');
    setAvatarPreview('');
    setQuery('');
    setResults([]);
    setSelected([]);
    setAdmins([]);
    setModerators([]);
    setError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await userAPI.search(query.trim());
        setResults((response.data || []).filter((user) => user._id !== currentUser?._id));
      } catch (err) {
        console.error('Group member search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, currentUser?._id]);

  const selectedIds = useMemo(() => new Set(selected.map((user) => user._id)), [selected]);

  const addUser = (user) => {
    if (selectedIds.has(user._id)) return;
    setSelected((items) => [...items, user]);
  };

  const removeUser = (userId) => {
    setSelected((items) => items.filter((user) => user._id !== userId));
    setAdmins((items) => items.filter((id) => id !== userId));
    setModerators((items) => items.filter((id) => id !== userId));
  };

  const toggleAdmin = (userId) => {
    setAdmins((items) => items.includes(userId) ? items.filter((id) => id !== userId) : [...items, userId]);
    setModerators((items) => items.filter((id) => id !== userId));
  };

  const toggleModerator = (userId) => {
    setModerators((items) => items.includes(userId) ? items.filter((id) => id !== userId) : [...items, userId]);
    setAdmins((items) => items.filter((id) => id !== userId));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    try {
      const response = await uploadAPI.avatar(file);
      setAvatar(response.data.url);
    } catch (err) {
      console.error('Group avatar upload error:', err);
      setError('Avatar upload failed. You can still create the group.');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one member.');
      return;
    }

    setIsCreating(true);
    setError('');
    const result = await createGroup({
      name: name.trim(),
      description: description.trim(),
      avatar,
      memberIds: selected.map((user) => user._id),
      adminIds: admins,
      moderatorIds: moderators
    });
    setIsCreating(false);

    if (!result) {
      setError('Could not create the group. Please try again.');
      return;
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="group-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="group-create-modal"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="group-modal-header">
              <div>
                <h2>Create Group</h2>
                <p>{selected.length + 1} members including you</p>
              </div>
              <button className="group-icon-btn" onClick={onClose} aria-label="Close create group modal">
                <FiX />
              </button>
            </div>

            <div className="group-modal-grid">
              <div className="group-form-panel">
                <button className="group-avatar-upload" onClick={() => fileInputRef.current?.click()}>
                  {avatarPreview || avatar ? (
                    <img src={avatarPreview || avatar} alt="Group avatar preview" />
                  ) : (
                    <>
                      <FiCamera />
                      <span>Avatar</span>
                    </>
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />

                <label className="group-field">
                  <span>Group name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Design team" maxLength={80} />
                </label>

                <label className="group-field">
                  <span>Description</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this group for?" rows={3} maxLength={500} />
                </label>

                <div className="selected-members">
                  <div className="group-section-title">Selected members</div>
                  {selected.length === 0 ? (
                    <div className="group-empty-state">Search and add people to this group.</div>
                  ) : selected.map((member) => (
                    <div className="selected-member-row" key={member._id}>
                      <div className="mini-avatar">
                        {member.avatar ? <img src={member.avatar} alt={getName(member)} /> : getName(member)[0].toUpperCase()}
                      </div>
                      <div className="member-main">
                        <strong>{getName(member)}</strong>
                        <span>@{member.username}</span>
                      </div>
                      <button className={`role-pill ${admins.includes(member._id) ? 'active' : ''}`} onClick={() => toggleAdmin(member._id)}>
                        <FiShield /> Admin
                      </button>
                      <button className={`role-pill ${moderators.includes(member._id) ? 'active moderator' : ''}`} onClick={() => toggleModerator(member._id)}>
                        <FiStar /> Mod
                      </button>
                      <button className="group-icon-btn danger" onClick={() => removeUser(member._id)} aria-label={`Remove ${getName(member)}`}>
                        <FiUserMinus />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="group-picker-panel">
                <div className="group-search">
                  <FiSearch />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." />
                </div>

                <div className="group-section-title">Members selection list</div>
                <div className="group-user-list">
                  {isSearching ? (
                    <div className="group-empty-state">Searching...</div>
                  ) : results.length === 0 ? (
                    <div className="group-empty-state">Type at least two letters to find users.</div>
                  ) : results.map((person) => {
                    const isSelected = selectedIds.has(person._id);
                    return (
                      <button className={`group-user-row ${isSelected ? 'selected' : ''}`} key={person._id} onClick={() => addUser(person)}>
                        <div className="mini-avatar">
                          {person.avatar ? <img src={person.avatar} alt={getName(person)} /> : getName(person)[0].toUpperCase()}
                        </div>
                        <div className="member-main">
                          <strong>{getName(person)}</strong>
                          <span>{person.bio || `@${person.username}`}</span>
                        </div>
                        {isSelected ? <FiCheck /> : <FiUsers />}
                      </button>
                    );
                  })}
                </div>

                <div className="admin-selection-note">
                  <FiShield />
                  <span>Admins can add or remove members, edit group info, delete messages, and manage calls.</span>
                </div>
              </div>
            </div>

            {error && <div className="group-error">{error}</div>}

            <div className="group-modal-footer">
              <button className="group-secondary-btn" onClick={onClose}>Cancel</button>
              <button className="group-primary-btn" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiMessageCircle, FiPhone, FiActivity, FiTrash2,
  FiShield, FiArrowLeft, FiSearch, FiX, FiPlus, FiEdit,
  FiLock, FiCheck, FiAlertTriangle, FiSend, FiUserPlus,
  FiEye, FiFilter, FiChevronDown, FiRefreshCw, FiBell,
  FiUserX, FiUserCheck, FiClock, FiMail, FiMapPin
} from 'react-icons/fi';
import useAuthStore from '../../stores/authStore';
import { adminAPI } from '../../lib/api';

const API_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`)
  : 'http://127.0.0.1:5000/api';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [newUsers, setNewUsers] = useState([]);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    email: '', username: '', password: '', displayName: '',
    phone: '', bio: '', role: 'user'
  });

  // Password reset state
  const [newPassword, setNewPassword] = useState('');

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');

  // Check auth
  useEffect(() => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'owner')) {
      router.push('/');
      return;
    }
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, newUsersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ page: 1, limit: 20 }),
        adminAPI.getNewUsers(30)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setTotalUsers(usersRes.data.total || 0);
      setTotalPages(usersRes.data.pages || 1);
      setNewUsers(newUsersRes.data.newUsers || []);
    } catch (e) {
      console.error('Admin load error:', e);
    }
    setLoading(false);
  };

  const loadUsers = useCallback(async (page, search, role, status) => {
    try {
      const res = await adminAPI.getUsers({ page, search, role, status, limit: 20 });
      setUsers(res.data.users || []);
      setTotalUsers(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      setCurrentPage(page);
    } catch (e) {
      console.error('Load users error:', e);
    }
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length >= 2 || query.length === 0) {
      loadUsers(1, query, filterRole, filterStatus);
    }
  };

  const handleFilter = (role, status) => {
    setFilterRole(role);
    setFilterStatus(status);
    loadUsers(1, searchQuery, role, status);
  };

  // ─── User Actions ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ email: '', username: '', password: '', displayName: '', phone: '', bio: '', role: 'user' });
    setFormError('');
    setFormSuccess('');
    setShowUserModal(true);
  };

  const openEditModal = (u) => {
    setModalMode('edit');
    setFormData({
      email: u.email || '', username: u.username || '', password: '',
      displayName: u.displayName || '', phone: u.phone || '', bio: u.bio || '', role: u.role || 'user'
    });
    setSelectedUser(u);
    setFormError('');
    setFormSuccess('');
    setShowUserModal(true);
  };

  const openDetailModal = async (u) => {
    try {
      const res = await adminAPI.getUser(u._id);
      setSelectedUser(res.data);
      setShowDetailModal(true);
    } catch (e) {
      console.error('Get user detail error:', e);
      setSelectedUser(u);
      setShowDetailModal(true);
    }
  };

  const handleCreateUser = async () => {
    setFormError('');
    try {
      await adminAPI.createUser(formData);
      setFormSuccess('User created successfully!');
      setShowUserModal(false);
      loadUsers(currentPage, searchQuery, filterRole, filterStatus);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    setFormError('');
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      await adminAPI.updateUser(selectedUser._id, updateData);
      setFormSuccess('User updated successfully!');
      setShowUserModal(false);
      loadUsers(currentPage, searchQuery, filterRole, filterStatus);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await adminAPI.deleteUser(userId);
      loadUsers(currentPage, searchQuery, filterRole, filterStatus);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleStatusChange = async (userId, status, reason) => {
    const reasonPrompt = status !== 'active'
      ? prompt(`Enter reason for ${status}:`) || ''
      : '';
    try {
      await adminAPI.updateUserStatus(userId, status, reasonPrompt);
      loadUsers(currentPage, searchQuery, filterRole, filterStatus);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update status');
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminAPI.updateUserRole(userId, role);
      loadUsers(currentPage, searchQuery, filterRole, filterStatus);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update role');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }
    try {
      await adminAPI.resetUserPassword(selectedUser._id, newPassword);
      alert('Password reset successfully!');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await adminAPI.broadcast(broadcastMsg, broadcastType);
      alert('Broadcast sent to all users!');
      setShowBroadcastModal(false);
      setBroadcastMsg('');
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to send broadcast');
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'active';
    const colors = {
      active: '#10b981',
      suspended: '#ef4444',
      held: '#f59e0b'
    };
    const labels = {
      active: 'Active',
      suspended: 'Suspended',
      held: 'On Hold'
    };
    return (
      <span style={{
        background: colors[s] + '20', color: colors[s],
        padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
      }}>
        {labels[s]}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const r = role || 'user';
    const colors = {
      super_admin: '#8b5cf6',
      admin: '#3b82f6',
      moderator: '#f59e0b',
      user: '#6b7280'
    };
    return (
      <span style={{
        background: colors[r] + '20', color: colors[r],
        padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
      }}>
        {r.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <FiActivity size={32} color="#6c5ce7" />
        </motion.div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{
        background: '#12121a', borderBottom: '1px solid #1e1e2e',
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push('/')} style={{
            background: '#1e1e2e', border: 'none', color: '#e2e8f0',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              <FiShield style={{ marginRight: 8, color: '#8b5cf6' }} />
              Super Admin Panel
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Logged in as @{user?.username} ({user?.role})
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBroadcastModal(true)} style={{
            background: '#8b5cf6', border: 'none', color: '#fff',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600
          }}>
            <FiSend size={14} /> Broadcast
          </button>
          <button onClick={loadInitialData} style={{
            background: '#1e1e2e', border: 'none', color: '#e2e8f0',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        background: '#12121a', borderBottom: '1px solid #1e1e2e'
      }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <FiActivity size={14} /> },
          { id: 'users', label: 'All Users', icon: <FiUsers size={14} /> },
          { id: 'newusers', label: `New Users (${newUsers.length})`, icon: <FiUserPlus size={14} /> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? '#8b5cf6' : 'transparent',
            border: 'none', color: activeTab === tab.id ? '#fff' : '#94a3b8',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            transition: 'all 0.2s'
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* ─── DASHBOARD TAB ────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Stats Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16, marginBottom: 24
            }}>
              {[
                { label: 'Total Users', value: stats?.totalUsers || 0, sub: `${stats?.onlineUsers || 0} online`, icon: <FiUsers />, color: '#8b5cf6' },
                { label: 'Messages', value: stats?.totalMessages || 0, icon: <FiMessageCircle />, color: '#3b82f6' },
                { label: 'Conversations', value: stats?.totalConversations || 0, icon: <FiActivity />, color: '#10b981' },
                { label: 'Calls', value: stats?.totalCalls || 0, icon: <FiPhone />, color: '#f59e0b' },
                { label: 'New Today', value: stats?.newUsersToday || 0, sub: 'Users registered today', icon: <FiUserPlus />, color: '#ec4899' },
                { label: 'Suspended', value: stats?.suspendedUsers || 0, icon: <FiUserX />, color: '#ef4444' }
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{
                    background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
                    padding: 20, position: 'relative', overflow: 'hidden'
                  }}>
                  <div style={{ color: stat.color, fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{stat.value.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{stat.label}</div>
                  {stat.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{stat.sub}</div>}
                  <div style={{
                    position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                    background: stat.color + '10', borderRadius: '50%'
                  }} />
                </motion.div>
              ))}
            </div>

            {/* New Users Notifications */}
            <div style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiBell color="#8b5cf6" /> Recent New Users
                </h3>
                <button onClick={() => setActiveTab('newusers')} style={{
                  background: 'none', border: 'none', color: '#8b5cf6',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}>View All</button>
              </div>
              {newUsers.slice(0, 5).map(u => (
                <div key={u._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderBottom: '1px solid #1e1e2e'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#8b5cf620',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#8b5cf6', fontWeight: 700, fontSize: 14
                    }}>
                      {(u.displayName || u.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || u.username}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>@{u.username} &middot; {u.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {getStatusBadge(u.status)}
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      <FiClock size={10} /> {formatDate(u.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── USERS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap'
            }}>
              <div style={{
                flex: 1, minWidth: 200, position: 'relative',
                background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10,
                display: 'flex', alignItems: 'center', padding: '0 12px'
              }}>
                <FiSearch color="#64748b" size={16} />
                <input type="text" placeholder="Search users by name, email, username..."
                  value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    background: 'none', border: 'none', color: '#e2e8f0',
                    padding: '10px 12px', width: '100%', fontSize: 14, outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button onClick={() => handleSearch('')} style={{
                    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'
                  }}><FiX size={16} /></button>
                )}
              </div>

              <select value={filterRole} onChange={(e) => handleFilter(e.target.value, filterStatus)}
                style={{
                  background: '#12121a', border: '1px solid #1e1e2e', color: '#e2e8f0',
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer'
                }}>
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>

              <select value={filterStatus} onChange={(e) => handleFilter(filterRole, e.target.value)}
                style={{
                  background: '#12121a', border: '1px solid #1e1e2e', color: '#e2e8f0',
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer'
                }}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="held">On Hold</option>
              </select>

              <button onClick={openCreateModal} style={{
                background: '#8b5cf6', border: 'none', color: '#fff',
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600
              }}>
                <FiPlus size={16} /> Create User
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Showing {users.length} of {totalUsers} users
            </div>

            {/* Users Table */}
            <div style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1e1e2e' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>User</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Joined</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                          onClick={() => openDetailModal(u)}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: u.isOnline ? '#10b98120' : '#64748b20',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 14,
                            color: u.isOnline ? '#10b981' : '#64748b',
                            border: u.isOnline ? '2px solid #10b981' : '2px solid transparent'
                          }}>
                            {u.avatar ? <img src={u.avatar} style={{ width: '100%', borderRadius: '50%' }} />
                              : (u.displayName || u.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || u.username}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#94a3b8' }}>{u.email}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <select value={u.role || 'user'} onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          style={{
                            background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0',
                            padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer'
                          }}>
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                        </select>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {getStatusBadge(u.status)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748b' }}>
                        {formatDate(u.createdAt)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => openDetailModal(u)} title="View Details"
                            style={{ background: '#3b82f620', border: 'none', color: '#3b82f6', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiEye size={14} />
                          </button>
                          <button onClick={() => openEditModal(u)} title="Edit"
                            style={{ background: '#f59e0b20', border: 'none', color: '#f59e0b', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiEdit size={14} />
                          </button>
                          {u.status === 'suspended' ? (
                            <button onClick={() => handleStatusChange(u._id, 'active')} title="Activate"
                              style={{ background: '#10b98120', border: 'none', color: '#10b981', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button onClick={() => handleStatusChange(u._id, 'suspended')} title="Suspend"
                              style={{ background: '#ef444420', border: 'none', color: '#ef4444', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiUserX size={14} />
                            </button>
                          )}
                          {u.status !== 'held' ? (
                            <button onClick={() => handleStatusChange(u._id, 'held')} title="Hold"
                              style={{ background: '#f59e0b20', border: 'none', color: '#f59e0b', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiAlertTriangle size={14} />
                            </button>
                          ) : null}
                          <button onClick={() => { setSelectedUser(u); setNewPassword(''); setFormError(''); setShowPasswordModal(true); }} title="Reset Password"
                            style={{ background: '#8b5cf620', border: 'none', color: '#8b5cf6', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiLock size={14} />
                          </button>
                          <button onClick={() => handleDeleteUser(u._id)} title="Delete"
                            style={{ background: '#ef444420', border: 'none', color: '#ef4444', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => loadUsers(i + 1, searchQuery, filterRole, filterStatus)}
                    style={{
                      background: currentPage === i + 1 ? '#8b5cf6' : '#1e1e2e',
                      border: 'none', color: currentPage === i + 1 ? '#fff' : '#94a3b8',
                      width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontWeight: 600
                    }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── NEW USERS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'newusers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiBell color="#8b5cf6" />
                <h3 style={{ margin: 0 }}>New Users (Last 30 Days) — {newUsers.length} users</h3>
              </div>
              {newUsers.map(u => (
                <div key={u._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px', borderBottom: '1px solid #1e1e2e'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: '#8b5cf620',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#8b5cf6', fontWeight: 700
                    }}>
                      {(u.displayName || u.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.displayName || u.username}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>@{u.username} &middot; {u.email} &middot; {u.phone || 'No phone'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {getRoleBadge(u.role)}
                    {getStatusBadge(u.status)}
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(u.createdAt)}</span>
                    <button onClick={() => openDetailModal(u)} style={{
                      background: '#3b82f620', border: 'none', color: '#3b82f6',
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12
                    }}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────────────── */}

      {/* Create/Edit User Modal */}
      {showUserModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
              padding: 24, width: 480, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>{modalMode === 'create' ? 'Create New User' : 'Edit User'}</h2>
              <button onClick={() => setShowUserModal(false)} style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'
              }}><FiX size={20} /></button>
            </div>

            {formError && (
              <div style={{ background: '#ef444420', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Username *</label>
                  <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Display Name</label>
                  <input value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>
                  Password {modalMode === 'create' ? '*' : '(leave blank to keep current)'}
                </label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Phone</label>
                  <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Role</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' }}>Bio</label>
                <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={2} style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUserModal(false)} style={{
                background: '#1e1e2e', border: 'none', color: '#94a3b8',
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}>Cancel</button>
              <button onClick={modalMode === 'create' ? handleCreateUser : handleUpdateUser} style={{
                background: '#8b5cf6', border: 'none', color: '#fff',
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600
              }}>
                {modalMode === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
              padding: 24, width: 560, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>User Details</h2>
              <button onClick={() => setShowDetailModal(false)} style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'
              }}><FiX size={20} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#8b5cf620',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#8b5cf6', fontWeight: 700, fontSize: 24
              }}>
                {(selectedUser.displayName || selectedUser.username || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedUser.displayName || selectedUser.username}</div>
                <div style={{ color: '#64748b' }}>@{selectedUser.username}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {getRoleBadge(selectedUser.role)}
                  {getStatusBadge(selectedUser.status)}
                  <span style={{ color: selectedUser.isOnline ? '#10b981' : '#64748b', fontSize: 12 }}>
                    {selectedUser.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { icon: <FiMail size={14} />, label: 'Email', value: selectedUser.email },
                { icon: <FiPhone size={14} />, label: 'Phone', value: selectedUser.phone || 'N/A' },
                { icon: <FiClock size={14} />, label: 'Joined', value: formatDate(selectedUser.createdAt) },
                { icon: <FiClock size={14} />, label: 'Last Seen', value: formatDate(selectedUser.lastSeen) },
                { icon: <FiMapPin size={14} />, label: 'Bio', value: selectedUser.bio || 'N/A' }
              ].map((item, i) => (
                <div key={i} style={{ background: '#1e1e2e', padding: '10px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.icon} {item.label}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* User Stats */}
            {selectedUser.stats && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#94a3b8' }}>Activity Stats</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Messages', value: selectedUser.stats.messageCount || 0 },
                    { label: 'Conversations', value: selectedUser.stats.conversationCount || 0 },
                    { label: 'Calls', value: selectedUser.stats.callCount || 0 },
                    { label: 'Contacts', value: selectedUser.stats.contactsCount || 0 }
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#1e1e2e', padding: '10px', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status info */}
            {selectedUser.statusReason && (
              <div style={{ background: '#ef444420', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                <strong>Status Reason:</strong> {selectedUser.statusReason}
                <br /><span style={{ fontSize: 11, color: '#64748b' }}>Changed: {formatDate(selectedUser.statusChangedAt)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDetailModal(false); openEditModal(selectedUser); }} style={{
                background: '#f59e0b20', border: 'none', color: '#f59e0b',
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}><FiEdit size={14} /> Edit</button>
              <button onClick={() => handleStatusChange(selectedUser._id, selectedUser.status === 'suspended' ? 'active' : 'suspended')} style={{
                background: selectedUser.status === 'suspended' ? '#10b98120' : '#ef444420',
                border: 'none', color: selectedUser.status === 'suspended' ? '#10b981' : '#ef4444',
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}>
                {selectedUser.status === 'suspended' ? <><FiUserCheck size={14} /> Activate</> : <><FiUserX size={14} /> Suspend</>}
              </button>
              <button onClick={() => {
                setShowDetailModal(false);
                setSelectedUser(selectedUser);
                setNewPassword('');
                setFormError('');
                setShowPasswordModal(true);
              }} style={{
                background: '#8b5cf620', border: 'none', color: '#8b5cf6',
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}><FiLock size={14} /> Reset Password</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001
        }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
              padding: 24, width: 400, maxWidth: '90vw'
            }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Reset Password for @{selectedUser.username}</h3>
            {formError && (
              <div style={{ background: '#ef444420', color: '#ef4444', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                {formError}
              </div>
            )}
            <input type="password" placeholder="Enter new password (min 6 chars)" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPasswordModal(false)} style={{
                background: '#1e1e2e', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={handleResetPassword} style={{
                background: '#8b5cf6', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600
              }}>Reset Password</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001
        }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
              padding: 24, width: 480, maxWidth: '90vw'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><FiSend style={{ marginRight: 8 }} /> Broadcast Message</h3>
              <button onClick={() => setShowBroadcastModal(false)} style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'
              }}><FiX size={20} /></button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px 0' }}>
              Send a notification message to all users in the system.
            </p>
            <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value)}
              style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, marginBottom: 12 }}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="maintenance">Maintenance</option>
              <option value="update">Update</option>
            </select>
            <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Type your broadcast message..."
              rows={4} style={{ width: '100%', background: '#1e1e2e', border: '1px solid #2d2d3f', color: '#e2e8f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBroadcastModal(false)} style={{
                background: '#1e1e2e', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={handleBroadcast} disabled={!broadcastMsg.trim()} style={{
                background: broadcastMsg.trim() ? '#8b5cf6' : '#2d2d3f', border: 'none',
                color: broadcastMsg.trim() ? '#fff' : '#64748b',
                padding: '8px 16px', borderRadius: 8, cursor: broadcastMsg.trim() ? 'pointer' : 'not-allowed', fontWeight: 600
              }}><FiSend size={14} style={{ marginRight: 6 }} /> Send to All Users</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
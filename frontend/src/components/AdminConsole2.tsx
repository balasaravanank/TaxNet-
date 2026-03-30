import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { XIcon, PlusIcon, TrashIcon, ShieldIcon, UserIcon, MailIcon, CalendarIcon, PowerIcon } from './Icons';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'auditor' | 'analyst';
  created_at: string;
  last_login?: string;
  is_active: number;
}

interface AdminConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_COLORS = {
  admin: '#f59e0b',
  auditor: '#06b6d4',
  analyst: '#8b5cf6'
};

const ROLE_ICONS = {
  admin: ShieldIcon,
  auditor: UserIcon,
  analyst: MailIcon
};

export function AdminConsole({ isOpen, onClose }: AdminConsoleProps) {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'analyst' as const
  });

  // Fetch users
  const fetchUsers = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  // Create user
  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchUsers();
        setFormData({ email: '', password: '', name: '', role: 'analyst' });
        setShowAddForm(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create user');
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userId: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  useEffect(() => {
    if (isOpen && user?.role === 'admin') {
      fetchUsers();
    }
  }, [isOpen, user, token]);

  if (!isOpen || user?.role !== 'admin') return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: 'white',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldIcon size={32} />
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Admin Console</h2>
                <p style={{ fontSize: '14px', opacity: 0.8, margin: '4px 0 0 0' }}>
                  Manage CBIC Authorities & Users
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>

        <div style={{ padding: '24px', maxHeight: 'calc(90vh - 120px)', overflow: 'auto' }}>
          {/* Add User Button */}
          <div style={{ 
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                User Management
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Add and manage CBIC officers and authorities
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <PlusIcon size={20} />
              Add User
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Add New CBIC Authority
              </h4>
              <form onSubmit={createUser} style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Rajesh Kumar"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                      required
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@cbic.gov.in"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Strong temporary password"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Role & Access Level
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    >
                      <option value="analyst">Analyst - View Only</option>
                      <option value="auditor">Auditor - Investigation</option>
                      <option value="admin">Admin - Full Access</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn--primary"
                    style={{ opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn btn--ghost"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            {users.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        User
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Role
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Created
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userRow) => {
                      const Icon = ROLE_ICONS[userRow.role];
                      return (
                        <tr key={userRow.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'var(--bg-elevated)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Icon size={20} color="var(--text-secondary)" />
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {userRow.name}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  {userRow.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: `${ROLE_COLORS[userRow.role]}20`,
                              color: ROLE_COLORS[userRow.role],
                              border: `1px solid ${ROLE_COLORS[userRow.role]}40`
                            }}>
                              {userRow.role.charAt(0).toUpperCase() + userRow.role.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CalendarIcon size={16} color="var(--text-secondary)" />
                              {new Date(userRow.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <PowerIcon size={16} color={userRow.is_active ? '#10B981' : '#EF4444'} />
                              <span style={{
                                fontSize: '14px',
                                color: userRow.is_active ? '#10B981' : '#EF4444'
                              }}>
                                {userRow.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            {userRow.id !== user?.id && (
                              <button
                                onClick={() => deleteUser(userRow.id)}
                                style={{
                                  padding: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                title="Deactivate User"
                              >
                                <TrashIcon size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <UserIcon size={64} color="var(--text-muted)" />
                <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No users found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
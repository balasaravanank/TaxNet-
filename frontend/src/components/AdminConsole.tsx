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
  admin: 'bg-amber-100 text-amber-800 border-amber-200',
  auditor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  analyst: 'bg-purple-100 text-purple-800 border-purple-200'
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldIcon size={32} />
              <div>
                <h2 className="text-2xl font-bold">Admin Console</h2>
                <p className="text-slate-300 text-sm">Manage CBIC Authorities & Users</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Add User Button */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">User Management</h3>
              <p className="text-gray-600 text-sm">Add and manage CBIC officers and authorities</p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <PlusIcon size={20} />
              Add User
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-4">Add New CBIC Authority</h4>
              <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Rajesh Kumar"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@cbic.gov.in"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Strong temporary password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role & Access Level
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="analyst">Analyst - View Only</option>
                    <option value="auditor">Auditor - Investigation</option>
                    <option value="admin">Admin - Full Access</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userRow) => {
                    const Icon = ROLE_ICONS[userRow.role];
                    return (
                      <tr key={userRow.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <Icon size={20} color="#6B7280" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {userRow.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {userRow.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[userRow.role]}`}>
                            {userRow.role.charAt(0).toUpperCase() + userRow.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <CalendarIcon size={16} color="#9CA3AF" />
                            {new Date(userRow.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PowerIcon size={16} color={userRow.is_active ? '#10B981' : '#EF4444'} />
                            <span className={`text-sm ${userRow.is_active ? 'text-green-700' : 'text-red-700'}`}>
                              {userRow.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {userRow.id !== user?.id && (
                            <button
                              onClick={() => deleteUser(userRow.id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded-lg hover:bg-red-50 transition-colors"
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
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <UserIcon size={64} color="#D1D5DB" />
              <p className="text-gray-500 mt-4">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
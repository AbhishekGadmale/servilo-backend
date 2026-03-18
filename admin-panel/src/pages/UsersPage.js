import React, { useState, useEffect } from 'react';
import { getAllUsersAPI, deleteUserAPI } from '../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await getAllUsersAPI();
      setUsers(res.data.users);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone!')) return;
    try {
      await deleteUserAPI(id);
      fetchUsers();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={styles.loading}>Loading users...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>👥 User Management</h2>

      <input
        style={styles.search}
        placeholder="🔍 Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user._id} style={styles.tableRow}>
                <td style={styles.td}>
                  <div style={styles.userCell}>
                    <div style={styles.avatar}>{user.name[0].toUpperCase()}</div>
                    <strong>{user.name}</strong>
                  </div>
                </td>
                <td style={styles.td}>{user.email}</td>
                <td style={styles.td}>{user.phone}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.roleBadge,
                    backgroundColor: user.role === 'provider' ? '#E8F5E9' : '#E3F2FD',
                    color: user.role === 'provider' ? '#2E7D32' : '#1565C0'
                  }}>
                    {user.role === 'provider' ? '🏪 Provider' : '👤 Customer'}
                  </span>
                </td>
                <td style={styles.td}>
                  {new Date(user.createdAt).toLocaleDateString('en-IN')}
                </td>
                <td style={styles.td}>
                  {user.role !== 'admin' && (
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(user._id)}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px' },
  loading: { padding: '32px', fontSize: '18px', color: '#666' },
  title: { fontSize: '24px', color: '#1A1A2E', marginBottom: '24px' },
  search: {
    width: '100%', padding: '12px 16px',
    borderRadius: '10px', border: '1px solid #E0E0E0',
    fontSize: '15px', marginBottom: '24px',
    boxSizing: 'border-box', outline: 'none'
  },
  tableContainer: { overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden'
  },
  tableHeader: { backgroundColor: '#F8F9FA' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' },
  tableRow: { borderBottom: '1px solid #F0F0F0' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  userCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    backgroundColor: '#6C63FF', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold', fontSize: '16px'
  },
  roleBadge: {
    padding: '4px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600'
  },
  deleteBtn: {
    padding: '6px 14px', backgroundColor: '#FFEBEE',
    color: '#C62828', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  }
};
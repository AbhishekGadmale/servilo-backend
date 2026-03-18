import React, { useState, useEffect } from 'react';
import { getAllShopsAdminAPI, approveShopAPI, deleteShopAPI } from '../services/api';

export default function ShopsPage() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { fetchShops(); }, []);

  const fetchShops = async () => {
    try {
      const res = await getAllShopsAdminAPI();
      setShops(res.data.shops);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this shop?')) return;
    try {
      await approveShopAPI(id);
      fetchShops();
      alert('✅ Shop approved successfully!');
    } catch (err) {
      alert('Failed to approve shop');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shop? This cannot be undone!')) return;
    try {
      await deleteShopAPI(id);
      fetchShops();
      alert('Shop deleted');
    } catch (err) {
      alert('Failed to delete shop');
    }
  };

  const filteredShops = shops.filter(shop =>
    filter === 'pending' ? !shop.isApproved : shop.isApproved
  );

  if (loading) return <div style={styles.loading}>Loading shops...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏪 Shop Management</h2>

      {/* Filter Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(filter === 'pending' ? styles.tabActive : {}) }}
          onClick={() => setFilter('pending')}
        >
          ⏳ Pending ({shops.filter(s => !s.isApproved).length})
        </button>
        <button
          style={{ ...styles.tab, ...(filter === 'approved' ? styles.tabActive : {}) }}
          onClick={() => setFilter('approved')}
        >
          ✅ Approved ({shops.filter(s => s.isApproved).length})
        </button>
      </div>

      {/* Shops Table */}
      {filteredShops.length === 0 ? (
        <div style={styles.empty}>
          {filter === 'pending' ? '🎉 No pending shops!' : '😕 No approved shops yet'}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Shop Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Owner</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Address</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShops.map(shop => (
                <tr key={shop._id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <strong>{shop.shopName}</strong>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>{shop.category}</span>
                  </td>
                  <td style={styles.td}>{shop.ownerId?.name}</td>
                  <td style={styles.td}>{shop.phone}</td>
                  <td style={styles.td}>{shop.address}</td>
                  <td style={styles.td}>
                    <div style={styles.actionBtns}>
                      {!shop.isApproved && (
                        <button
                          style={styles.approveBtn}
                          onClick={() => handleApprove(shop._id)}
                        >
                          ✅ Approve
                        </button>
                      )}
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDelete(shop._id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '32px' },
  loading: { padding: '32px', fontSize: '18px', color: '#666' },
  title: { fontSize: '24px', color: '#1A1A2E', marginBottom: '24px' },
  tabs: { display: 'flex', gap: '12px', marginBottom: '24px' },
  tab: {
    padding: '10px 20px', borderRadius: '10px',
    border: '2px solid #E0E0E0', backgroundColor: '#fff',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600'
  },
  tabActive: { borderColor: '#6C63FF', backgroundColor: '#6C63FF', color: '#fff' },
  empty: {
    textAlign: 'center', padding: '48px',
    fontSize: '18px', color: '#888',
    backgroundColor: '#fff', borderRadius: '16px'
  },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden' },
  tableHeader: { backgroundColor: '#F8F9FA' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' },
  tableRow: { borderBottom: '1px solid #F0F0F0' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  categoryBadge: {
    backgroundColor: '#F0EEFF', color: '#6C63FF',
    padding: '4px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600',
    textTransform: 'capitalize'
  },
  actionBtns: { display: 'flex', gap: '8px' },
  approveBtn: {
    padding: '6px 14px', backgroundColor: '#E8F5E9',
    color: '#2E7D32', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  },
  deleteBtn: {
    padding: '6px 14px', backgroundColor: '#FFEBEE',
    color: '#C62828', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  }
};
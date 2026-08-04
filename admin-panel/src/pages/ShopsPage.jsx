import React, { useState, useEffect } from 'react';
import { getAllShopsAdminAPI, approveShopAPI, deleteShopAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ShopsPage() {
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('pending');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { 
    setPage(1); 
    fetchShops(1, filter); 
  }, [filter]);

  useEffect(() => { fetchShops(page, filter); }, [page]);

  const fetchShops = async (p = page, f = filter) => {
    setError('');
    setLoading(true);
    try {
      const res = await getAllShopsAdminAPI(p, 10, f);
      setShops(res.data.shops);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load shops. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this shop?')) return;
    setActionLoading(id);
    try {
      await approveShopAPI(id);
      fetchShops(page, filter);
      toast.success('Shop approved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to approve shop');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shop? This cannot be undone!')) return;
    setActionLoading(id);
    try {
      await deleteShopAPI(id);
      fetchShops(page, filter);
      toast.success('Shop deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete shop');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch =
      (shop.shopName || '').toLowerCase().includes(search.toLowerCase()) ||
      (shop.ownerId?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  if (loading) return <div style={styles.loading}>Loading shops...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏪 Shop Management</h2>

      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button style={styles.retryBtn} onClick={fetchShops}>Retry</button>
        </div>
      )}

      <input
        style={styles.search}
        placeholder="🔍 Search by shop name or owner..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Filter Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(filter === 'pending' ? styles.tabActive : {}) }}
          onClick={() => setFilter('pending')}
        >
          ⏳ Pending {filter === 'pending' ? `(${totalCount})` : ''}
        </button>
        <button
          style={{ ...styles.tab, ...(filter === 'approved' ? styles.tabActive : {}) }}
          onClick={() => setFilter('approved')}
        >
          ✅ Approved {filter === 'approved' ? `(${totalCount})` : ''}
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
                          style={{ ...styles.approveBtn, opacity: actionLoading === shop._id ? 0.5 : 1 }}
                          onClick={() => handleApprove(shop._id)}
                          disabled={actionLoading === shop._id}
                        >
                          {actionLoading === shop._id ? '...' : '✅ Approve'}
                        </button>
                      )}
                      <button
                        style={{ ...styles.deleteBtn, opacity: actionLoading === shop._id ? 0.5 : 1 }}
                        onClick={() => handleDelete(shop._id)}
                        disabled={actionLoading === shop._id}
                      >
                        {actionLoading === shop._id ? '...' : '🗑️ Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={styles.paginationContainer}>
          <button 
            style={styles.pageBtn} 
            disabled={page === 1} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span style={styles.pageText}>Page {page} of {totalPages}</span>
          <button 
            style={styles.pageBtn} 
            disabled={page === totalPages} 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '32px' },
  loading: { padding: '32px', fontSize: '18px', color: '#666' },
  title: { fontSize: '24px', color: '#1A1A2E', marginBottom: '24px' },
  errorBanner: {
    backgroundColor: '#FFEBEE', color: '#C62828',
    padding: '12px 16px', borderRadius: '10px',
    marginBottom: '20px', fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  retryBtn: {
    padding: '6px 14px', backgroundColor: '#C62828',
    color: '#fff', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  },
  search: {
    width: '100%', padding: '12px 16px',
    borderRadius: '10px', border: '1px solid #E0E0E0',
    fontSize: '15px', marginBottom: '24px',
    boxSizing: 'border-box', outline: 'none'
  },
  tabs: { display: 'flex', gap: '12px', marginBottom: '24px' },
  tab: {
    padding: '10px 20px', borderRadius: '10px',
    border: '2px solid #E0E0E0', backgroundColor: '#fff',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600'
  },
  tabActive: { border: '2px solid #6C63FF', backgroundColor: '#6C63FF', color: '#fff' },
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
  },
  paginationContainer: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: '16px', marginTop: '24px'
  },
  pageBtn: {
    padding: '8px 16px', backgroundColor: '#6C63FF', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: '600', fontSize: '14px', disabled: { opacity: 0.5 }
  },
  pageText: { fontSize: '14px', fontWeight: '600', color: '#333' }
};
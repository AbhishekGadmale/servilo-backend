import React, { useState, useEffect } from 'react';
import { getAllReviewsAdminAPI, deleteReviewAPI } from '../services/api';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  useEffect(() => { fetchReviews(); }, []);

  const fetchReviews = async () => {
    setError('');
    try {
      const res = await getAllReviewsAdminAPI();
      setReviews(res.data.reviews);
    } catch (err) {
      setError(err.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review? This will also update the shop rating.')) return;
    try {
      await deleteReviewAPI(id);
      fetchReviews();
    } catch (err) {
      alert(err.message || 'Failed to delete review');
    }
  };

  const filteredReviews = reviews.filter(r =>
    r.comment?.toLowerCase().includes(search.toLowerCase()) ||
    r.userId?.name.toLowerCase().includes(search.toLowerCase()) ||
    r.shopId?.shopName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={styles.loading}>Loading reviews...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>⭐ Review Moderation</h2>

      <input
        style={styles.search}
        placeholder="🔍 Search reviews by comment, user, or shop..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={styles.th}>Shop</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Rating</th>
              <th style={styles.th}>Comment</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.map(r => (
              <tr key={r._id} style={styles.tr}>
                <td style={styles.td}><b>{r.shopId?.shopName}</b></td>
                <td style={styles.td}>
                  {r.userId?.name}<br/>
                  <small style={{ color: '#888' }}>{r.userId?.email}</small>
                </td>
                <td style={styles.td}>
                  <span style={styles.stars}>{'⭐'.repeat(r.rating)}</span>
                </td>
                <td style={{ ...styles.td, maxWidth: '300px' }}>{r.comment || '-'}</td>
                <td style={styles.td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(r._id)}>
                    🗑️ Delete
                  </button>
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
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '1px solid #E0E0E0', fontSize: '15px', marginBottom: '24px',
    boxSizing: 'border-box', outline: 'none'
  },
  errorBanner: {
    backgroundColor: '#FFEBEE', color: '#C62828',
    padding: '12px 16px', borderRadius: '10px', marginBottom: '24px'
  },
  tableWrapper: { backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  theadRow: { backgroundColor: '#F8F9FA', borderBottom: '1px solid #EEE' },
  th: { padding: '16px', fontSize: '14px', color: '#666', fontWeight: '600' },
  tr: { borderBottom: '1px solid #F8F8F8' },
  td: { padding: '16px', fontSize: '14px', color: '#333' },
  stars: { color: '#F59E0B' },
  deleteBtn: {
    padding: '6px 14px', backgroundColor: '#FFEBEE', color: '#C62828',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  }
};

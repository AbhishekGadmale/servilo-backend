import React, { useState, useEffect } from 'react';
import { getStatsAPI } from '../services/api';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatsAPI()
      .then(res => setStats(res.data.stats))
      .catch(err => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Customers', value: stats?.totalUsers || 0, emoji: '👤', color: '#6C63FF' },
    { label: 'Service Providers', value: stats?.totalProviders || 0, emoji: '🏪', color: '#2E7D32' },
    { label: 'Total Shops', value: stats?.totalShops || 0, emoji: '🏬', color: '#1565C0' },
    { label: 'Pending Approvals', value: stats?.pendingShops || 0, emoji: '⏳', color: '#E65100' },
    { label: 'Total Bookings', value: stats?.totalBookings || 0, emoji: '📅', color: '#6A1B9A' },
  ];

  if (loading) return <div style={styles.loading}>Loading stats...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📊 Dashboard Overview</h2>
      <p style={styles.subtitle}>Welcome back, Admin! Here's what's happening on Servilo.</p>

      <div style={styles.grid}>
        {cards.map((card, i) => (
          <div key={i} style={{ ...styles.card, borderTop: `4px solid ${card.color}` }}>
            <div style={styles.cardEmoji}>{card.emoji}</div>
            <div style={{ ...styles.cardValue, color: card.color }}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px' },
  loading: { padding: '32px', fontSize: '18px', color: '#666' },
  title: { fontSize: '24px', color: '#1A1A2E', marginBottom: '8px' },
  subtitle: { color: '#888', marginBottom: '32px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: '#fff', borderRadius: '16px',
    padding: '24px', textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  cardEmoji: { fontSize: '36px', marginBottom: '12px' },
  cardValue: { fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' },
  cardLabel: { fontSize: '14px', color: '#888' }
};
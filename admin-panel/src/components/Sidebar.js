import React from 'react';
import { FiGrid, FiShoppingBag, FiUsers, FiLogOut } from 'react-icons/fi';

export default function Sidebar({ activePage, setActivePage, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiGrid /> },
    { id: 'shops', label: 'Shop Approvals', icon: <FiShoppingBag /> },
    { id: 'users', label: 'Users', icon: <FiUsers /> },
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoText}>⚙️ Servilo</span>
        <span style={styles.adminBadge}>ADMIN</span>
      </div>

      <nav style={styles.nav}>
        {menuItems.map(item => (
          <button
            key={item.id}
            style={{
              ...styles.navItem,
              ...(activePage === item.id ? styles.navItemActive : {})
            }}
            onClick={() => setActivePage(item.id)}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <button style={styles.logoutBtn} onClick={onLogout}>
        <FiLogOut style={{ marginRight: '8px' }} />
        Logout
      </button>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '240px', minHeight: '100vh',
    backgroundColor: '#1A1A2E', display: 'flex',
    flexDirection: 'column', padding: '24px 16px'
  },
  logo: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', marginBottom: '32px'
  },
  logoText: { fontSize: '24px', color: '#fff', fontWeight: 'bold' },
  adminBadge: {
    fontSize: '10px', backgroundColor: '#6C63FF',
    color: '#fff', padding: '2px 8px',
    borderRadius: '10px', marginTop: '4px'
  },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  navItem: {
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', borderRadius: '10px',
    border: 'none', backgroundColor: 'transparent',
    color: '#aaa', fontSize: '15px', cursor: 'pointer',
    textAlign: 'left', gap: '10px'
  },
  navItemActive: { backgroundColor: '#6C63FF', color: '#fff' },
  navIcon: { fontSize: '18px' },
  logoutBtn: {
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', borderRadius: '10px',
    border: 'none', backgroundColor: '#FF5252',
    color: '#fff', fontSize: '15px',
    cursor: 'pointer', fontWeight: 'bold'
  }
};
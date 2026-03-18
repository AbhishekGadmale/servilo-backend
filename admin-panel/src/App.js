import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ShopsPage from './pages/ShopsPage';
import UsersPage from './pages/UsersPage';
import Sidebar from './components/Sidebar';

export default function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const savedUser = localStorage.getItem('adminUser');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setUser(null);
  };

  if (!user) return <LoginPage onLogin={setUser} />;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'shops': return <ShopsPage />;
      case 'users': return <UsersPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div style={styles.app}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
      />
      <main style={styles.main}>
        {renderPage()}
      </main>
    </div>
  );
}

const styles = {
  app: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8F9FA' },
  main: { flex: 1, overflowY: 'auto' }
};
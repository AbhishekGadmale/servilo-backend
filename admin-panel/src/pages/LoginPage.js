import React, { useState } from 'react';
import { loginAPI } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginAPI({ email, password });
      const { token, user } = res.data;
      if (user.role !== 'admin') {
        setError('Access denied. Admin only.');
        return;
      }
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>⚙️ Servilo</h1>
        <h2 style={styles.title}>Admin Panel</h2>
        <p style={styles.subtitle}>Sign in to manage the platform</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <input
            style={styles.input}
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0EEFF'
  },
  card: {
    backgroundColor: '#fff', padding: '40px',
    borderRadius: '20px', width: '400px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
  },
  logo: { textAlign: 'center', fontSize: '32px', marginBottom: '8px' },
  title: { textAlign: 'center', color: '#6C63FF', margin: '0 0 8px' },
  subtitle: { textAlign: 'center', color: '#888', marginBottom: '24px' },
  error: {
    backgroundColor: '#FFEBEE', color: '#C62828',
    padding: '10px', borderRadius: '8px', marginBottom: '16px',
    fontSize: '14px'
  },
  input: {
    width: '100%', padding: '12px',
    marginBottom: '16px', borderRadius: '10px',
    border: '1px solid #E0E0E0', fontSize: '15px',
    boxSizing: 'border-box', outline: 'none'
  },
  button: {
    width: '100%', padding: '14px',
    backgroundColor: '#6C63FF', color: '#fff',
    border: 'none', borderRadius: '10px',
    fontSize: '16px', fontWeight: 'bold',
    cursor: 'pointer'
  }
};
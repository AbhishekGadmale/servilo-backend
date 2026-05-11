import React, { useState } from 'react';
import { loginAPI, verifyOTPAPI, sendOTPAPI } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginAPI({ email, password });
      
      if (res.data.requireOtp) {
        setOtpSent(true);
        setError('Verification required. OTP sent to your email.');
        setLoading(false);
        return;
      }

      const { token, user } = res.data;
      if (user.role !== 'admin') {
        setError('Access denied. Admin only.');
        setLoading(false);
        return;
      }
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await verifyOTPAPI(email, otp);
      const { token, user } = res.data;
      
      if (user.role !== 'admin') {
        setError('Access denied. Admin only.');
        setLoading(false);
        return;
      }

      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the OTP.');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    try {
      await sendOTPAPI(email);
      setError('A new OTP has been sent to your email.');
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>⚙️ Servilo</h1>
        <h2 style={styles.title}>Admin Panel</h2>
        <p style={styles.subtitle}>
          {otpSent ? 'Enter the verification code' : 'Sign in to manage the platform'}
        </p>

        {error && <div style={{...styles.error, color: error.includes('sent') ? '#2E7D32' : '#C62828', backgroundColor: error.includes('sent') ? '#E8F5E9' : '#FFEBEE'}}>{error}</div>}

        {!otpSent ? (
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
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <input
              style={styles.input}
              type="text"
              placeholder="6-Digit OTP"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              maxLength={6}
              required
            />
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button 
              type="button" 
              style={{...styles.button, backgroundColor: 'transparent', color: '#6C63FF', marginTop: '10px'}}
              onClick={handleResendOTP}
            >
              Resend OTP
            </button>
            <button 
              type="button" 
              style={{...styles.button, backgroundColor: 'transparent', color: '#888', marginTop: '5px', fontSize: '13px'}}
              onClick={() => setOtpSent(false)}
            >
              Back to Login
            </button>
          </form>
        )}
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
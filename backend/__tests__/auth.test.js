const request = require('supertest');
const app = require('./testApp');
require('./setup');

describe('🔐 Auth API Tests', () => {

  const validUser = {
    name: 'Test Customer',
    email: 'customer@test.com',
    phone: '9999999999',
    password: 'password123',
    role: 'customer'
  };

  const validProvider = {
    name: 'Test Provider',
    email: 'provider@test.com',
    phone: '8888888888',
    password: 'password123',
    role: 'provider'
  };

  // ── SIGNUP TESTS ─────────────────────────────────────
  describe('POST /api/auth/signup', () => {

    test('✅ Should create a new customer account', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.role).toBe('customer');
      expect(res.body.user.password).toBeUndefined(); // password not exposed
    });

    test('✅ Should create a provider account', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validProvider);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('provider');
    });

    test('❌ Should reject missing name', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Name');
    });

    test('❌ Should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, email: 'notanemail' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('email');
    });

    test('❌ Should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('6 characters');
    });

    test('❌ Should reject short phone', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, phone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('10');
    });

    test('❌ Should reject duplicate email', async () => {
      await request(app).post('/api/auth/signup').send(validUser);
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already');
    });
  });

  // ── LOGIN TESTS ──────────────────────────────────────
  describe('POST /api/auth/login', () => {

    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser);
    });

    test('✅ Should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    test('❌ Should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: 'wrongpassword' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid');
    });

    test('❌ Should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('❌ Should reject missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });
  });

  // ── PROFILE TESTS ────────────────────────────────────
  describe('GET /api/auth/profile', () => {

    test('✅ Should get profile with valid token', async () => {
      const signup = await request(app).post('/api/auth/signup').send(validUser);
      const token = signup.body.token;

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(validUser.email);
    });

    test('❌ Should reject request without token', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
    });

    test('❌ Should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalidtoken123');
      expect(res.status).toBe(401);
    });
  });
});
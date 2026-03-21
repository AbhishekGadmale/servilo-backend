const request = require('supertest');
const app = require('./testApp');
require('./setup');

describe('🏪 Shop API Tests', () => {

  let customerToken, providerToken, adminToken, shopId;

  const customer = {
    name: 'Customer', email: 'customer@test.com',
    phone: '9999999999', password: 'password123', role: 'customer'
  };
  const provider = {
    name: 'Provider', email: 'provider@test.com',
    phone: '8888888888', password: 'password123', role: 'provider'
  };
  const admin = {
    name: 'Admin', email: 'admin@test.com',
    phone: '7777777777', password: 'password123', role: 'admin'
  };

  const shopData = {
    shopName: 'Test Barber Shop',
    category: 'barber',
    address: '123 Test Street, Pune',
    phone: '9876543210',
    openTime: '09:00',
    closeTime: '21:00',
    services: [{ name: 'Haircut', price: 100, duration: 30 }],
    coordinates: [73.8567, 18.5204]
  };

  beforeEach(async () => {
    const [c, p, a] = await Promise.all([
      request(app).post('/api/auth/signup').send(customer),
      request(app).post('/api/auth/signup').send(provider),
      request(app).post('/api/auth/signup').send(admin)
    ]);
    customerToken = c.body.token;
    providerToken = p.body.token;
    adminToken = a.body.token;
  });

  // ── CREATE SHOP ──────────────────────────────────────
  describe('POST /api/shops/create', () => {

    test('✅ Provider can create a shop', async () => {
      const res = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      expect(res.status).toBe(201);
      expect(res.body.shop.shopName).toBe(shopData.shopName);
      expect(res.body.shop.isApproved).toBe(false); // needs approval
      shopId = res.body.shop._id;
    });

    test('❌ Customer cannot create a shop', async () => {
      const res = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(shopData);

      expect(res.status).toBe(403);
    });

    test('❌ Cannot create shop without auth', async () => {
      const res = await request(app)
        .post('/api/shops/create')
        .send(shopData);

      expect(res.status).toBe(401);
    });
  });

  // ── GET SHOPS ────────────────────────────────────────
  describe('GET /api/shops', () => {

    test('✅ Returns only approved shops to customers', async () => {
      // Create shop (unapproved)
      const create = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      // Before approval — should NOT appear
      let res = await request(app).get('/api/shops');
      expect(res.body.shops.length).toBe(0);

      // Approve shop
      await request(app)
        .put(`/api/shops/${create.body.shop._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // After approval — should appear
      res = await request(app).get('/api/shops');
      expect(res.body.shops.length).toBe(1);
    });

    test('✅ Can filter shops by category', async () => {
      const create = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      await request(app)
        .put(`/api/shops/${create.body.shop._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/shops?category=barber');

      expect(res.body.shops.length).toBe(1);
      expect(res.body.shops[0].category).toBe('barber');

      const foodRes = await request(app)
        .get('/api/shops?category=food');
      expect(foodRes.body.shops.length).toBe(0);
    });
  });

  // ── ADMIN APPROVE ────────────────────────────────────
  describe('PUT /api/shops/:id/approve', () => {

    test('✅ Admin can approve a shop', async () => {
      const create = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      const res = await request(app)
        .put(`/api/shops/${create.body.shop._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.shop.isApproved).toBe(true);
    });

    test('❌ Customer cannot approve a shop', async () => {
      const create = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      const res = await request(app)
        .put(`/api/shops/${create.body.shop._id}/approve`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── ITEM MANAGEMENT ──────────────────────────────────
  describe('POST /api/shops/:id/items', () => {

    test('✅ Provider can add service to their shop', async () => {
      const create = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(shopData);

      const res = await request(app)
        .post(`/api/shops/${create.body.shop._id}/items`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ name: 'Beard Trim', price: 50, duration: 15 });

      expect(res.status).toBe(201);
      expect(res.body.item.name).toBe('Beard Trim');
    });
  });
});
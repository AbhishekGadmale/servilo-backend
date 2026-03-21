const request = require('supertest');
const app = require('./testApp');
require('./setup');

describe('🔧 Item Management Tests', () => {

  let providerToken, adminToken, shopId;

  beforeEach(async () => {
    const [p, a] = await Promise.all([
      request(app).post('/api/auth/signup').send({
        name: 'Provider', email: 'p@test.com',
        phone: '8888888888', password: 'password123', role: 'provider'
      }),
      request(app).post('/api/auth/signup').send({
        name: 'Admin', email: 'a@test.com',
        phone: '7777777777', password: 'password123', role: 'admin'
      })
    ]);
    providerToken = p.body.token;
    adminToken = a.body.token;

    const shop = await request(app)
      .post('/api/shops/create')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        shopName: 'Test Barber', category: 'barber',
        address: '123 Test St', phone: '9876543210',
        openTime: '09:00', closeTime: '21:00',
        services: [{ name: 'Haircut', price: 100, duration: 30 }],
        coordinates: [73.8567, 18.5204]
      });

    shopId = shop.body.shop._id;

    await request(app)
      .put(`/api/shops/${shopId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('✅ Can get items for a shop', async () => {
    const res = await request(app).get(`/api/shops/${shopId}/items`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBe(1);
  });

  test('✅ Provider can add a new service', async () => {
    const res = await request(app)
      .post(`/api/shops/${shopId}/items`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Beard Trim', price: 50, duration: 15 });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Beard Trim');
    expect(res.body.item.price).toBe(50);
  });

  test('✅ Provider can update an item', async () => {
    const items = await request(app).get(`/api/shops/${shopId}/items`);
    const itemId = items.body.items[0]._id;

    const res = await request(app)
      .put(`/api/shops/${shopId}/items/${itemId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Premium Haircut', price: 150, duration: 45 });

    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe('Premium Haircut');
    expect(res.body.item.price).toBe(150);
  });

  test('✅ Provider can delete an item', async () => {
    // Add an item first
    const added = await request(app)
      .post(`/api/shops/${shopId}/items`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Temp Service', price: 30, duration: 20 });

    const res = await request(app)
      .delete(`/api/shops/${shopId}/items/${added.body.item._id}`)
      .set('Authorization', `Bearer ${providerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify it's gone
    const items = await request(app).get(`/api/shops/${shopId}/items`);
    const names = items.body.items.map(i => i.name);
    expect(names).not.toContain('Temp Service');
  });

  test('❌ Non-owner cannot add items', async () => {
    const other = await request(app).post('/api/auth/signup').send({
      name: 'Other', email: 'other@test.com',
      phone: '6666666666', password: 'password123', role: 'provider'
    });

    const res = await request(app)
      .post(`/api/shops/${shopId}/items`)
      .set('Authorization', `Bearer ${other.body.token}`)
      .send({ name: 'Hack Service', price: 10, duration: 5 });

    expect(res.status).toBe(403);
  });
});
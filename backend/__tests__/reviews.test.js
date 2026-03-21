const request = require('supertest');
const app = require('./testApp');
require('./setup');

describe('⭐ Review API Tests', () => {

  let customerToken, providerToken, adminToken, shopId;

  beforeEach(async () => {
    const [c, p, a] = await Promise.all([
      request(app).post('/api/auth/signup').send({
        name: 'Customer', email: 'c@test.com',
        phone: '9999999999', password: 'password123', role: 'customer'
      }),
      request(app).post('/api/auth/signup').send({
        name: 'Provider', email: 'p@test.com',
        phone: '8888888888', password: 'password123', role: 'provider'
      }),
      request(app).post('/api/auth/signup').send({
        name: 'Admin', email: 'a@test.com',
        phone: '7777777777', password: 'password123', role: 'admin'
      })
    ]);
    customerToken = c.body.token;
    providerToken = p.body.token;
    adminToken = a.body.token;

    const shop = await request(app)
      .post('/api/shops/create')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        shopName: 'Test Shop', category: 'barber',
        address: '123 Test St', phone: '9876543210',
        openTime: '09:00', closeTime: '21:00',
        services: [{ name: 'Haircut', price: 100, duration: 30 }],
        coordinates: [73.8567, 18.5204]
      });

    await request(app)
      .put(`/api/shops/${shop.body.shop._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    shopId = shop.body.shop._id;
  });

  test('✅ Customer can add a review', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 5, comment: 'Excellent service!' });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
  });

  test('✅ Shop rating updates after review', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 4, comment: 'Good!' });

    const shop = await request(app).get(`/api/shops/${shopId}`);
    expect(parseFloat(shop.body.shop.rating)).toBe(4);
    expect(shop.body.shop.totalReviews).toBe(1);
  });

  test('❌ Cannot review same shop twice', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 5, comment: 'Great!' });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 3, comment: 'OK' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already reviewed');
  });

  test('✅ Anyone can view shop reviews', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 5, comment: 'Amazing!' });

    const res = await request(app).get(`/api/reviews/${shopId}`);
    expect(res.status).toBe(200);
    expect(res.body.reviews.length).toBe(1);
    expect(res.body.reviews[0].comment).toBe('Amazing!');
  });

  test('❌ Rating must be between 1-5', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shopId, rating: 6, comment: 'Test' });

    expect(res.status).toBe(500); // Mongoose validation error
  });
});
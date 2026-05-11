const request = require('supertest');
const app = require('./testApp');
const { signUpAndVerify } = require('./testUtils');
const Shop = require('../models/Shop');
require('./setup');

describe('🛡️ Booking Queue Fix Verification', () => {

  let customerToken, providerToken, adminToken;
  let shopId;

  beforeEach(async () => {
    // Create users
    const [c, p, a] = await Promise.all([
      signUpAndVerify(app, {
        name: 'Customer', email: 'customer@test.com',
        phone: '9999999999', password: 'password123', role: 'customer'
      }),
      signUpAndVerify(app, {
        name: 'Provider', email: 'provider@test.com',
        phone: '8888888888', password: 'password123', role: 'provider'
      }),
      signUpAndVerify(app, {
        name: 'Admin', email: 'admin@test.com',
        phone: '7777777777', password: 'password123', role: 'admin'
      })
    ]);
    customerToken = c.token;
    providerToken = p.token;
    adminToken = a.token;

    // Create and approve shop
    const shopRes = await request(app)
      .post('/api/shops/create')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        shopName: 'Queue Test Shop',
        category: 'barber',
        address: '123 Test St',
        phone: '9876543210',
        openTime: '09:00',
        closeTime: '21:00',
        services: [{ name: 'Haircut', price: 100, duration: 30 }],
        coordinates: [73.8567, 18.5204]
      });

    shopId = shopRes.body.shop._id;

    await request(app)
      .put(`/api/shops/${shopId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('✅ Should not decrement queue twice when updating status multiple times to terminal states', async () => {
    // 1. Create a booking
    const bookingRes = await request(app)
      .post('/api/bookings/book')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shopId,
        serviceType: 'barber',
        bookingType: 'queue',
        barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
      });
    
    const bookingId = bookingRes.body.booking._id;

    // Verify initial queue is 1
    let shop = await Shop.findById(shopId);
    expect(shop.currentQueue).toBe(1);

    // 2. Transition to 'confirmed' then 'completed' (terminal state)
    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'confirmed' });

    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'completed' });

    // Verify queue is 0
    shop = await Shop.findById(shopId);
    expect(shop.currentQueue).toBe(0);

    // 3. Transition to 'rejected' (another terminal state) - this should fail now because it's already completed
    const rejectRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'rejected' });

    expect(rejectRes.status).toBe(400);

    // Verify queue is STILL 0
    shop = await Shop.findById(shopId);
    expect(shop.currentQueue).toBe(0);
  });

  test('❌ Should prevent cancelling an already completed/cancelled booking', async () => {
    // 1. Create a booking
    const bookingRes = await request(app)
      .post('/api/bookings/book')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shopId,
        serviceType: 'barber',
        bookingType: 'queue',
        barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
      });
    
    const bookingId = bookingRes.body.booking._id;

    // 2. Transition to 'confirmed' then 'completed'
    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'confirmed' });

    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'completed' });

    // 3. Try to cancel
    const cancelRes = await request(app)
      .put(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.message).toContain('already completed');

    // 4. Try to cancel again if it was already cancelled
    const bookingRes2 = await request(app)
      .post('/api/bookings/book')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shopId,
        serviceType: 'barber',
        bookingType: 'queue',
        barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
      });
    const bookingId2 = bookingRes2.body.booking._id;

    await request(app)
      .put(`/api/bookings/${bookingId2}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    const cancelRes2 = await request(app)
      .put(`/api/bookings/${bookingId2}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes2.status).toBe(400);
    expect(cancelRes2.body.message).toContain('already cancelled');
  });

});
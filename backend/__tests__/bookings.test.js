const request = require('supertest');
const app = require('./testApp');
require('./setup');

describe('📅 Booking API Tests', () => {

  let customerToken, providerToken, adminToken;
  let shopId, bookingId;

  beforeEach(async () => {
    // Create users
    const [c, p, a] = await Promise.all([
      request(app).post('/api/auth/signup').send({
        name: 'Customer', email: 'customer@test.com',
        phone: '9999999999', password: 'password123', role: 'customer'
      }),
      request(app).post('/api/auth/signup').send({
        name: 'Provider', email: 'provider@test.com',
        phone: '8888888888', password: 'password123', role: 'provider'
      }),
      request(app).post('/api/auth/signup').send({
        name: 'Admin', email: 'admin@test.com',
        phone: '7777777777', password: 'password123', role: 'admin'
      })
    ]);
    customerToken = c.body.token;
    providerToken = p.body.token;
    adminToken = a.body.token;

    // Create and approve shop
    const shop = await request(app)
      .post('/api/shops/create')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        shopName: 'Test Barber',
        category: 'barber',
        address: '123 Test St',
        phone: '9876543210',
        openTime: '09:00',
        closeTime: '21:00',
        services: [{ name: 'Haircut', price: 100, duration: 30 }],
        coordinates: [73.8567, 18.5204]
      });

    shopId = shop.body.shop._id;

    await request(app)
      .put(`/api/shops/${shopId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  // ── CREATE BOOKING ───────────────────────────────────
  describe('POST /api/bookings/book', () => {

    test('✅ Customer can create a barber queue booking', async () => {
      const res = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId,
          serviceType: 'barber',
          bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.booking.serviceType).toBe('barber');
      expect(res.body.booking.barberData.queueNumber).toBe(1);
      bookingId = res.body.booking._id;
    });

    test('✅ Queue number increments correctly', async () => {
      await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      // Create second user
      const user2 = await request(app).post('/api/auth/signup').send({
        name: 'Customer2', email: 'customer2@test.com',
        phone: '6666666666', password: 'password123', role: 'customer'
      });

      const res = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${user2.body.token}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      expect(res.body.booking.barberData.queueNumber).toBe(2);
    });

    test('✅ Customer can book for a friend', async () => {
      const res = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 },
          isForFriend: true,
          friendName: 'Rahul',
          friendPhone: '5555555555'
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.isForFriend).toBe(true);
      expect(res.body.booking.friendName).toBe('Rahul');
    });

    test('❌ Cannot book if shop is closed', async () => {
      // Close the shop
      await request(app)
        .put(`/api/shops/${shopId}/toggle-status`)
        .set('Authorization', `Bearer ${providerToken}`);

      const res = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('closed');
    });

    test('❌ Cannot have more than 2 active bookings', async () => {
      // Create 2 bookings first
      const shop2 = await request(app)
        .post('/api/shops/create')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          shopName: 'Test Shop 2', category: 'food',
          address: '456 Test St', phone: '9876543211',
          openTime: '09:00', closeTime: '21:00',
          menuItems: [{ name: 'Vada Pav', price: 20, inStock: true }],
          coordinates: [73.8567, 18.5204]
        });

      await request(app)
        .put(`/api/shops/${shop2.body.shop._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId: shop2.body.shop._id,
          serviceType: 'food', bookingType: 'order',
          orderData: { items: [{ name: 'Vada Pav', price: 20, quantity: 2 }], totalAmount: 40 }
        });

      // Third booking should fail
      const res = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('2 active bookings');
    });

    test('❌ Cannot book without authentication', async () => {
      const res = await request(app)
        .post('/api/bookings/book')
        .send({ shopId, serviceType: 'barber', bookingType: 'queue' });

      expect(res.status).toBe(401);
    });
  });

  // ── GET BOOKINGS ─────────────────────────────────────
  describe('GET /api/bookings/my-bookings', () => {

    test('✅ Customer can see their bookings', async () => {
      await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      const res = await request(app)
        .get('/api/bookings/my-bookings')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings.length).toBe(1);
      expect(res.body.bookings[0].serviceType).toBe('barber');
    });
  });

  // ── CANCEL BOOKING ───────────────────────────────────
  describe('PUT /api/bookings/:id/cancel', () => {

    test('✅ Customer can cancel their own booking', async () => {
      const booking = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      const res = await request(app)
        .put(`/api/bookings/${booking.body.booking._id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('cancelled');
    });
  });

  // ── UPDATE STATUS ────────────────────────────────────
  describe('PUT /api/bookings/:id/status', () => {

    test('✅ Provider can confirm a booking', async () => {
      const booking = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      const res = await request(app)
        .put(`/api/bookings/${booking.body.booking._id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('confirmed');
    });

    test('❌ Customer cannot update booking status', async () => {
      const booking = await request(app)
        .post('/api/bookings/book')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId, serviceType: 'barber', bookingType: 'queue',
          barberData: { serviceName: 'Haircut', price: 100, duration: 30 }
        });

      const res = await request(app)
        .put(`/api/bookings/${booking.body.booking._id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(403);
    });
  });
});
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Mock Email Service
global.OTP_MAP = {}; // Map to store OTPs by email for testing
jest.mock('../utils/email', () => ({
  sendOTPEmail: jest.fn((email, otp) => {
    global.OTP_MAP[email] = otp; 
    global.LAST_OTP = otp; // Keep for backward compatibility if needed
    return Promise.resolve({ success: true });
  })
}));

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  console.log('✅ Test DB connected');
});

// Clear all collections between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Close connection after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('✅ Test DB disconnected');
});
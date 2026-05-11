const request = require('supertest');

/**
 * Helper to signup a user and verify their OTP in one go.
 */
const signUpAndVerify = async (app, userData) => {
  // 1. Signup
  const res = await request(app)
    .post('/api/auth/signup')
    .send(userData);

  if (res.status !== 201) {
    throw new Error(`Signup failed: ${JSON.stringify(res.body)}`);
  }

  // 2. Verify OTP (using the mock-captured global OTP_MAP)
  const otp = global.OTP_MAP[userData.email] || global.LAST_OTP;
  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: userData.email, otp });

  if (verifyRes.status !== 200) {
    throw new Error(`OTP Verification failed: ${JSON.stringify(verifyRes.body)}`);
  }

  return {
    token: verifyRes.body.token,
    user: verifyRes.body.user,
    response: verifyRes
  };
};

module.exports = { signUpAndVerify };

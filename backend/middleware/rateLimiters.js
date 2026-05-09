/**
 * rateLimiters.js
 *
 * Centralised rate-limiter definitions.
 * Import from here instead of server.js to avoid circular dependencies.
 *
 * Strategy:
 *  - globalLimiter  → applied to ALL /api routes (generous, prevents DoS)
 *  - loginLimiter   → applied ONLY to POST /api/auth/login (counts failures)
 *  - signupLimiter  → applied ONLY to POST /api/auth/signup (prevents mass accounts)
 *
 * Admin dashboard routes (GET /api/auth/admin/*, GET /api/shops/admin/*)
 * are covered only by globalLimiter — never blocked by auth-attempt limits.
 */

const rateLimit = require('express-rate-limit');

// Helper to skip rate limiting in test environment
const isTest = process.env.NODE_ENV === 'test';

// ── Global limiter ───────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,                   // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: 'Too many requests. Please try again in 15 minutes.'
  }
});

// ── Login limiter ────────────────────────────────────────
// Only counts FAILED attempts (skipSuccessfulRequests: true).
// A legitimate admin logging in successfully won't consume the quota.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 failed attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isTest,
  handler: (req, res) => {
    const resetMs  = req.rateLimit.resetTime instanceof Date
      ? req.rateLimit.resetTime.getTime()
      : req.rateLimit.resetTime;
    const retryAfterSec = Math.max(0, Math.ceil((resetMs - Date.now()) / 1000));
    const retryAfterMin = Math.ceil(retryAfterSec / 60);
    res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Please try again in ${retryAfterMin} minute(s).`,
      retryAfterSeconds: retryAfterSec
    });
  }
});

// ── Signup limiter ───────────────────────────────────────
// Prevents mass account creation from a single IP.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 accounts per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (req, res) => {
    const resetMs  = req.rateLimit.resetTime instanceof Date
      ? req.rateLimit.resetTime.getTime()
      : req.rateLimit.resetTime;
    const retryAfterSec = Math.max(0, Math.ceil((resetMs - Date.now()) / 1000));
    const retryAfterMin = Math.ceil(retryAfterSec / 60);
    res.status(429).json({
      success: false,
      message: `Too many accounts created from this IP. Please try again in ${retryAfterMin} minute(s).`,
      retryAfterSeconds: retryAfterSec
    });
  }
});

// ── OTP limiter ──────────────────────────────────────────
// Prevents OTP spam (max 5 OTPs per IP per 15 minutes)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again in 15 minutes.'
  }
});

module.exports = { globalLimiter, loginLimiter, signupLimiter, otpLimiter };

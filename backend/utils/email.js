const nodemailer = require('nodemailer');

const sendOTPEmail = async (email, otp) => {
  try {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn('⚠️ EMAIL_USER or EMAIL_PASS is not configured in .env file.');
      // In development, we log the OTP to the console so we can still test without credentials
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV ONLY] OTP for ${email}: ${otp}`);
        return { mock: true, message: 'Email skipped (missing credentials)' };
      }
      throw new Error('Email service configuration missing.');
    }

    // Configure the Nodemailer transporter for Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    const mailOptions = {
      from: `"Servilo" <${user}>`,
      to: email,
      subject: 'Your Servilo Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6C63FF; text-align: center;">Welcome to Servilo</h2>
          <p>Hello,</p>
          <p>Use the following code to sign in to your account. This code will expire in 10 minutes.</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1A1A2E;">${otp}</span>
          </div>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Servilo App. All rights reserved.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw error;
  }
};

module.exports = { sendOTPEmail };

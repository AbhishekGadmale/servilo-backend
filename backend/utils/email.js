const { Resend } = require('resend');

const sendOTPEmail = async (email, otp) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.error('❌ RESEND_API_KEY is not configured in .env file.');
      // In development, we might want to log the OTP to console so we can still test
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV ONLY] OTP for ${email}: ${otp}`);
        return { mock: true, message: 'Email skipped (missing API key)' };
      }
      throw new Error('Email service configuration missing.');
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: 'Servilo <onboarding@resend.dev>', // You can update this to your domain later
      to: [email],
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
    });

    if (error) {
      console.error('Resend Error:', error);
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    return data;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw error;
  }
};

module.exports = { sendOTPEmail };

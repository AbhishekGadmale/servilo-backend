require('dotenv').config();
const { sendOTPEmail } = require('./utils/email');

const testEmail = async () => {
  const recipient = process.env.EMAIL_USER || 'agadmale335@gmail.com'; 
  const otp = '123456';
  
  console.log(`Attempting to send test OTP ${otp} to ${recipient}...`);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Error: EMAIL_USER or EMAIL_PASS not found in .env file.');
    console.log('Please update your backend/.env file first.');
    return;
  }

  try {
    const result = await sendOTPEmail(recipient, otp);
    console.log('✅ Success! Email sent.');
    console.log('Result ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email.');
    console.error('Error Details:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if EMAIL_USER and EMAIL_PASS are set correctly in backend/.env');
    console.log('2. Ensure you are using a 16-character "App Password", not your regular Gmail password.');
    console.log('3. Ensure 2-Step Verification is enabled on your Google account.');
  }
};

testEmail();

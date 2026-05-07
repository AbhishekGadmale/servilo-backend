const { sendPushNotification } = require('./utils/notifications');
const dotenv = require('dotenv');
dotenv.config();

async function testNotification() {
  const args = process.argv.slice(2);
  let testToken = args[0];

  if (!testToken) {
    console.log('⚠️ No token provided. Using dummy token for format testing.');
    testToken = 'ExponentPushToken[dummy-token-for-testing]';
  } else {
    console.log(`🚀 Using provided token: ${testToken}`);
  }

  console.log('Testing notification system...');
  
  await sendPushNotification(
    testToken,
    '🧪 Test Notification',
    'This is a test notification from the Servilo backend.',
    { test: true }
  );
  
  console.log('\n--- Troubleshooting Tips ---');
  console.log('1. If you see "Invalid push token format", ensure your token starts with "ExpoPushToken[" or "ExponentPushToken[".');
  console.log('2. If you see "DeviceNotRegistered", the token is no longer valid. Re-open the mobile app to refresh it.');
  console.log('3. If the app is built with EAS, ensure you have set EXPO_ACCESS_TOKEN in your .env file on Render.');
  console.log('4. Ensure the mobile app has "bookings" notification channel set up (handled in src/utils/notifications.js).');
}

testNotification();

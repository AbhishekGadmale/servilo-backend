const { sendPushNotification } = require('./utils/notifications');

async function testNotification() {
  console.log('Testing notification system...');
  // This is a test token that Expo uses for documentation examples or just a dummy one
  // Real tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  const testToken = 'ExponentPushToken[dummy-token-for-testing]';
  
  await sendPushNotification(
    testToken,
    '🧪 Test Notification',
    'This is a test notification from the Servilo backend.'
  );
  
  console.log('Test completed. Check logs for results.');
}

testNotification();

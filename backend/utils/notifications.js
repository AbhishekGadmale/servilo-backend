const User = require('../models/User');
const fetch = require('node-fetch');

/**
 * Expo Push Notification Sender
 */
const sendPushNotification = async (token, title, body, data = {}) => {
  if (!token) {
    console.log('⚠️ No push token provided');
    return;
  }

  if (!token.startsWith('ExponentPushToken') && !token.startsWith('ExpoPushToken')) {
    console.log('⚠️ Invalid push token format:', token.substring(0, 20));
    return;
  }

  try {
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'bookings',
      badge: 1
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    const result = await response.json();

    if (result?.data?.status === 'error') {
      console.log('❌ Push notification error:', result.data.message);
    } else {
      console.log('✅ Push notification sent:', title);
    }
  } catch (error) {
    console.log('❌ Push send failed:', error.message);
  }
};

/**
 * Notify a regular user (customer)
 */
const notifyUser = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('expoPushToken notificationsEnabled');
    if (!user) { console.log('User not found for notification'); return; }
    if (!user.notificationsEnabled) { console.log('Notifications disabled for user'); return; }
    if (!user.expoPushToken) { console.log('No push token for user:', userId); return; }
    await sendPushNotification(user.expoPushToken, title, body, data);
  } catch (error) {
    console.log('notifyUser error:', error.message);
  }
};

/**
 * Notify a provider (shop owner)
 */
const notifyProvider = async (ownerId, title, body, data = {}) => {
  try {
    const owner = await User.findById(ownerId).select('expoPushToken notificationsEnabled');
    if (!owner) { console.log('Owner not found for notification'); return; }
    if (!owner.notificationsEnabled) { console.log('Notifications disabled for owner'); return; }
    if (!owner.expoPushToken) { console.log('No push token for owner:', ownerId); return; }
    await sendPushNotification(owner.expoPushToken, title, body, data);
  } catch (error) {
    console.log('notifyProvider error:', error.message);
  }
};

module.exports = {
  sendPushNotification,
  notifyUser,
  notifyProvider
};

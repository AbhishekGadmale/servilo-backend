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

    // Include Project ID if available (often required for EAS)
    if (process.env.EXPO_PROJECT_ID) {
      message.projectId = process.env.EXPO_PROJECT_ID;
    }

    const headers = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    // Use Expo Access Token if available (required for some EAS projects)
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });

    const result = await response.json();

    // Handle global errors from Expo
    if (result.errors) {
      console.log('❌ Expo API errors:', JSON.stringify(result.errors));
      return;
    }

    // Expo returns an array in 'data' for each message sent
    if (result.data) {
      const dataArray = Array.isArray(result.data) ? result.data : [result.data];
      
      dataArray.forEach((receipt, index) => {
        if (receipt.status === 'error') {
          console.log(`❌ Push delivery error: ${receipt.message}`);
          if (receipt.details) {
            console.log(`   Details: ${JSON.stringify(receipt.details)}`);
          }
        } else {
          console.log(`✅ Push notification sent: ${title}`);
        }
      });
    }
  } catch (error) {
    console.log('❌ Push send failed:', error.message);
  }
};

/**
 * Private helper to notify any user by ID
 */
const _notifyUserById = async (userId, title, body, data = {}, roleLabel = 'user') => {
  try {
    const user = await User.findById(userId).select('expoPushToken notificationsEnabled name');
    if (!user) {
      console.log(`⚠️ ${roleLabel} not found for notification:`, userId);
      return;
    }
    if (!user.notificationsEnabled) {
      console.log(`🔇 Notifications disabled for ${roleLabel}:`, user.name);
      return;
    }
    if (!user.expoPushToken) {
      console.log(`🚫 No push token for ${roleLabel}:`, user.name);
      return;
    }
    await sendPushNotification(user.expoPushToken, title, body, data);
  } catch (error) {
    console.log(`❌ _notifyUserById error (${roleLabel}):`, error.message);
  }
};

/**
 * Notify a regular user (customer)
 */
const notifyUser = (userId, title, body, data = {}) => 
  _notifyUserById(userId, title, body, data, 'customer');

/**
 * Notify a provider (shop owner)
 */
const notifyProvider = (ownerId, title, body, data = {}) => 
  _notifyUserById(ownerId, title, body, data, 'provider');

module.exports = {
  sendPushNotification,
  notifyUser,
  notifyProvider
};

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { C } from '../shared/theme';

export async function configureReminderNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('payment-reminders', {
      name: 'Payment reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: C.scarlet,
    });
  }
}

export async function schedulePaymentReminder(title: string, amount: number, due: Date) {
  if (Platform.OS === 'web') return undefined;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Payment due: ${title}`,
      body: `${amount.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })} is due today. Open Finance Bro when you are ready to pay.`,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'payment-reminders' } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due },
  });
}

export async function cancelPaymentReminder(notificationId?: string) {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}

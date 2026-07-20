package com.karachinaseeb.knb_customer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // High-importance notification channel for order / refund / offer pushes.
        // Creating it here (idempotent — Android ignores re-creation) lets FCM
        // messages that reference channel_id "knb_orders" show heads-up banners
        // and appear on the lock screen. Without an app-created channel, FCM
        // auto-displays on its default channel with DEFAULT importance: tray-only,
        // no banner, and hidden from the lock screen on many devices (MIUI).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "knb_orders",
                "Order updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Order status, refunds and offers"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }
}

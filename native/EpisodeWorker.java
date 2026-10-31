package com.wayanime.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

public class EpisodeWorker extends Worker {

    private static final String TAG = "WA-EpisodeWorker";
    private static final String CHANNEL_ID = "wa_episodes";

    public EpisodeWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences("wa_notify", Context.MODE_PRIVATE);
            String animeId = prefs.getString("animeId", "");
            String title = prefs.getString("title", "");
            String lastEp = prefs.getString("lastEp", "");

            if (animeId.isEmpty()) {
                Log.d(TAG, "No anime being watched");
                return Result.success();
            }

            // Simple check - in real app would query API
            Log.d(TAG, "Checking episodes for " + title + " last=" + lastEp);
            // Placeholder: could scrape or call API here

            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "work failed", e);
            return Result.retry();
        }
    }

    private void showNotification(String title, String body) {
        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "حلقات جديدة", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(channel);
        }

        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_info_details)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pi)
                .setAutoCancel(true);

        nm.notify(1001, builder.build());
    }
}

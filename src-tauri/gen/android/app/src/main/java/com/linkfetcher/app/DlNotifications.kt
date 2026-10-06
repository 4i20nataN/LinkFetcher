// Notificações nativas de download (extraído do YtDlpPlugin.kt).
// O WebView não tem Notification API e o plugin JS não cobre progresso:
// o próprio plugin emite (throttle já feito pelo % inteiro). Toque abre o
// arquivo (concluído) ou o app (andamento). Best-effort com try/catch.
// Usa SÓ a Activity — sem estado do plugin.
package com.linkfetcher.app

import android.app.Activity
import android.content.Intent
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File

internal class DlNotifications(private val activity: Activity) {

    private val dlChannelId = "linkfetcher_downloads"

    private fun dlNotifyId(processId: String): Int =
        processId.hashCode().let { if (it == Int.MIN_VALUE) 0 else kotlin.math.abs(it) }

    private fun notificationManager(): android.app.NotificationManager? = try {
        activity.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
    } catch (_: Exception) { null }

    private fun ensureDlChannel() {
        if (android.os.Build.VERSION.SDK_INT < 26) return
        try {
            val nm = notificationManager() ?: return
            if (nm.getNotificationChannel(dlChannelId) == null) {
                nm.createNotificationChannel(
                    android.app.NotificationChannel(
                        dlChannelId, "Downloads",
                        android.app.NotificationManager.IMPORTANCE_DEFAULT
                    )
                )
            }
        } catch (_: Exception) { }
    }

    private fun appLaunchPending(): android.app.PendingIntent? {
        // Corpo em bloco (não expressão): `return` antecipado não é
        // permitido em expression body.
        return try {
            val launch = activity.packageManager.getLaunchIntentForPackage(activity.packageName) ?: return null
            android.app.PendingIntent.getActivity(
                activity, 0, launch,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
        } catch (_: Exception) { null }
    }

    private fun fileViewPending(file: File): android.app.PendingIntent? {
        return try {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val mime = MimeTypeMap.getSingleton()
                .getMimeTypeFromExtension(file.extension.lowercase()) ?: "*/*"
            val view = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(view, file.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            android.app.PendingIntent.getActivity(
                activity, file.absolutePath.hashCode(), chooser,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
        } catch (_: Exception) { null }
    }

    fun showDlProgress(processId: String, title: String, percent: Int) {
        try {
            ensureDlChannel()
            val nm = notificationManager() ?: return
            val n = androidx.core.app.NotificationCompat.Builder(activity, dlChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title.ifBlank { "Baixando…" })
                .setContentText("$percent%")
                .setProgress(100, percent.coerceIn(0, 100), false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(appLaunchPending())
                .build()
            nm.notify(dlNotifyId(processId), n)
        } catch (_: Exception) { }
    }

    fun showDlProcessing(processId: String, title: String) {
        try {
            ensureDlChannel()
            val nm = notificationManager() ?: return
            val n = androidx.core.app.NotificationCompat.Builder(activity, dlChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title.ifBlank { "Baixando…" })
                .setContentText("Processando…")
                .setProgress(0, 0, true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(appLaunchPending())
                .build()
            nm.notify(dlNotifyId(processId), n)
        } catch (_: Exception) { }
    }

    fun showDlPaused(processId: String, title: String) {
        try {
            ensureDlChannel()
            val nm = notificationManager() ?: return
            val n = androidx.core.app.NotificationCompat.Builder(activity, dlChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title.ifBlank { "Download" })
                .setContentText("Pausado")
                .setOngoing(false)
                .setOnlyAlertOnce(true)
                .setContentIntent(appLaunchPending())
                .build()
            nm.notify(dlNotifyId(processId), n)
        } catch (_: Exception) { }
    }

    fun showDlComplete(processId: String, title: String, file: File) {
        try {
            ensureDlChannel()
            val nm = notificationManager() ?: return
            val n = androidx.core.app.NotificationCompat.Builder(activity, dlChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Download concluído")
                .setContentText(title.ifBlank { file.name })
                .setOngoing(false)
                .setAutoCancel(true)
                .setContentIntent(fileViewPending(file) ?: appLaunchPending())
                .build()
            nm.notify(dlNotifyId(processId), n)
        } catch (_: Exception) { }
    }

    fun showDlError(processId: String, title: String, msg: String) {
        try {
            ensureDlChannel()
            val nm = notificationManager() ?: return
            val n = androidx.core.app.NotificationCompat.Builder(activity, dlChannelId)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle("Falha no download")
                .setContentText((title.ifBlank { "Download" } + " · " + msg).take(140))
                .setOngoing(false)
                .setAutoCancel(true)
                .setContentIntent(appLaunchPending())
                .build()
            nm.notify(dlNotifyId(processId), n)
        } catch (_: Exception) { }
    }

    fun cancelDlNotification(processId: String) {
        try { notificationManager()?.cancel(dlNotifyId(processId)) } catch (_: Exception) { }
    }
}

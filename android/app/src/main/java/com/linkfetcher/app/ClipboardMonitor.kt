package com.linkfetcher.app

import android.content.ClipboardManager
import android.content.ClipData
import android.content.Context
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.ActivityCallback

@CapacitorPlugin(name = "ClipboardMonitor")
class ClipboardMonitor : Plugin() {

    private var clipboardManager: ClipboardManager? = null
    private var isMonitoring = false
    private var lastClipText = ""

    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        try {
            val cm = clipboardManager ?: return@OnPrimaryClipChangedListener
            val clip = cm.primaryClip ?: return@OnPrimaryClipChangedListener
            if (clip.itemCount == 0) return@OnPrimaryClipChangedListener

            val item = clip.getItemAt(0)
            val text = item.text?.toString() ?: return@OnPrimaryClipChangedListener

            if (text == lastClipText || text.isBlank()) return@OnPrimaryClipChangedListener
            lastClipText = text

            // Check if it looks like a URL
            if (URL_REGEX.containsMatchIn(text)) {
                Log.i(TAG, "URL detected in clipboard: $text")
                val data = JSObject()
                data.put("url", text)
                notifyListeners("urlDetected", data)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error reading clipboard: ${e.message}")
        }
    }

    @PluginMethod
    fun startMonitoring(call: PluginCall) {
        try {
            if (isMonitoring) {
                call.resolve()
                return
            }
            clipboardManager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            if (clipboardManager == null) {
                call.reject("ClipboardManager not available")
                return
            }

            // Capture current clipboard content to avoid re-triggering
            val currentClip = clipboardManager?.primaryClip
            if (currentClip != null && currentClip.itemCount > 0) {
                lastClipText = currentClip.getItemAt(0).text?.toString() ?: ""
            }

            clipboardManager?.addPrimaryClipChangedListener(clipboardListener)
            isMonitoring = true
            Log.i(TAG, "Clipboard monitoring started")
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start monitoring: ${e.message}")
            call.reject("Failed to start monitoring: ${e.message}")
        }
    }

    @PluginMethod
    fun stopMonitoring(call: PluginCall) {
        try {
            if (!isMonitoring) {
                call.resolve()
                return
            }
            clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
            isMonitoring = false
            Log.i(TAG, "Clipboard monitoring stopped")
            call.resolve()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping monitoring: ${e.message}")
            call.resolve() // Don't fail on cleanup
        }
    }

    @PluginMethod
    fun getClipboardText(call: PluginCall) {
        try {
            val text = clipboardManager?.primaryClip?.let { clip ->
                if (clip.itemCount > 0) clip.getItemAt(0).text?.toString() else null
            } ?: ""
            val result = JSObject()
            result.put("text", text)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to read clipboard: ${e.message}")
        }
    }

    override fun handleOnDestroy() {
        if (isMonitoring) {
            clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
            isMonitoring = false
        }
        super.handleOnDestroy()
    }

    companion object {
        private const val TAG = "ClipboardMonitor"
        private val URL_REGEX = Regex("""https?://[^\s<>"{}|\\^`\[\]]+""", RegexOption.IGNORE_CASE)
    }
}

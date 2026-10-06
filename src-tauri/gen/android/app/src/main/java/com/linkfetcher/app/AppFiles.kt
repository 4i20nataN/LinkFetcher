// Arquivos: jail + publicação + localização do final (extraído do
// YtDlpPlugin.kt). Usa SÓ a Activity — sem estado do plugin.
package com.linkfetcher.app

import android.app.Activity
import android.os.Environment
import android.util.Log
import android.webkit.MimeTypeMap
import java.io.File

private const val TAG = "YtDlpPlugin"

internal class AppFiles(private val activity: Activity) {

    // Jail: `openFile`/`publishFile` só operam dentro dos diretórios privados
    // do app (canonical, sem `..`/symlink escape). Path fora → reject, nunca
    // intent nem cópia pública. Nulo = fora da jail.
    fun jailedAppFile(raw: String): File? {
        val canon = try {
            File(raw.trim().trim('\'', '"')).canonicalPath
        } catch (_: Exception) {
            return null
        }
        val roots = listOfNotNull(
            try { activity.getExternalFilesDir(null)?.canonicalPath } catch (_: Exception) { null },
            try { activity.filesDir?.canonicalPath } catch (_: Exception) { null },
            try { activity.cacheDir?.canonicalPath } catch (_: Exception) { null },
            try { activity.externalCacheDir?.canonicalPath } catch (_: Exception) { null },
        )
        if (roots.none { canon == it || canon.startsWith("$it/") }) return null
        return File(canon)
    }

    fun newestFile(known: String?): String? {
        known?.takeIf { File(it).exists() }?.let { return it }
        val dir = try {
            activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return null
        } catch (_: Exception) {
            return null
        }
        return dir.listFiles()
            ?.filter { f -> f.isFile && !YtDlpParsing.isTempArtifact(f.name) && !YtDlpParsing.isSidecar(f.name) }
            ?.maxByOrNull { it.lastModified() }
            ?.absolutePath
    }

    // Copia o arquivo final (pasta privada do app, invisível ao usuário) para
    // a coleção pública de Downloads, onde aparece no app Files, gerenciadores
    // e players. Retorna a URI pública ou null (best-effort: o download já
    // concluiu — publicação nunca falha a operação).
    // SDK 29+: MediaStore com RELATIVE_PATH (sem permissão).
    // SDK 24-28: pasta pública + MediaScanner (precisa da permissão
    // WRITE_EXTERNAL_STORAGE, já declarada com maxSdkVersion=28).
    fun publishToPublicDownloads(src: File, subdir: String? = null): String? {
        // Nulo (frontend antigo) = padrão "LinkFetcher". String vazia = raiz de
        // Downloads (escolha explícita do usuário). Qualquer valor suspeito é
        // sanitizado — nunca escreve fora de Downloads.
        val clean = if (subdir == null) "LinkFetcher"
        else subdir.substringAfterLast('/').trim()
            .replace(Regex("[^\\p{L}\\p{N} _.-]"), "")
            .replace(Regex("\\.+"), ".")
            .take(32).trim().trim('.')
        val relPath = if (clean.isEmpty()) Environment.DIRECTORY_DOWNLOADS
            else "${Environment.DIRECTORY_DOWNLOADS}/$clean"
        return try {
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                val mime = MimeTypeMap.getSingleton()
                    .getMimeTypeFromExtension(src.extension.lowercase())
                    ?: "application/octet-stream"
                val values = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Downloads.DISPLAY_NAME, src.name)
                    put(android.provider.MediaStore.Downloads.MIME_TYPE, mime)
                    put(
                        android.provider.MediaStore.Downloads.RELATIVE_PATH,
                        relPath
                    )
                    put(android.provider.MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = activity.contentResolver
                val uri = resolver.insert(
                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
                ) ?: return null
                try {
                    resolver.openOutputStream(uri)?.use { out ->
                        src.inputStream().use { it.copyTo(out) }
                    } ?: return null
                    values.clear()
                    values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } catch (e: Exception) {
                    try { resolver.delete(uri, null, null) } catch (_: Exception) { }
                    throw e
                }
                Log.i(TAG, "publicado em $relPath: $uri")
                uri.toString()
            } else {
                val pub = if (clean.isEmpty()) Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                ) else File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    clean
                )
                if (!pub.exists() && !pub.mkdirs()) return null
                val dst = File(pub, src.name)
                src.inputStream().use { input ->
                    dst.outputStream().use { input.copyTo(it) }
                }
                android.media.MediaScannerConnection.scanFile(
                    activity, arrayOf(dst.absolutePath), null, null
                )
                Log.i(TAG, "publicado (legado): ${dst.absolutePath}")
                dst.absolutePath
            }
        } catch (e: Exception) {
            Log.w(TAG, "publish falhou (best-effort): ${e.message}")
            null
        }
    }
}

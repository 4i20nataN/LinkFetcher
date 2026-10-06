// Parsing de stdout do yt-dlp + buscas (extraído do YtDlpPlugin.kt).
// Tudo puro, sem Activity: `internal object`, testável sem aparelho.
package com.linkfetcher.app

import app.tauri.plugin.JSObject
import org.json.JSONObject
import java.io.File

internal object YtDlpParsing {

    data class MobileProgress(
        val percent: Double,
        val speed: Double,
        val eta: Double,
        val downloaded: Long,
        val total: Long
    )

    // `at` aceita "Unknown speed" (2 tokens): sem o grupo guloso a linha era
    // descartada e o progresso congelava nesses trechos.
    private val progressRegex =
        """\[download\]\s+(NA|\d+(?:\.\d+)?)%\s+of\s+(~?\S+)\s+at\s+(.+?)\s+ETA\s+(\S+)""".toRegex()

    fun parseSize(s: String): Long {
        val t = s.trim().trimStart('~')
        fun num(suffix: String, mult: Long): Long? =
            t.takeIf { it.endsWith(suffix) }?.dropLast(suffix.length)
                ?.toDoubleOrNull()?.let { (it * mult).toLong() }
        return num("GiB", 1024L * 1024 * 1024)
            ?: num("MiB", 1024L * 1024)
            ?: num("KiB", 1024L)
            ?: num("B", 1)
            ?: t.toDoubleOrNull()?.toLong()
            ?: 0L
    }

    fun parseSpeed(s: String): Double {
        val t = s.trim()
        if (t == "NA" || t == "Unknown" || t == "Unknown speed") return 0.0
        fun num(suffix: String, mult: Double): Double? =
            t.takeIf { it.endsWith(suffix) }?.dropLast(suffix.length)
                ?.toDoubleOrNull()?.let { it * mult }
        return num("GiB/s", 1024.0 * 1024 * 1024)
            ?: num("MiB/s", 1024.0 * 1024)
            ?: num("KiB/s", 1024.0)
            ?: num("B/s", 1.0)
            ?: t.toDoubleOrNull()
            ?: 0.0
    }

    fun parseEta(s: String): Double {
        val parts = s.trim().split(':')
        var total = 0.0
        for (p in parts) {
            total = total * 60.0 + (p.toDoubleOrNull() ?: return 0.0)
        }
        return total
    }

    fun parseProgress(line: String): MobileProgress? {
        val m = progressRegex.find(line.trim()) ?: return null
        // Percentual desconhecido ("NA"): sem base para % — ignora a linha.
        val percent = m.groupValues[1].toDoubleOrNull() ?: return null
        val total = parseSize(m.groupValues[2])
        val downloaded = (percent / 100.0 * total).toLong()
        return MobileProgress(
            percent,
            parseSpeed(m.groupValues[3]),
            parseEta(m.groupValues[4]),
            downloaded,
            total
        )
    }

    fun parseDestination(line: String): String? {
        val t = line.trim()
        val dest = "Destination: "
        val di = t.indexOf(dest)
        if (di >= 0) return t.substring(di + dest.length).trim()
        val mergePrefix = "Merging formats into \""
        val mi = t.indexOf(mergePrefix)
        if (mi >= 0) {
            val rest = t.substring(mi + mergePrefix.length)
            val end = rest.indexOf('"')
            if (end > 0) return rest.substring(0, end)
        }
        val marker = " has already been downloaded"
        val ai = t.indexOf(marker)
        if (ai >= 0) {
            val di2 = t.indexOf("[download] ")
            if (di2 >= 0) return t.substring(di2 + "[download] ".length, ai).trim()
        }
        return null
    }

    fun isPostProcessorLine(line: String): Boolean {
        val t = line.trim()
        return t.startsWith("[ExtractAudio]")
            || t.startsWith("[Merger]")
            || t.startsWith("[VideoConvertor]")
            || t.startsWith("[VideoRemuxer]")
            || t.startsWith("[EmbedSubtitle]")
            || t.startsWith("[Metadata]")
            || t.startsWith("[ThumbnailsConvertor]")
    }

    // Sinais de vida sem % (só avaliado quando parseProgress falha): o
    // engine exibe como atividade ("Fragmento 12/120", "Tentando de novo…")
    // em vez de 0% morto. Nunca duplica: postprocessor/destination passam
    // por aqui e não casam nenhum padrão.
    sealed interface ActivitySignal {
        data class Fragment(val current: Int, val total: Int) : ActivitySignal
        object Retry : ActivitySignal
        data class Line(val text: String) : ActivitySignal
    }

    private val fragmentRegex =
        """\[download\]\s+Downloading fragment (\d+) of (\d+)""".toRegex()

    fun parseActivity(line: String): ActivitySignal? {
        val t = line.trim()
        if (t.isEmpty()) return null
        fragmentRegex.find(t)?.let {
            val c = it.groupValues[1].toIntOrNull()
            val n = it.groupValues[2].toIntOrNull()
            if (c != null && n != null) return ActivitySignal.Fragment(c, n)
        }
        if (t.contains("Retrying", ignoreCase = true) || t.contains("Got error", ignoreCase = true)) {
            return ActivitySignal.Retry
        }
        if (t.startsWith("WARNING") || t.startsWith("ERROR")) {
            return ActivitySignal.Line(t)
        }
        return null
    }

    fun isTempArtifact(name: String): Boolean {
        return name.contains(".part") || name.endsWith(".ytdl") || name.endsWith(".temp") ||
            name.endsWith(".tmp") || name.endsWith(".new") || name.contains(".cuttmp.") ||
            name.endsWith(".cuttmp") || name.contains("-Frag")
    }

    // Sidecars (legenda/capa/metadados) nunca são o arquivo final: sem este
    // filtro o fallback podia devolver um .vtt/.jpg como "download concluído".
    fun isSidecar(name: String): Boolean {
        val n = name.lowercase()
        return n.endsWith(".vtt") || n.endsWith(".srt") || n.endsWith(".ass") ||
            n.endsWith(".lrc") || n.endsWith(".srv1") || n.endsWith(".srv2") ||
            n.endsWith(".ttml") || n.endsWith(".description") ||
            n.endsWith(".info.json") || n.endsWith(".annotations.xml")
    }

    // Pasta de saída a partir do `-o` do argv (`/dir/nome.%(ext)s` → `/dir`).
    fun outputDirFromArgv(argv: List<String>): File? {
        val i = argv.indexOf("-o")
        if (i < 0 || i + 1 >= argv.size) return null
        val tpl = argv[i + 1]
        val cut = tpl.indexOf("%(").takeIf { it >= 0 } ?: tpl.length
        return File(tpl.substring(0, cut)).parentFile?.takeIf { it.isDirectory }
    }

    // Aguarda (poll 500ms) um arquivo novo não-temporário na pasta — cobre o
    // caso em que o mp3 Convertido pousa depois do retorno das callbacks.
    fun waitForRecentFile(dir: File?, sinceMs: Long, timeoutMs: Long): String? {
        if (dir == null) return null
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val best = dir.listFiles()
                ?.filter { f -> f.isFile && !isTempArtifact(f.name) && !isSidecar(f.name) && f.lastModified() >= sinceMs && f.length() > 0 }
                ?.maxByOrNull { it.lastModified() }
            if (best != null) return best.absolutePath
            try {
                Thread.sleep(500)
            } catch (_: InterruptedException) {
                break
            }
        }
        return null
    }

    fun removeTempVariants(base: File): Int {
        var removed = 0
        if (isTempArtifact(base.name) && base.delete()) removed++
        for (suffix in listOf(".part", ".ytdl", ".temp", ".tmp", ".new")) {
            if (File(base.absolutePath + suffix).delete()) removed++
        }
        base.parentFile?.listFiles()?.forEach { f ->
            if (f.name.startsWith(base.name) && f.name.length > base.name.length &&
                (f.name.contains(".cuttmp.") || f.name.contains("-Frag")) && f.delete()
            ) removed++
        }
        return removed
    }

    fun cleanError(stderr: String): String {
        fun isNoise(l: String): Boolean {
            val t = l.trim()
            if (t.isEmpty()) return true
            return (t.contains("frame=") && t.contains("fps=")) ||
                (t.startsWith("size=") && t.contains("time=")) ||
                (t.contains("bitrate=") && t.contains("speed=")) ||
                t.startsWith("elapsed=") ||
                progressRegex.containsMatchIn(t)
        }
        val kept = stderr.split('\n', '\r').map { it.trim() }.filter { !isNoise(it) }
        var msg = kept.takeLast(8).joinToString(" · ").trim()
        if (msg.isEmpty()) {
            msg = stderr.split('\n', '\r').map { it.trim() }
                .filter { it.isNotEmpty() }.lastOrNull() ?: "erro desconhecido"
        }
        for (prefix in listOf("ERROR: ", "Error: ")) {
            if (msg.startsWith(prefix)) {
                msg = msg.removePrefix(prefix)
                break
            }
        }
        return if (msg.length > 500) msg.take(497) + "..." else msg
    }

    fun buildSearchQuery(platform: String, query: String, max: Int): String {
        fun enc(s: String): String {
            val sb = StringBuilder()
            for (b in s.toByteArray(Charsets.UTF_8)) {
                val c = b.toInt() and 0xFF
                if (c in 0x30..0x39 || c in 0x41..0x5A || c in 0x61..0x7A || c == '-'.code || c == '_'.code ||
                    c == '.'.code || c == '!'.code || c == '~'.code || c == '*'.code || c == '\''.code ||
                    c == '('.code || c == ')'.code
                ) sb.append(c.toChar()) else sb.append('%').append(String.format("%02X", c))
            }
            return sb.toString()
        }
        return when (platform) {
            "youtube" -> "ytsearch$max:$query"
            "vimeo" -> "https://vimeo.com/search?q=${enc(query)}"
            "dailymotion" -> "https://www.dailymotion.com/search/${enc(query)}/videos"
            "bilibili" -> "https://search.bilibili.com/all?keyword=${enc(query)}"
            "soundcloud" -> "scsearch$max:$query"
            else -> "ytsearch$max:$query"
        }
    }

    fun mapSearchItem(item: JSONObject): JSONObject {
        fun str(vararg keys: String): String {
            for (k in keys) {
                val v = item.optString(k, "")
                if (v.isNotEmpty()) return v
            }
            return ""
        }
        var thumbnail = str("thumbnail")
        if (thumbnail.isEmpty()) {
            val thumbs = item.optJSONArray("thumbnails")
            if (thumbs != null && thumbs.length() > 0) {
                thumbnail = thumbs.optJSONObject(0)?.optString("url", "") ?: ""
            }
        }
        val out = JSObject()
        out.put("id", str("id"))
        val title = str("title")
        out.put("title", title.ifEmpty { "Unknown" })
        out.put("url", str("url", "webpage_url"))
        out.put("thumbnail", thumbnail)
        out.put("duration", item.optDouble("duration", 0.0))
        out.put("duration_string", str("duration_string").ifEmpty { "0:00" })
        out.put("view_count", item.optLong("view_count", 0L))
        out.put("uploader", str("uploader", "channel"))
        out.put("description", str("description"))
        return out
    }
}

package com.linkfetcher.app

// Conferir contra a versão instalada de io.github.junkfood02.youtubedl-android:
// os getters de VideoInfo (probe/search) foram escritos com base na API pública documentada
// e podem variar levemente entre releases.

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.security.MessageDigest
import java.io.File
import java.io.FileInputStream
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

@CapacitorPlugin(name = "YtDlp")
class YtDlpPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val activeJobs = mutableMapOf<String, Job>()
    private var initialized = false
    private val updateReady = CompletableDeferred<Unit>()
    private var wakeLock: PowerManager.WakeLock? = null

    @Synchronized
    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LinkFetcher:DownloadWakeLock")
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(15 * 60 * 1000L /* 15 minutos de limite de seguranca */)
                Log.i(TAG, "WakeLock de CPU adquirido para garantir download em segundo plano")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Nao foi possivel adquirir WakeLock: ${e.message}")
        }
    }

    @Synchronized
    private fun releaseWakeLockIfIdle() {
        try {
            if (activeJobs.isEmpty()) {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                    Log.i(TAG, "WakeLock liberado — todos os downloads em segundo plano foram concluidos")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao liberar WakeLock: ${e.message}")
        }
    }

    override fun load() {
        try {
            YoutubeDL.getInstance().init(context.applicationContext)
            FFmpeg.getInstance().init(context.applicationContext)
            initialized = true
            Log.i(TAG, "load: yt-dlp/ffmpeg initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao inicializar yt-dlp/ffmpeg: ${e.message}", e)
            initialized = false
        }
        // O binário yt-dlp empacotado no .aar (0.18.1) fica desatualizado em relação
        // às mudanças do YouTube (SABR/player API), causando erros como
        // "'NoneType' object has no attribute 'lower'" em formatos com campos ausentes.
        // updateYoutubeDL baixa o binário mais recente do GitHub em runtime,
        // independente da versão do plugin. Roda em background, não bloqueia o load().
        scope.launch {
            try {
                val status = YoutubeDL.getInstance().updateYoutubeDL(
                    context.applicationContext,
                    YoutubeDL.UpdateChannel.STABLE
                )
                Log.i(TAG, "updateYoutubeDL: status=$status, version=${YoutubeDL.getInstance().versionName(context.applicationContext)}")
            } catch (e: Exception) {
                Log.w(TAG, "updateYoutubeDL falhou (seguindo com binário embutido): ${e.message}", e)
            } finally {
                updateReady.complete(Unit)
            }
        }
    }

    /**
     * Tenta (re)inicializar yt-dlp/ffmpeg se ainda não estiver pronto.
     * Chamado no início de cada operação para cobrir falhas silenciosas no
     * primeiro boot (emulador lento, cold-start, etc.) sem exigir reinício
     * do app.
     *
     * @return true se pronto para uso, false se a inicialização falhou.
     */
    private fun tryInitIfNeeded(): Boolean {
        if (initialized) return true
        return try {
            Log.i(TAG, "tryInitIfNeeded: tentando re-inicializar yt-dlp/ffmpeg")
            YoutubeDL.getInstance().init(context.applicationContext)
            FFmpeg.getInstance().init(context.applicationContext)
            initialized = true
            Log.i(TAG, "tryInitIfNeeded: re-inicialização bem-sucedida")
            true
        } catch (e: Exception) {
            Log.e(TAG, "tryInitIfNeeded: falha na re-inicialização: ${e.message}", e)
            false
        }
    }

    /** Aguarda o updateYoutubeDL() do load() terminar (timeout 20s). */
    private suspend fun awaitUpdate() {
        try {
            withTimeoutOrNull(20_000L) { updateReady.await() }
                ?: Log.w(TAG, "awaitUpdate: timeout 20s — prosseguindo com binário embutido")
        } catch (_: Exception) { /* proceed anyway */ }
    }

    @PluginMethod
    fun ensureBinaries(call: PluginCall) {
        val result = JSObject()
        result.put("ready", initialized)
        // A lib empacota os binários dentro do próprio APK/AAR — não há path exposto pra Windows-style paths.
        result.put("ytdlpPath", "bundled")
        result.put("ffmpegPath", "bundled")
        call.resolve(result)
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val result = JSObject()
        result.put("ready", initialized)
        result.put("platform", "android")
        call.resolve(result)
    }

    @PluginMethod
    fun probe(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("url é obrigatória")
        Log.i(TAG, "probe: url=$url, initialized=$initialized")
        if (!tryInitIfNeeded()) {
            Log.e(TAG, "probe: yt-dlp não pôde ser inicializado")
            call.reject("yt-dlp não inicializado. Feche e reabra o aplicativo.")
            return
        }
        scope.launch {
            awaitUpdate()
            val startTime = System.currentTimeMillis()
            try {
                Log.i(TAG, "probe: calling getInfo...")
                val request = YoutubeDLRequest(url)
                applyFastExtractionOptions(request, url)
                val info = withTimeoutOrNull(30_000L) {
                    YoutubeDL.getInstance().getInfo(request)
                }
                if (info == null) {
                    val elapsed = System.currentTimeMillis() - startTime
                    Log.e(TAG, "probe: TIMEOUT after ${elapsed}ms for $url")
                    call.reject("Probe timeout — sem resposta em 30s")
                    return@launch
                }
                val elapsed = System.currentTimeMillis() - startTime
                Log.i(TAG, "probe: getInfo returned in ${elapsed}ms, title=${info.title}")
                val json = JSObject()
                json.put("id", info.id)
                json.put("title", info.title)
                json.put("author", info.uploader)
                json.put("channel", info.uploader)
                json.put("duration", info.duration)
                json.put("duration_string", formatDuration(info.duration))
                json.put("thumbnail", info.thumbnail)
                json.put("description", info.description)
                json.put("webpage_url", info.webpageUrl ?: url)
                json.put("extractor_type", info.extractor ?: "")

                val formatsArray = JSArray()
                try {
                    val formats = info.formats
                    if (formats != null) {
                        Log.d(TAG, "probe: raw formats count=${formats.size}")
                        for ((i, fmt) in formats.withIndex()) {
                            Log.d(TAG, "probe: fmt[$i] id=${fmt.formatId} w=${fmt.width} h=${fmt.height} note=${fmt.formatNote} vcodec=${fmt.vcodec} acodec=${fmt.acodec} tbr=${fmt.tbr}")
                        }
                        for (fmt in formats) {
                            val fmtObj = JSObject()
                            fmtObj.put("format_id", fmt.formatId ?: "")
                            fmtObj.put("ext", fmt.ext ?: "")
                            fmtObj.put("format_note", fmt.formatNote ?: "")
                            fmtObj.put("vcodec", fmt.vcodec ?: "none")
                            fmtObj.put("acodec", fmt.acodec ?: "none")
                            fmtObj.put("filesize", fmt.fileSize)
                            fmtObj.put("tbr", fmt.tbr?.toDouble() ?: 0.0)
                            fmtObj.put("fps", fmt.fps?.toDouble() ?: 0.0)
                            val w = fmt.width
                            val h = fmt.height
                            if (w > 0 && h > 0) {
                                fmtObj.put("resolution", "${w}x${h}")
                            } else {
                                fmtObj.put("resolution", fmt.formatNote ?: "")
                            }
                            formatsArray.put(fmtObj)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "probe: failed to extract formats: ${e.message}", e)
                }
                json.put("formats", formatsArray)

                Log.i(TAG, "probe: resolving with ${formatsArray.length()} formats")
                if (formatsArray.length() > 0) {
                    val sample = formatsArray.getJSONObject(0)
                    Log.d(TAG, "probe: sample[0] = ${sample.toString(2).take(500)}")
                }
                call.resolve(json)
            } catch (e: Exception) {
                val elapsed = System.currentTimeMillis() - startTime
                Log.e(TAG, "probe: ERROR after ${elapsed}ms: ${e.message}", e)
                call.reject(e.message ?: "probe falhou", e)
            }
        }
    }

    private fun isYouTubeUrl(url: String): Boolean =
        url.contains("youtube.com") || url.contains("youtu.be")

    /**
     * player_client para YouTube:
     * - "android" (padrão no dispositivo) limita a 720p.
     * - "web" tem risco de SABR streaming (https://github.com/yt-dlp/yt-dlp/issues/12482).
     * - "web_creator" suporta full quality (até 8K) sem SABR.
     * - "tv" suporta até 4K sem SABR, bom fallback.
     *
     * Ordem: web_creator → tv → web (último recurso).
     */
    private fun applyFastExtractionOptions(request: YoutubeDLRequest, url: String = "") {
        request.addOption("--no-playlist")
        request.addOption("--no-warnings")
        if (isYouTubeUrl(url)) {
            request.addOption("--extractor-args", "youtube:player_client=web_creator,tv,web")
        }
    }

    private fun formatDuration(seconds: Int): String {
        if (seconds <= 0) return "0:00"
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        val s = seconds % 60
        return if (h > 0) {
            String.format("%d:%02d:%02d", h, m, s)
        } else {
            String.format("%d:%02d", m, s)
        }
    }

    @PluginMethod
    fun search(call: PluginCall) {
        val query = call.getString("query") ?: return call.reject("query é obrigatória")
        val maxResults = call.getInt("maxResults") ?: 10
        Log.i(TAG, "search: query='$query', maxResults=$maxResults, initialized=$initialized")
        scope.launch {
            awaitUpdate()
            try {
                if (!tryInitIfNeeded()) {
                    Log.e(TAG, "search: yt-dlp não pôde ser inicializado")
                    call.reject("yt-dlp não inicializado. Feche e reabra o aplicativo.")
                    return@launch
                }
                val request = YoutubeDLRequest("ytsearch$maxResults:$query")
                request.addOption("--flat-playlist")
                request.addOption("--no-warnings")
                request.addOption("--dump-json")
                Log.i(TAG, "search: executing yt-dlp...")
                val response = YoutubeDL.getInstance().execute(request)
                Log.i(TAG, "search: response.out length=${response.out?.length ?: 0}, exitCode=${response.exitCode}")
                val results = JSArray()
                val outStr = response.out
                if (outStr.isNullOrBlank()) {
                    Log.w(TAG, "search: response.out is empty/null")
                    call.resolve(JSObject().put("results", results))
                    return@launch
                }
                // yt-dlp --flat-playlist --dump-json outputs NDJSON (one JSON object per line),
                // NOT a wrapper {"entries":[...]}. Parse each line independently.
                val lines = outStr.lines().filter { it.isNotBlank() }
                Log.i(TAG, "search: got ${lines.size} NDJSON lines")
                for ((idx, line) in lines.withIndex()) {
                    try {
                        val entry = JSONObject(line)
                        val item = JSObject()
                        item.put("id", entry.optString("id", ""))
                        item.put("title", entry.optString("title", ""))
                        item.put("url", entry.optString("webpage_url",
                            entry.optString("url", "")))
                        // thumbnails is a JSON array of objects with "url" key
                        val thumbUrl = entry.optString("thumbnail", "")
                        if (thumbUrl.isNotEmpty()) {
                            item.put("thumbnail", thumbUrl)
                        } else {
                            val thumbs = entry.optJSONArray("thumbnails")
                            if (thumbs != null && thumbs.length() > 0) {
                                item.put("thumbnail", thumbs.getJSONObject(0).optString("url", ""))
                            }
                        }
                        val dur = entry.optInt("duration", 0)
                        item.put("duration", dur)
                        item.put("duration_string", formatDuration(dur))
                        item.put("view_count", entry.optLong("view_count", 0))
                        item.put("uploader", entry.optString("uploader",
                            entry.optString("channel", "")))
                        item.put("description", entry.optString("description", "") ?: "")
                        results.put(item)
                    } catch (je: Exception) {
                        Log.w(TAG, "search: failed to parse line $idx: ${je.message}")
                    }
                }
                Log.i(TAG, "search: returning ${results.length()} results")
                call.resolve(JSObject().put("results", results))
            } catch (e: Exception) {
                Log.e(TAG, "search failed: ${e.message}", e)
                call.reject(e.message ?: "search falhou", e)
            }
        }
    }

    /**
     * Encontra o caminho do binário ffmpeg registrado internamente pela lib
     * (FFmpeg.getInstance()) via reflection, e devolve o diretório que o contém.
     *
     * Motivo: em teste real, mesmo com FFmpeg.getInstance().init() bem-sucedido em
     * load(), o download falhou com "ffmpeg not found. Please install or provide
     * the path using --ffmpeg-location" — indicando que o auto-registro interno
     * (que a lib normalmente faz ao montar a request) não aconteceu dessa vez.
     * Em vez de confiar nisso, buscamos o File do binário direto no objeto FFmpeg
     * via reflection (mesma técnica já usada pra debug de `options` acima) e
     * passamos --ffmpeg-location explicitamente em toda request de download.
     */
    /**
     * yt-dlp só reconhece um arquivo apontado por --ffmpeg-location diretamente se o
     * nome for LITERALMENTE "ffmpeg" (ou "ffprobe"). Se o basename for outra coisa
     * (aqui: "libffmpeg.so", nome que o Android exige pra .so em jniLibs), o yt-dlp
     * trata o path como DIRETÓRIO e procura arquivos chamados "ffmpeg"/"ffprobe"
     * dentro dele — que não existem — daí o erro "ffmpeg not found" mesmo com o
     * caminho certo. (Confirmado: reflection em FFmpeg.getInstance() não achou o
     * registro interno que a lib supostamente monta sozinha nesse ambiente.)
     *
     * Fix: copiar libffmpeg.so/libffprobe.so pra um diretório interno gravável com
     * os nomes exatos "ffmpeg"/"ffprobe", marcar como executável, e apontar
     * --ffmpeg-location pro DIRETÓRIO (não pro arquivo). Feito uma vez só; chamadas
     * seguintes reaproveitam os arquivos já copiados.
     */
    private fun ensureFfmpegBinaries(): String? {
        return try {
            // 1. Diretório oficial onde a lib youtubedl-android extrai o FFmpeg completo (~145MB)
            val standardBinDir = File(context.filesDir, "bin")
            val standardFfmpeg = File(standardBinDir, "ffmpeg")
            if (standardFfmpeg.exists() && standardFfmpeg.length() > 1_000_000L && standardFfmpeg.canExecute()) {
                Log.i(TAG, "ensureFfmpegBinaries: encontrado FFmpeg oficial em ${standardBinDir.absolutePath} (${standardFfmpeg.length()} bytes)")
                return standardBinDir.absolutePath
            }

            val binDir = File(context.filesDir, "ffmpeg_bin")
            binDir.mkdirs()
            val ffmpegDst = File(binDir, "ffmpeg")
            val ffprobeDst = File(binDir, "ffprobe")

            if (ffmpegDst.exists() && ffmpegDst.length() > 1_000_000L && ffmpegDst.canExecute()) {
                return binDir.absolutePath
            }

            // 2. Busca nos diretórios do app por binários maiores que 1MB (evita o wrapper C de 334KB)
            val searchDirs = listOfNotNull(
                File(context.applicationInfo.nativeLibraryDir),
                context.filesDir,
                context.noBackupFilesDir,
                context.cacheDir,
                context.filesDir.parentFile?.let { File(it, "no_backup") },
                context.filesDir.parentFile?.let { File(it, "files") }
            )

            var foundFfmpegSrc: File? = null
            var foundFfprobeSrc: File? = null

            for (dir in searchDirs) {
                if (!dir.exists()) continue
                dir.walkTopDown().maxDepth(6).forEach { file ->
                    if (file.isFile && file.length() > 1_000_000L) {
                        val name = file.name.lowercase()
                        if ((name == "ffmpeg" || name == "libffmpeg.so") && foundFfmpegSrc == null) {
                            foundFfmpegSrc = file
                        }
                        if ((name == "ffprobe" || name == "libffprobe.so") && foundFfprobeSrc == null) {
                            foundFfprobeSrc = file
                        }
                    }
                }
                if (foundFfmpegSrc != null) break
            }

            Log.i(TAG, "ensureFfmpegBinaries: foundFfmpegSrc=${foundFfmpegSrc?.absolutePath} (${foundFfmpegSrc?.length()} bytes)")

            if (foundFfmpegSrc != null) {
                foundFfmpegSrc!!.copyTo(ffmpegDst, overwrite = true)
                ffmpegDst.setExecutable(true, false)
                Log.i(TAG, "ensureFfmpegBinaries: copiado ${foundFfmpegSrc!!.name} para ${ffmpegDst.absolutePath}")
            }
            if (foundFfprobeSrc != null) {
                foundFfprobeSrc!!.copyTo(ffprobeDst, overwrite = true)
                ffprobeDst.setExecutable(true, false)
                Log.i(TAG, "ensureFfmpegBinaries: copiado ${foundFfprobeSrc!!.name} para ${ffprobeDst.absolutePath}")
            }

            if (ffmpegDst.exists() && ffmpegDst.length() > 1_000_000L && ffmpegDst.canExecute()) {
                binDir.absolutePath
            } else {
                Log.w(TAG, "ensureFfmpegBinaries: ffmpeg validado não encontrado")
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "ensureFfmpegBinaries: falhou com exceção: ${e.message}", e)
            null
        }
    }

    @PluginMethod
    fun download(call: PluginCall) {
        val id = call.getString("id") ?: UUID.randomUUID().toString()
        val url = call.getString("url") ?: return call.reject("url é obrigatória")

        Log.i(TAG, "download: id=$id, url=$url, initialized=$initialized")
        if (!tryInitIfNeeded()) {
            Log.e(TAG, "download: yt-dlp não pôde ser inicializado")
            call.reject("yt-dlp não inicializado. Feche e reabra o aplicativo.")
            return
        }

        // Usar armazenamento INTERNO do app — garantidamente gravável sem permissões
        val internalDir = File(context.filesDir, "downloads")
        internalDir.mkdirs()

        val request = YoutubeDLRequest(url)
        applyFastExtractionOptions(request, url)
        // O FFmpeg.getInstance().init() já registra e configura o caminho oficial do FFmpeg 
        // e o LD_LIBRARY_PATH com todas as bibliotecas compartilhadas (.so) necessárias.
        // Sobrescrever --ffmpeg-location manualmente com um diretório sem LD_LIBRARY_PATH faz
        // o linker do Android falhar ao carregar libavcodec.so, gerando "ffmpeg not found".
        val customFilename = call.getString("customFilename")
        val template = if (!customFilename.isNullOrBlank()) customFilename else "%(title)s.%(ext)s"
        request.addOption("-o", File(internalDir, template).absolutePath)

        val customFormat = call.getString("customFormat")?.takeIf { it.isNotBlank() }
        val format = customFormat ?: call.getString("format")
        val audioOnly = call.getBoolean("audioOnly") ?: false
        val videoOnly = call.getBoolean("videoOnly") ?: false
        val videoFormat = call.getString("videoFormat")?.takeIf { it.isNotBlank() }
        val videoCodec = call.getString("videoCodec")?.takeIf { it.isNotBlank() }

        if (audioOnly) {
            request.addOption("-x")
            call.getString("audioFormat")?.takeIf { it.isNotBlank() }?.let { request.addOption("--audio-format", it) }
            call.getString("audioQuality")?.takeIf { it.isNotBlank() }?.let { request.addOption("--audio-quality", it) }
        } else if (!format.isNullOrBlank()) {
            var finalFmt = format
            if (!videoCodec.isNullOrBlank() && !finalFmt.contains("vcodec")) {
                finalFmt = finalFmt.replace("bv*", "bv*[vcodec~=$videoCodec]")
            }
            if (videoOnly) {
                finalFmt = finalFmt
                    .replace(Regex("\\+ba\\[ext=\\w+\\]"), "")
                    .replace("+ba", "")
                    .replace("/ba", "")
                    .replace("/b", "")
                if (finalFmt.isBlank()) finalFmt = "bv*"
            }
            request.addOption("-f", finalFmt)
        }

        if (call.getBoolean("writeSubs") == true) request.addOption("--write-subs")
        if (call.getBoolean("writeAutoSubs") == true) request.addOption("--write-auto-subs")
        call.getString("subLangs")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sub-langs", it) }
        call.getString("subFormat")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sub-format", it) }
        if (call.getBoolean("embedSubs") == true) request.addOption("--embed-subs")
        if (call.getBoolean("writeThumbnail") == true) request.addOption("--write-thumbnail")
        if (call.getBoolean("embedThumbnail") == true) request.addOption("--embed-thumbnail")
        if (call.getBoolean("embedMetadata") == true) request.addOption("--embed-metadata")
        val mergeOutput = call.getString("mergeOutputFormat")?.takeIf { it.isNotBlank() } ?: videoFormat
        if (!audioOnly && !mergeOutput.isNullOrBlank()) {
            request.addOption("--merge-output-format", mergeOutput)
        }
        if (call.getBoolean("restrictFilenames") == true) request.addOption("--restrict-filenames")
        call.getInt("concurrentFragments")?.let { request.addOption("--concurrent-fragments", it.toString()) }
        call.getInt("retries")?.let { request.addOption("--retries", it.toString()) }
        val bandLimit = call.getInt("bandLimit") ?: 0
        if (bandLimit > 0) request.addOption("--limit-rate", "${bandLimit}K")
        if (call.getBoolean("noOverwrites") == true) request.addOption("--no-overwrites")
        if (call.getBoolean("keepVideo") == true) request.addOption("--keep-video")
        call.getString("downloadSections")?.takeIf { it.isNotBlank() }?.let { request.addOption("--download-sections", it) }
        call.getString("sponsorblockRemove")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sponsorblock-remove", it) }
        // Paridade com Desktop/Web (YtDlpManager.ts / server.ts): "--video-fps" não existe no
        // yt-dlp e era ignorado silenciosamente. Usar --format-sort "fps:N", igual às outras plataformas.
        val fpsMax = call.getInt("fpsMax") ?: 0
        if (fpsMax > 0 && !audioOnly) request.addOption("--format-sort", "fps:$fpsMax")

        Log.i(TAG, "download: starting execute, internalDir=${internalDir.absolutePath}, format=$format, audioOnly=$audioOnly, mergeOutput=${call.getString("mergeOutputFormat")}, fpsMax=$fpsMax, videoOnly=${call.getBoolean("videoOnly")}, keepVideo=${call.getBoolean("keepVideo")}")
        // Dump all raw options for debugging
        try {
            val optsField = request.javaClass.getDeclaredField("options")
            optsField.isAccessible = true
            @Suppress("UNCHECKED_CAST")
            val opts = optsField.get(request) as? List<*> ?: emptyList<Any>()
            Log.i(TAG, "download: raw options=$opts")
        } catch (e: Exception) {
            Log.w(TAG, "download: could not dump options: ${e.message}")
        }

        val job = scope.launch {
            awaitUpdate()
            try {
                try {
                    YoutubeDL.getInstance().execute(request, id) { progress, etaInSeconds, line ->
                        emitProgressThrottled(id, progress, etaInSeconds, line)
                    }
                } catch (firstErr: Exception) {
                    val errMsg = firstErr.message ?: ""
                    if (errMsg.contains("Postprocessing") || errMsg.contains("ffmpeg")) {
                        Log.w(TAG, "Postprocessing FFmpeg falhou (desalinhamento ELF 16KB no Android). Executando fallback para fluxo pré-mesclado (b/best)...")
                        val fallbackRequest = YoutubeDLRequest(url)
                        applyFastExtractionOptions(fallbackRequest, url)
                        fallbackRequest.addOption("-o", File(internalDir, template).absolutePath)
                        fallbackRequest.addOption("-f", "b/best")
                        YoutubeDL.getInstance().execute(fallbackRequest, id) { progress, etaInSeconds, line ->
                            emitProgressThrottled(id, progress, etaInSeconds, line)
                        }
                    } else {
                        throw firstErr
                    }
                }

                // Encontrar o arquivo baixado no internalDir
                val downloadedFiles = internalDir.listFiles()
                    ?.filter { it.isFile && it.length() > 0 }
                    ?.sortedByDescending { it.lastModified() }
                    ?: emptyList()
                Log.i(TAG, "download complete: files=${downloadedFiles.map { "${it.name}(${it.length()}b)" }}")

                val localFile = downloadedFiles.firstOrNull()
                if (localFile == null) {
                    Log.e(TAG, "download complete but no file found in ${internalDir.absolutePath}")
                    val errorPayload = JSObject()
                    errorPayload.put("id", id)
                    errorPayload.put("type", "error")
                    errorPayload.put("message", "Download concluído mas nenhum arquivo encontrado")
                    notifyListeners("yt-dlp-progress", errorPayload)
                    call.reject("Download concluído mas nenhum arquivo encontrado")
                    return@launch
                }

                // Copiar para MediaStore (Downloads público) via ContentResolver
                val publicUri = copyToMediaStore(localFile)
                val publicPath = publicUri?.toString() ?: localFile.absolutePath
                Log.i(TAG, "file saved: local=${localFile.absolutePath}, publicUri=$publicUri")

                // Capturar nome/tamanho ANTES de deletar — File.length() reconsulta o
                // filesystem a cada chamada e retorna 0 para um arquivo já deletado.
                val fileName = localFile.name
                val fileSize = localFile.length()

                // Limpeza: uma vez copiado para o storage público, o arquivo interno é lixo.
                // Sem isso o cache interno (filesDir) cresce indefinidamente a cada download.
                if (publicUri != null) {
                    localFile.delete()
                }
                internalDir.listFiles()
                    ?.filter { it.name.endsWith(".part") || it.name.endsWith(".ytdl") }
                    ?.forEach { it.delete() }

                val completePayload = JSObject()
                completePayload.put("id", id)
                completePayload.put("type", "complete")
                completePayload.put("filePath", publicPath)
                completePayload.put("fileName", fileName)
                completePayload.put("fileSize", fileSize)
                notifyListeners("yt-dlp-progress", completePayload)

                val result = JSObject()
                result.put("success", true)
                result.put("exitCode", 0)
                result.put("filePath", publicPath)
                result.put("fileName", fileName)
                result.put("fileSize", fileSize)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "download error: ${e.message}", e)
                val errorPayload = JSObject()
                errorPayload.put("id", id)
                errorPayload.put("type", "error")
                errorPayload.put("message", e.message ?: "download falhou")
                notifyListeners("yt-dlp-progress", errorPayload)
                call.reject(e.message ?: "download falhou", e)
            } finally {
                activeJobs.remove(id)
                cleanupProgressState(id)
                releaseWakeLockIfIdle()
            }
        }
        activeJobs[id] = job
        acquireWakeLock()
    }

    private fun copyToMediaStore(file: File): Uri? {
        return try {
            val resolver = context.contentResolver
            val mimeType = when {
                file.name.endsWith(".mp4") -> "video/mp4"
                file.name.endsWith(".webm") -> "video/webm"
                file.name.endsWith(".mkv") -> "video/x-matroska"
                file.name.endsWith(".m4a") -> "audio/mp4"
                file.name.endsWith(".mp3") -> "audio/mpeg"
                file.name.endsWith(".ogg") -> "audio/ogg"
                file.name.endsWith(".wav") -> "audio/wav"
                file.name.endsWith(".srt") -> "application/x-subrip"
                file.name.endsWith(".vtt") -> "text/vtt"
                else -> "application/octet-stream"
            }

            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, file.name)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.DATE_ADDED, System.currentTimeMillis() / 1000)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
            }

            val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri = resolver.insert(collection, values) ?: return null

            resolver.openOutputStream(uri)?.use { os ->
                FileInputStream(file).use { fis ->
                    fis.copyTo(os)
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }

            uri
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao copiar para MediaStore: ${e.message}")
            null
        }
    }

    // ── Auto-Update via GitHub Releases (paridade com electron/updater) ────────────
    // Mesmo repositório pinado do Electron (PINNED_OWNER_REPO em verifyRelease.cjs).
    // Não reimplementa a verificação Ed25519 do manifest do desktop (fora de escopo aqui),
    // mas pina host/owner-repo e mantém checagem de versão + instalação via Intent segura
    // (FileProvider, sem exigir instalação de fontes desconhecidas fora do fluxo do sistema).
    private val UPDATE_OWNER_REPO = "4i20nataN/LinkFetcher"

    @PluginMethod
    fun checkUpdate(call: PluginCall) {
        scope.launch {
            try {
                val url = java.net.URL("https://api.github.com/repos/$UPDATE_OWNER_REPO/releases/latest")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.setRequestProperty("Accept", "application/vnd.github+json")
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val json = JSONObject(body)
                val tagName = json.getString("tag_name").removePrefix("v")
                val assets = json.getJSONArray("assets")
                var apkUrl: String? = null
                var checksumsUrl: String? = null
                for (i in 0 until assets.length()) {
                    val asset = assets.getJSONObject(i)
                    val name = asset.getString("name")
                    if (apkUrl == null && name.endsWith(".apk")) {
                        apkUrl = asset.getString("browser_download_url")
                    }
                    if (checksumsUrl == null && Regex("(?i)^checksums[_-]?sha512\\.txt$|^(checksums?|sha512sums)(\\.txt)?$").matches(name)) {
                        checksumsUrl = asset.getString("browser_download_url")
                    }
                }
                val result = JSObject()
                result.put("version", tagName)
                result.put("apkUrl", apkUrl ?: "")
                result.put("checksumsUrl", checksumsUrl ?: "")
                result.put("available", apkUrl != null)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "checkUpdate failed: ${e.message}", e)
                call.reject("Falha ao checar atualização: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun downloadUpdate(call: PluginCall) {
        val apkUrl = call.getString("apkUrl") ?: return call.reject("apkUrl é obrigatório")
        val checksumsUrl = call.getString("checksumsUrl")
        val host = Uri.parse(apkUrl).host ?: ""
        val allowedHosts = setOf("github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com")
        if (host !in allowedHosts) {
            call.reject("Host de asset não permitido: $host")
            return
        }
        scope.launch {
            try {
                val updateDir = File(context.cacheDir, "updates").apply { mkdirs() }
                val destFile = File(updateDir, "update.apk")
                if (destFile.exists()) destFile.delete()

                var currentUrl = apkUrl
                var conn: java.net.HttpURLConnection
                var redirects = 0
                while (true) {
                    conn = java.net.URL(currentUrl).openConnection() as java.net.HttpURLConnection
                    conn.instanceFollowRedirects = false
                    conn.connectTimeout = 15_000
                    conn.readTimeout = 30_000
                    val code = conn.responseCode
                    if (code in 300..399) {
                        val location = conn.getHeaderField("Location") ?: break
                        conn.disconnect()
                        currentUrl = location
                        redirects++
                        if (redirects > 5) throw Exception("Muitos redirects")
                        continue
                    }
                    break
                }

                val total = conn.contentLength.toLong()
                var received = 0L
                val digest = MessageDigest.getInstance("SHA-512")
                conn.inputStream.use { input ->
                    destFile.outputStream().use { output ->
                        val buffer = ByteArray(8 * 1024)
                        var lastEmit = 0L
                        while (true) {
                            val read = input.read(buffer)
                            if (read == -1) break
                            output.write(buffer, 0, read)
                            digest.update(buffer, 0, read)
                            received += read
                            val now = System.currentTimeMillis()
                            if (now - lastEmit > 200) {
                                lastEmit = now
                                val payload = JSObject()
                                payload.put("stage", "downloading")
                                payload.put("received", received)
                                payload.put("total", total)
                                if (total > 0) payload.put("percent", (received * 100.0 / total))
                                notifyListeners("update-progress", payload)
                            }
                        }
                    }
                }
                conn.disconnect()

                val actualHash = digest.digest().joinToString("") { "%02x".format(it) }

                if (!checksumsUrl.isNullOrBlank()) {
                    notifyListeners("update-progress", JSObject().put("stage", "verifying"))
                    val expectedHash = fetchExpectedChecksum(checksumsUrl, destFile.name)
                    if (expectedHash != null && !expectedHash.equals(actualHash, ignoreCase = true)) {
                        destFile.delete()
                        val errorPayload = JSObject()
                        errorPayload.put("id", "update")
                        errorPayload.put("type", "error")
                        errorPayload.put("message", "Verificação de integridade (SHA-256) falhou")
                        notifyListeners("update-progress", errorPayload)
                        call.reject("Verificação de integridade (SHA-256) falhou — download descartado por segurança")
                        return@launch
                    } else if (expectedHash == null) {
                        Log.w(TAG, "checksums.txt não continha hash para ${destFile.name}, prosseguindo sem verificação")
                    } else {
                        Log.i(TAG, "downloadUpdate: SHA-256 verificado com sucesso")
                    }
                } else {
                    Log.w(TAG, "downloadUpdate: nenhum checksumsUrl fornecido, instalador não verificado")
                }

                val result = JSObject()
                result.put("ok", true)
                result.put("apkPath", destFile.absolutePath)
                result.put("verified", !checksumsUrl.isNullOrBlank())
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "downloadUpdate failed: ${e.message}", e)
                call.reject("Falha ao baixar atualização: ${e.message}", e)
            }
        }
    }

    /** Busca o hash esperado (formato `sha256sum`: "<hex>  <filename>" por linha) para [filename]. */
    private fun fetchExpectedChecksum(checksumsUrl: String, filename: String): String? {
        return try {
            val conn = java.net.URL(checksumsUrl).openConnection() as java.net.HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            text.lineSequence()
                .map { it.trim() }
                .firstOrNull { it.endsWith(filename) || it.contains(" $filename") || it.contains("*$filename") }
                ?.substringBefore(' ')
                ?.trim()
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao buscar checksums.txt: ${e.message}")
            null
        }
    }

    @PluginMethod
    fun installUpdate(call: PluginCall) {
        val apkPath = call.getString("apkPath") ?: return call.reject("apkPath é obrigatório")
        try {
            // Android 8+ (API 26) requires the "install unknown apps" permission to be
            // granted per-source before an ACTION_VIEW package-archive intent will work.
            // Without this check the intent silently fails (or shows a dead-end system
            // dialog) on first install attempt.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
                val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(settingsIntent)
                call.reject("PERMISSION_REQUIRED: conceda permissão para instalar apps desconhecidos e tente novamente")
                return
            }

            val apkFile = File(apkPath)
            if (!apkFile.exists()) return call.reject("Arquivo do instalador não encontrado")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            Log.e(TAG, "installUpdate failed: ${e.message}", e)
            call.reject("Não foi possível iniciar a instalação: ${e.message}", e)
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val id = call.getString("id")
        if (id != null) {
            YoutubeDL.getInstance().destroyProcessById(id)
            activeJobs[id]?.cancel()
            activeJobs.remove(id)
        }
        call.resolve()
    }

    @PluginMethod
    fun openFile(call: PluginCall) {
        val filePath = call.getString("filePath") ?: return call.reject("filePath é obrigatório")
        Log.i(TAG, "openFile: filePath=$filePath")
        try {
            val uri = Uri.parse(filePath)
            val mimeType = if (uri.scheme == "content") {
                // content:// URIs (o caso normal — vem do MediaStore após o download)
                // não têm extensão visível na string; o tipo real já está nos
                // metadados do MediaStore, então consultamos em vez de adivinhar.
                context.contentResolver.getType(uri) ?: getMimeType(filePath)
            } else {
                getMimeType(filePath)
            }
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            Log.e(TAG, "openFile failed: ${e.message}", e)
            call.reject("Não foi possível abrir o arquivo: ${e.message}", e)
        }
    }

    private fun getMimeType(filePath: String): String {
        return when {
            filePath.endsWith(".mp4") -> "video/mp4"
            filePath.endsWith(".webm") -> "video/webm"
            filePath.endsWith(".mkv") -> "video/x-matroska"
            filePath.endsWith(".m4a") || filePath.endsWith(".aac") -> "audio/mp4"
            filePath.endsWith(".mp3") -> "audio/mpeg"
            filePath.endsWith(".ogg") -> "audio/ogg"
            filePath.endsWith(".wav") -> "audio/wav"
            filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") -> "image/jpeg"
            filePath.endsWith(".png") -> "image/png"
            filePath.endsWith(".webp") -> "image/webp"
            filePath.endsWith(".srt") -> "application/x-subrip"
            filePath.endsWith(".vtt") -> "text/vtt"
            else -> "application/octet-stream"
        }
    }

    // ── Throttled progress emission ──────────────────────────────────────────
    // Emits at most every 500ms and only when percent changes ≥1% or speed changes.
    // Reduces WebView bridge traffic from ~6.67 events/sec to ~2/sec per download.
    private data class ProgressState(var lastPercent: Float = -1f, var lastSpeed: String = "", var lastEmitMs: Long = 0)
    private val progressStateMap = mutableMapOf<String, ProgressState>()

    private fun emitProgressThrottled(id: String, rawProgress: Float, etaInSeconds: Long, line: String) {
        val now = System.currentTimeMillis()
        val state = progressStateMap.getOrPut(id) { ProgressState() }
        val percent = (rawProgress * 100f).coerceIn(0f, 100f)
        val speed = Regex("at\\s+([\\d.]+\\s?[KMG]i?B/s)").find(line)?.groupValues?.get(1) ?: ""

        val percentDelta = kotlin.math.abs(percent - state.lastPercent)
        val speedChanged = speed != state.lastSpeed
        val elapsed = now - state.lastEmitMs

        // Always emit on first call, when percent changes ≥1%, speed changes, or ≥500ms passed
        if (state.lastPercent < 0f || percentDelta >= 1f || speedChanged || elapsed >= 500) {
            state.lastPercent = percent
            state.lastSpeed = speed
            state.lastEmitMs = now

            val payload = JSObject()
            payload.put("id", id)
            payload.put("type", "progress")
            payload.put("percent", percent.toDouble())
            payload.put("eta", "${etaInSeconds}s")
            payload.put("speed", speed)
            notifyListeners("yt-dlp-progress", payload)
        }
    }

    private fun cleanupProgressState(id: String) {
        progressStateMap.remove(id)
    }

    companion object {
        private const val TAG = "YtDlpPlugin"
    }
}

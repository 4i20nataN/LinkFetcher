package com.linkfetcher.app

import android.app.Activity
import android.content.Intent
import android.os.Environment
import android.util.Log
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "YtDlpPlugin"

// Fonte canônica: este arquivo + os demais `*.kt` de `src-tauri/android-plugin/`
// são copiados para `gen/` pelo `scripts/sync-android-plugin.mjs` (o CI
// valida com `--check`). Edite AQUI, nunca no `gen/` — `android init`
// apaga customização manual de lá.

@TauriPlugin
class YtDlpPlugin(private val activity: Activity) : Plugin(activity) {

    // Pool limitado (núcleo 2, teto 8, fila ilimitada): picos de probes +
    // downloads enfileiram em vez de explodir threads; sem Abort (invoke
    // jamais pode ficar sem resposta por pool cheio).
    private val executor = java.util.concurrent.ThreadPoolExecutor(
        2, 8, 60L, java.util.concurrent.TimeUnit.SECONDS,
        java.util.concurrent.LinkedBlockingQueue()
    )
    private val lastPaths = ConcurrentHashMap<String, String>()
    private var webView: WebView? = null
    // Colaboradores sem estado do plugin (só Activity): notificações e arquivos.
    private val notifications = DlNotifications(activity)
    private val appFiles = AppFiles(activity)
    // Jobs ativos (processId → início) + desfechos recentes: o `trigger()`
    // não enfileira — evento emitido com o WebView suspenso (minimizar/sair)
    // é descartado e o JS nunca recebe o `complete`, travando o item em
    // `downloading` com o arquivo já em disco. `jobState` permite ao engine
    // reconciliar na volta ao foreground sem reiniciar nada (reiniciar
    // duplicaria o processo). A lib não expõe query não-destrutiva
    // (só `destroyProcessById`), por isso o registro é nosso. `unknown` =
    // sem registro: o frontend NÃO age — seguro por padrão.
    private val activeJobs = ConcurrentHashMap<String, Long>()
    // Último progresso parseado por job: o engine usa `jobProgress` para
    // PULLAR o estado 1x/s (só Android). Push (trigger + CustomEvent) já
    // falhou das duas formas neste aparelho — poll via invoke é
    // request/response e não depende de listener, timing nem foreground.
    private val lastProgress = ConcurrentHashMap<String, YtDlpParsing.MobileProgress>()
    private data class FinishedJob(val ok: Boolean, val filePath: String?, val size: Long, val error: String?, val at: Long)
    private val finishedJobs = ConcurrentHashMap<String, FinishedJob>()
    private fun rememberFinished(id: String, job: FinishedJob) {
        finishedJobs[id] = job
        if (finishedJobs.size > 100) {
            finishedJobs.entries.minByOrNull { it.value.at }?.key?.let { finishedJobs.remove(it) }
        }
    }
    // Self-update do yt-dlp respeita o toggle da UI (default ligado).
    // Ajustado via comando `setUpdatesEnabled` no boot e ao trocar.
    @Volatile
    private var updatesEnabled = true
    // Downloads de APK em andamento (id do DownloadManager → nome do arquivo).
    private val pendingUpdates = ConcurrentHashMap<Long, String>()

    override fun load(webView: WebView) {
        super.load(webView)
        this.webView = webView
        // Pre-warm em background: a 1ª init extrai o env Python dos assets
        // (segundos em aparelho fraco). Sem isso, a 1ª análise pagava esse
        // custo dentro do probe, parecendo "lentidão ao analisar".
        executor.execute cmd@{
            val t0 = System.currentTimeMillis()
            ensureInitialized()
            Log.i(TAG, "pre-warm yt-dlp em ${System.currentTimeMillis() - t0}ms")
        }
        // Conclusão de download do APK de update → abre o instalador.
        // RECEIVER_NOT_EXPORTED (API 33+); ContextCompat resolve no minSdk 24.
        try {
            val filter = android.content.IntentFilter(
                android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE
            )
            val receiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(
                    context: android.content.Context?,
                    intent: android.content.Intent?
                ) {
                    val id = intent?.getLongExtra(
                        android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1
                    ) ?: return
                    onUpdateDownloaded(id)
                }
            }
            androidx.core.content.ContextCompat.registerReceiver(
                activity, receiver, filter,
                androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED
            )
        } catch (e: Exception) {
            Log.w(TAG, "receiver de update não registrado: ${e.message}")
        }
    }

    private fun ensureInitialized() {
        try {
            val ctx = activity.applicationContext
            YoutubeDL.getInstance().init(ctx)
            FFmpeg.getInstance().init(ctx)
        } catch (e: Exception) {
            Log.d(TAG, "ensureInitialized aviso: ${e.message}")
        }
    }

    // Android 13+: sem POST_NOTIFICATIONS em runtime o SO descarta os avisos
    // em silêncio. Fire-and-forget (sem callback): o SO mostra o diálogo uma
    // vez; negar só cala as notificações, nunca o download.
    private fun ensureNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT < 33) return
        try {
            val perm = android.Manifest.permission.POST_NOTIFICATIONS
            if (androidx.core.content.ContextCompat.checkSelfPermission(activity, perm) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                androidx.core.app.ActivityCompat.requestPermissions(activity, arrayOf(perm), 9021)
            }
        } catch (e: Exception) {
            Log.d(TAG, "permissão de notificação: ${e.message}")
        }
    }

    // Transporte DUPLO de progresso (regressão v1.4.0 revertida): `trigger()`
    // (evento Tauri, `listen` no frontend) + `evaluateJavascript`
    // (CustomEvent na window). O H4 removeu o 2º por "dobrar o IPC", mas no
    // SM-A107M o `trigger()` não entrega progresso — o CustomEvent era o que
    // funcionava em v1.3.1. Dedupe no engine (valores idempotentes + guards
    // de status) absorve a duplicata. Não remover de novo sem prova no
    // aparelho de que o `trigger()` sozinho sustenta o progresso.
    private fun emitOnUi(event: String, build: JSObject.() -> Unit) {
        val data = JSObject()
        data.build()
        val jsonStr = data.toString()
        activity.runOnUiThread {
            trigger(event, data)
            webView?.let { wv ->
                val escapedJson = JSONObject.quote(jsonStr)
                val js = "(function(){ try { var d = JSON.parse($escapedJson); window.dispatchEvent(new CustomEvent('$event', { detail: d })); } catch(e){} })();"
                wv.evaluateJavascript(js, null)
            }
        }
    }

    // ---- probe: dump-json completo (paridade com o desktop) ----

    @Command
    fun probe(invoke: Invoke) {
        val args = invoke.parseArgs(ProbeArgs::class.java)
        if (args.url.isBlank()) {
            invoke.reject("URL vazia")
            return
        }
        executor.execute cmd@{
            ensureInitialized()
            val t0 = System.currentTimeMillis()
            try {
                val request = YoutubeDLRequest(args.url)
                request.addOption("--dump-json")
                request.addOption("--no-download")
                request.addOption("--no-playlist")
                request.addOption("--no-warnings")
                // Fail-fast em rede móvel instável: sem isso o probe usa os
                // retries padrão (10 + backoff) e trava a UI por minutos.
                request.addOption("--socket-timeout", "15")
                request.addOption("--retries", "2")
                args.proxy?.takeIf { it.isNotBlank() }?.let {
                    request.addOption("--proxy", it)
                }
                val response = YoutubeDL.getInstance().execute(request, "probe-${System.nanoTime()}")
                Log.i(TAG, "probe em ${System.currentTimeMillis() - t0}ms exit=${response.exitCode}")
                if (response.exitCode != 0) {
                    invoke.reject(YtDlpParsing.cleanError(response.err.ifBlank { response.out }))
                    return@cmd
                }
                try {
                    val obj = JSObject(response.out)
                    // H1: a lista `thumbnails` (N resoluções do mesmo frame)
                    // nunca é consumida — só `thumbnail` (string). Remove p/
                    // enxugar o IPC no armv7. Desktop mantém o dump cheio; o
                    // frontend tolera a ausência (fallbacks em Providers.ts).
                    obj.remove("thumbnails")
                    invoke.resolve(obj)
                } catch (e: Exception) {
                    invoke.reject("probe: JSON inválido: ${e.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "probe falhou", e)
                invoke.reject(e.message ?: "Erro desconhecido ao obter metadados")
            }
        }
    }

    // ---- playlist: NDJSON parseado (mesma regra do desktop) ----

    @Command
    fun probePlaylist(invoke: Invoke) {
        val args = invoke.parseArgs(ProbeArgs::class.java)
        if (args.url.isBlank()) {
            invoke.reject("URL vazia")
            return
        }
        executor.execute cmd@{
            ensureInitialized()
            try {
                val request = YoutubeDLRequest(args.url)
                request.addOption("--flat-playlist")
                request.addOption("--dump-json")
                request.addOption("--no-download")
                request.addOption("--ignore-errors")
                request.addOption("--no-warnings")
                request.addOption("--socket-timeout", "15")
                request.addOption("--retries", "2")
                args.proxy?.takeIf { it.isNotBlank() }?.let {
                    request.addOption("--proxy", it)
                }
                val response = YoutubeDL.getInstance().execute(request, "playlist-${System.nanoTime()}")
                if (response.exitCode != 0 && response.out.isBlank()) {
                    invoke.reject(YtDlpParsing.cleanError(response.err.ifBlank { response.out }))
                    return@cmd
                }
                val entries = JSONArray()
                var count: Long? = null
                var title: String? = null
                response.out.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }.forEach { line ->
                    try {
                        val obj = JSONObject(line)
                        val isPlaylist = obj.optString("_type") == "playlist" || obj.has("playlist_count")
                        if (isPlaylist) {
                            if (count == null && obj.has("playlist_count")) count = obj.optLong("playlist_count")
                            if (title == null) {
                                obj.optString("title").takeIf { it.isNotEmpty() }?.let { title = it }
                            }
                        } else {
                            entries.put(obj)
                        }
                    } catch (_: Exception) { /* linha não-JSON: ignora */ }
                }
                if (count == null && entries.length() > 0) count = entries.length().toLong()
                if (title == null && entries.length() > 0) {
                    entries.optJSONObject(0)?.optString("playlist")
                        ?.takeIf { it.isNotEmpty() }?.let { title = it }
                }
                val ret = JSObject()
                ret.put("entries", entries)
                count?.let { ret.put("playlist_count", it) }
                title?.let { ret.put("title", it) }
                invoke.resolve(ret)
            } catch (e: Exception) {
                Log.e(TAG, "probePlaylist falhou", e)
                invoke.reject(e.message ?: "Erro desconhecido na playlist")
            }
        }
    }

    // ---- search: mesmos 9 campos do backend desktop ----

    @Command
    fun search(invoke: Invoke) {
        val args = invoke.parseArgs(SearchArgs::class.java)
        if (args.query.isBlank()) {
            invoke.reject("Busca vazia")
            return
        }
        executor.execute cmd@{
            ensureInitialized()
            try {
                val max = args.maxResults ?: 10
                val request = YoutubeDLRequest(YtDlpParsing.buildSearchQuery(args.platform, args.query, max))
                request.addOption("--flat-playlist")
                request.addOption("--dump-json")
                request.addOption("--no-download")
                request.addOption("--no-warnings")
                request.addOption("--socket-timeout", "15")
                request.addOption("--retries", "2")
                args.proxy?.takeIf { it.isNotBlank() }?.let {
                    request.addOption("--proxy", it)
                }
                val response = YoutubeDL.getInstance().execute(request, "search-${System.nanoTime()}")
                if (response.exitCode != 0 && response.out.isBlank()) {
                    invoke.reject(YtDlpParsing.cleanError(response.err.ifBlank { response.out }))
                    return@cmd
                }
                val results = JSONArray()
                response.out.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }.forEach { line ->
                    try {
                        results.put(YtDlpParsing.mapSearchItem(JSONObject(line)))
                    } catch (_: Exception) { /* ignora */ }
                }
                invoke.resolve(JSObject().apply { put("results", results) })
            } catch (e: Exception) {
                Log.e(TAG, "search falhou", e)
                invoke.reject(e.message ?: "Falha na busca")
            }
        }
    }

    // ---- execute: argv canônico do Rust no yt-dlp embarcado ----

    @Command
    fun execute(invoke: Invoke) {
        val args = invoke.parseArgs(ExecuteArgs::class.java)
        if (args.processId.isBlank() || args.argv.isEmpty()) {
            invoke.reject("argv ou processId inválidos")
            return
        }
        executor.execute cmd@{
            ensureInitialized()
            ensureNotificationPermission()
            val startMs = System.currentTimeMillis()
            var captured: String? = null
            // Todos os destinos vistos (download + pós-processamento): o último
            // pode ser um intermediário já apagado (ex. .webm após extrair o
            // .mp3) — na conclusão procura-se o mais recente EXISTENTE.
            val seen = mutableListOf<String>()
            var lastPercent = -1
            var processingSent = false
            // Teto de 2 eventos/s: sem ele, download rápido emite ~100
            // updates (1 por ponto de %) × 2 transportes = tempestade de
            // renders que afoga o WebView no armv7 (notificação nativa anda,
            // card atrasa "um tempão"). % é sempre o valor atual — pular
            // intermediários não perde informação.
            var lastEmitMs = 0L
            // Sinais de vida sem % (fragmentos DASH/HLS, retries, avisos do
            // extrator): sem eles a UI congela em 0% por minutos num stall
            // real — o usuário chama de "bugado". Throttle de 3s; o engine
            // limpa no próximo progresso/conclusão.
            var lastActivityMs = 0L
            fun emitActivity(kind: String, a: Int = -1, b: Int = -1, text: String? = null) {
                val now = System.currentTimeMillis()
                if (now - lastActivityMs < 3_000) return
                lastActivityMs = now
                emitOnUi("yt-dlp-progress") {
                    put("id", args.processId)
                    put("type", "activity")
                    put("kind", kind)
                    if (a >= 0) put("current", a)
                    if (b >= 0) put("total", b)
                    if (text != null) put("text", text.take(140))
                }
            }
            try {
                activeJobs[args.processId] = startMs
                // Retry reusa o id: limpa desfecho da tentativa anterior para
                // um `finished` velho nunca reconciliar a nova execução.
                finishedJobs.remove(args.processId)
                lastProgress.remove(args.processId)
                val request = YoutubeDLRequest(emptyList<String>())
                request.addCommands(args.argv)
                val response = YoutubeDL.getInstance().execute(request, args.processId) { _, _, line ->
                    YtDlpParsing.parseDestination(line)?.let {
                        captured = it
                        seen.add(it)
                        lastPaths[args.processId] = it
                    }
                    // Pós-processamento (ffmpeg embarcado: extração MP3, merge,
                    // embed) não imprime % — sem este evento a UI congela em
                    // 100% sem explicação (o DownloadEngine já trata `processing`).
                    if (!processingSent && YtDlpParsing.isPostProcessorLine(line)) {
                        processingSent = true
                        emitOnUi("yt-dlp-progress") {
                            put("id", args.processId)
                            put("type", "processing")
                        }
                        notifications.showDlProcessing(args.processId, args.title)
                    }
                    YtDlpParsing.parseProgress(line)?.let { p ->
                        // Snapshot p/ `jobProgress` (poll do engine): guarda
                        // TODA linha parseada, sem o teto de 500ms do emit.
                        lastProgress[args.processId] = p
                        val nowMs = System.currentTimeMillis()
                        if (p.percent.toInt() != lastPercent && (lastPercent == -1 || nowMs - lastEmitMs >= 500)) {
                            lastPercent = p.percent.toInt()
                            lastEmitMs = nowMs
                            emitOnUi("yt-dlp-progress") {
                                put("id", args.processId)
                                put("type", "progress")
                                put("percent", p.percent)
                                put("speed", p.speed)
                                put("eta", p.eta)
                                put("downloaded", p.downloaded)
                                put("total", p.total)
                            }
                            notifications.showDlProgress(args.processId, args.title, p.percent.toInt())
                        }
                    } ?: YtDlpParsing.parseActivity(line)?.let { a ->
                        // Linha sem % mas com informação (fragmento/retry/aviso).
                        when (a) {
                            is YtDlpParsing.ActivitySignal.Fragment -> emitActivity("fragment", a.current, a.total)
                            is YtDlpParsing.ActivitySignal.Retry -> emitActivity("retry")
                            is YtDlpParsing.ActivitySignal.Line -> emitActivity("line", text = a.text)
                        }
                    }
                }
                if (response.exitCode != 0) {
                    val msg = YtDlpParsing.cleanError(response.err.ifBlank { response.out })
                    emitOnUi("yt-dlp-progress") {
                        put("id", args.processId)
                        put("type", "error")
                        put("message", msg)
                    }
                    notifications.showDlError(args.processId, args.title, msg)
                    rememberFinished(args.processId, FinishedJob(false, null, 0, msg, System.currentTimeMillis()))
                    invoke.reject(msg)
                    return@cmd
                }
                val finalPath = seen.asReversed().firstOrNull { File(it).exists() }
                    ?: appFiles.newestFile(lastPaths[args.processId])
                    // Último recurso (só quando nada foi visto): o arquivo pode
                    // pousar no disco depois das callbacks (conversão ffmpeg
                    // lenta em aparelho fraco). Poll curto (5s): cada segundo
                    // aqui é uma thread do pool bloqueada.
                    ?: YtDlpParsing.waitForRecentFile(YtDlpParsing.outputDirFromArgv(args.argv), startMs, 5_000)
                lastPaths.remove(args.processId)
                if (finalPath == null) {
                    // Diagnóstico: destinos vistos + conteúdo da pasta + cauda
                    // do stdout/stderr (ex. pós-processador falhou?).
                    try {
                        val dbgDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                        val files = dbgDir?.listFiles()?.map { it.name + ":" + it.length() }?.take(20)
                        Log.w(TAG, "execute ${args.processId} sem arquivo: seen=$seen dir=${dbgDir?.absolutePath} files=$files")
                        Log.w(TAG, "execute ${args.processId} out-tail=${response.out.takeLast(600)}")
                        Log.w(TAG, "execute ${args.processId} err-tail=${response.err.takeLast(600)}")
                    } catch (_: Exception) { /* diagnóstico best-effort */ }
                    val msg = "download concluído sem arquivo final"
                    emitOnUi("yt-dlp-progress") {
                        put("id", args.processId)
                        put("type", "error")
                        put("message", msg)
                    }
                    rememberFinished(args.processId, FinishedJob(false, null, 0, msg, System.currentTimeMillis()))
                    invoke.reject(msg)
                    return@cmd
                }
                val size = File(finalPath).length()
                Log.i(TAG, "execute ${args.processId} ok: $finalPath ($size)")
                // Pasta privada do app é invisível (Files/Downloads, players):
                // publica cópia na coleção pública p/ o usuário achar o arquivo.
                // Best-effort: nunca falha o download se a publicação falhar.
                val publicUri = appFiles.publishToPublicDownloads(File(finalPath), args.publicSubdir)
                val filtersNote = if (args.warnFilters)
                    "Filtros de áudio/vídeo indisponíveis no mobile — arquivo salvo sem normalização/nitidez."
                else null
                emitOnUi("yt-dlp-progress") {
                    put("id", args.processId)
                    put("type", "complete")
                    put("filePath", finalPath)
                    put("size", size)
                    if (publicUri != null) put("publicUri", publicUri)
                    if (filtersNote != null) put("subWarning", filtersNote)
                }
                notifications.showDlComplete(args.processId, args.title, File(finalPath))
                rememberFinished(args.processId, FinishedJob(true, finalPath, size, null, System.currentTimeMillis()))
                invoke.resolve(JSObject().apply {
                    put("filePath", finalPath)
                    put("size", size)
                    if (publicUri != null) put("publicUri", publicUri)
                    if (filtersNote != null) put("subWarning", filtersNote)
                })
            } catch (e: Exception) {
                Log.e(TAG, "execute ${args.processId} falhou", e)
                val msg = (e.message ?: "Falha no download").take(500)
                emitOnUi("yt-dlp-progress") {
                    put("id", args.processId)
                    put("type", "error")
                    put("message", msg)
                }
                notifications.showDlError(args.processId, args.title, msg)
                rememberFinished(args.processId, FinishedJob(false, null, 0, msg, System.currentTimeMillis()))
                invoke.reject(msg)
            } finally {
                activeJobs.remove(args.processId)
                lastProgress.remove(args.processId)
            }
        }
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(CancelArgs::class.java)
        try {
            val killed = YoutubeDL.getInstance().destroyProcessById(args.id)
            if (args.cleanup) {
                lastPaths.remove(args.id)?.let { YtDlpParsing.removeTempVariants(File(it)) }
                notifications.cancelDlNotification(args.id)
            } else {
                lastPaths.remove(args.id)
                notifications.showDlPaused(args.id, "")
            }
            invoke.resolve(JSObject().apply { put("success", killed) })
        } catch (e: Exception) {
            invoke.reject(e.message ?: "Erro ao cancelar")
        }
    }

    // ---- jobState: reconciliação pós-background (ver activeJobs acima) ----
    @Command
    fun jobState(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(CancelArgs::class.java)
            val id = args.id
            if (id.isBlank()) {
                invoke.reject("id vazio")
                return
            }
            val res = JSObject()
            val fin = finishedJobs[id]
            when {
                activeJobs.containsKey(id) -> res.put("state", "running")
                fin != null -> {
                    res.put("state", "finished")
                    res.put("ok", fin.ok)
                    if (fin.filePath != null) res.put("filePath", fin.filePath)
                    res.put("size", fin.size)
                    if (fin.error != null) res.put("error", fin.error)
                }
                else -> res.put("state", "unknown")
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "jobState falhou")
        }
    }

    // ---- jobProgress: snapshot p/ poll do engine (ver lastProgress) ----
    // Retorna o último progresso parseado do job ATIVO. Job sumiu (concluiu,
    // falhou, cancelou) = active:false e o engine reconcilia via `jobState`.
    @Command
    fun jobProgress(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(CancelArgs::class.java)
            val id = args.id
            if (id.isBlank()) {
                invoke.reject("id vazio")
                return
            }
            val res = JSObject()
            val p = if (activeJobs.containsKey(id)) lastProgress[id] else null
            if (p == null) {
                res.put("active", false)
            } else {
                res.put("active", true)
                res.put("percent", p.percent)
                res.put("speed", p.speed)
                res.put("eta", p.eta)
                res.put("downloaded", p.downloaded)
                res.put("total", p.total)
            }
            invoke.resolve(res)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "jobProgress falhou")
        }
    }


    // ---- auto-update sideload (sem Play Store) ----
    // Baixa o APK da release via DownloadManager do sistema (notificação,
    // retry e visibilidade nativos) e, ao concluir, abre o instalador.
    // Sem Play Store não há updater embarcado: este é o canal de update.

    // Espelha o toggle de updates da UI (chamado no boot e ao trocar).
    // Persiste em prefs p/ o MainActivity ler antes do JS existir.
    @Command
    fun setUpdatesEnabled(invoke: Invoke) {
        updatesEnabled = try {
            invoke.parseArgs(UpdatesEnabledArgs::class.java).enabled
        } catch (_: Exception) {
            true
        }
        try {
            activity.getSharedPreferences("linkfetcher", android.content.Context.MODE_PRIVATE)
                .edit().putBoolean("updates_enabled", updatesEnabled).apply()
        } catch (_: Exception) { }
        invoke.resolve(JSObject().apply { put("updatesEnabled", updatesEnabled) })
    }

    companion object {
        // Lido pelo MainActivity antes do WebView/JS existir.
        fun updatesEnabledStored(activity: Activity): Boolean = try {
            activity.getSharedPreferences("linkfetcher", android.content.Context.MODE_PRIVATE)
                .getBoolean("updates_enabled", true)
        } catch (_: Exception) {
            true
        }
    }

    // ABI do aparelho no vocabulário dos assets da release
    // (LinkFetcher-<abi>.apk): arm64, armv7, x86_64, x86.
    @Command
    fun appAbi(invoke: Invoke) {
        val raw = android.os.Build.SUPPORTED_ABIS?.firstOrNull() ?: ""
        val abi = when {
            raw.startsWith("arm64") -> "arm64"
            raw.startsWith("armeabi") || raw.startsWith("armv7") -> "armv7"
            raw.startsWith("x86_64") -> "x86_64"
            raw.startsWith("x86") -> "x86"
            else -> ""
        }
        invoke.resolve(JSObject().apply { put("abi", abi) })
    }

    // Versão do extrator embarcado p/ diagnóstico na UI (bitrot A1: se a
    // extração quebrar, o usuário informa a versão sem logcat).
    @Command
    fun engineVersion(invoke: Invoke) {
        try {
            val v = try {
                YoutubeDL.getInstance().version(activity.applicationContext) ?: ""
            } catch (_: Exception) { "" }
            invoke.resolve(JSObject().apply { put("version", v) })
        } catch (e: Exception) {
            invoke.reject(e.message ?: "sem versão")
        }
    }

    @Command
    fun updateDownload(invoke: Invoke) {
        val args = invoke.parseArgs(UpdateDownloadArgs::class.java)
        // Sanitiza como o publish: sem separadores, sem `..`, só .apk.
        // O comando é same-app, mas path traversal nunca deve passar.
        val fileName = args.fileName.substringAfterLast('/').substringAfterLast('\\')
            .trim().replace(Regex("\\.+"), ".")
            .take(64).trim().trim('.')
        if (args.url.isBlank() || !fileName.endsWith(".apk") || ".." in fileName) {
            invoke.reject("URL ou nome de APK inválidos")
            return
        }
        try {
            val dm = activity.getSystemService(android.app.DownloadManager::class.java)
                ?: return invoke.reject("DownloadManager indisponível")
            val req = android.app.DownloadManager.Request(android.net.Uri.parse(args.url))
                .setTitle("LinkFetcher $fileName")
                .setDescription("Baixando atualização…")
                .setNotificationVisibility(
                    android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "LinkFetcher/$fileName")
                .setMimeType("application/vnd.android.package-archive")
                .setAllowedOverRoaming(false)
            val id = dm.enqueue(req)
            pendingUpdates[id] = fileName
            Log.i(TAG, "update download enfileirado: $fileName (id=$id)")
            invoke.resolve(JSObject().apply { put("downloadId", id) })
        } catch (e: Exception) {
            Log.e(TAG, "updateDownload falhou", e)
            invoke.reject(e.message ?: "Falha ao baixar atualização")
        }
    }

    private fun onUpdateDownloaded(id: Long) {
        val fileName = pendingUpdates.remove(id) ?: return
        try {
            val dm = activity.getSystemService(android.app.DownloadManager::class.java)
                ?: return
            val q = android.app.DownloadManager.Query().setFilterById(id)
            dm.query(q)?.use { c ->
                if (!c.moveToFirst()) return
                val status = c.getInt(
                    c.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_STATUS)
                )
                if (status != android.app.DownloadManager.STATUS_SUCCESSFUL) {
                    Log.w(TAG, "update download malsucedido: $fileName status=$status")
                    return
                }
            }
            val file = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "LinkFetcher/$fileName"
            )
            if (!file.exists()) {
                Log.w(TAG, "update APK não encontrado: ${file.absolutePath}")
                return
            }
            val uri = FileProvider.getUriForFile(
                activity, "${activity.packageName}.fileprovider", file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            Log.i(TAG, "instalador aberto: $fileName")
        } catch (e: Exception) {
            Log.e(TAG, "instalação do update falhou: $fileName", e)
        }
    }

    // ---- arquivos ----


    @Command
    fun getDownloadsDir(invoke: Invoke) {
        try {
            val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: activity.filesDir
            if (!dir.exists()) dir.mkdirs()
            invoke.resolve(JSObject().apply { put("dir", dir.absolutePath) })
        } catch (e: Exception) {
            invoke.reject(e.message ?: "Sem acesso ao armazenamento")
        }
    }

    // Publica um arquivo da pasta privada (ex. backup JSON salvo via
    // plugin-fs) em Downloads públicos. Generalização do publish do execute.
    @Command
    fun publishFile(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(OpenArgs::class.java)
            val file = appFiles.jailedAppFile(args.path)
            if (file == null) {
                Log.e(TAG, "publishFile: fora da pasta do app: ${args.path}")
                invoke.reject("arquivo fora da pasta do app")
                return
            }
            if (!file.exists() || !file.isFile) {
                invoke.reject("arquivo não encontrado")
                return
            }
            val uri = appFiles.publishToPublicDownloads(file, null)
            if (uri == null) {
                invoke.reject("falha ao publicar em Downloads")
                return
            }
            Log.i(TAG, "publishFile ok: ${file.name} -> $uri")
            invoke.resolve(JSObject().apply { put("uri", uri) })
        } catch (e: Exception) {
            Log.e(TAG, "publishFile falhou", e)
            invoke.reject(e.message ?: "Falha ao publicar arquivo")
        }
    }

    @Command
    fun openFile(invoke: Invoke) {
        val args = invoke.parseArgs(OpenArgs::class.java)
        val file = appFiles.jailedAppFile(args.path)
        if (file == null) {
            Log.e(TAG, "openFile: fora da pasta do app: ${args.path}")
            invoke.reject("arquivo fora da pasta do app")
            return
        }
        if (!file.exists()) {
            Log.e(TAG, "openFile: não existe: ${args.path}")
            invoke.reject("arquivo não encontrado")
            return
        }
        try {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val mime = MimeTypeMap.getSingleton()
                .getMimeTypeFromExtension(file.extension.lowercase())
                ?: "*/*"
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            // Sem app tratador o chooser lança: vira reject com mensagem real
            // (o frontend exibe no toast) em vez de silêncio.
            if (intent.resolveActivity(activity.packageManager) == null) {
                Log.e(TAG, "openFile: sem app para $mime (${file.name})")
                invoke.reject("Nenhum app para abrir .$mime")
                return
            }
            activity.startActivity(Intent.createChooser(intent, file.name))
            Log.i(TAG, "openFile ok: ${file.absolutePath} ($mime)")
            invoke.resolve(JSObject())
        } catch (e: Exception) {
            Log.e(TAG, "openFile falhou: ${file.absolutePath}", e)
            invoke.reject(e.message ?: "Nenhum app para abrir o arquivo")
        }
    }

}

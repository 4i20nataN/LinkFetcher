// Args dos comandos do plugin (extraído do YtDlpPlugin.kt). Verbatim.
package com.linkfetcher.app

import app.tauri.annotation.InvokeArg

@InvokeArg
class ProbeArgs {
    var url: String = ""
    var proxy: String? = null
}

@InvokeArg
class SearchArgs {
    var query: String = ""
    var platform: String = "youtube"
    var maxResults: Int? = null
    var proxy: String? = null
}

@InvokeArg
class ExecuteArgs {
    var argv: List<String> = emptyList()
    var processId: String = ""
    // Rust marca true quando `--ppa` (normalizar/nitidez) foi removido do
    // argv mobile: o arquivo sai sem os filtros — avisa em vez de calar.
    var warnFilters: Boolean = false
    // Subpasta pública de destino (Downloads/<subdir>). Nulo/vazio = padrão.
    var publicSubdir: String? = null
    // Título p/ a notificação nativa de progresso/conclusão.
    var title: String = ""
}

@InvokeArg
class CancelArgs {
    var id: String = ""
    var cleanup: Boolean = false
}

@InvokeArg
class OpenArgs {
    var path: String = ""
}

@InvokeArg
class UpdateDownloadArgs {
    var url: String = ""
    var fileName: String = ""
}

@InvokeArg
class UpdatesEnabledArgs {
    var enabled: Boolean = true
}

# Arquitetura e Funções do Sistema - Downloader Universal

Este documento detalha de forma técnica, resumida e não-narrativa a estrutura e o fluxo do aplicativo Downloader Universal, idealizado sob princípios de Clean Architecture, modularidade e foco em UX/UI com o tema Frosted Glass.

---

## 📂 Estrutura de Pastas e Módulos

O código está estruturado em módulos independentes para facilitar a manutenção e escalabilidade de novos provedores e funcionalidades:

```bash
/src
  ├── components/          # Componentes globais reutilizáveis
  │   ├── Sidebar.tsx      # Barra lateral de navegação e menu colapsável
  │   └── ThemeWrapper.tsx # Orquestrador de temas (Claro, Escuro, Cinza) e cores de destaque
  │
  ├── context/             # Gerenciamento de Estado Global do React
  │   └── AppContext.tsx   # Contexto unificado (Configurações, Favoritos, Fila, Downloads)
  │
  ├── core/                # Camada Core (Lógica de Negócios e Serviços do Sistema)
  │   ├── engine/          # Motor de simulação de downloads de alto desempenho
  │   │   └── DownloadEngine.ts
  │   ├── plugins/         # Extensões e Extratores de Plataformas (Provedores)
  │   │   ├── MediaProvider.ts  # Contrato/Interface abstrata para novos plugins
  │   │   └── Providers.ts      # Implementações (YouTube, Instagram, Arquivos Diretos, Genérico)
  │   ├── storage/         # Persistência de Dados e Mecanismo de Backup
  │   │   └── Storage.ts        # Métodos de I/O em LocalStorage e controle de cache
  │   └── i18n.ts          # Sistema de Internacionalização (Português/Inglês) com useTranslation
  │
  ├── features/            # Camadas de Visualização e Controle por Funcionalidade
  │   ├── analyzer/        # Tela principal para análise e decodificação de links (LinkAnalyzer)
  │   ├── downloads/       # Gerenciador avançado de progresso de downloads (DownloadManager)
  │   ├── favorites/       # Painel de links favoritos com notas pessoais (FavoritesView)
  │   ├── later/           # Fila inteligente de agendamento (DownloadLaterView)
  │   ├── youtube/         # Painel de pesquisa integrado (YouTubeSearch / Busca Online)
  │   └── settings/        # Painel de configuração completo (SettingsView)
  │
  └── types.ts             # Definições de Tipos estritos e Interfaces do TypeScript
```

---

## 🛠️ Detalhamento das Funções e Componentes

### 1. Sistema de Provedores (`/src/core/plugins/`)
- **`MediaProvider` (Interface)**: Define o contrato padrão com métodos como `canHandle(url)`, `extractMetadata(url)` e `getFormats()`.
- **`DirectFileProvider`**: Reconhece links que apontam diretamente para arquivos de mídia (`.png`, `.jpg`, `.webp`, `.mp4`, `.mp3`, `.mov`, `.gif`). Extrai automaticamente dimensões e formatos sem placeholders de vídeo genéricos.
- **`ProviderRegistry`**: Registra todos os plugins disponíveis e retorna dinamicamente o provedor ideal para qualquer link colado.

### 2. Motor de Download (`/src/core/engine/`)
- **`DownloadEngineClass`**: Controla a fila com limite de downloads simultâneos, limites de banda (em KB/s) configurados pelo usuário, pausa, retomada, reordenamento, e exclusão de itens na fila.
- **Simulação Realista**: Emprega cálculos de tempo (ETA) e progresso baseados em pacotes de bytes por segundo para uma representação perfeita do ambiente local.

### 3. Internacionalização (`/src/core/i18n.ts`)
- Suporta múltiplos idiomas de forma robusta e modular:
  - **`pt`**: Português brasileiro.
  - **`en`**: Inglês norte-americano.
- Ganho de desempenho via hook `useTranslation(settings)`, traduzindo dinamicamente labels, placeholders, modais, confirmações e feedbacks visuais em tempo de execução.

### 4. Gerenciamento Visual (`/src/components/ThemeWrapper.tsx`)
- Implementa o tema **Frosted Glass** (Efeito Vidro Fosco Translúcido) com alta legibilidade:
  - **Modo Claro (Light)**: Cores suaves de areia/areia cinza que preservam o conforto visual sem saturação.
  - **Modo Escuro (Dark)**: Canvas futurista, contrastes balanceados.
  - **Modo Cinza (Gray)**: Tons neutros de cinza com personalidade visual refinada.
- Oferece 14 cores de destaque (*Accent Colors*) que aplicam variáveis CSS estritas e classes dinâmicas do Tailwind para botões, bordas, anéis de foco e textos de destaque.

### 5. Mecanismo de Armazenamento e Backup (`/src/core/storage/`)
- **Persistência Segura**: Persiste todas as preferências, favoritos com notas e fila do usuário localmente via `localStorage`.
- **Exportação/Importação**: Implementa conversão e compactação de configuração de backup JSON para facilitar a migração ou salvamento das preferências de favoritos em outras plataformas ou navegadores.

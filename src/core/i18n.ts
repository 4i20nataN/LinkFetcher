import { AppSettings } from '../types';

export const translations = {
  pt: {
    // Sidebar
    analyzeLink: 'Analisar Link',
    analyzeDesc: 'Cole e baixe mídias',
    onlineSearch: 'Busca Online',
    searchDesc: 'Pesquisa integrada',
    downloads: 'Downloads',
    downloadsDesc: 'Fila e gerenciador',
    favorites: 'Favoritos',
    favoritesDesc: 'Links salvos',
    downloadLater: 'Baixar Depois',
    laterDesc: 'Fila inteligente',
    settings: 'Configurações',
    settingsDesc: 'Ajustes e personalização',
    mediaDownloader: 'MEDIA DOWNLOADER',
    universalDownloader: 'Downloader Universal',
    activeDriver: 'Motor Ativo',
    adminRole: 'ADMIN / ARQUITETO',

    // Analyzer View
    mainPlaceholder: 'Cole o link aqui (ex: https://youtube.com/watch?v=...)',
    supportedPlats: 'SUPORTADOS:',
    btnAnalyze: 'Analisar',
    btnPaste: 'Colar Link',
    selectOption: 'Selecione uma opção',
    availableFormats: 'Formatos e Resoluções Disponíveis',
    btnDownloadSelected: 'Baixar no Formato Escolhido',
    originalResolution: 'RESOLUÇÃO ORIGINAL',
    codec: 'CODEC DE VÍDEO',
    contentType: 'TIPO DE CONTEÚDO',
    favorite: 'Favoritar',
    unfavorite: 'Desfavoritar',
    laterBtn: 'Baixar Depois',
    inLaterBtn: 'Salvo p/ Depois',
    btnOriginal: 'Link Original',
    extractedFrom: 'Conteúdo extraído automaticamente de',
    viewsCount: 'visualizações',
    publishedDate: 'Publicado:',
    authorLabel: 'Autor:',
    unknown: 'Não especificado',

    // Features Cards
    feat1Title: 'Análise Instantânea',
    feat1Desc: 'Motor de decodificação automatizado de alta velocidade.',
    feat2Title: 'Download Seguro',
    feat2Desc: 'Arquivos baixados de forma segura, livre de anúncios ou pop-ups.',
    feat3Title: 'Compatibilidade Ampla',
    feat3Desc: 'Suporte estendido para as principais mídias e formatos.',

    // Search View
    searchTitle: 'Busca Online Integrada',
    searchSubtitle: 'Pesquise e analise mídias diretamente sem sair do aplicativo.',
    searchPlaceholder: 'Pesquise por títulos, palavras-chave ou canais...',
    btnSearch: 'Pesquisar',
    btnAnalyzeVideo: 'Analisar',
    views: 'visualizações',

    // Downloads View
    downloadsTitle: 'Gerenciador de Downloads',
    downloadsSubtitle: 'Monitore sua fila de transferências ativas e histórico em tempo real.',
    generalProgress: 'Progresso Geral',
    downloadsSimult: 'Downloads Simultâneos',
    activeSpeed: 'Velocidade',
    etaRemaining: 'Restante',
    simultCount: '{count} downloads',
    downloadQueue: 'Fila de Downloads',
    downloadHistory: 'Histórico',
    clearCompleted: 'Limpar Concluídos',
    noDownloads: 'Nenhum download ativo ou concluído',
    noDownloadsDesc: 'Insira um link na aba de análise para iniciar uma transferência.',
    speedLimit: 'Limite de Banda',
    unlimited: 'Ilimitado',
    kbps: 'KB/s',
    mbps: 'MB/s',

    // Favorites View
    favoritesTitle: 'Links Favoritos',
    favoritesSubtitle: 'Seus links favoritos salvos para download rápido.',
    noFavorites: 'Nenhum favorito ainda',
    noFavoritesDesc: 'Toque na estrela ao analisar qualquer link para salvá-lo aqui.',
    notesPlaceholder: 'Adicione anotações sobre este link...',
    dateAdded: 'Adicionado em:',

    // Download Later View
    laterTitle: 'Baixar Depois',
    laterSubtitle: 'Links que você salvou para baixar em um momento mais oportuno.',
    noLater: 'Nenhum link na fila',
    noLaterDesc: 'Salve mídias para baixar depois enquanto navega.',
    btnStartDownload: 'Analisar para Baixar',

    // Settings View
    settingsTitle: 'Configurações do Sistema',
    settingsSubtitle: 'Ajuste as preferências de visualização, limites de rede e configurações do sistema de download.',
    visualPrefs: 'Personalização Visual',
    themeMode: 'Modo do Tema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    themeGray: 'Cinza',
    accentColor: 'Cor Principal do Aplicativo',
    networkSettings: 'Rede e Fila de Downloads',
    simultaneousDownloads: 'Downloads Simultâneos',
    bandwidthLimit: 'Limite de Banda de Rede',
    unlimitedMax: 'Sem limites (Máximo)',
    wifiOnly: 'Baixar Apenas via Wi-Fi',
    wifiOnlyDesc: 'Impede downloads usando redes de dados móveis.',
    storageSettings: 'Armazenamento e Pasta Padrão',
    destinationFolder: 'Pasta de Destino padrão (Simulado)',
    appLanguage: 'Idioma do Aplicativo',
    backupSettings: 'Configurações de Backup',
    exportBackup: 'Exportar Backup',
    importBackup: 'Importar Backup',
    aboutTitle: 'Sobre o Downloader Universal',
    aboutDesc: 'Uma solução robusta e unificada para download de mídias de alta performance. Desenvolvido para rodar de forma leve no Windows, Mobile e Web.',
    backupSuccess: 'Backup exportado com sucesso!',
    importSuccess: 'Backup importado com sucesso!',
    importFailed: 'Falha ao importar o arquivo de backup.',
    placeholderText: 'Texto simulado...',
    notifLabel: 'Notificações do Sistema',
    notifDesc: 'Exibir balões de aviso ao concluir downloads.',
    updatesLabel: 'Buscar atualizações automaticamente',
    updatesDesc: 'Busca patches do motor de análise na inicialização.',
    
    // Accents
    indigo: 'Índigo',
    emerald: 'Esmeralda',
    amber: 'Âmbar',
    rose: 'Rosa',
    violet: 'Violeta',
    sky: 'Céu',
    teal: 'Mental',
    fuchsia: 'Fúcsia',
    orange: 'Laranja',
    cyan: 'Ciano',
    lime: 'Limão',
    crimson: 'Carmesim',
    pink: 'Pink',
    slate: 'Aço',
  },
  en: {
    // Sidebar
    analyzeLink: 'Analyze Link',
    analyzeDesc: 'Paste and download media',
    onlineSearch: 'Online Search',
    searchDesc: 'Integrated search',
    downloads: 'Downloads',
    downloadsDesc: 'Queue and manager',
    favorites: 'Favorites',
    favoritesDesc: 'Saved links',
    downloadLater: 'Download Later',
    laterDesc: 'Smart queue',
    settings: 'Settings',
    settingsDesc: 'Adjustments & options',
    mediaDownloader: 'MEDIA DOWNLOADER',
    universalDownloader: 'Universal Downloader',
    activeDriver: 'Engine Active',
    adminRole: 'ADMIN / ARCHITECT',

    // Analyzer View
    mainPlaceholder: 'Paste link here (e.g. https://youtube.com/watch?v=...)',
    supportedPlats: 'SUPPORTED:',
    btnAnalyze: 'Analyze',
    btnPaste: 'Paste Link',
    selectOption: 'Select an option',
    availableFormats: 'Available Formats & Resolutions',
    btnDownloadSelected: 'Download in Selected Format',
    originalResolution: 'ORIGINAL RESOLUTION',
    codec: 'VIDEO CODEC',
    contentType: 'CONTENT TYPE',
    favorite: 'Favorite',
    unfavorite: 'Unfavorite',
    laterBtn: 'Download Later',
    inLaterBtn: 'Saved Later',
    btnOriginal: 'Original Link',
    extractedFrom: 'Content automatically extracted from',
    viewsCount: 'views',
    publishedDate: 'Published:',
    authorLabel: 'Author:',
    unknown: 'Not specified',

    // Features Cards
    feat1Title: 'Instant Analysis',
    feat1Desc: 'Automated high-speed media decoding engine.',
    feat2Title: 'Secure Download',
    feat2Desc: 'Files downloaded safely, 100% free of ads and pop-ups.',
    feat3Title: 'Wide Compatibility',
    feat3Desc: 'Extended support for major media formats and servers.',

    // Search View
    searchTitle: 'Integrated Online Search',
    searchSubtitle: 'Search and analyze media directly without leaving the app.',
    searchPlaceholder: 'Search by titles, keywords, or channels...',
    btnSearch: 'Search',
    btnAnalyzeVideo: 'Analyze',
    views: 'views',

    // Downloads View
    downloadsTitle: 'Download Manager',
    downloadsSubtitle: 'Monitor your active download queue and history in real-time.',
    generalProgress: 'General Progress',
    downloadsSimult: 'Simultaneous Downloads',
    activeSpeed: 'Speed',
    etaRemaining: 'Remaining',
    simultCount: '{count} downloads',
    downloadQueue: 'Download Queue',
    downloadHistory: 'History',
    clearCompleted: 'Clear Completed',
    noDownloads: 'No active or completed downloads',
    noDownloadsDesc: 'Enter a link in the analysis tab to start a transfer.',
    speedLimit: 'Speed Limit',
    unlimited: 'Unlimited',
    kbps: 'KB/s',
    mbps: 'MB/s',

    // Favorites View
    favoritesTitle: 'Favorite Links',
    favoritesSubtitle: 'Your favorite links saved for quick access and download.',
    noFavorites: 'No favorites yet',
    noFavoritesDesc: 'Tap the star when analyzing any link to save it here.',
    notesPlaceholder: 'Add notes about this link...',
    dateAdded: 'Added on:',

    // Download Later View
    laterTitle: 'Download Later',
    laterSubtitle: 'Links you saved to download at a more convenient time.',
    noLater: 'No links in queue',
    noLaterDesc: 'Save media to download later while you browse.',
    btnStartDownload: 'Analyze to Download',

    // Settings View
    settingsTitle: 'System Settings',
    settingsSubtitle: 'Adjust viewing preferences, network limits, and download system settings.',
    visualPrefs: 'Visual Customization',
    themeMode: 'Theme Mode',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeGray: 'Gray',
    accentColor: 'App Theme Accent',
    networkSettings: 'Network & Download Queue',
    simultaneousDownloads: 'Simultaneous Downloads',
    bandwidthLimit: 'Network Bandwidth Limit',
    unlimitedMax: 'No limits (Maximum)',
    wifiOnly: 'Download over Wi-Fi Only',
    wifiOnlyDesc: 'Prevents downloads on cellular/mobile data.',
    storageSettings: 'Storage & Default Folder',
    destinationFolder: 'Default Destination Folder (Simulated)',
    appLanguage: 'App Language',
    backupSettings: 'Backup Settings',
    exportBackup: 'Export Backup',
    importBackup: 'Import Backup',
    aboutTitle: 'About Universal Downloader',
    aboutDesc: 'A robust and unified solution for high-performance media downloading. Designed to run lightweight on Windows, Mobile, and Web.',
    backupSuccess: 'Backup exported successfully!',
    importSuccess: 'Backup imported successfully!',
    importFailed: 'Failed to import backup file.',
    placeholderText: 'Simulated text...',
    notifLabel: 'System Notifications',
    notifDesc: 'Display notification banners when downloads finish.',
    updatesLabel: 'Check for updates automatically',
    updatesDesc: 'Checks for analysis engine patches on startup.',

    // Accents
    indigo: 'Indigo',
    emerald: 'Emerald',
    amber: 'Amber',
    rose: 'Rose',
    violet: 'Violet',
    sky: 'Sky',
    teal: 'Teal',
    fuchsia: 'Fuchsia',
    orange: 'Orange',
    cyan: 'Cyan',
    lime: 'Lime',
    crimson: 'Crimson',
    pink: 'Pink',
    slate: 'Steel/Slate',
  }
};

export type TranslationKey = keyof typeof translations.pt;

export function useTranslation(settings: { language: 'pt' | 'en' }) {
  const lang = settings.language || 'pt';
  const dict = translations[lang] || translations.pt;
  
  const t = (key: TranslationKey, variables?: Record<string, string | number>): string => {
    let text = dict[key] || translations.pt[key] || '';
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return { t, language: lang };
}

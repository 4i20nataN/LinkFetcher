import { MediaInfo, PlatformId, MediaFormat, SearchResult } from '../../types';
import { MediaProvider } from './MediaProvider';

// Helper to generate a random number within a range
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to format view count
const formatViews = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export class YouTubeProvider implements MediaProvider {
  id: PlatformId = 'youtube';
  name = 'YouTube';
  domains = [/youtube\.com/i, /youtu\.be/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    // Simulate short API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    let videoId = 'dQw4w9WgXcQ'; // default
    const ytMatch = url.match(/(?:v=|\/vi\/|youtu\.be\/|\/v\/|\/e\/|embed\/|shorts\/)([^#&?]*)/);
    if (ytMatch && ytMatch[1] && ytMatch[1].length === 11) {
      videoId = ytMatch[1];
    }

    const titleOptions = [
      'Lo-Fi Beats para Programar e Estudar 🎧',
      'Flutter Clean Architecture & Riverpod Tutorial Completo 🚀',
      'Como criar Apps de Alta Performance com React & Vite',
      'Nothing Phone (2a) - O Review Sincero e Detalhado',
      'A História do Synthwave e Cyberpunk Beats 🌌',
      'Natureza Relaxante 4K - Som de Chuva na Floresta 🌧️'
    ];
    
    const authorOptions = [
      'Lofi Girl',
      'Código Limpo Tech',
      'Arquiteto de Software',
      'Tech Reviews BR',
      'Cosmic Sounds',
      'Sons da Natureza'
    ];

    const randomIndex = rand(0, titleOptions.length - 1);
    let title = url.includes('dQw4w9WgXcQ') ? 'Rick Astley - Never Gonna Give You Up (Official Music Video)' : titleOptions[randomIndex];
    let author = url.includes('dQw4w9WgXcQ') ? 'Rick Astley' : authorOptions[randomIndex];
    let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      // Fetch actual metadata from YouTube oEmbed via noembed (CORS-enabled)
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) author = data.author_name;
      }
    } catch (err) {
      console.warn('Failed to fetch real YouTube metadata using oEmbed, using simulated data.', err);
    }
    
    const viewsNum = rand(50000, 15000000);
    const duration = '12:45';

    const formats: MediaFormat[] = [
      { id: 'yt_video_1080p', ext: 'mp4', quality: '1080p (Full HD)', sizeEst: '48.5 MB', sizeBytes: 48.5 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'yt_video_720p', ext: 'mp4', quality: '720p (HD)', sizeEst: '26.2 MB', sizeBytes: 26.2 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'yt_video_480p', ext: 'mp4', quality: '480p (SD)', sizeEst: '15.4 MB', sizeBytes: 15.4 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'yt_video_360p', ext: 'mp4', quality: '360p (SD)', sizeEst: '9.2 MB', sizeBytes: 9.2 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'yt_video_240p', ext: 'mp4', quality: '240p (SD)', sizeEst: '4.8 MB', sizeBytes: 4.8 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'yt_audio_mp3', ext: 'mp3', quality: 'Áudio MP3 (320kbps)', sizeEst: '6.5 MB', sizeBytes: 6.5 * 1024 * 1024, codec: 'mp3', type: 'audio' }
    ];

    return {
      id: videoId,
      title,
      author,
      channel: author,
      duration,
      resolution: 'Original',
      sizeEst: 'Original',
      formats,
      codec: 'Original',
      type: 'video',
      publishDate: undefined,
      views: undefined,
      platform: 'youtube',
      originalUrl: url,
      thumbnailUrl,
      status: 'success'
    };
  }
}

export class TikTokProvider implements MediaProvider {
  id: PlatformId = 'tiktok';
  name = 'TikTok';
  domains = [/tiktok\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1400));
    
    const formats: MediaFormat[] = [
      { id: 'tt_v_original', ext: 'mp4', quality: '1080p (Original)', sizeEst: '15.4 MB', sizeBytes: 15.4 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'tt_v_no_watermark', ext: 'mp4', quality: '1080p (Sem Marca d\'Água)', sizeEst: '14.8 MB', sizeBytes: 14.8 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'tt_a_mp3', ext: 'mp3', quality: '192kbps (Música Original)', sizeEst: '2.1 MB', sizeBytes: 2.1 * 1024 * 1024, codec: 'mp3', type: 'audio' }
    ];

    return {
      id: 'tt_' + rand(10000, 99999),
      title: 'Desafio de UI Design minimalista feito em 10 minutos! 🎨✨ #uidesign #figma #viral',
      author: '@designer_pro',
      channel: '@designer_pro',
      duration: '00:58',
      resolution: '1080x1920',
      sizeEst: '15.4 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Há 2 dias',
      views: formatViews(rand(10000, 450000)),
      platform: 'tiktok',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class InstagramProvider implements MediaProvider {
  id: PlatformId = 'instagram';
  name = 'Instagram';
  domains = [/instagram\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1600));

    const isReel = url.includes('/reel/') || url.includes('/reels/');
    const type = isReel ? 'video' : 'image';

    const formats: MediaFormat[] = isReel ? [
      { id: 'ig_v_hd', ext: 'mp4', quality: '1080p (Reel HD)', sizeEst: '28.1 MB', sizeBytes: 28.1 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'ig_a_m4a', ext: 'm4a', quality: '128kbps (Áudio)', sizeEst: '1.4 MB', sizeBytes: 1.4 * 1024 * 1024, codec: 'aac', type: 'audio' }
    ] : [
      { id: 'ig_i_hq', ext: 'jpg', quality: 'Alta Qualidade (1080x1080)', sizeEst: '1.8 MB', sizeBytes: 1.8 * 1024 * 1024, codec: 'jpg', type: 'image' },
      { id: 'ig_i_webp', ext: 'webp', quality: 'WebP Comprimido', sizeEst: '0.6 MB', sizeBytes: 0.6 * 1024 * 1024, codec: 'webp', type: 'image' },
      { id: 'ig_i_png', ext: 'png', quality: 'PNG Original', sizeEst: '4.2 MB', sizeBytes: 4.2 * 1024 * 1024, codec: 'png', type: 'image' }
    ];

    return {
      id: 'ig_' + rand(10000, 99999),
      title: isReel 
        ? 'Rotina matinal de um Engenheiro de Software morando em Berlim 🇩🇪☕️' 
        : 'Nova coleção de paletas de cores do Nothing OS e Material You minimalista. Salve para depois!',
      author: '@tech_lifestyle',
      channel: '@tech_lifestyle',
      duration: isReel ? '00:45' : 'Imagem',
      resolution: isReel ? '1080x1920' : '1080x1080',
      sizeEst: isReel ? '28.1 MB' : '1.8 MB',
      formats,
      codec: isReel ? 'H.264 / AAC' : 'JPEG',
      type,
      publishDate: 'Há 5 dias',
      views: isReel ? formatViews(rand(15000, 890000)) : undefined,
      platform: 'instagram',
      originalUrl: url,
      thumbnailUrl: isReel 
        ? 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60'
        : 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class FacebookProvider implements MediaProvider {
  id: PlatformId = 'facebook';
  name = 'Facebook';
  domains = [/facebook\.com/i, /fb\.watch/i, /fb\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const formats: MediaFormat[] = [
      { id: 'fb_v_hd', ext: 'mp4', quality: 'HD (720p)', sizeEst: '42.1 MB', sizeBytes: 42.1 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'fb_v_sd', ext: 'mp4', quality: 'SD (360p)', sizeEst: '12.4 MB', sizeBytes: 12.4 * 1024 * 1024, codec: 'h264 / aac', type: 'video' }
    ];

    return {
      id: 'fb_' + rand(10000, 99999),
      title: 'Apresentação dos novos recursos da Inteligência Artificial do Google para Desenvolvedores 🤖🇧🇷',
      author: 'Portal de Tecnologia',
      channel: 'Portal de Tecnologia',
      duration: '03:40',
      resolution: '1280x720',
      sizeEst: '42.1 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: '20 de Junho de 2026',
      views: formatViews(rand(5000, 120000)),
      platform: 'facebook',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class XProvider implements MediaProvider {
  id: PlatformId = 'x';
  name = 'X (Twitter)';
  domains = [/x\.com/i, /twitter\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1300));
    
    const formats: MediaFormat[] = [
      { id: 'x_v_1080p', ext: 'mp4', quality: '1080p (FullHD)', sizeEst: '32.6 MB', sizeBytes: 32.6 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'x_v_720p', ext: 'mp4', quality: '720p (HD)', sizeEst: '18.4 MB', sizeBytes: 18.4 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'x_v_480p', ext: 'mp4', quality: '480p (SD)', sizeEst: '9.1 MB', sizeBytes: 9.1 * 1024 * 1024, codec: 'h264 / aac', type: 'video' }
    ];

    return {
      id: 'x_' + rand(10000, 99999),
      title: 'Incrível! O robô humanoide realizando tarefas domésticas com extrema precisão e feedback tátil avançado! 🤖🧠',
      author: '@FutureTechChannel',
      channel: '@FutureTechChannel',
      duration: '01:24',
      resolution: '1920x1080',
      sizeEst: '32.6 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Há 12 horas',
      views: formatViews(rand(20000, 2400000)),
      platform: 'x',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class RedditProvider implements MediaProvider {
  id: PlatformId = 'reddit';
  name = 'Reddit';
  domains = [/reddit\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1600));
    
    const formats: MediaFormat[] = [
      { id: 'rd_v_hq', ext: 'mp4', quality: 'HD com Áudio Integrado', sizeEst: '55.3 MB', sizeBytes: 55.3 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'rd_v_noaudio', ext: 'mp4', quality: 'Apenas Vídeo (Mudo)', sizeEst: '48.1 MB', sizeBytes: 48.1 * 1024 * 1024, codec: 'h264', type: 'video' },
      { id: 'rd_a_aac', ext: 'aac', quality: 'Áudio Separado', sizeEst: '7.2 MB', sizeBytes: 7.2 * 1024 * 1024, codec: 'aac', type: 'audio' }
    ];

    return {
      id: 'rd_' + rand(10000, 99999),
      title: 'r/battlestations - Meu setup de programação finalizado! Foco total em ergonomia e iluminação indireta quente.',
      author: 'u/mechanical_coder',
      channel: 'r/battlestations',
      duration: '02:10',
      resolution: '1920x1080',
      sizeEst: '55.3 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Há 1 dia',
      views: formatViews(rand(1000, 45000)),
      platform: 'reddit',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class SoundCloudProvider implements MediaProvider {
  id: PlatformId = 'soundcloud';
  name = 'SoundCloud';
  domains = [/soundcloud\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1400));
    
    const formats: MediaFormat[] = [
      { id: 'sc_a_320', ext: 'mp3', quality: 'Alta Definição (320kbps MP3)', sizeEst: '11.8 MB', sizeBytes: 11.8 * 1024 * 1024, codec: 'mp3', type: 'audio' },
      { id: 'sc_a_opus', ext: 'opus', quality: 'HQ Streaming (128kbps Opus)', sizeEst: '4.7 MB', sizeBytes: 4.7 * 1024 * 1024, codec: 'opus', type: 'audio' },
      { id: 'sc_a_wav', ext: 'wav', quality: 'Lossless WAV Original', sizeEst: '52.1 MB', sizeBytes: 52.1 * 1024 * 1024, codec: 'pcm', type: 'audio' }
    ];

    return {
      id: 'sc_' + rand(10000, 99999),
      title: 'Midnight Drive (Synthwave/Retrowave Radio Edit)',
      author: 'RetroFuture Beats',
      channel: 'RetroFuture Beats',
      duration: '04:55',
      resolution: 'Áudio',
      sizeEst: '11.8 MB',
      formats,
      codec: 'MP3 / Opus / WAV',
      type: 'audio',
      publishDate: '12 de Maio de 2026',
      views: formatViews(rand(25000, 1200000)),
      platform: 'soundcloud',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class SpotifyProvider implements MediaProvider {
  id: PlatformId = 'spotify';
  name = 'Spotify';
  domains = [/spotify\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const formats: MediaFormat[] = [
      { id: 'sp_a_ogg', ext: 'ogg', quality: 'Premium Ogg Vorbis (320kbps)', sizeEst: '8.4 MB', sizeBytes: 8.4 * 1024 * 1024, codec: 'vorbis', type: 'audio' },
      { id: 'sp_a_mp3', ext: 'mp3', quality: 'Compatível MP3 (320kbps)', sizeEst: '8.4 MB', sizeBytes: 8.4 * 1024 * 1024, codec: 'mp3', type: 'audio' },
      { id: 'sp_a_m4a', ext: 'm4a', quality: 'AAC Standard (256kbps)', sizeEst: '6.7 MB', sizeBytes: 6.7 * 1024 * 1024, codec: 'aac', type: 'audio' }
    ];

    return {
      id: 'sp_' + rand(10000, 99999),
      title: 'Starlight Eclipse - Neon Dreams (Acoustic Version)',
      author: 'The Cosmic Quartet',
      channel: 'The Cosmic Quartet',
      duration: '03:40',
      resolution: 'Áudio',
      sizeEst: '8.4 MB',
      formats,
      codec: 'Ogg Vorbis / MP3',
      type: 'audio',
      publishDate: '10 de Janeiro de 2026',
      views: formatViews(rand(100000, 9500000)),
      platform: 'spotify',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class TwitchProvider implements MediaProvider {
  id: PlatformId = 'twitch';
  name = 'Twitch';
  domains = [/twitch\.tv/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const formats: MediaFormat[] = [
      { id: 'tw_v_1080p60', ext: 'mp4', quality: '1080p (60fps Source)', sizeEst: '342.5 MB', sizeBytes: 342.5 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'tw_v_720p60', ext: 'mp4', quality: '720p (60fps)', sizeEst: '184.1 MB', sizeBytes: 184.1 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'tw_a_aac', ext: 'aac', quality: 'Apenas Áudio do Stream', sizeEst: '22.8 MB', sizeBytes: 22.8 * 1024 * 1024, codec: 'aac', type: 'audio' }
    ];

    return {
      id: 'tw_' + rand(10000, 99999),
      title: 'Grande Final do Campeonato de Velocidade Retro - Melhores Momentos do Stream 🎮🏁',
      author: 'SpeedyGamerLive',
      channel: 'SpeedyGamerLive',
      duration: '15:20',
      resolution: '1920x1080 (60fps)',
      sizeEst: '342.5 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Clip de Ontem',
      views: formatViews(rand(4000, 98000)),
      platform: 'twitch',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class PinterestProvider implements MediaProvider {
  id: PlatformId = 'pinterest';
  name = 'Pinterest';
  domains = [/pinterest\.com/i, /pin\.it/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const formats: MediaFormat[] = [
      { id: 'pt_i_png', ext: 'png', quality: 'Resolução Ultra PNG', sizeEst: '6.4 MB', sizeBytes: 6.4 * 1024 * 1024, codec: 'png', type: 'image' },
      { id: 'pt_i_jpg', ext: 'jpg', quality: 'Resolução Original JPG', sizeEst: '2.8 MB', sizeBytes: 2.8 * 1024 * 1024, codec: 'jpg', type: 'image' },
      { id: 'pt_i_webp', ext: 'webp', quality: 'WebP Comprimido', sizeEst: '0.8 MB', sizeBytes: 0.8 * 1024 * 1024, codec: 'webp', type: 'image' }
    ];

    return {
      id: 'pt_' + rand(10000, 99999),
      title: 'Conceito Minimalista de Arquitetura Nórdica e Decoração Sustentável 🪵🏠',
      author: 'Studio Design Nordic',
      channel: 'Studio Design Nordic',
      duration: 'Imagem',
      resolution: '1200x1600',
      sizeEst: '6.4 MB',
      formats,
      codec: 'PNG / JPEG',
      type: 'image',
      publishDate: 'Publicado há 1 mês',
      views: undefined,
      platform: 'pinterest',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class ThreadsProvider implements MediaProvider {
  id: PlatformId = 'threads';
  name = 'Threads';
  domains = [/threads\.net/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1400));
    
    const formats: MediaFormat[] = [
      { id: 'th_v_hd', ext: 'mp4', quality: '1080p HD (Original)', sizeEst: '18.2 MB', sizeBytes: 18.2 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'th_i_jpg', ext: 'jpg', quality: 'Alta Resolução JPG', sizeEst: '1.2 MB', sizeBytes: 1.2 * 1024 * 1024, codec: 'jpg', type: 'image' }
    ];

    return {
      id: 'th_' + rand(10000, 99999),
      title: 'Código limpo de verdade: Estrutura modular escalável para aplicativos modernos! O que acham dessa abordagem?',
      author: '@architect_master',
      channel: '@architect_master',
      duration: '00:32',
      resolution: '1080x1080',
      sizeEst: '18.2 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Há 3 horas',
      views: formatViews(rand(200, 18000)),
      platform: 'threads',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

export class VimeoProvider implements MediaProvider {
  id: PlatformId = 'vimeo';
  name = 'Vimeo';
  domains = [/vimeo\.com/i];

  canHandle(url: string): boolean {
    return this.domains.some(regex => regex.test(url));
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const formats: MediaFormat[] = [
      { id: 'vm_v_1080p', ext: 'mp4', quality: '1080p Cinematic (HQ)', sizeEst: '88.4 MB', sizeBytes: 88.4 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'vm_v_720p', ext: 'mp4', quality: '720p HD Standard', sizeEst: '44.2 MB', sizeBytes: 44.2 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
      { id: 'vm_a_mp3', ext: 'mp3', quality: '320kbps Audio Stream', sizeEst: '8.4 MB', sizeBytes: 8.4 * 1024 * 1024, codec: 'mp3', type: 'audio' }
    ];

    return {
      id: 'vm_' + rand(10000, 99999),
      title: 'Echoes of Silence - Short Cinematic Documentary (Official Selection)',
      author: 'Vanguard Film Studio',
      channel: 'Vanguard Film Studio',
      duration: '06:12',
      resolution: '1920x1080',
      sizeEst: '88.4 MB',
      formats,
      codec: 'H.264 / AAC',
      type: 'video',
      publishDate: 'Outubro de 2025',
      views: formatViews(rand(1000, 120000)),
      platform: 'vimeo',
      originalUrl: url,
      thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&auto=format&fit=crop&q=60',
      status: 'success'
    };
  }
}

// Direct File Provider (Images, Audio, Video files)
export class DirectFileProvider implements MediaProvider {
  id: PlatformId = 'generic';
  name = 'Arquivo Direto';
  domains = [
    /[./](webp|png|jpg|jpeg|gif|bmp|svg|mp3|wav|ogg|m4a|mp4|webm|mov|mkv|aac|flac)([?#/]|$)/i,
    /susercontent\.com/i,
    /unsplash\.com/i,
    /image/i,
    /^data:image/i
  ];

  canHandle(url: string): boolean {
    if (url.startsWith('data:')) return true;
    const hasExtension = /[./](webp|png|jpg|jpeg|gif|bmp|svg|mp3|wav|ogg|m4a|mp4|webm|mov|mkv|aac|flac)([?#/]|$)/i.test(url);
    const isImageHost = url.includes('down-br.img.susercontent.com') || 
                        url.includes('images.unsplash.com') ||
                        url.includes('picsum.photos') ||
                        url.includes('image') ||
                        url.includes('photo');
    return hasExtension || isImageHost;
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 800));

    let filename = 'arquivo_midia';
    try {
      if (url.startsWith('data:')) {
        const mimeMatch = url.match(/^data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const ext = mime.split('/')[1] || 'png';
        filename = `imagem_base64.${ext}`;
      } else {
        const parsed = new URL(url);
        const pathname = parsed.pathname;
        const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (lastSegment && lastSegment.includes('.')) {
          filename = decodeURIComponent(lastSegment.split('?')[0]);
        } else {
          filename = parsed.hostname;
        }
      }
    } catch (_) {}

    const title = `Download: ${filename}`;

    let type: 'image' | 'audio' | 'video' = 'image';
    let duration = 'Imagem';
    let resolution = 'Auto-detectada';
    let formats: MediaFormat[] = [];
    let codec = 'N/A';
    let thumbnailUrl = url;

    const isAudio = /[./](mp3|wav|ogg|m4a|aac|flac)([?#/]|$)/i.test(url);
    const isVideo = /[./](mp4|webm|mov|mkv)([?#/]|$)/i.test(url);
    const isImage = !isAudio && !isVideo || url.startsWith('data:image/');

    if (isImage) {
      type = 'image';
      duration = 'Imagem';
      resolution = 'Auto-detectada';
      codec = 'PNG / JPEG / WebP';
      thumbnailUrl = url;

      formats = [
        { id: 'dir_img_orig', ext: 'png', quality: 'Formato PNG', sizeEst: '2.5 MB', sizeBytes: 2.5 * 1024 * 1024, codec: 'png', type: 'image' },
        { id: 'dir_img_webp', ext: 'webp', quality: 'Formato WebP', sizeEst: '0.8 MB', sizeBytes: 0.8 * 1024 * 1024, codec: 'webp', type: 'image' },
        { id: 'dir_img_jpg', ext: 'jpg', quality: 'Formato JPEG', sizeEst: '1.4 MB', sizeBytes: 1.4 * 1024 * 1024, codec: 'jpeg', type: 'image' },
      ];

      try {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolution = `${img.naturalWidth}×${img.naturalHeight}`;
            resolve(null);
          };
          img.onerror = () => {
            resolution = '1200×800';
            resolve(null);
          };
          img.src = url;
          setTimeout(resolve, 1000);
        });
      } catch (e) {
        resolution = '1200×800';
      }
    } else if (isAudio) {
      type = 'audio';
      duration = '03:45';
      resolution = 'Áudio';
      codec = 'MP3 / WAV';
      thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=60';

      formats = [
        { id: 'dir_aud_mp3', ext: 'mp3', quality: 'Qualidade MP3 (320kbps)', sizeEst: '8.5 MB', sizeBytes: 8.5 * 1024 * 1024, codec: 'mp3', type: 'audio' },
        { id: 'dir_aud_wav', ext: 'wav', quality: 'Qualidade Original (WAV)', sizeEst: '35.2 MB', sizeBytes: 35.2 * 1024 * 1024, codec: 'pcm', type: 'audio' },
      ];

      try {
        await new Promise((resolve) => {
          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
            const minutes = Math.floor(audio.duration / 60);
            const seconds = Math.floor(audio.duration % 60);
            duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            resolve(null);
          };
          audio.onerror = () => {
            resolve(null);
          };
          setTimeout(resolve, 1000);
        });
      } catch (e) {}
    } else if (isVideo) {
      type = 'video';
      duration = '02:30';
      resolution = '1920x1080';
      codec = 'H.264 / AAC';
      thumbnailUrl = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&auto=format&fit=crop&q=60';

      formats = [
        { id: 'dir_vid_mp4', ext: 'mp4', quality: 'HD Original (MP4)', sizeEst: '45.1 MB', sizeBytes: 45.1 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
        { id: 'dir_vid_webm', ext: 'webm', quality: 'HD Compresso (WebM)', sizeEst: '32.4 MB', sizeBytes: 32.4 * 1024 * 1024, codec: 'vp9', type: 'video' },
        { id: 'dir_vid_mp3', ext: 'mp3', quality: 'Apenas Áudio (MP3)', sizeEst: '5.4 MB', sizeBytes: 5.4 * 1024 * 1024, codec: 'mp3', type: 'audio' },
      ];

      try {
        await new Promise((resolve) => {
          const video = document.createElement('video');
          video.src = url;
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            const minutes = Math.floor(video.duration / 60);
            const seconds = Math.floor(video.duration % 60);
            duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (video.videoWidth && video.videoHeight) {
              resolution = `${video.videoWidth}x${video.videoHeight}`;
            }
            resolve(null);
          };
          video.onerror = () => {
            resolve(null);
          };
          setTimeout(resolve, 1000);
        });
      } catch (e) {}
    }

    let host = 'Arquivo Direto';
    try {
      const parsed = new URL(url);
      host = parsed.hostname.replace('www.', '');
    } catch (_) {}

    return {
      id: 'dir_' + rand(10000, 99999),
      title,
      author: host,
      channel: host,
      duration,
      resolution,
      sizeEst: formats[0]?.sizeEst || 'N/A',
      formats,
      codec,
      type,
      publishDate: 'Não especificado',
      views: undefined,
      platform: 'generic',
      originalUrl: url,
      thumbnailUrl,
      status: 'success'
    };
  }
}

// Fallback Provider for unmatched links
export class GenericProvider implements MediaProvider {
  id: PlatformId = 'generic';
  name = 'Link Web Genérico';
  domains = [/.*/];

  canHandle(_url: string): boolean {
    return true;
  }

  async analyze(url: string): Promise<MediaInfo> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const domains = ['youtube', 'tiktok', 'instagram', 'facebook', 'x', 'reddit', 'soundcloud', 'spotify', 'twitch', 'pinterest', 'threads', 'vimeo'];
    let matchedId: PlatformId = 'generic';
    for (const dom of domains) {
      if (url.toLowerCase().includes(dom)) {
        matchedId = dom as PlatformId;
        break;
      }
    }

    const isAudio = /[./](mp3|wav|ogg|m4a|aac|flac)([?#/]|$)/i.test(url) || url.toLowerCase().includes('audio') || url.toLowerCase().includes('sound');
    const isVideo = /[./](mp4|webm|mov|mkv)([?#/]|$)/i.test(url) || url.toLowerCase().includes('video') || url.toLowerCase().includes('movie') || url.toLowerCase().includes('clip');
    const isImage = /[./](webp|png|jpg|jpeg|gif|bmp|svg)([?#/]|$)/i.test(url) || url.toLowerCase().includes('image') || url.toLowerCase().includes('photo') || url.toLowerCase().includes('pic') || url.startsWith('data:image/');

    let type: 'image' | 'audio' | 'video' = 'video';
    let duration = '02:30';
    let resolution = '1920x1080';
    let codec = 'H.264 / AAC';
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60';
    let formats: MediaFormat[] = [];

    if (isImage) {
      type = 'image';
      duration = 'Imagem';
      resolution = 'Auto-detectada';
      codec = 'PNG / JPEG / WebP';
      thumbnailUrl = url.startsWith('data:') ? url : 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=60';
      formats = [
        { id: 'gen_i_png', ext: 'png', quality: 'Formato PNG', sizeEst: '2.5 MB', sizeBytes: 2.5 * 1024 * 1024, codec: 'png', type: 'image' },
        { id: 'gen_i_webp', ext: 'webp', quality: 'Formato WebP', sizeEst: '0.8 MB', sizeBytes: 0.8 * 1024 * 1024, codec: 'webp', type: 'image' },
        { id: 'gen_i_jpg', ext: 'jpg', quality: 'Formato JPEG', sizeEst: '1.4 MB', sizeBytes: 1.4 * 1024 * 1024, codec: 'jpeg', type: 'image' }
      ];
    } else if (isAudio) {
      type = 'audio';
      duration = '03:45';
      resolution = 'Áudio';
      codec = 'MP3 / WAV';
      thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=60';
      formats = [
        { id: 'gen_a_mp3', ext: 'mp3', quality: 'Qualidade MP3 (320kbps)', sizeEst: '8.5 MB', sizeBytes: 8.5 * 1024 * 1024, codec: 'mp3', type: 'audio' },
        { id: 'gen_a_wav', ext: 'wav', quality: 'Qualidade Original (WAV)', sizeEst: '35.2 MB', sizeBytes: 35.2 * 1024 * 1024, codec: 'pcm', type: 'audio' }
      ];
    } else {
      type = 'video';
      duration = '02:30';
      resolution = '1920x1080';
      codec = 'H.264 / AAC';
      thumbnailUrl = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&auto=format&fit=crop&q=60';
      formats = [
        { id: 'gen_v_hd', ext: 'mp4', quality: 'HD Original', sizeEst: '48.2 MB', sizeBytes: 48.2 * 1024 * 1024, codec: 'h264 / aac', type: 'video' },
        { id: 'gen_a_mp3', ext: 'mp3', quality: 'Áudio MP3 (320kbps)', sizeEst: '9.2 MB', sizeBytes: 9.2 * 1024 * 1024, codec: 'mp3', type: 'audio' }
      ];
    }

    let host = 'Servidor Web';
    try {
      if (url.startsWith('data:')) {
        host = 'Data URI';
      } else {
        const parsed = new URL(url);
        host = parsed.hostname.replace('www.', '');
      }
    } catch (_) {}

    return {
      id: 'gen_' + rand(10000, 99999),
      title: `Conteúdo extraído automaticamente de ${host}`,
      author: host,
      channel: host,
      duration,
      resolution,
      sizeEst: formats[0]?.sizeEst || '48.2 MB',
      formats,
      codec,
      type,
      publishDate: 'Não especificado',
      views: formatViews(rand(100, 25000)),
      platform: matchedId,
      originalUrl: url,
      thumbnailUrl,
      status: 'success'
    };
  }
}

// Registry Manager
export class ProviderRegistry {
  private static providers: MediaProvider[] = [
    new DirectFileProvider(),
    new YouTubeProvider(),
    new TikTokProvider(),
    new InstagramProvider(),
    new FacebookProvider(),
    new XProvider(),
    new RedditProvider(),
    new SoundCloudProvider(),
    new SpotifyProvider(),
    new TwitchProvider(),
    new PinterestProvider(),
    new ThreadsProvider(),
    new VimeoProvider()
  ];

  private static fallback = new GenericProvider();

  static register(provider: MediaProvider) {
    this.providers.push(provider);
  }

  static getProviderForUrl(url: string): MediaProvider {
    for (const p of this.providers) {
      if (p.canHandle(url)) {
        return p;
      }
    }
    return this.fallback;
  }

  static getPlatformConfig(id: PlatformId) {
    const configs: Record<PlatformId, { name: string; icon: string; color: string; domains: string[] }> = {
      youtube: { name: 'YouTube', icon: 'Youtube', color: 'bg-red-600 text-white', domains: ['youtube.com', 'youtu.be'] },
      tiktok: { name: 'TikTok', icon: 'Tv', color: 'bg-neutral-900 text-white border border-neutral-700', domains: ['tiktok.com'] },
      instagram: { name: 'Instagram', icon: 'Instagram', color: 'bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white', domains: ['instagram.com'] },
      facebook: { name: 'Facebook', icon: 'Facebook', color: 'bg-blue-600 text-white', domains: ['facebook.com'] },
      x: { name: 'X / Twitter', icon: 'Twitter', color: 'bg-black text-white border border-neutral-800', domains: ['x.com', 'twitter.com'] },
      reddit: { name: 'Reddit', icon: 'MessageSquare', color: 'bg-orange-600 text-white', domains: ['reddit.com'] },
      soundcloud: { name: 'SoundCloud', icon: 'Music', color: 'bg-orange-500 text-white', domains: ['soundcloud.com'] },
      spotify: { name: 'Spotify', icon: 'Disc', color: 'bg-emerald-500 text-black', domains: ['spotify.com'] },
      twitch: { name: 'Twitch', icon: 'Twitch', color: 'bg-purple-600 text-white', domains: ['twitch.tv'] },
      pinterest: { name: 'Pinterest', icon: 'Image', color: 'bg-red-700 text-white', domains: ['pinterest.com'] },
      threads: { name: 'Threads', icon: 'Hash', color: 'bg-zinc-900 text-white', domains: ['threads.net'] },
      vimeo: { name: 'Vimeo', icon: 'Video', color: 'bg-sky-500 text-white', domains: ['vimeo.com'] },
      generic: { name: 'Web Link / File', icon: 'Globe', color: 'bg-zinc-600 text-white', domains: [] }
    };
    return configs[id] || configs.generic;
  }
}

// Generate high quality mock search results for YouTube
export function mockSearchYouTube(query: string): SearchResult[] {
  const topics = [
    { title: 'Como dominar Clean Architecture no Flutter em 2026', author: 'Código Limpo Tech', image: '1507679799987-c73779587ccf' },
    { title: 'Synthwave Relaxante - Estudo e Concentração Profunda 🌃', author: 'Cosmic Sounds', image: '1550751827-4bd374c3f58b' },
    { title: 'Dicas Práticas de Figma para Engenheiros de Software', author: 'Figma BR Master', image: '1581291518633-83b4ebd1d83e' },
    { title: 'Nothing Phone (2a) - Por que esse design chama tanto a atenção?', author: 'Tech Reviews BR', image: '1546054454-aa26e2b734c7' },
    { title: 'Som de Chuva e Trovões na Floresta Tropical ⛈️ (10 Horas)', author: 'Natureza Relaxante', image: '1470071459604-3b5ec3a7fe05' },
    { title: 'React 19 + TypeScript + Tailwind CSS: O Futuro do Front-End', author: 'RocketCode BR', image: '1517694712202-14dd9538aa97' }
  ];

  // If query is empty, return defaults. Otherwise, customize titles using the query
  return topics.map((t, idx) => {
    const finalTitle = query 
      ? `${query.charAt(0).toUpperCase() + query.slice(1)}: ${t.title.split(' - ')[0]}`
      : t.title;

    const secs = rand(120, 2700);
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;

    return {
      id: `yt_search_${idx}_${rand(100, 999)}`,
      title: finalTitle,
      url: `https://youtube.com/watch?v=mockId${idx}ab`,
      thumbnail: `https://images.unsplash.com/photo-${t.image}?w=400&auto=format&fit=crop&q=60`,
      duration: secs,
      duration_string: `${mins}:${remaining.toString().padStart(2, '0')}`,
      view_count: rand(12000, 5400000),
      uploader: t.author,
      description: `${t.title} - ${t.author}`,
    };
  });
}

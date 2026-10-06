// Caixa de entrada do link + faixa de plataformas (extraída do LinkAnalyzer).
import { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../core/i18n';
import {
  getAccentBgClass, getAccentRingClass
} from '../../components/ThemeWrapper';
import {
  Play, Trash2, RefreshCw,
  Music, Camera, Globe, X, Cloud, Radio, MessageCircle, MessageSquare,
  Film, Pin, Linkedin, Github, Heart, Send, Gamepad2, AtSign,
  BookOpen, GitBranch, PenTool
} from 'lucide-react';

export interface AnalyzeFormProps {
  url: string;
  setUrl: (v: string) => void;
  loading: boolean;
  onPaste: () => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function AnalyzeForm({ url, setUrl, loading, onPaste, onSubmit, onClear }: AnalyzeFormProps) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const animationFrameRef = useRef<number | null>(null);
  const smoothSetPlaybackRate = (element: HTMLElement | null, targetRate: number) => {
    if (!element) return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const animations = element.getAnimations();
    if (animations.length === 0) return;

    const startRate = animations[0].playbackRate;
    const duration = 400; // ms
    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const currentRate = startRate + (targetRate - startRate) * ease;

      animations.forEach(a => a.playbackRate = currentRate);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="p-4 md:p-6 rounded-3xl glass-card shadow-2xl">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('mainPlaceholder')}
            autoComplete="off"
              className={`
              w-full pl-4 pr-12 py-3.5 rounded-xl lf-surface border lf-border text-sm text-white placeholder-zinc-500
              focus:border-transparent focus:outline-none focus:ring-2 ${getAccentRingClass(settings)} transition-all
            `}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
          {url && (
            <button
              onClick={onClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/5 lf-text-secondary hover:text-white transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onPaste}
            type="button"
            className="flex-1 md:flex-none px-4 py-3.5 rounded-xl lf-surface-raised hover:bg-zinc-850 text-zinc-200 border lf-border hover:text-white font-medium text-sm transition-all"
          >
            {t('btnPaste')}
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={loading || !url}
            className={`
              flex-1 md:flex-none px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-lg
              ${loading || !url
                ? 'lf-surface-raised lf-text-muted cursor-not-allowed border lf-border shadow-none'
                : `${getAccentBgClass(settings)} hover:shadow-indigo-500/20`
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <RefreshCw size={16} className="animate-spin" /> {settings.language === 'en' ? 'Analyzing...' : 'Analisando...'}
              </span>
            ) : (
              t('btnAnalyze')
            )}
          </button>
        </div>
      </div>

      {/* Supported platforms strip */}
      <div
        className="slider-container"
        onMouseEnter={(e) => {
          const row = e.currentTarget.querySelector('.scroll-row');
          if (row) smoothSetPlaybackRate(row as HTMLElement, 0.35);
        }}
        onMouseLeave={(e) => {
          const row = e.currentTarget.querySelector('.scroll-row');
          if (row) smoothSetPlaybackRate(row as HTMLElement, 1);
        }}
      >
        <div className="scroll-row" id="scrollRow">
          <div className="tag youtube"><Play size={18} />YouTube</div>
          <div className="tag tiktok"><Music size={18} />TikTok</div>
          <div className="tag instagram"><Camera size={18} />Instagram</div>
          <div className="tag facebook"><Globe size={18} />Facebook</div>
          <div className="tag twitter"><X size={18} />X</div>
          <div className="tag soundcloud"><Cloud size={18} />SoundCloud</div>
          <div className="tag twitch"><Radio size={18} />Twitch</div>
          <div className="tag reddit"><MessageCircle size={18} />Reddit</div>
          <div className="tag discord"><MessageSquare size={18} />Discord</div>
          <div className="tag kick"><Play size={18} />Kick</div>
          <div className="tag vimeo"><Film size={18} />Vimeo</div>
          <div className="tag pinterest"><Pin size={18} />Pinterest</div>
          <div className="tag linkedin"><Linkedin size={18} />LinkedIn</div>
          <div className="tag github"><Github size={18} />GitHub</div>
          <div className="tag patreon"><Heart size={18} />Patreon</div>
          <div className="tag telegram"><Send size={18} />Telegram</div>
          <div className="tag snapchat"><Send size={18} />Snapchat</div>
          <div className="tag steam"><Gamepad2 size={18} />Steam</div>
          <div className="tag threads"><AtSign size={18} />Threads</div>
          <div className="tag medium"><BookOpen size={18} />Medium</div>
          <div className="tag behance"><PenTool size={18} />Behance</div>
          <div className="tag dribbble"><PenTool size={18} />Dribbble</div>
          <div className="tag gitlab"><GitBranch size={18} />GitLab</div>
          <div className="tag tumblr"><PenTool size={18} />Tumblr</div>
          <div className="tag flickr"><Camera size={18} />Flickr</div>
          <div className="tag mastodon"><Radio size={18} />Mastodon</div>
          <div className="tag bandcamp"><Music size={18} />Bandcamp</div>

          <div className="tag youtube"><Play size={18} />YouTube</div>
          <div className="tag tiktok"><Music size={18} />TikTok</div>
          <div className="tag instagram"><Camera size={18} />Instagram</div>
          <div className="tag facebook"><Globe size={18} />Facebook</div>
          <div className="tag twitter"><X size={18} />X</div>
          <div className="tag soundcloud"><Cloud size={18} />SoundCloud</div>
          <div className="tag twitch"><Radio size={18} />Twitch</div>
          <div className="tag reddit"><MessageCircle size={18} />Reddit</div>
          <div className="tag discord"><MessageSquare size={18} />Discord</div>
          <div className="tag kick"><Play size={18} />Kick</div>
          <div className="tag vimeo"><Film size={18} />Vimeo</div>
          <div className="tag pinterest"><Pin size={18} />Pinterest</div>
          <div className="tag linkedin"><Linkedin size={18} />LinkedIn</div>
          <div className="tag github"><Github size={18} />GitHub</div>
          <div className="tag patreon"><Heart size={18} />Patreon</div>
          <div className="tag telegram"><Send size={18} />Telegram</div>
          <div className="tag snapchat"><Send size={18} />Snapchat</div>
          <div className="tag steam"><Gamepad2 size={18} />Steam</div>
          <div className="tag threads"><AtSign size={18} />Threads</div>
          <div className="tag medium"><BookOpen size={18} />Medium</div>
          <div className="tag behance"><PenTool size={18} />Behance</div>
          <div className="tag dribbble"><PenTool size={18} />Dribbble</div>
          <div className="tag gitlab"><GitBranch size={18} />GitLab</div>
          <div className="tag tumblr"><PenTool size={18} />Tumblr</div>
          <div className="tag flickr"><Camera size={18} />Flickr</div>
          <div className="tag mastodon"><Radio size={18} />Mastodon</div>
          <div className="tag bandcamp"><Music size={18} />Bandcamp</div>
        </div>
      </div>
    </div>
  );
}

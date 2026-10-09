// Modal de preview do comando yt-dlp (extraído do DownloadManager).
import { createPortal } from 'react-dom';
import { DownloadItem, type AppSettings } from '../../../types';
import { buildArgsPreview } from '../../../core/ytdlp/buildArgsPreview';
import { X, Code } from 'lucide-react';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { scaleIn, fadeIn, transitions } from '../../../animation/variants';
import { getAccentTextClass } from '../../../components/ThemeWrapper';

export interface CommandPreviewProps {
  item: DownloadItem;
  settings: AppSettings;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export function CommandPreview({ item: commandPreview, settings, onClose, showToast }: CommandPreviewProps) {
  // Portal no body (mesmo motivo do DeleteConfirm): `fixed` sob ancestral
  // animado ancora no meio da lista.
  return createPortal((
    <AnimatedCard
      variant={fadeIn}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <AnimatedCard
        variant={scaleIn}
        transition={transitions.modal}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700/50">
          <div className="flex items-center gap-2.5">
            <Code size={16} className="text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              {settings.language === 'en' ? 'Download Command' : 'Comando de Download'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {settings.iconStyle === 'emoji' ? <span>✖️</span> : <X size={14} className={getAccentTextClass(settings)} />}
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
            {settings.language === 'en' ? 'Title' : 'Titulo'}
          </p>
          <p className="text-xs text-zinc-300 mb-4 truncate">{commandPreview.title}</p>

          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
            yt-dlp
          </p>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-emerald-400 whitespace-pre-wrap break-all">
            {(() => {
              const args = buildArgsPreview(commandPreview);
              const lines: string[] = ['yt-dlp \\'];
              for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (i === args.length - 1) {
                  lines.push(`  "${arg}"`);
                } else if (arg === '--') {
                  // Separador anti-flag (S11): última linha, sem `\`.
                  const next = args[i + 1];
                  lines.push(next ? `  -- "${next}"` : `  --`);
                  i++;
                } else if (arg.startsWith('-')) {
                  const next = args[i + 1];
                  if (next && !next.startsWith('-')) {
                    lines.push(`  ${arg} "${next}" \\`);
                    i++;
                  } else {
                    lines.push(`  ${arg} \\`);
                  }
                } else {
                  lines.push(`  "${arg}" \\`);
                }
              }
              return lines.join('\n');
            })()}
          </pre>
        </div>

        <div className="px-5 py-3 border-t border-zinc-700/50 flex justify-end">
          <button
            onClick={() => {
              const args = buildArgsPreview(commandPreview);
              const cmd = 'yt-dlp ' + args.map(a => `"${a}"`).join(' ');
              navigator.clipboard.writeText(cmd).then(() => {
                showToast(settings.language === 'en' ? 'Command copied!' : 'Comando copiado!');
              }).catch(() => {
                showToast(settings.language === 'en' ? 'Failed to copy' : 'Falha ao copiar');
              });
            }}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            {settings.language === 'en' ? 'Copy Command' : 'Copiar Comando'}
          </button>
        </div>
          </AnimatedCard>
      </AnimatedCard>
  ), document.body);
}

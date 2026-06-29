import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FavoriteItem } from '../../types';
import { Star, Link2, ExternalLink, ArrowRight, Trash2, Edit2, Check, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass, getAccentBorderClass, getAccentRingClass 
} from '../../components/ThemeWrapper';
import { ProviderRegistry } from '../../core/plugins/Providers';

export const FavoritesView: React.FC = () => {
  const { settings, favorites, toggleFavorite, updateFavoriteNotes, setSelectedUrl, setActiveTab } = useApp();
  const { t } = useTranslation(settings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const handleStartEditing = (fav: FavoriteItem) => {
    setEditingId(fav.id);
    setEditNotes(fav.notes || '');
  };

  const handleSaveNotes = (id: string) => {
    updateFavoriteNotes(id, editNotes);
    setEditingId(null);
  };

  const handleAnalyze = (url: string) => {
    setSelectedUrl(url);
    setActiveTab('analyze');
  };

  const handleExportFavorites = () => {
    try {
      const dataStr = JSON.stringify(favorites, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorites-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {
      console.error('Failed to export favorites');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4">
      {/* Title Header with Export Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div className="text-center md:text-left space-y-1">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
            {t('favoritesTitle')}
          </h2>
          <p className="text-zinc-400 text-sm md:text-base">
            {t('favoritesSubtitle')}
          </p>
        </div>
        
        {favorites.length > 0 && (
          <button
            onClick={handleExportFavorites}
            className={`
              w-full md:w-auto px-4 py-2.5 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md
              ${getAccentBgClass(settings)} hover:scale-[1.02] active:scale-[0.98]
            `}
          >
            <Download size={14} />
            {settings.language === 'en' ? 'Backup Favorites' : 'Exportar Favoritos'}
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        /* Empty State */
        <div className="p-16 text-center rounded-3xl glass-card border-dashed flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/60 text-zinc-500">
            <Star size={32} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-zinc-300">{t('noFavorites')}</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {t('noFavoritesDesc')}
            </p>
          </div>
        </div>
      ) : (
        /* Favorites Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence initial={false}>
            {favorites.map((fav) => {
              const platform = ProviderRegistry.getPlatformConfig(fav.platform);
              const isEditing = editingId === fav.id;

              return (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="p-4 rounded-2xl glass-card flex flex-col justify-between space-y-4 group hover:bg-white/10 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
                      <img
                        src={fav.thumbnailUrl}
                        alt={fav.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {platform && (
                        <span className={`absolute top-1 left-1 p-1 rounded text-[7px] font-bold ${platform.color} shadow`}>
                          {platform.name}
                        </span>
                      )}
                    </div>

                    {/* Metadata details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[9px] font-semibold text-zinc-500 block font-mono uppercase tracking-wider">
                        {t('dateAdded')} {new Date(fav.dateAdded).toLocaleDateString()}
                      </span>
                      <h4 className="font-semibold text-xs text-white leading-snug line-clamp-2">
                        {fav.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 block truncate font-mono">
                        {fav.url}
                      </p>
                    </div>
                  </div>

                  {/* Notes Segment */}
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase flex items-center gap-1">
                        <FileText size={10} /> {settings.language === 'en' ? 'Notes / Annotations' : 'Observações / Anotações'}
                      </span>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEditing(fav)}
                          className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                          title={settings.language === 'en' ? 'Edit notes' : 'Editar anotação'}
                        >
                          <Edit2 size={10} />
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex gap-1.5 mt-1.5">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder={t('notesPlaceholder')}
                          className={`
                            flex-1 px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-white placeholder-zinc-600
                            focus:outline-none focus:ring-1 ${getAccentRingClass(settings)}
                          `}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(fav.id)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNotes(fav.id)}
                          className={`p-2 rounded ${getAccentBgClass(settings)} text-white shadow-md`}
                          title={settings.language === 'en' ? 'Save' : 'Salvar'}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-300 italic min-h-[16px] leading-relaxed">
                        {fav.notes || (settings.language === 'en' ? 'No notes registered.' : 'Nenhuma nota registrada.')}
                      </p>
                    )}
                  </div>

                  {/* Card bottom footer actions */}
                  <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                    <button
                      onClick={() => toggleFavorite({ id: fav.id, title: fav.title, url: fav.url, platform: fav.platform, thumbnailUrl: fav.thumbnailUrl })}
                      className="text-zinc-500 hover:text-rose-400 flex items-center gap-1.5 font-semibold transition-colors"
                    >
                      <Trash2 size={13} /> {settings.language === 'en' ? 'Delete' : 'Excluir'}
                    </button>

                    <div className="flex items-center gap-2">
                      <a
                        href={fav.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'View original' : 'Ver original'}
                      >
                        <ExternalLink size={13} />
                      </a>
                      
                      <button
                        onClick={() => handleAnalyze(fav.url)}
                        className={`
                          px-3.5 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 transition-all
                          ${getAccentBgClass(settings)}
                        `}
                      >
                        {settings.language === 'en' ? 'Analyze' : 'Analisar'} <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clipboard, X, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ClipboardPopupProps {
  onDismiss: () => void;
  onAnalyze: (url: string) => void;
}

export function ClipboardPopup({ onDismiss, onAnalyze }: ClipboardPopupProps) {
  const { settings } = useApp();
  const [detectedUrl, setDetectedUrl] = useState('');
  const [visible, setVisible] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!window.electron;
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

  // Desktop: listen for Electron clipboard events
  useEffect(() => {
    if (!isElectron || !settings.clipboardMonitoringEnabled) return;

    const unsub = window.electron!.onClipboardUrlDetected((url: string) => {
      setDetectedUrl(url);
      setVisible(true);
    });

    return () => { unsub(); };
  }, [isElectron, settings.clipboardMonitoringEnabled]);

  // Mobile: listen for Capacitor native events
  useEffect(() => {
    if (!isCapacitor || !settings.clipboardMonitoringEnabled) return;

    let listener: any = null;
    (async () => {
      try {
        const ClipboardMonitorMod = await import('../native/ClipboardMonitor');
        const ClipboardMonitor = ClipboardMonitorMod.default;
        listener = await ClipboardMonitor.addListener('urlDetected', (data: { url: string }) => {
          setDetectedUrl(data.url);
          setVisible(true);
        });
      } catch {
        // Plugin not available — silent fail
      }
    })();

    return () => { listener?.remove(); };
  }, [isCapacitor, settings.clipboardMonitoringEnabled]);

  const handleAnalyze = useCallback(() => {
    onAnalyze(detectedUrl);
    setVisible(false);
    onDismiss();
  }, [detectedUrl, onAnalyze, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && detectedUrl && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] max-w-[90vw]"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/20 shrink-0">
              <Clipboard size={18} className="text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white/70">
                {settings.language === 'en' ? 'Link detected in clipboard' : 'Link detectado na área de transferência'}
              </p>
              <p className="text-xs text-white font-medium truncate max-w-[220px]">
                {detectedUrl}
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-semibold transition-colors shrink-0"
            >
              <Download size={12} />
              {settings.language === 'en' ? 'Download' : 'Baixar'}
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            >
              <X size={14} className="text-white/50" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

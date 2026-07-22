import { registerPlugin } from '@capacitor/core';

export interface ClipboardMonitorPlugin {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getClipboardText(): Promise<{ text: string }>;
  addListener(event: 'urlDetected', handler: (data: { url: string }) => void): Promise<{ remove(): void }>;
}

const ClipboardMonitor = registerPlugin<ClipboardMonitorPlugin>('ClipboardMonitor');

export default ClipboardMonitor;

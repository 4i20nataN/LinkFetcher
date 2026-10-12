// Contrato do download gratuito: formato de referência + opções neutras.
// Trava o preset (ex.: voltar a herdar fragmentos agressivos quebra).
import { describe, expect, it } from 'vitest';
import { buildQuickOptions, pickQuickRefFormat } from './analyzerUtils';
import type { FormatOptions } from '../downloads/FormatOptions';
import type { MediaFormat, MediaInfo } from '../../types';

function fmt(over: Partial<MediaFormat> = {}): MediaFormat {
  return {
    id: 'f', ext: 'mp4', quality: '1080p', sizeEst: '', sizeBytes: 100,
    codec: '', type: 'video',
    ...over,
  } as MediaFormat;
}

function media(formats: MediaFormat[]): MediaInfo {
  return { formats } as MediaInfo;
}

function base(): FormatOptions {
  return {
    format: 'bestvideo+bestaudio/best',
    audioOnly: false,
    audioFormat: 'mp3',
    audioQuality: '0',
    writeSubs: true,
    writeAutoSubs: true,
    subLangs: 'en',
    subFormat: 'srt',
    embedSubs: true,
    writeThumbnail: true,
    embedThumbnail: true,
    embedMetadata: true,
    concurrentFragments: 8,
    bandLimit: 500,
    downloadSections: '*00:01-00:02',
    sponsorblockRemove: 'sponsor',
  };
}

describe('pickQuickRefFormat', () => {
  it('áudio: primeira faixa de áudio', () => {
    const m = media([fmt({ type: 'video' }), fmt({ id: 'a', type: 'audio' })]);
    expect(pickQuickRefFormat(m, 'audio')?.id).toBe('a');
  });

  it('vídeo: maior faixa de vídeo', () => {
    const m = media([
      fmt({ id: 'small', sizeBytes: 10 }),
      fmt({ id: 'big', sizeBytes: 999 }),
      fmt({ id: 'a', type: 'audio', sizeBytes: 5000 }),
    ]);
    expect(pickQuickRefFormat(m, 'video')?.id).toBe('big');
  });

  it('sem formatos: null (handler mostra erro)', () => {
    expect(pickQuickRefFormat(media([]), 'video')).toBeNull();
    expect(pickQuickRefFormat(media([]), 'audio')).toBeNull();
  });
});

describe('buildQuickOptions', () => {
  it('vídeo: teto 1080p60 + merge mp4 copy', () => {
    const q = buildQuickOptions(base(), 'video');
    expect(q.format).toBe('bv*[height<=1080]+ba/b[height<=1080]');
    expect(q.audioOnly).toBe(false);
    expect(q.fpsMax).toBe(60);
    expect(q.videoFormat).toBe('mp4');
    expect(q.videoCodec).toBe('');
  });

  it('áudio: bestaudio extraído em MP3 máxima', () => {
    const q = buildQuickOptions(base(), 'audio');
    expect(q.format).toBe('bestaudio/best');
    expect(q.audioOnly).toBe(true);
    expect(q.audioFormat).toBe('mp3');
    expect(q.audioQuality).toBe('0');
  });

  it('neutro: sem legendas, capa, metadados, cortes, sponsorblock, re-encode', () => {
    for (const kind of ['video', 'audio'] as const) {
      const q = buildQuickOptions(base(), kind);
      expect(q.writeSubs).toBe(false);
      expect(q.writeAutoSubs).toBe(false);
      expect(q.subLangs).toBe('');
      expect(q.embedSubs).toBe(false);
      expect(q.writeThumbnail).toBe(false);
      expect(q.embedThumbnail).toBe(false);
      expect(q.embedMetadata).toBe(false);
      expect(q.downloadSections).toBe('');
      expect(q.sponsorblockRemove).toBe('');
      expect(q.videoOnly).toBe(false);
      expect(q.keepVideo).toBe(false);
    }
  });

  it('conservador na rede: 1 fragmento e sem limite herdado (anti-429)', () => {
    for (const kind of ['video', 'audio'] as const) {
      const q = buildQuickOptions(base(), kind);
      expect(q.concurrentFragments).toBe(1);
      expect(q.bandLimit).toBe(0);
    }
  });

  it('não muta as opções do painel (RESULTADO segue fiel ao personalizado)', () => {
    const b = base();
    buildQuickOptions(b, 'video');
    expect(b.concurrentFragments).toBe(8);
    expect(b.bandLimit).toBe(500);
    expect(b.fpsMax).toBeUndefined();
    expect(b.videoFormat).toBeUndefined();
  });
});

// Seções da aba "Avançado" do seletor de formato.
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../core/i18n';
import { BlockIcon, BlockTitle } from '../../../components/BlockIcon';
import { AlertTriangle } from 'lucide-react';
import type { FormatOptions } from '../FormatOptions';
import { canEmbedThumbnail } from './formatUtils';
import {
  AccordionSection,
  Btn,
  ToggleRow,
  SmallToggle,
  TooltipWrapper,
  TimeRangeSlider,
} from './FormatWidgets';
import type { FormatSectionCtx } from './sectionCtx';

type Ctx = { ctx: FormatSectionCtx };

export function TrimSection({ ctx }: Ctx) {
  const { options, update, mediaInfo, openSections, toggleSection, accentBg, trimStart, setTrimStart, trimEnd, setTrimEnd, trimStartRef, trimEndRef } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="trim" title={t('fmtTrim')} blockId="trim" isOpen={openSections.has('trim')} onToggle={() => toggleSection('trim')} accentBg={accentBg}>
      <div className={`px-3 pb-3 pt-2 space-y-2 ${options.audioOnly ? 'opacity-30 pointer-events-none' : ''}`}>
        {mediaInfo.durationSeconds > 0 ? (
          <TimeRangeSlider
            durationSeconds={mediaInfo.durationSeconds}
            startSeconds={trimStart}
            endSeconds={trimEnd}
            accentBg={accentBg}
            onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }}
          />
        ) : (
          <>
            <p className="fs-sm lf-text-faint">{t('fmtTrimHint')}</p>
            <div className="flex gap-2 items-center">
              <input
                ref={trimStartRef}
                type="text"
                placeholder={t('fmtTrimStartPh')}
                onChange={e => {
                  const end = trimEndRef.current?.value.trim() || '';
                  const val = e.target.value.trim();
                  if (val && end) update({ downloadSections: `*${val}-${end}` });
                  else if (val) update({ downloadSections: `*${val}-` });
                  else update({ downloadSections: end ? `*-${end}` : '' });
                }}
                className="flex-1 px-3 py-2 rounded-lg lf-surface lf-border fs-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15"
              />
              <span className="lf-text-faint text-xs">-</span>
              <input
                ref={trimEndRef}
                type="text"
                placeholder={t('fmtTrimEndPh')}
                onChange={e => {
                  const start = trimStartRef.current?.value.trim() || '';
                  const val = e.target.value.trim();
                  if (start && val) update({ downloadSections: `*${start}-${val}` });
                  else if (val) update({ downloadSections: `*-${val}` });
                  else update({ downloadSections: start ? `*${start}-` : '' });
                }}
                className="flex-1 px-3 py-2 rounded-lg lf-surface lf-border fs-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15"
              />
            </div>
          </>
        )}
      </div>
    </AccordionSection>
  );
}

export function OutputSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg, isFpsAvailable, selectedTargetHeight } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="output" title={t('fmtOutputMode')} blockId="output-mode" isOpen={openSections.has('output')} onToggle={() => toggleSection('output')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BlockIcon blockId="video-format" />
            <BlockTitle>{t('fmtContent')}</BlockTitle>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Btn active={!options.videoOnly && !options.audioOnly} onClick={() => update({ videoOnly: false, audioOnly: false })} className="py-2.5">
              {t('fmtVideoAudio')}
            </Btn>
            <Btn active={!!options.videoOnly} onClick={() => {
              const next = !options.videoOnly;
              const reset: Partial<FormatOptions> = { videoOnly: next, audioOnly: false };
              if (next) {
                reset.audioFormat = 'mp3';
                reset.audioQuality = '0';
              }
              update(reset);
            }} className="py-2.5">
              {t('fmtVideoOnly')}
            </Btn>
            <Btn active={!!options.audioOnly} onClick={() => {
              const next = !options.audioOnly;
              const reset: Partial<FormatOptions> = { audioOnly: next, videoOnly: false };
              if (next) {
                reset.embedSubs = false;
                reset.videoFormat = '';
                reset.videoCodec = '';
                reset.fpsMax = 0;
              }
              update(reset);
            }} className="py-2.5">
              {t('fmtAudioOnlyOpt')}
            </Btn>
          </div>
        </div>
        <div className={`space-y-2 ${options.audioOnly ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2">
            <BlockIcon blockId="fps" />
            <BlockTitle>{t('fmtFpsMax')}</BlockTitle>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 24, 30, 60, 120].map(fps => {
              const available = isFpsAvailable(fps);
              const btn = (
                <Btn key={fps} active={options.fpsMax === fps} disabled={!available} onClick={() => update({ fpsMax: fps })} className="py-2 flex-1">
                  {fps === 0 ? 'Original' : `${fps} FPS`}
                </Btn>
              );
              return available ? btn : (
                <TooltipWrapper key={fps} tip={selectedTargetHeight ? t('fmtFpsTipMissing', { h: selectedTargetHeight, fps }) : t('fmtFpsUnavailable')}>
                  {btn}
                </TooltipWrapper>
              );
            })}
          </div>
          {selectedTargetHeight != null && [24, 30, 60, 120].some(f => !isFpsAvailable(f)) && (
            <p className="fs-sm lf-text-faint">{t('fmtFpsMissing')}</p>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}

export function SponsorBlockSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="sponsorblock" title="SponsorBlock" blockId="sponsorblock" isOpen={openSections.has('sponsorblock')} onToggle={() => toggleSection('sponsorblock')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 space-y-2">
        <p className="fs-sm lf-text-faint">{t('fmtSponsorblock')}</p>
        <div className="flex gap-2.5">
          <Btn
            active={!options.sponsorblockRemove}
            onClick={() => update({ sponsorblockRemove: '' })}
            className="py-1.5 px-2.5 fs-sm flex-1"
          >
            {t('fmtOff')}
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {[
            { id: 'sponsor', label: 'Sponsors' },
            { id: 'intro', label: 'Intro' },
            { id: 'outro', label: 'Outro' },
            { id: 'preview', label: 'Preview' },
            { id: 'selfpromo', label: 'Self-promo' },
            { id: 'interaction', label: t('fmtSponsorCatInteraction') },
            { id: 'music_offtopic', label: t('fmtSponsorCatMusic') },
            { id: 'filler', label: 'Filler' },
          ].map(cat => {
            const current = options.sponsorblockRemove || '';
            const selected = current === 'all' || current.split(',').includes(cat.id);
            return (
              <Btn
                key={cat.id}
                active={selected}
                onClick={() => {
                  if (current === 'all') {
                    update({ sponsorblockRemove: cat.id });
                  } else {
                    const parts = current ? current.split(',') : [];
                    const next = selected ? parts.filter(p => p !== cat.id) : [...parts, cat.id];
                    update({ sponsorblockRemove: next.length > 0 ? next.join(',') : '' });
                  }
                }}
                className="py-1.5 px-2.5 fs-sm"
              >
                {selected && '✓ '}{cat.label}
              </Btn>
            );
          })}
        </div>
        <div className="flex gap-2.5">
          <Btn
            active={options.sponsorblockRemove === 'all'}
            onClick={() => update({ sponsorblockRemove: 'all' })}
            className="py-1.5 px-2.5 fs-sm flex-1"
          >
            {options.sponsorblockRemove === 'all' && '✓ '}{t('fmtRemoveAll')}
          </Btn>
        </div>
      </div>
    </AccordionSection>
  );
}

export function MetadataSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="metadata" title={t('fmtMetaSection')} blockId="metadata" isOpen={openSections.has('metadata')} onToggle={() => toggleSection('metadata')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ToggleRow value={options.embedMetadata} onChange={() => update({ embedMetadata: !options.embedMetadata })} label={t('fmtMeta')} desc={t('fmtMetaDesc')} icon={<BlockIcon blockId="container" />} />
        <div>
          <ToggleRow value={!!options.writeThumbnail} onChange={() => update({ writeThumbnail: !options.writeThumbnail })} label={t('fmtThumb')} desc={t('fmtThumbDesc')} icon={<BlockIcon blockId="thumbnail" />} />
          {options.writeThumbnail && (
            <div className="mt-2 space-y-1.5">
              <div className={canEmbedThumbnail(options) ? '' : 'opacity-30 pointer-events-none'}>
                <SmallToggle value={!!options.embedThumbnail} onChange={() => update({ embedThumbnail: !options.embedThumbnail })} label={t('fmtThumbEmbed')} />
              </div>
              {!canEmbedThumbnail(options) && (
                <p className="fs-sm lf-text-faint">{t('fmtThumbAudio', { fmt: options.audioOnly ? 'wav' : 'webm/flv' })}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}

export function BehaviorSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="behavior" title={t('fmtBehavior')} blockId="behavior" isOpen={openSections.has('behavior')} onToggle={() => toggleSection('behavior')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BlockIcon blockId="speed-limit" />
            <BlockTitle>{t('fmtSpeedLimit')}</BlockTitle>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {[0, 512, 1024, 5120, 10240, 25600, 51200].map(kbps => (
              <Btn
                key={kbps}
                active={options.bandLimit === kbps}
                onClick={() => update({ bandLimit: kbps })}
                className="py-2 flex-1 fs-sm min-w-[80px]"
              >
              {kbps === 0 ? t('fmtNoLimit') : kbps >= 1024 ? `${kbps / 1024}MB/s` : `${kbps}KB/s`}
              </Btn>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
        <BlockIcon blockId="custom-format" />
            <BlockTitle>{t('fmtBehavior')}</BlockTitle>
          </div>
          <div className="space-y-1.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={11} className="text-amber-500/70" />
              <span className="fs-sm text-amber-500/70 font-medium">{t('fmtAdvancedOpts')}</span>
            </div>
            <SmallToggle value={!!options.noOverwrites} onChange={() => update({ noOverwrites: !options.noOverwrites })} label={t('fmtNoOverwrite')} />
            <div className={options.audioOnly ? '' : 'opacity-30 pointer-events-none'}>
              <SmallToggle value={!!options.keepVideo} onChange={() => update({ keepVideo: !options.keepVideo })} label={t('fmtKeepVideo')} />
            </div>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}

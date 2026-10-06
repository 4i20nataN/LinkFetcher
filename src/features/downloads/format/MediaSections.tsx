// Seções da aba "Mídia" do seletor de formato (extraídas do FormatSelector).
// Cada seção recebe o ctx compartilhado e lê `settings`/`t` via hooks.
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../core/i18n';
import { BlockIcon, BlockTitle } from '../../../components/BlockIcon';
import { Toggle } from '../../../components/Toggle';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { AnimatedAccordion } from '../../../animation/AnimatedAccordion';
import { ChevronDown, ChevronUp, FileText, Download, Subtitles, Info } from 'lucide-react';
import { AUDIO_QUALITY_PRESETS } from '../constants';
import type { FormatOptions } from '../FormatOptions';
import {
  VIDEO_PRESETS,
  VIDEO_FORMATS,
  VIDEO_CODECS,
  CODEC_FILTER,
  CODEC_TIPS,
  AUDIO_FORMATS,
  SUB_FORMATS,
} from './formatData';
import { fmtDate, fmtDuration } from './formatUtils';
import {
  AccordionSection,
  Btn,
  ToggleRow,
  SmallToggle,
  TooltipWrapper,
  SubsPickerModal,
} from './FormatWidgets';
import type { FormatSectionCtx } from './sectionCtx';

type Ctx = { ctx: FormatSectionCtx };

/* ── Resolução ── */
export function ResolutionSection({ ctx }: Ctx) {
  const { options, update, maxRes, openSections, toggleSection, accentBg } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="resolution" title={t('fmtResolution')} blockId="resolution" isOpen={openSections.has('resolution')} onToggle={() => toggleSection('resolution')} accentBg={accentBg}>
      <div className={`px-3 pb-3 pt-2 space-y-2 ${options.audioOnly ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="flex flex-wrap gap-2.5">
          {VIDEO_PRESETS.map(preset => {
            const unavailable = preset.height !== Infinity && maxRes > 0 && preset.height > maxRes;
            return (
              <Btn
                key={preset.id}
                active={options.format === preset.format && !options.audioOnly}
                onClick={() => {
                  let fmt: string = preset.format;
                  if (options.videoCodec) {
                    fmt = fmt.replace(/\[vcodec~?[^]]*\]/g, '');
                    fmt = fmt.replace(/bv\*\[/g, `bv*[vcodec~=${CODEC_FILTER[options.videoCodec] ?? options.videoCodec}][`);
                  }
                  update({ format: fmt, audioOnly: false });
                }}
                disabled={unavailable}
                className="py-2.5"
              >
                {'starYellow' in preset && preset.starYellow ? (
                  <><span className="text-yellow-400">★</span> {t('fmtBest')}</>
                ) : preset.id === '360p' ? t('fmtPreset360') : preset.label}
              </Btn>
            );
          })}
        </div>
        {maxRes > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg lf-surface-30 lf-border">
            <Info size={12} className="lf-text-muted shrink-0" />
            <p className="fs-sm lf-text-secondary">
              {settings.language === 'en'
                ? `This video is available up to ${maxRes}p. Higher presets will download at the maximum available quality.`
                : `Este video esta disponivel ate ${maxRes}p. Presets maiores serao baixados na maxima qualidade disponivel.`}
            </p>
          </div>
        )}
      </div>
    </AccordionSection>
  );
}

/* ── Formato Video + Codecs ── */
export function VideoFormatSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg, allowedCodecs, allowedContainers } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="video-format" title={t('fmtFormats')} blockId="video-format" isOpen={openSections.has('video-format')} onToggle={() => toggleSection('video-format')} accentBg={accentBg}>
      <div className={`px-3 pb-3 pt-2 space-y-3 ${options.audioOnly ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={`space-y-2 ${options.videoOnly ? 'opacity-30 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <BlockIcon blockId="container" />
              <BlockTitle>{t('fmtContainer')}</BlockTitle>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {VIDEO_FORMATS.map(fmt => {
                const ok = !allowedContainers || allowedContainers.includes(fmt);
                const btn = (
                  <Btn
                    key={fmt}
                    active={!options.audioOnly && options.videoFormat === fmt}
                    disabled={!ok}
                    onClick={() => {
                      if (options.audioOnly) return;
                      update({ videoFormat: fmt });
                    }}
                    className="py-2"
                  >
                    {fmt.toUpperCase()}
                  </Btn>
                );
                return ok ? btn : (
                  <TooltipWrapper key={fmt} tip={t('fmtTipIncompatCodec', { name: VIDEO_CODECS.find(c => c.id === options.videoCodec)?.label ?? options.videoCodec })}>
                    {btn}
                  </TooltipWrapper>
                );
              })}
            </div>
            {options.videoOnly && (
              <p className="fs-sm lf-text-faint">{t('fmtVideoOnlyNote')}</p>
            )}
          </div>
            <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BlockIcon blockId="codec" />
              <BlockTitle>{t('fmtCodec')}</BlockTitle>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {VIDEO_CODECS.map(codec => {
                const ok = !allowedCodecs || allowedCodecs.includes(codec.id);
                const btn = (
                  <Btn
                    key={codec.id}
                    active={options.videoCodec === codec.id}
                    disabled={!ok}
                    onClick={() => {
                      const codecVal = codec.id;
                      update({ videoCodec: codecVal });
                      if (!options.audioOnly && options.format) {
                        let fmt = options.format;
                        fmt = fmt.replace(/\[vcodec~?[^]]*\]/g, '');
                        if (codecVal) {
                          fmt = fmt.replace(/bv\*\[/g, `bv*[vcodec~=${CODEC_FILTER[codecVal] ?? codecVal}][`);
                        }
                        update({ format: fmt });
                      }
                    }}
                    className="py-2"
                  >
                    {codec.label}
                  </Btn>
                );
                return ok ? (
                  <TooltipWrapper key={codec.id} tip={t(CODEC_TIPS[codec.id] ?? 'fmtTipAuto')}>
                    {btn}
                  </TooltipWrapper>
                ) : (
                  <TooltipWrapper key={codec.id} tip={t('fmtTipIncompatContainer', { name: options.videoFormat?.toUpperCase() ?? '' })}>
                    {btn}
                  </TooltipWrapper>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}

/* ── Áudio ── */
export function AudioSection({ ctx }: Ctx) {
  const { options, update, openSections, toggleSection, accentBg } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="audio" title={t('fmtAudio')} blockId="audio-format" isOpen={openSections.has('audio')} onToggle={() => toggleSection('audio')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 space-y-3">
        <ToggleRow
          value={options.audioOnly}
          onChange={() => {
            const next = !options.audioOnly;
            const reset: Partial<FormatOptions> = { audioOnly: next };
            if (next) {
              reset.embedSubs = false;
              reset.videoFormat = '';
              reset.videoCodec = '';
              reset.fpsMax = 0;
              reset.videoOnly = false;
            }
            update(reset);
          }}
          label={t('fmtExtractAudio')}
          desc={t('fmtExtractAudioDesc')}
          icon={<BlockIcon blockId="audio-extract" />}
        />
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${options.audioOnly ? '' : 'opacity-30 pointer-events-none'}`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BlockIcon blockId="audio-format" />
            <BlockTitle>{t('fmtAudioFormat')}</BlockTitle>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {AUDIO_FORMATS.map(fmt => (
              <Btn key={fmt.id} active={options.audioFormat === fmt.id} onClick={() => update({ audioFormat: fmt.id })} className="py-2">
                {fmt.label}
              </Btn>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BlockIcon blockId="audio-quality" />
            <BlockTitle>{t('fmtAudioQuality')}</BlockTitle>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {AUDIO_QUALITY_PRESETS.map(q => (
              <Btn key={q.value} active={options.audioQuality === q.value} onClick={() => update({ audioQuality: q.value })} className="py-2">
                {q.value === '0' ? t('fmtBest') : q.label}
              </Btn>
            ))}
          </div>
        </div>
        </div>
        {!options.audioOnly && (
          <p className="fs-sm lf-text-faint">{t('fmtAudioNote')}</p>
        )}
      </div>
    </AccordionSection>
  );
}

/* ── Descrição ── */
export function DescriptionSection({ ctx }: Ctx) {
  const { options, update, mediaInfo, openSections, toggleSection, accentBg, descExpanded, setDescExpanded } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="description" title={t('fmtDescSection')} blockId="metadata" isOpen={openSections.has('description')} onToggle={() => toggleSection('description')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 space-y-2">
        <div className={`relative fs-sm lf-text-secondary leading-relaxed whitespace-pre-line ${descExpanded ? '' : 'line-clamp-5'}`}>
          {mediaInfo.description}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDescExpanded(!descExpanded)}
            className="fs-xs lf-text-muted hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {descExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {descExpanded ? t('fmtDescCollapse') : t('fmtDescExpand')}
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <Btn active={options.descFormat === 'none'} onClick={() => update({ descFormat: 'none' })} className="py-1 px-2 text-[10px]">
              {t('fmtNoInclude')}
            </Btn>
            <Btn active={options.descFormat === 'txt'} onClick={() => update({ descFormat: 'txt' })} className="py-1 px-2 text-[10px]">
              {settings.iconStyle === 'emoji' ? <span className="inline mr-1">📄</span> : <FileText size={10} className={`inline mr-1 ${getAccentTextClass(settings)}`} />}.txt
            </Btn>
            <Btn active={options.descFormat === 'md'} onClick={() => update({ descFormat: 'md' })} className="py-1 px-2 text-[10px]">
              {settings.iconStyle === 'emoji' ? <span className="inline mr-1">⬇️</span> : <Download size={10} className={`inline mr-1 ${getAccentTextClass(settings)}`} />}.md
            </Btn>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}

/* ── Legendas ── */
export function SubtitlesSection({ ctx }: Ctx) {
  const { options, update, mediaInfo, openSections, toggleSection, accentBg, showSubs, setShowSubs, showSubsPicker, setShowSubsPicker } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <AccordionSection id="subtitles" title={t('fmtSubs')} blockId="subtitles" isOpen={openSections.has('subtitles')} onToggle={() => toggleSection('subtitles')} accentBg={accentBg}>
      <div className="px-3 pb-3 pt-2 space-y-3">
        <ToggleRow
          value={showSubs}
          onChange={() => {
            const next = !showSubs;
            setShowSubs(next);
            if (next) update({ writeSubs: true });
            else update({ writeSubs: false, writeAutoSubs: false, embedSubs: false });
          }}
          label={t('fmtDlSubs')}
          desc={t('fmtDlSubsDesc')}
        />
        {showSubs && (
          <AnimatedAccordion isOpen={showSubs} className="space-y-3 pl-2 border-l-2 border-zinc-800">
            {/* Disponibilidade real segundo o probe: resumo compacto +
                modal com busca; o clique escolhe o idioma exato. */}
            {(() => {
              const manual = mediaInfo.subtitleLangs?.manual ?? [];
              const auto = mediaInfo.subtitleLangs?.auto ?? [];
              if (manual.length === 0 && auto.length === 0) {
                return (
                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-500/80 fs-sm font-medium">
                    {t('fmtSubsNone')}
                  </div>
                );
              }
              // Picker único de idioma (atalhos vivem dentro do modal):
              // mostra a seleção atual com × para limpar.
              const picked = options.subLangs || '';
              return (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl lf-surface-40 lf-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <Subtitles size={14} className={`${getAccentTextClass(settings)} shrink-0`} />
                      <span className="text-xs lf-text-secondary font-medium truncate">
                        {t('fmtSubsManual')} ({manual.length}) • {t('fmtSubsAuto')} ({auto.length})
                      </span>
                      {picked && (
                        <button
                          onClick={() => update({ subLangs: '' })}
                          className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-white font-mono uppercase text-[10px] font-bold hover:bg-white/15 transition-colors shrink-0"
                        >
                          {picked.toUpperCase()} ✕
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowSubsPicker(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors shrink-0"
                    >
                      {picked ? t('fmtSubsChange') : t('fmtSubsBrowse')}
                    </button>
                  </div>
                  {showSubsPicker && (
                    <SubsPickerModal
                      manual={manual}
                      auto={auto}
                      selected={options.subLangs || ''}
                      onPick={(lang) => update({ subLangs: options.subLangs === lang ? '' : lang })}
                      onClose={() => setShowSubsPicker(false)}
                    />
                  )}
                  {!options.subLangs && (
                    <p className="fs-sm lf-text-faint">{t('fmtSubsDefaultNote')}</p>
                  )}
                </>
              );
            })()}
            {/* Proteção: idioma escolhido x probe — avisa antes de baixar. */}
            {showSubs && (() => {
              const sel = (options.subLangs || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
              if (sel.length === 0 || sel.includes('all')) return null;
              const manual = mediaInfo.subtitleLangs?.manual ?? [];
              const auto = mediaInfo.subtitleLangs?.auto ?? [];
              if (manual.length === 0 && auto.length === 0) return null;
              const missing = sel.filter((l) => !manual.includes(l) && !auto.includes(l));
              if (missing.length > 0) {
                return (
                  <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/15 text-rose-400/80 fs-sm font-medium">
                    {t('fmtSubsMissingLang')} {missing.join(', ').toUpperCase()}
                  </div>
                );
              }
              if (!options.writeAutoSubs) {
                const onlyAuto = sel.filter((l) => !manual.includes(l) && auto.includes(l));
                if (onlyAuto.length > 0) {
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-500/80 fs-sm font-medium">
                      {t('fmtSubsNeedAuto')} {onlyAuto.join(', ').toUpperCase()}
                    </div>
                  );
                }
              }
              return null;
            })()}
            <SmallToggle value={options.writeAutoSubs} onChange={() => update({ writeAutoSubs: !options.writeAutoSubs })} label={t('fmtAutoSubs')} />
            <div className="space-y-1.5">
              <BlockTitle>{t('fmtSubFormat')}</BlockTitle>
          <div className="flex flex-wrap gap-2.5">
                {SUB_FORMATS.map(fmt => (
                  <Btn key={fmt} active={options.subFormat === fmt} onClick={() => update({ subFormat: fmt })} className="py-2">
                    {fmt.toUpperCase()}
                  </Btn>
                ))}
              </div>
            </div>
            <div className={(!options.audioOnly && options.subLangs !== 'all' && (!options.videoFormat || ['mp4', 'webm', 'mkv'].includes(options.videoFormat))) ? '' : 'opacity-30 pointer-events-none'}>
              <SmallToggle value={options.embedSubs} onChange={() => update({ embedSubs: !options.embedSubs })} label={t('fmtEmbedSubs')} />
            </div>
            {(!!options.audioOnly || (!!options.videoFormat && !['mp4', 'webm', 'mkv'].includes(options.videoFormat))) && (
              <p className="fs-sm lf-text-faint">{t('fmtEmbedSubsNote')}</p>
            )}
            {options.subLangs === 'all' && (
              <p className="fs-sm lf-text-faint">{t('fmtEmbedSubsAllNote')}</p>
            )}
          </AnimatedAccordion>
        )}
      </div>
    </AccordionSection>
  );
}

/* ── Nome do Arquivo + Nome Limpo ── */
export function FilenameSection({ ctx }: Ctx) {
  const { options, update, mediaInfo, useUnderscore, setUseUnderscore } = ctx;
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  return (
    <div className="p-3 rounded-xl lf-surface-40 lf-border glass-section space-y-2">
      <div className="flex items-center gap-2">
        <BlockIcon blockId="custom-format" />
        <BlockTitle>{t('fmtFileNameTitle')}</BlockTitle>
      </div>
      <input
        type="text"
        value={options.customFilename || ''}
        onChange={e => {
          let val = e.target.value;
          if (useUnderscore) val = val.replace(/ /g, '_');
          update({ customFilename: val });
        }}
        placeholder={t('fmtFileName')}
        className="w-full px-3 py-2 rounded-lg lf-surface-raised lf-border fs-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/15 transition-colors font-mono"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        {[
          { resolved: mediaInfo.title || 'video', label: t('fmtTagTitle') },
          { resolved: mediaInfo.channel || 'canal', label: t('fmtTagChannel') },
          { resolved: fmtDate(mediaInfo.publishDate || '', true), label: t('fmtTagDate') },
          { resolved: fmtDuration(mediaInfo.duration || ''), label: t('fmtTagDuration') },
        ].filter(tag => tag.resolved).map(tag => {
          // Anti-spam: cada token entra no máximo 1x. Se o valor já
          // está no nome (click anterior ou digitação), o botão
          // desliga em vez de duplicar o título até o infinito.
          const cur = options.customFilename || '';
          const val = useUnderscore ? tag.resolved.replace(/ /g, '_') : tag.resolved;
          const added = val !== '' && cur.includes(val);
          return (
            <button
              key={tag.label}
              disabled={added}
              title={added ? t('fmtTagAdded') : undefined}
              onClick={() => {
                const sep = useUnderscore ? '_' : ' ';
                update({ customFilename: cur ? `${cur}${sep}${val}` : val });
              }}
              className={`lf-opt px-2 py-1 rounded-md fs-sm transition-all duration-200 ${added ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {tag.label}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-1 pl-2 border-l lf-border">
          <Toggle
            value={useUnderscore}
            onChange={() => {
              const next = !useUnderscore;
              setUseUnderscore(next);
              if (next && options.customFilename) {
                update({ customFilename: options.customFilename.replace(/ /g, '_') });
              }
            }}
            settings={settings}
          />
          <span className="fs-sm lf-text-faint">{t('fmtNoSpaces')}</span>
        </div>
        <div className="flex items-center gap-1 ml-1 pl-2 border-l lf-border">
          <label className="fs-sm lf-text-secondary">{t('fmtCleanName')}</label>
          <Toggle value={!!options.restrictFilenames} onChange={() => update({ restrictFilenames: !options.restrictFilenames })} settings={settings} />
        </div>
      </div>
    </div>
  );
}

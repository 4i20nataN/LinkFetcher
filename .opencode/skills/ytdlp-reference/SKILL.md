---
name: ytdlp-reference
description: "Complete yt-dlp CLI reference documentation. Use this skill when working with yt-dlp commands, flags, format selection, output templates, post-processing, SponsorBlock, authentication, or any yt-dlp related task in the LinkFetcher project. Triggers on: yt-dlp, ytdl, format selection, download flags, video/audio merging, subtitle embedding, thumbnail embedding, metadata, cookies, proxy, ffmpeg integration, output template, format sorting, download sections, extractor arguments."
---

# yt-dlp Reference (LinkFetcher)

Complete CLI reference for yt-dlp, extracted from the official README. Use this to look up any flag, option, or behavior when building, debugging, or extending LinkFetcher's download engine.

## When to Use

- **Building new download features** — look up the correct flag before adding to `YtDlpManager.buildArgs()`
- **Debugging download issues** — check flag behavior, defaults, and edge cases
- **Adding new FormatOptions** — verify the yt-dlp flag exists and its exact syntax
- **Understanding format selection** — `-f` selectors, `-S` sorting, filtering operators
- **Post-processing** — merging, remuxing, embed metadata/subtitles/thumbnails
- **Output templates** — available fields, formatting syntax, date/time patterns

## Reference Files

Read the relevant file based on what you need:

| Topic | File |
|-------|------|
| General, Network, Geo, Video Selection, Download, Filesystem options | `references/01-general-options.md` |
| Format selection (`-f`), sorting (`-S`), filtering, thumbnails, internet shortcuts | `references/02-format-selection.md` |
| Subtitles, Authentication (cookies, credentials) | `references/03-subtitles-auth.md` |
| Post-processing, SponsorBlock, Extractor options, Preset aliases | `references/04-post-processing.md` |
| Output template syntax, ALL available fields, formatting | `references/05-output-template.md` |
| Configuration files, netrc, environment variables | `references/06-configuration.md` |
| Workarounds, Verbosity and Simulation | `references/07-workarounds-verbosity.md` |
| Embedding yt-dlp, Plugins | `references/08-embedding-plugins.md` |
| Changes from youtube-dl (new features, differences, deprecated) | `references/09-changes-from-ytdl.md` |

## Quick Reference: Most Used Flags in LinkFetcher

| Flag | Purpose | LinkFetcher Usage |
|------|---------|-------------------|
| `-f, --format FORMAT` | Format selector expression | `FormatSelector` → `buildArgs()` |
| `-S, --format-sort SORTORDER` | Sort criteria for format selection | Resolution, codec, bitrate preferences |
| `-o, --output TEMPLATE` | Output filename template | `%(title)s.%(ext)s` pattern |
| `-P, --paths PATH` | Download destination path | Set via settings |
| `--merge-output-format FORMAT` | Container for merged files | `mp4` or `mkv` |
| `-x, --extract-audio` | Convert to audio-only | Audio download mode |
| `--audio-format FORMAT` | Audio conversion format | `mp3`, `aac`, `flac`, etc. |
| `--audio-quality QUALITY` | Audio VBR quality (0-10) | Default 5 |
| `--embed-subs` | Embed subtitles in video | Subtitle option |
| `--embed-thumbnail` | Embed thumbnail as cover art | Thumbnail option |
| `--embed-metadata` | Embed metadata to video | Metadata option |
| `--write-subs` / `--write-auto-subs` | Write subtitle files | Subtitle download |
| `--sub-lang LANGS` | Subtitle language filter | Language selection |
| `--sponsorblock-remove CATS` | Remove SponsorBlock segments | Sponsor integration |
| `--cookies-from-browser BROWSER` | Load cookies from browser | Auth for private content |
| `--cookies FILE` | Read cookies from file | Custom cookie file |
| `-N, --concurrent-fragments N` | Parallel fragment downloads | Speed optimization |
| `-r, --limit-rate RATE` | Max download rate | Bandwidth limiting |
| `--download-sections REGEX` | Download specific sections | Time-range downloads |
| `--ffmpeg-location PATH` | ffmpeg binary location | Bundled in `electron/resources/` |
| `--restrict-filenames` | ASCII-only filenames | Safe filename handling |
| `--trim-filenames LENGTH` | Max filename length | Prevent path too long errors |
| `--no-overwrites` | Don't overwrite files | Avoid re-downloading |
| `--windows-filenames` | Windows-compatible filenames | Platform safety |
| `-j, --dump-json` | Probe video metadata (no download) | LinkAnalyzer probe |
| `--flat-playlist` | Don't extract playlist entries | YouTube search |
| `--no-playlist` | Download video only, not playlist | Single video mode |
| `-v, --verbose` | Verbose output | Debug logging |

## Format Selection Quick Guide

**Basic selectors:** `best`, `bestvideo`, `bestaudio`, `worst`, `worstvideo`, `worstaudio`
**Merge:** `bestvideo+bestaudio` (requires ffmpeg)
**Filter:** `-f "best[height<=720]"`, `-f "bv*[vcodec^=avc]"`, `-f "ba[abr>128]"`
**Sort:** `-S "res:720,acodec:aac"` — prefer 720p, prefer AAC audio
**Negation:** `!` prefix on string comparisons, `<`, `<=`, `>`, `>=`, `=` for numeric

## Output Template Fields (Most Used)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Video identifier |
| `title` | string | Video title |
| `ext` | string | File extension |
| `uploader` | string | Uploader name |
| `duration` | numeric | Duration in seconds |
| `duration_string` | string | Duration (HH:mm:ss) |
| `upload_date` | string | YYYYMMDD format |
| `resolution` | string | Textual resolution |
| `width` / `height` | numeric | Video dimensions |
| `fps` | numeric | Frame rate |
| `filesize` / `filesize_approx` | numeric | File size in bytes |
| `vcodec` / `acodec` | string | Codec names |
| `tbr` / `vbr` / `abr` | numeric | Bitrate in kbps |
| `playlist` | string | Playlist title or id |
| `playlist_index` | numeric | Position in playlist |

## Important Notes for LinkFetcher

1. **UI never builds yt-dlp args directly.** `FormatSelector` → `FormatOptions` → `YtDlpManager.buildArgs()` is the only valid path.
2. **`-S` sort fields** are comma-separated, not space-separated. E.g. `-S "res:720,acodec:aac"`.
3. **`--format-sort` vs `-f`**: `-S` adjusts the definition of "best"; `-f` selects specific formats. They work together.
4. **`--ffmpeg-location`** must point to the directory containing ffmpeg, not the binary itself.
5. **`--cookies-from-browser`** works differently on each OS. On Windows, it reads from the default Chrome profile.
6. **`--download-sections`** requires ffmpeg and re-encodes the video.
7. **Output template `%(filepath)s`** is post-process only — not available during download, only after `--print after_move:filepath`.

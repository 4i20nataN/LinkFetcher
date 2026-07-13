# yt-dlp CLI Reference (LinkFetcher Flags)

> Extracted from the official yt-dlp README.md. This document covers only the flags actually used by LinkFetcher.

---

## Table of Contents

- [General / Probe](#general--probe)
- [Format Selection](#format-selection)
- [Output / Filesystem](#output--filesystem)
- [Download Options](#download-options)
- [Subtitle Options](#subtitle-options)
- [Thumbnail Options](#thumbnail-options)
- [Metadata / Post-Processing](#metadata--post-processing)
- [Audio (Extract Audio)](#audio-extract-audio)
- [Merging](#merging)
- [SponsorBlock Options](#sponsorblock-options)
- [FFmpeg](#ffmpeg)
- [Cookies / Authentication](#cookies--authentication)
- [Post-Processing Options](#post-processing-options)
- [Output Template](#output-template)
- [Format Selection: Filtering](#format-selection-filtering)
- [Format Selection: Sorting](#format-selection-sorting)

---

## General / Probe

### `--flat-playlist`

```
    --flat-playlist                 Do not extract a playlist's URL result
                                    entries; some entry metadata may be missing
                                    and downloading may be bypassed
    --no-flat-playlist              Fully extract the videos of a playlist
                                    (default)
```

### `--no-playlist`

```
    --no-playlist                   Download only the video, if the URL refers
                                    to a video and a playlist
    --yes-playlist                  Download the playlist, if the URL refers to
                                    a video and a playlist
```

### `-j, --dump-json` / `-J, --dump-single-json`

```
    -j, --dump-json                 Quiet, but print JSON information for each
                                    video. Simulate unless --no-simulate is
                                    used. See "OUTPUT TEMPLATE" for a
                                    description of available keys
    -J, --dump-single-json          Quiet, but print JSON information for each
                                    URL or infojson passed. Simulate unless
                                    --no-simulate is used. If the URL refers to
                                    a playlist, the whole playlist information
                                    is dumped in a single line
```

### `--no-download` (`--skip-download`)

```
    --skip-download                 Do not download the video but write all
                                    related files (Alias: --no-download)
```

### `-v, --verbose`

```
    -v, --verbose                   Print various debugging information
```

---

## Format Selection

### `-f, --format FORMAT`

```
    -f, --format FORMAT             Video format code, see "FORMAT SELECTION"
                                    for more details
```

The general syntax for format selection is `-f FORMAT` (or `--format FORMAT`) where `FORMAT` is a *selector expression*, i.e. an expression that describes format or formats you would like to download.

You can also use special names to select particular edge case formats:

 - `all`: Select **all formats** separately
 - `mergeall`: Select and **merge all formats** (Must be used with `--audio-multistreams`, `--video-multistreams` or both)
 - `b*`, `best*`: Select the best quality format that **contains either** a video or an audio or both (i.e.; `vcodec!=none or acodec!=none`)
 - `b`, `best`: Select the best quality format that **contains both** video and audio. Equivalent to `best*[vcodec!=none][acodec!=none]`
 - `bv`, `bestvideo`: Select the best quality **video-only** format. Equivalent to `best*[acodec=none]`
 - `bv*`, `bestvideo*`: Select the best quality format that **contains video**. It may also contain audio. Equivalent to `best*[vcodec!=none]`
 - `ba`, `bestaudio`: Select the best quality **audio-only** format. Equivalent to `best*[vcodec=none]`
 - `ba*`, `bestaudio*`: Select the best quality format that **contains audio**. It may also contain video. Equivalent to `best*[acodec!=none]` ([Do not use!](https://github.com/yt-dlp/yt-dlp/issues/979#issuecomment-919629354))
 - `w*`, `worst*`: Select the worst quality format that contains either a video or an audio
 - `w`, `worst`: Select the worst quality format that contains both video and audio. Equivalent to `worst*[vcodec!=none][acodec!=none]`
 - `wv`, `worstvideo`: Select the worst quality video-only format. Equivalent to `worst*[acodec=none]`
 - `wv*`, `worstvideo*`: Select the worst quality format that contains video. It may also contain audio. Equivalent to `worst*[vcodec!=none]`
 - `wa`, `worstaudio`: Select the worst quality audio-only format. Equivalent to `worst*[vcodec=none]`
 - `wa*`, `worstaudio*`: Select the worst quality format that contains audio. It may also contain video. Equivalent to `worst*[acodec!=none]`

You can select the n'th best format of a type by using `best<type>.<n>`. For example, `best.2` will select the 2nd best combined format. Similarly, `bv*.3` will select the 3rd best format that contains a video stream.

If you want to download multiple videos, and they don't have the same formats available, you can specify the order of preference using slashes. Note that formats on the left hand side are preferred; e.g. `-f 22/17/18` will download format 22 if it's available, otherwise it will download format 17 if it's available, otherwise it will download format 18 if it's available, otherwise it will complain that no suitable formats are available for download.

If you want to download several formats of the same video use a comma as a separator, e.g. `-f 22,17,18` will download all these three formats, of course if they are available. Or a more sophisticated example combined with the precedence feature: `-f 136/137/mp4/bestvideo,140/m4a/bestaudio`.

You can merge the video and audio of multiple formats into a single file using `-f <format1>+<format2>+...` (requires ffmpeg installed); e.g. `-f bestvideo+bestaudio` will download the best video-only format, the best audio-only format and mux them together with ffmpeg.

### `-S, --format-sort` (and all sort fields)

```
    -S, --format-sort SORTORDER     Sort the formats by the fields given, see
                                    "Sorting Formats" for more details
    --format-sort-reset             Disregard previous user specified sort order
                                    and reset to the default
    --format-sort-force             Force user specified sort order to have
                                    precedence over all fields, see "Sorting
                                    Formats" for more details (Alias: --S-force)
    --no-format-sort-force          Some fields have precedence over the user
                                    specified sort order (default)
```

You can change the criteria for being considered the `best` by using `-S` (`--format-sort`). The general format for this is `--format-sort field1,field2...`.

The available fields are:

 - `hasvid`: Gives priority to formats that have a video stream
 - `hasaud`: Gives priority to formats that have an audio stream
 - `ie_pref`: The format preference
 - `lang`: The language preference as determined by the extractor (e.g. original language preferred over audio description)
 - `quality`: The quality of the format
 - `source`: The preference of the source
 - `proto`: Protocol used for download (`https`/`ftps` > `http`/`ftp` > `m3u8_native`/`m3u8` > `http_dash_segments`> `websocket_frag` > `f4f`/`f4m`)
 - `vcodec`: Video Codec (`av01` > `vp9.2` > `vp9` > `h265` > `h264` > `vp8` > `h263` > `theora` > other)
 - `acodec`: Audio Codec (`flac`/`alac` > `wav`/`aiff` > `opus` > `vorbis` > `aac` > `mp4a` > `mp3` > `ac4` > `eac3` > `ac3` > `dts` > other)
 - `codec`: Equivalent to `vcodec,acodec`
 - `vext`: Video Extension (`mp4` > `mov` > `webm` > `flv` > other). If `--prefer-free-formats` is used, `webm` is preferred.
 - `aext`: Audio Extension (`m4a` > `aac` > `mp3` > `ogg` > `opus` > `webm` > other). If `--prefer-free-formats` is used, the order changes to `ogg` > `opus` > `webm` > `mp3` > `m4a` > `aac`
 - `ext`: Equivalent to `vext,aext`
 - `filesize`: Exact filesize, if known in advance
 - `fs_approx`: Approximate filesize
 - `size`: Exact filesize if available, otherwise approximate filesize
 - `height`: Height of video
 - `width`: Width of video
 - `res`: Video resolution, calculated as the smallest dimension.
 - `fps`: Framerate of video
 - `hdr`: The dynamic range of the video (`DV` > `HDR12` > `HDR10+` > `HDR10` > `HLG` > `SDR`)
 - `channels`: The number of audio channels
 - `tbr`: Total average bitrate in [kbps](## "1000 bits/sec")
 - `vbr`: Average video bitrate in [kbps](## "1000 bits/sec")
 - `abr`: Average audio bitrate in [kbps](## "1000 bits/sec")
 - `br`: Average bitrate in [kbps](## "1000 bits/sec"), `tbr`/`vbr`/`abr`
 - `asr`: Audio sample rate in Hz

All fields, unless specified otherwise, are sorted in descending order. To reverse this, prefix the field with a `+`. E.g. `+res` prefers format with the smallest resolution. Additionally, you can suffix a preferred value for the fields, separated by a `:`. E.g. `res:720` prefers larger videos, but no larger than 720p and the smallest video if there are no videos less than 720p. For `codec` and `ext`, you can provide two preferred values, the first for video and the second for audio. E.g. `+codec:avc:m4a` (equivalent to `+vcodec:avc,+acodec:m4a`) sets the video codec preference to `h264` > `h265` > `vp9` > `vp9.2` > `av01` > `vp8` > `h263` > `theora` and audio codec preference to `mp4a` > `aac` > `vorbis` > `opus` > `mp3` > `ac3` > `dts`. You can also make the sorting prefer the nearest values to the provided by using `~` as the delimiter. E.g. `filesize~1G` prefers the format with filesize closest to 1 GiB.

The fields `hasvid` and `ie_pref` are always given highest priority in sorting, irrespective of the user-defined order. This behavior can be changed by using `--format-sort-force`. Apart from these, the default order used is: `lang,quality,res,fps,hdr:12,vcodec,channels,acodec,size,br,asr,proto,ext,hasaud,source,id`. The extractors may override this default order, but they cannot override the user-provided order.

Note that the default for hdr is `hdr:12`; i.e. Dolby Vision is not preferred.

If your format selector is `worst`, the last item is selected after sorting. This means it will select the format that is worst in all respects. Most of the time, what you actually want is the video with the smallest filesize instead. So it is generally better to use `-f best -S +size,+br,+res,+fps`.

If you use the `-S`/`--format-sort` option multiple times, each subsequent sorting argument will be prepended to the previous one, and only the highest priority entry of any duplicated field will be preserved. E.g. `-S proto -S res` is equivalent to `-S res,proto`, and `-S res:720,fps -S vcodec,res:1080` is equivalent to `-S vcodec,res:1080,fps`. You can use `--format-sort-reset` to disregard any previously passed `-S`/`--format-sort` arguments and reset to the default order.

### `--format-sort-force`

See under `--format-sort` above.

### `--video-multistreams` / `--audio-multistreams`

```
    --video-multistreams            Allow multiple video streams to be merged
                                    into a single file
    --no-video-multistreams         Only one video stream is downloaded for each
                                    output file (default)
    --audio-multistreams            Allow multiple audio streams to be merged
                                    into a single file
    --no-audio-multistreams         Only one audio stream is downloaded for each
                                    output file (default)
```

Unless `--video-multistreams` is used, all formats with a video stream except the first one are ignored. Similarly, unless `--audio-multistreams` is used, all formats with an audio stream except the first one are ignored. E.g. `-f bestvideo+best+bestaudio --video-multistreams --audio-multistreams` will download and merge all 3 given formats. The resulting file will have 2 video streams and 2 audio streams. But `-f bestvideo+best+bestaudio --no-video-multistreams` will download and merge only `bestvideo` and `bestaudio`. `best` is ignored since another format containing a video stream (`bestvideo`) has already been selected. The order of the formats is therefore important. `-f best+bestaudio --no-audio-multistreams` will download only `best` while `-f bestaudio+best --no-audio-multistreams` will ignore `best` and download only `bestaudio`.

---

## Output / Filesystem

### `-o, --output TEMPLATE`

```
    -o, --output [TYPES:]TEMPLATE   Output filename template; see "OUTPUT
                                    TEMPLATE" for details
    --output-na-placeholder TEXT    Placeholder for unavailable fields in
                                    --output (default: "NA")
```

### `-P, --paths`

```
    -P, --paths [TYPES:]PATH        The paths where the files should be
                                    downloaded. Specify the type of file and the
                                    path separated by a colon ":". All the same
                                    TYPES as --output are supported.
                                    Additionally, you can also provide "home"
                                    (default) and "temp" paths. All intermediary
                                    files are first downloaded to the temp path
                                    and then the final files are moved over to
                                    the home path after download is finished.
                                    This option is ignored if --output is an
                                    absolute path
```

### `--restrict-filenames`

```
    --restrict-filenames            Restrict filenames to only ASCII characters,
                                    and avoid "&" and spaces in filenames
    --no-restrict-filenames         Allow Unicode characters, "&" and spaces in
                                    filenames (default)
```

### `--trim-filenames`

```
    --trim-filenames LENGTH         Limit the filename length (excluding
                                    extension) to the specified number of
                                    characters
```

### `--no-overwrites` / `-w`

```
    -w, --no-overwrites             Do not overwrite any files
```

### `--windows-filenames`

```
    --windows-filenames             Force filenames to be Windows-compatible
    --no-windows-filenames          Sanitize filenames only minimally
```

---

## Download Options

### `-N, --concurrent-fragments`

```
    -N, --concurrent-fragments N    Number of fragments of a dash/hlsnative
                                    video that should be downloaded concurrently
                                    (default is 1)
```

### `-r, --limit-rate`

```
    -r, --limit-rate RATE           Maximum download rate in bytes per second,
                                    e.g. 50K or 4.2M
```

### `-R, --retries`

```
    -R, --retries RETRIES           Number of retries (default is 10), or
                                    "infinite"
```

### `--fragment-retries`

```
    --fragment-retries RETRIES      Number of retries for a fragment (default is
                                    10), or "infinite" (DASH, hlsnative and ISM)
```

### `--download-sections`

```
    --download-sections REGEX       Download only chapters that match the
                                    regular expression. A "*" prefix denotes
                                    time-range instead of chapter. Negative
                                    timestamps are calculated from the end.
                                    "*from-url" can be used to download between
                                    the "start_time" and "end_time" extracted
                                    from the URL. Needs ffmpeg. This option can
                                    be used multiple times to download multiple
                                    sections, e.g. --download-sections
                                    "*10:15-inf" --download-sections "intro"
```

---

## Subtitle Options

### `--write-subs`

```
    --write-subs                    Write subtitle file
    --no-write-subs                 Do not write subtitle file (default)
```

### `--write-auto-subs`

```
    --write-auto-subs               Write automatically generated subtitle file
                                    (Alias: --write-automatic-subs)
    --no-write-auto-subs            Do not write auto-generated subtitles
                                    (default) (Alias: --no-write-automatic-subs)
```

### `--sub-lang`

```
    --sub-langs LANGS               Languages of the subtitles to download (can
                                    be regex) or "all" separated by commas, e.g.
                                    --sub-langs "en.*,ja" (where "en.*" is a
                                    regex pattern that matches "en" followed by
                                    0 or more of any character). You can prefix
                                    the language code with a "-" to exclude it
                                    from the requested languages, e.g. --sub-
                                    langs all,-live_chat. Use --list-subs for a
                                    list of available language tags
```

### `--embed-subs`

```
    --embed-subs                    Embed subtitles in the video (only for mp4,
                                    webm and mkv videos)
    --no-embed-subs                 Do not embed subtitles (default)
```

### `--sub-format`

```
    --sub-format FORMAT             Subtitle format; accepts formats preference
                                    separated by "/", e.g. "srt" or "ass/srt/best"
```

---

## Thumbnail Options

### `--write-thumbnail`

```
    --write-thumbnail               Write thumbnail image to disk
    --no-write-thumbnail            Do not write thumbnail image to disk (default)
```

### `--embed-thumbnail`

```
    --embed-thumbnail               Embed thumbnail in the video as cover art
    --no-embed-thumbnail            Do not embed thumbnail (default)
```

### `--convert-thumbnails`

```
    --convert-thumbnails FORMAT     Convert the thumbnails to another format
                                    (currently supported: jpg, png, webp). You
                                    can specify multiple rules using similar
                                    syntax as "--remux-video". Use "--convert-
                                    thumbnails none" to disable conversion
                                    (default)
```

---

## Metadata / Post-Processing

### `--embed-metadata`

```
    --embed-metadata                Embed metadata to the video file. Also
                                    embeds chapters/infojson if present unless
                                    --no-embed-chapters/--no-embed-info-json are
                                    used (Alias: --add-metadata)
    --no-embed-metadata             Do not add metadata to file (default)
                                    (Alias: --no-add-metadata)
```

### `--add-metadata`

Alias for `--embed-metadata` (see above).

---

## Audio (Extract Audio)

### `-x, --extract-audio`

```
    -x, --extract-audio             Convert video files to audio-only files
                                    (requires ffmpeg and ffprobe)
```

### `--audio-format`

```
    --audio-format FORMAT           Format to convert the audio to when -x is
                                    used. (currently supported: best (default),
                                    aac, alac, flac, m4a, mp3, opus, vorbis,
                                    wav). You can specify multiple rules using
                                    similar syntax as --remux-video
```

### `--audio-quality`

```
    --audio-quality QUALITY         Specify ffmpeg audio quality to use when
                                    converting the audio with -x. Insert a value
                                    between 0 (best) and 10 (worst) for VBR or a
                                    specific bitrate like 128K (default 5)
```

---

## Merging

### `--merge-output-format`

```
    --merge-output-format FORMAT    Containers that may be used when merging
                                    formats, separated by "/", e.g. "mp4/mkv".
                                    Ignored if no merge is required. (currently
                                    supported: avi, flv, mkv, mov, mp4, webm)
```

---

## SponsorBlock Options

Make chapter entries for, or remove various segments (sponsor,
introductions, etc.) from downloaded YouTube videos using the
[SponsorBlock API](https://sponsor.ajay.app)

### `--sponsorblock-remove`

```
    --sponsorblock-remove CATS      SponsorBlock categories to be removed from
                                    the video file, separated by commas. If a
                                    category is present in both mark and remove,
                                    remove takes precedence. The syntax and
                                    available categories are the same as for
                                    --sponsorblock-mark except that "default"
                                    refers to "all,-filler" and poi_highlight,
                                    chapter are not available
```

### `--sponsorblock-mark`

```
    --sponsorblock-mark CATS        SponsorBlock categories to create chapters
                                    for, separated by commas. Available
                                    categories are sponsor, intro, outro,
                                    selfpromo, preview, filler, interaction,
                                    music_offtopic, hook, poi_highlight,
                                    chapter, all and default (=all). You can
                                    prefix the category with a "-" to exclude
                                    it. See [1] for descriptions of the
                                    categories. E.g. --sponsorblock-mark
                                    all,-preview
                                    [1] https://wiki.sponsor.ajay.app/w/Segment_Categories
```

---

## FFmpeg

### `--ffmpeg-location`

```
    --ffmpeg-location PATH          Location of the ffmpeg binary; either the
                                    path to the binary or its containing directory
```

---

## Cookies / Authentication

### `--cookies`

```
    --cookies FILE                  Netscape formatted file to read cookies from
                                    and dump cookie jar in
    --no-cookies                    Do not read/dump cookies from/to file
                                    (default)
```

### `--cookies-from-browser`

```
    --cookies-from-browser BROWSER[+KEYRING][:PROFILE][::CONTAINER]
                                    The name of the browser to load cookies
                                    from. Currently supported browsers are:
                                    brave, chrome, chromium, edge, firefox,
                                    opera, safari, vivaldi, whale. Optionally,
                                    the KEYRING used for decrypting Chromium
                                    cookies on Linux, the name/path of the
                                    PROFILE to load cookies from, and the
                                    CONTAINER name (if Firefox) ("none" for no
                                    container) can be given with their
                                    respective separators. By default, all
                                    containers of the most recently accessed
                                    profile are used. Currently supported
                                    keyrings are: basictext, gnomekeyring,
                                    kwallet, kwallet5, kwallet6
    --no-cookies-from-browser       Do not load cookies from browser (default)
```

---

## Post-Processing Options

### `--postprocessor-args`

```
    --postprocessor-args NAME:ARGS  Give these arguments to the postprocessors.
                                    Specify the postprocessor/executable name
                                    and the arguments separated by a colon ":"
                                    to give the argument to the specified
                                    postprocessor/executable. Supported PP are:
                                    Merger, ModifyChapters, SplitChapters,
                                    ExtractAudio, VideoRemuxer, VideoConvertor,
                                    Metadata, EmbedSubtitle, EmbedThumbnail,
                                    SubtitlesConvertor, ThumbnailsConvertor,
                                    FixupStretched, FixupM4a, FixupM3u8,
                                    FixupTimestamp and FixupDuration. The
                                    supported executables are: AtomicParsley,
                                    FFmpeg and FFprobe. You can also specify
                                    "PP+EXE:ARGS" to give the arguments to the
                                    specified executable only when being used by
                                    the specified postprocessor. Additionally,
                                    for ffmpeg/ffprobe, "_i"/"_o" can be
                                    appended to the prefix optionally followed
                                    by a number to pass the argument before the
                                    specified input/output file, e.g. --ppa
                                    "Merger+ffmpeg_i1:-v quiet". You can use
                                    this option multiple times to give different
                                    arguments to different postprocessors.
                                    (Alias: --ppa)
```

### `--exec`

```
    --exec [WHEN:]CMD               Execute a command, optionally prefixed with
                                    when to execute it, separated by a ":".
                                    Supported values of "WHEN" are the same as
                                    that of --use-postprocessor (default:
                                    after_move). The same syntax as the output
                                    template can be used to pass any field as
                                    arguments to the command; however, for
                                    security reasons the only allowed
                                    conversions are: "i"/"d" (signed integer
                                    decimal), "f" (floating-point decimal) and
                                    "q" (shell-quoted). If no fields are passed,
                                    %(filepath,_filename|)q is appended to the
                                    end of the command. This option can be used
                                    multiple times
    --no-exec                       Remove any previously defined --exec
```

---

## Output Template

The `-o` option is used to indicate a template for the output file names while `-P` option is used to specify the path each type of file should be saved to.

It may contain special sequences that will be replaced when downloading each video. The special sequences may be formatted according to [Python string formatting operations](https://docs.python.org/3/library/stdtypes.html#printf-style-string-formatting), e.g. `%(NAME)s` or `%(NAME)05d`.

The field names themselves (the part inside the parenthesis) can also have some special formatting:

1. **Object traversal**: The dictionaries and lists available in metadata can be traversed by using a dot `.` separator; e.g. `%(tags.0)s`, `%(subtitles.en.-1.ext)s`. You can do Python slicing with colon `:`; E.g. `%(id.3:7)s`, `%(id.6:2:-1)s`, `%(formats.:.format_id)s`. Curly braces `{}` can be used to build dictionaries with only specific keys; e.g. `%(formats.:.{format_id,height})#j`. An empty field name `%()s` refers to the entire infodict; e.g. `%(.{id,title})s`. Note that all the fields that become available using this method are not listed below. Use `-j` to see such fields

1. **Arithmetic**: Simple arithmetic can be done on numeric fields using `+`, `-` and `*`. E.g. `%(playlist_index+10)03d`, `%(n_entries+1-playlist_index)d`

1. **Date/time Formatting**: Date/time fields can be formatted according to [strftime formatting](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes) by specifying it separated from the field name using a `>`. E.g. `%(duration>%H-%M-%S)s`, `%(upload_date>%Y-%m-%d)s`, `%(epoch-3600>%H-%M-%S)s`

1. **Alternatives**: Alternate fields can be specified separated with a `,`. E.g. `%(release_date>%Y,upload_date>%Y|Unknown)s`

1. **Replacement**: A replacement value can be specified using a `&` separator according to the [`str.format` mini-language](https://docs.python.org/3/library/string.html#format-specification-mini-language). If the field is *not* empty, this replacement value will be used instead of the actual field content. This is done after alternate fields are considered; thus the replacement is used if *any* of the alternative fields is *not* empty. E.g. `%(chapters&has chapters|no chapters)s`, `%(title&TITLE={:>20}|NO TITLE)s`

1. **Default**: A literal default value can be specified for when the field is empty using a `|` separator. This overrides `--output-na-placeholder`. E.g. `%(uploader|Unknown)s`

1. **More Conversions**: In addition to the normal format types `diouxXeEfFgGcrs`, yt-dlp additionally supports converting to `B` = **B**ytes, `j` = **j**son (flag `#` for pretty-printing, `+` for Unicode), `h` = HTML escaping, `l` = a comma-separated **l**ist (flag `#` for `\n` newline-separated), `q` = a string **q**uoted for the terminal (flag `#` to split a list into different arguments), `D` = add **D**ecimal suffixes (e.g. 10M) (flag `#` to use 1024 as factor), and `S` = **S**anitize as filename (flag `#` for restricted)

1. **Unicode normalization**: The format type `U` can be used for NFC [Unicode normalization](https://docs.python.org/3/library/unicodedata.html#unicodedata.normalize). The alternate form flag (`#`) changes the normalization to NFD and the conversion flag `+` can be used for NFKC/NFKD compatibility equivalence normalization. E.g. `%(title)+.100U` is NFKC

To summarize, the general syntax for a field is:
```
%(name[.keys][addition][>strf][,alternate][&replacement][|default])[flags][width][.precision][length]type
```

Additionally, you can set different output templates for the various metadata files separately from the general output template by specifying the type of file followed by the template separated by a colon `:`. The different file types supported are `subtitle`, `thumbnail`, `description`, `annotation` (deprecated), `infojson`, `link`, `pl_thumbnail`, `pl_description`, `pl_infojson`, `chapter`, `pl_video`. E.g. `-o "%(title)s.%(ext)s" -o "thumbnail:%(title)s\%(title)s.%(ext)s"` will put the thumbnails in a folder with the same name as the video. If any of the templates is empty, that type of file will not be written. E.g. `--write-thumbnail -o "thumbnail:"` will write thumbnails only for playlists and not for video.

**Note**: Due to post-processing (i.e. merging etc.), the actual output filename might differ. Use `--print after_move:filepath` to get the name after all post-processing is complete.

### Available Output Template Fields

**General:**
 - `id` (string): Video identifier
 - `title` (string): Video title
 - `fulltitle` (string): Video title ignoring live timestamp and generic title
 - `ext` (string): Video filename extension
 - `alt_title` (string): A secondary title of the video
 - `description` (string): The description of the video
 - `display_id` (string): An alternative identifier for the video
 - `uploader` (string): Full name of the video uploader
 - `uploader_id` (string): Nickname or id of the video uploader
 - `uploader_url` (string): URL to the video uploader's profile
 - `license` (string): License name the video is licensed under
 - `creators` (list): The creators of the video
 - `creator` (string): The creators of the video; comma-separated
 - `timestamp` (numeric): UNIX timestamp of the moment the video became available
 - `upload_date` (string): Video upload date in UTC (YYYYMMDD)
 - `release_timestamp` (numeric): UNIX timestamp of the moment the video was released
 - `release_date` (string): The date (YYYYMMDD) when the video was released in UTC
 - `release_year` (numeric): Year (YYYY) when the video or album was released
 - `modified_timestamp` (numeric): UNIX timestamp of the moment the video was last modified
 - `modified_date` (string): The date (YYYYMMDD) when the video was last modified in UTC
 - `channel` (string): Full name of the channel the video is uploaded on
 - `channel_id` (string): Id of the channel
 - `channel_url` (string): URL of the channel
 - `channel_follower_count` (numeric): Number of followers of the channel
 - `channel_is_verified` (boolean): Whether the channel is verified on the platform
 - `location` (string): Physical location where the video was filmed
 - `duration` (numeric): Length of the video in seconds
 - `duration_string` (string): Length of the video (HH:mm:ss)
 - `view_count` (numeric): How many users have watched the video on the platform
 - `concurrent_view_count` (numeric): How many users are currently watching the video on the platform
 - `like_count` (numeric): Number of positive ratings of the video
 - `dislike_count` (numeric): Number of negative ratings of the video
 - `repost_count` (numeric): Number of reposts of the video
 - `average_rating` (numeric): Average rating given by users, the scale used depends on the webpage
 - `comment_count` (numeric): Number of comments on the video
 - `save_count` (numeric): Number of times the video has been saved or bookmarked
 - `age_limit` (numeric): Age restriction for the video (years)
 - `live_status` (string): One of "not_live", "is_live", "is_upcoming", "was_live", "post_live"
 - `is_live` (boolean): Whether this video is a live stream or a fixed-length video
 - `was_live` (boolean): Whether this video was originally a live stream
 - `playable_in_embed` (string): Whether this video is allowed to play in embedded players on other sites
 - `availability` (string): Whether the video is "private", "premium_only", "subscriber_only", "needs_auth", "unlisted" or "public"
 - `media_type` (string): The type of media as classified by the site, e.g. "episode", "clip", "trailer"
 - `start_time` (numeric): Time in seconds where the reproduction should start, as specified in the URL
 - `end_time` (numeric): Time in seconds where the reproduction should end, as specified in the URL
 - `extractor` (string): Name of the extractor
 - `extractor_key` (string): Key name of the extractor
 - `epoch` (numeric): Unix epoch of when the information extraction was completed
 - `autonumber` (numeric): Number that will be increased with each download, starting at `--autonumber-start`, padded with leading zeros to 5 digits
 - `video_autonumber` (numeric): Number that will be increased with each video

**Playlist:**
 - `n_entries` (numeric): Total number of extracted items in the playlist
 - `playlist_id` (string): Identifier of the playlist that contains the video
 - `playlist_title` (string): Name of the playlist that contains the video
 - `playlist` (string): `playlist_title` if available or else `playlist_id`
 - `playlist_count` (numeric): Total number of items in the playlist
 - `playlist_index` (numeric): Index of the video in the playlist padded with leading zeros according the final index
 - `playlist_autonumber` (numeric): Position of the video in the playlist download queue padded with leading zeros according to the total length of the playlist
 - `playlist_uploader` (string): Full name of the playlist uploader
 - `playlist_uploader_id` (string): Nickname or id of the playlist uploader
 - `playlist_channel` (string): Display name of the channel that uploaded the playlist
 - `playlist_channel_id` (string): Identifier of the channel that uploaded the playlist
 - `playlist_webpage_url` (string): URL of the playlist webpage

**URL:**
 - `webpage_url` (string): A URL to the video webpage which, if given to yt-dlp, should yield the same result again
 - `webpage_url_basename` (string): The basename of the webpage URL
 - `webpage_url_domain` (string): The domain of the webpage URL
 - `original_url` (string): The URL given by the user (or the same as `webpage_url` for playlist entries)

**Tags:**
 - `categories` (list): List of categories the video belongs to
 - `tags` (list): List of tags assigned to the video
 - `cast` (list): List of cast members

**Chapter:**
 - `chapter` (string): Name or title of the chapter the video belongs to
 - `chapter_number` (numeric): Number of the chapter the video belongs to
 - `chapter_id` (string): Id of the chapter the video belongs to

**Series/Episode:**
 - `series` (string): Title of the series or program the video episode belongs to
 - `series_id` (string): Id of the series or program the video episode belongs to
 - `season` (string): Title of the season the video episode belongs to
 - `season_number` (numeric): Number of the season the video episode belongs to
 - `season_id` (string): Id of the season the video episode belongs to
 - `episode` (string): Title of the video episode
 - `episode_number` (numeric): Number of the video episode within a season
 - `episode_id` (string): Id of the video episode

**Track/Album:**
 - `track` (string): Title of the track
 - `track_number` (numeric): Number of the track within an album or a disc
 - `track_id` (string): Id of the track
 - `artists` (list): Artist(s) of the track
 - `artist` (string): Artist(s) of the track; comma-separated
 - `genres` (list): Genre(s) of the track
 - `genre` (string): Genre(s) of the track; comma-separated
 - `composers` (list): Composer(s) of the piece
 - `composer` (string): Composer(s) of the piece; comma-separated
 - `album` (string): Title of the album the track belongs to
 - `album_type` (string): Type of the album
 - `album_artists` (list): All artists appeared on the album
 - `album_artist` (string): All artists appeared on the album; comma-separated
 - `disc_number` (numeric): Number of the disc or other physical medium the track belongs to

**Section (--download-sections only):**
 - `section_title` (string): Title of the chapter
 - `section_number` (numeric): Number of the chapter within the file
 - `section_start` (numeric): Start time of the chapter in seconds
 - `section_end` (numeric): End time of the chapter in seconds

**Print-only (--print):**
 - `urls` (string): The URLs of all requested formats, one in each line
 - `filename` (string): Name of the video file
 - `formats_table` (table): The video format table as printed by `--list-formats`
 - `thumbnails_table` (table): The thumbnail format table as printed by `--list-thumbnails`
 - `subtitles_table` (table): The subtitle format table as printed by `--list-subs`
 - `automatic_captions_table` (table): The automatic subtitle format table as printed by `--list-subs`

**Post-process only:**
 - `filepath`: Actual path of downloaded video file

**SponsorBlock chapter title:**
 - `start_time` (numeric): Start time of the chapter in seconds
 - `end_time` (numeric): End time of the chapter in seconds
 - `categories` (list): The [SponsorBlock categories](https://wiki.sponsor.ajay.app/w/Types#Category) the chapter belongs to
 - `category` (string): The smallest SponsorBlock category the chapter belongs to
 - `category_names` (list): Friendly names of the categories
 - `name` (string): Friendly name of the smallest category
 - `type` (string): The [SponsorBlock action type](https://wiki.sponsor.ajay.app/w/Types#Action_Type) of the chapter

---

## Format Selection: Filtering

You can filter the video formats by putting a condition in brackets, as in `-f "best[height=720]"` (or `-f "[filesize>10M]"` since filters without a selector are interpreted as `best`).

### Numeric meta fields

The following numeric meta fields can be used with comparisons `<`, `<=`, `>`, `>=`, `=` (equals), `!=` (not equals):

 - `filesize`: The number of bytes, if known in advance
 - `filesize_approx`: An estimate for the number of bytes
 - `width`: Width of the video, if known
 - `height`: Height of the video, if known
 - `aspect_ratio`: Aspect ratio of the video, if known
 - `tbr`: Average bitrate of audio and video in kbps
 - `abr`: Average audio bitrate in kbps
 - `vbr`: Average video bitrate in kbps
 - `asr`: Audio sampling rate in Hertz
 - `fps`: Frame rate
 - `audio_channels`: The number of audio channels
 - `stretched_ratio`: `width:height` of the video's pixels, if not square

### String meta fields

Also filtering work for comparisons `=` (equals), `^=` (starts with), `$=` (ends with), `*=` (contains), `~=` (matches regex) and following string meta fields:

 - `url`: Video URL
 - `ext`: File extension
 - `acodec`: Name of the audio codec in use
 - `vcodec`: Name of the video codec in use
 - `container`: Name of the container format
 - `protocol`: The protocol that will be used for the actual download, lower-case (`http`, `https`, `rtmp`, `rtmpe`, `f4m`, `ism`, `http_dash_segments`, `m3u8`, or `m3u8_native`)
 - `language`: Language code
 - `dynamic_range`: The dynamic range of the video
 - `format_id`: A short description of the format
 - `format`: A human-readable description of the format
 - `format_note`: Additional info about the format
 - `resolution`: Textual description of width and height

Any string comparison may be prefixed with negation `!` in order to produce an opposite comparison, e.g. `!*=` (does not contain). The comparand of a string comparison needs to be quoted with either double or single quotes if it contains spaces or special characters other than `._-`.

**Note**: None of the aforementioned meta fields are guaranteed to be present since this solely depends on the metadata obtained by the particular extractor, i.e. the metadata offered by the website. Any other field made available by the extractor can also be used for filtering.

Formats for which the value is not known are excluded unless you put a question mark (`?`) after the operator. You can combine format filters, so `-f "bv[height<=?720][tbr>500]"` selects up to 720p videos (or videos where the height is not known) with a bitrate of at least 500 kbps. You can also use the filters with `all` to download all formats that satisfy the filter, e.g. `-f "all[vcodec=none]"` selects all audio-only formats.

Format selectors can also be grouped using parentheses; e.g. `-f "(mp4,webm)[height<480]"` will download the best pre-merged mp4 and webm formats with a height lower than 480.

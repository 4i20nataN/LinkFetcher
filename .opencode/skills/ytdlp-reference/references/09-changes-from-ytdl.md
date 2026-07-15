# yt-dlp: CHANGES FROM YOUTUBE-DL

<!-- Extracted from yt-dlp README.md -->

# CHANGES FROM YOUTUBE-DL

### New features

* Forked from [**yt-dlc@f9401f2**](https://github.com/blackjack4494/yt-dlc/commit/f9401f2a91987068139c5f757b12fc711d4c0cee) and merged with [**youtube-dl@a08f2b7**](https://github.com/ytdl-org/youtube-dl/commit/a08f2b7e4567cdc50c0614ee0a4ffdff49b8b6e6) ([exceptions](https://github.com/yt-dlp/yt-dlp/issues/21))

* **[SponsorBlock Integration](#sponsorblock-options)**: You can mark/remove sponsor sections in YouTube videos by utilizing the [SponsorBlock](https://sponsor.ajay.app) API

* **[Format Sorting](#sorting-formats)**: The default format sorting options have been changed so that higher resolution and better codecs will be now preferred instead of simply using larger bitrate. Furthermore, you can now specify the sort order using `-S`. This allows for much easier format selection than what is possible by simply using `--format` ([examples](#format-selection-examples))

* **Merged with animelover1984/youtube-dl**: You get most of the features and improvements from [animelover1984/youtube-dl](https://github.com/animelover1984/youtube-dl) including `--write-comments`, `BiliBiliSearch`, `BilibiliChannel`, Embedding thumbnail in mp4/ogg/opus, playlist infojson etc. See [#31](https://github.com/yt-dlp/yt-dlp/pull/31) for details.

* **YouTube improvements**:
    * Supports Clips, Stories (`ytstories:<channel UCID>`), Search (including filters)**\***, YouTube Music Search, Channel-specific search, Search prefix (`ytsearch:`)**\***, Mixes, and Feeds (`:ytfav`, `:ytwatchlater`, `:ytsubs`, `:ythistory`, `:ytrec`, `:ytnotif`)
    * Fix for [n-sig based throttling](https://github.com/ytdl-org/youtube-dl/issues/29326) **\***
    * Download livestreams from the start using `--live-from-start` (*experimental*)
    * Channel URLs download all uploads of the channel, including shorts and live

* **Cookies from browser**: Cookies can be automatically extracted from all major web browsers using `--cookies-from-browser BROWSER[+KEYRING][:PROFILE][::CONTAINER]`

* **Download time range**: Videos can be downloaded partially based on either timestamps or chapters using `--download-sections`

* **Split video by chapters**: Videos can be split into multiple files based on chapters using `--split-chapters`

* **Multi-threaded fragment downloads**: Download multiple fragments of m3u8/mpd videos in parallel. Use `--concurrent-fragments` (`-N`) option to set the number of threads used

* **New and fixed extractors**: Many new extractors have been added and a lot of existing ones have been fixed. See the [changelog](Changelog.md) or the [list of supported sites](supportedsites.md)

* **New MSOs**: Philo, Spectrum, SlingTV, Cablevision, RCN etc.

* **Subtitle extraction from manifests**: Subtitles can be extracted from streaming media manifests. See [commit/be6202f](https://github.com/yt-dlp/yt-dlp/commit/be6202f12b97858b9d716e608394b51065d0419f) for details

* **Multiple paths and output templates**: You can give different [output templates](#output-template) and download paths for different types of files. You can also set a temporary path where intermediary files are downloaded to using `--paths` (`-P`)

* **Portable Configuration**: Configuration files are automatically loaded from the home and root directories. See [CONFIGURATION](#configuration) for details

* **Output template improvements**: Output templates can now have date-time formatting, numeric offsets, object traversal etc. See [output template](#output-template) for details. Even more advanced operations can also be done with the help of `--parse-metadata` and `--replace-in-metadata`

* **Other new options**: Many new options have been added such as `--alias`, `--print`, `--concat-playlist`, `--wait-for-video`, `--retry-sleep`, `--sleep-requests`, `--convert-thumbnails`, `--force-download-archive`, `--force-overwrites`, `--break-match-filters` etc

* **Improvements**: Regex and other operators in `--format`/`--match-filters`, multiple `--postprocessor-args` and `--downloader-args`, faster archive checking, more [format selection options](#format-selection), merge multi-video/audio, multiple `--config-locations`, `--exec` at different stages, etc

* **Plugins**: Extractors and PostProcessors can be loaded from an external file. See [plugins](#plugins) for details

* **Self updater**: The releases can be updated using `yt-dlp -U`, and downgraded using `--update-to` if required

* **Automated builds**: [Nightly/master builds](#update-channels) can be used with `--update-to nightly` and `--update-to master`

See [changelog](Changelog.md) or [commits](https://github.com/yt-dlp/yt-dlp/commits) for the full list of changes

Features marked with a **\*** have been back-ported to youtube-dl

### Differences in default behavior

Some of yt-dlp's default options are different from that of youtube-dl and youtube-dlc:

* yt-dlp supports only [Python 3.10+](## "Windows 8"), and will remove support for more versions as they [become EOL](https://devguide.python.org/versions/#python-release-cycle); while [youtube-dl still supports Python 2.6+ and 3.2+](https://github.com/ytdl-org/youtube-dl/issues/30568#issue-1118238743)
* The options `--auto-number` (`-A`), `--title` (`-t`) and `--literal` (`-l`), no longer work. See [removed options](#Removed) for details
* `avconv` is not supported as an alternative to `ffmpeg`
* yt-dlp stores config files in slightly different locations to youtube-dl. See [CONFIGURATION](#configuration) for a list of correct locations
* The default [output template](#output-template) is `%(title)s [%(id)s].%(ext)s`. There is no real reason for this change. This was changed before yt-dlp was ever made public and now there are no plans to change it back to `%(title)s-%(id)s.%(ext)s`. Instead, you may use `--compat-options filename`
* The default [format sorting](#sorting-formats) is different from youtube-dl and prefers higher resolution and better codecs rather than higher bitrates. You can use the `--format-sort` option to change this to any order you prefer, or use `--compat-options format-sort` to use youtube-dl's sorting order. Older versions of yt-dlp preferred VP9 due to its broader compatibility; you can use `--compat-options prefer-vp9-sort` to revert to that format sorting preference. These two compat options cannot be used together
* The default format selector is `bv*+ba/b`. This means that if a combined video + audio format that is better than the best video-only format is found, the former will be preferred. Use `-f bv+ba/b` or `--compat-options format-spec` to revert this
* Unlike youtube-dlc, yt-dlp does not allow merging multiple audio/video streams into one file by default (since this conflicts with the use of `-f bv*+ba`). If needed, this feature must be enabled using `--audio-multistreams` and `--video-multistreams`. You can also use `--compat-options multistreams` to enable both
* `--no-abort-on-error` is enabled by default. Use `--abort-on-error` or `--compat-options abort-on-error` to abort on errors instead
* When writing metadata files such as thumbnails, description or infojson, the same information (if available) is also written for playlists. Use `--no-write-playlist-metafiles` or `--compat-options no-playlist-metafiles` to not write these files
* `--add-metadata` attaches the `infojson` to `mkv` files in addition to writing the metadata when used with `--write-info-json`. Use `--no-embed-info-json` or `--compat-options no-attach-info-json` to revert this
* Some metadata are embedded into different fields when using `--add-metadata` as compared to youtube-dl. Most notably, `comment` field contains the `webpage_url` and `synopsis` contains the `description`. You can [use `--parse-metadata`](#modifying-metadata) to modify this to your liking or use `--compat-options embed-metadata` to revert this
* `playlist_index` behaves differently when used with options like `--playlist-reverse` and `--playlist-items`. See [#302](https://github.com/yt-dlp/yt-dlp/issues/302) for details. You can use `--compat-options playlist-index` if you want to keep the earlier behavior
* The output of `-F` is listed in a new format. Use `--compat-options list-formats` to revert this
* Live chats (if available) are considered as subtitles. Use `--sub-langs all,-live_chat` to download all subtitles except live chat. You can also use `--compat-options no-live-chat` to prevent any live chat/danmaku from downloading
* YouTube channel URLs download all uploads of the channel. To download only the videos in a specific tab, pass the tab's URL. If the channel does not show the requested tab, an error will be raised. Also, `/live` URLs raise an error if there are no live videos instead of silently downloading the entire channel. You may use `--compat-options no-youtube-channel-redirect` to revert all these redirections
* Unavailable videos are also listed for YouTube playlists. Use `--compat-options no-youtube-unavailable-videos` to remove this
* The upload dates extracted from YouTube are in UTC.
* If `ffmpeg` is used as the downloader, the downloading and merging of formats happen in a single step when possible. Use `--compat-options no-direct-merge` to revert this
* Thumbnail embedding in `mp4` is done with mutagen if possible. Use `--compat-options embed-thumbnail-atomicparsley` to force the use of AtomicParsley instead
* Some internal metadata such as filenames are removed by default from the infojson. Use `--no-clean-infojson` or `--compat-options no-clean-infojson` to revert this
* When `--embed-subs` and `--write-subs` are used together, the subtitles are written to disk and also embedded in the media file. You can use just `--embed-subs` to embed the subs and automatically delete the separate file. See [#630 (comment)](https://github.com/yt-dlp/yt-dlp/issues/630#issuecomment-893659460) for more info. `--compat-options no-keep-subs` can be used to revert this
* `certifi` will be used for SSL root certificates, if installed. If you want to use system certificates (e.g. self-signed), use `--compat-options no-certifi`
* yt-dlp's sanitization of invalid characters in filenames is different/smarter than in youtube-dl. You can use `--compat-options filename-sanitization` to revert to youtube-dl's behavior
* (Not currently implemented) ~~yt-dlp tries to parse the external downloader outputs into the standard progress output if possible. You can use `--compat-options no-external-downloader-progress` to get the downloader output as-is~~
* yt-dlp versions from 2021.09.01 to 2022.11.11 (inclusive) applied `--match-filters` to nested playlists. This was an unintentional side-effect of [8f18ac](https://github.com/yt-dlp/yt-dlp/commit/8f18aca8717bb0dd49054555af8d386e5eda3a88) and is fixed in [d7b460](https://github.com/yt-dlp/yt-dlp/commit/d7b460d0e5fc710950582baed2e3fc616ed98a80). Use `--compat-options playlist-match-filter` to revert this
* yt-dlp versions from 2021.11.10 to 2023.06.21 (inclusive) estimated `filesize_approx` values for fragmented/manifest formats. This was added for convenience in [f2fe69](https://github.com/yt-dlp/yt-dlp/commit/f2fe69c7b0d208bdb1f6292b4ae92bc1e1a7444a), but was reverted in [0dff8e](https://github.com/yt-dlp/yt-dlp/commit/0dff8e4d1e6e9fb938f4256ea9af7d81f42fd54f) due to the potentially extreme inaccuracy of the estimated values. Use `--compat-options manifest-filesize-approx` to keep extracting the estimated values
* yt-dlp uses modern http client backends such as `requests`. Use `--compat-options prefer-legacy-http-handler` to prefer the legacy http handler (`urllib`) to be used for standard http requests.
* The sub-modules `swfinterp`, `casefold` are removed.
* Passing `--simulate` (or calling `extract_info` with `download=False`) no longer alters the default format selection. See [#9843](https://github.com/yt-dlp/yt-dlp/issues/9843) for details.
* yt-dlp no longer applies the server modified time to downloaded files by default. Use `--mtime` or `--compat-options mtime-by-default` to revert this.

For convenience, there are some compat option aliases available to use:

* `--compat-options all`: Use all compat options (**Do NOT use this!**)
* `--compat-options youtube-dl`: Same as `--compat-options all,-multistreams,-playlist-match-filter,-manifest-filesize-approx,-allow-unsafe-ext,-prefer-vp9-sort,-allow-unsafe-exec-expansion`
* `--compat-options youtube-dlc`: Same as `--compat-options all,-no-live-chat,-no-youtube-channel-redirect,-playlist-match-filter,-manifest-filesize-approx,-allow-unsafe-ext,-prefer-vp9-sort,-allow-unsafe-exec-expansion`
* `--compat-options 2021`: Same as `--compat-options 2022,no-certifi,filename-sanitization`
* `--compat-options 2022`: Same as `--compat-options 2023,playlist-match-filter,no-external-downloader-progress,prefer-legacy-http-handler,manifest-filesize-approx`
* `--compat-options 2023`: Same as `--compat-options 2024,prefer-vp9-sort`
* `--compat-options 2024`: Same as `--compat-options 2025,mtime-by-default`
* `--compat-options 2025`: Currently does nothing. Use this to enable all future compat options

Using one of the yearly compat option aliases will pin yt-dlp's default behavior to what it was at the *end* of that calendar year.

The following compat options restore vulnerable behavior from before security patches:

* `--compat-options allow-unsafe-ext`: Allow files with any extension (including unsafe ones) to be downloaded ([GHSA-79w7-vh3h-8g4j](<https://github.com/yt-dlp/yt-dlp/security/advisories/GHSA-79w7-vh3h-8g4j>))

    > :warning: Only use if a valid file download is rejected because its extension is detected as uncommon
    >
    > **This option can enable remote code execution!** Consider [opening an issue](<https://github.com/yt-dlp/yt-dlp/issues/new/choose>) instead!

* `--compat-options allow-unsafe-exec-expansion`: The `--exec` option allows output template syntax to be used in its commands; however, for security reasons the conversions that can be used are restricted to `i`/`d` (signed integer decimal), `f` (floating-point decimal) and `q` (shell-quoted). yt-dlp versions from 2021.04.11 to 2026.03.17 (inclusive) did not apply this restriction. This option reverts this restriction

    > :warning: **This option can enable remote code execution!** Consider using `%()q` conversions in your exec command templates for any string values.


### Deprecated options

These are all the deprecated options and the current alternative to achieve the same effect

#### Almost redundant options
While these options are almost the same as their new counterparts, there are some differences that prevents them being redundant

    -j, --dump-json                  --print "%()j"
    -F, --list-formats               --print formats_table
    --list-thumbnails                --print thumbnails_table --print playlist:thumbnails_table
    --list-subs                      --print automatic_captions_table --print subtitles_table

#### Redundant options
While these options are redundant, they are still expected to be used due to their ease of use

    --get-description                --print description
    --get-duration                   --print duration_string
    --get-filename                   --print filename
    --get-format                     --print format
    --get-id                         --print id
    --get-thumbnail                  --print thumbnail
    -e, --get-title                  --print title
    -g, --get-url                    --print urls
    --match-title REGEX              --match-filters "title ~= (?i)REGEX"
    --reject-title REGEX             --match-filters "title !~= (?i)REGEX"
    --min-views COUNT                --match-filters "view_count >=? COUNT"
    --max-views COUNT                --match-filters "view_count <=? COUNT"
    --break-on-reject                Use --break-match-filters
    --user-agent UA                  --add-headers "User-Agent:UA"
    --referer URL                    --add-headers "Referer:URL"
    --playlist-start NUMBER          -I NUMBER:
    --playlist-end NUMBER            -I :NUMBER
    --playlist-reverse               -I ::-1
    --no-playlist-reverse            Default
    --no-colors                      --color no_color

#### Not recommended
While these options still work, their use is not recommended since there are other alternatives to achieve the same

    --force-generic-extractor        --ies generic,default
    --exec-before-download CMD       --exec "before_dl:CMD"
    --no-exec-before-download        --no-exec
    --all-formats                    -f all
    --all-subs                       --sub-langs all --write-subs
    --print-json                     -j --no-simulate
    --autonumber-size NUMBER         Use string formatting, e.g. %(autonumber)03d
    --autonumber-start NUMBER        Use internal field formatting like %(autonumber+NUMBER)s
    --id                             -o "%(id)s.%(ext)s"
    --metadata-from-title FORMAT     --parse-metadata "%(title)s:FORMAT"
    --hls-prefer-native              --downloader "m3u8:native"
    --hls-prefer-ffmpeg              --downloader "m3u8:ffmpeg"
    --list-formats-old               --compat-options list-formats (Alias: --no-list-formats-as-table)
    --list-formats-as-table          --compat-options -list-formats [Default]
    --geo-bypass                     --xff "default"
    --no-geo-bypass                  --xff "never"
    --geo-bypass-country CODE        --xff CODE
    --geo-bypass-ip-block IP_BLOCK   --xff IP_BLOCK

#### Developer options
These options are not intended to be used by the end-user

    --test                           Download only part of video for testing extractors
    --load-pages                     Load pages dumped by --write-pages
    --allow-unplayable-formats       List unplayable formats also
    --no-allow-unplayable-formats    Default

#### Old aliases
These are aliases that are no longer documented for various reasons

    --clean-infojson                 --clean-info-json
    --force-write-download-archive   --force-write-archive
    --no-clean-infojson              --no-clean-info-json
    --no-split-tracks                --no-split-chapters
    --no-write-srt                   --no-write-subs
    --prefer-unsecure                --prefer-insecure
    --rate-limit RATE                --limit-rate RATE
    --split-tracks                   --split-chapters
    --srt-lang LANGS                 --sub-langs LANGS
    --trim-file-names LENGTH         --trim-filenames LENGTH
    --write-srt                      --write-subs
    --yes-overwrites                 --force-overwrites

#### Sponskrub Options
Support for [SponSkrub](https://github.com/faissaloo/SponSkrub) has been removed in favor of the `--sponsorblock` options

    --sponskrub                      --sponsorblock-mark all
    --no-sponskrub                   --no-sponsorblock
    --sponskrub-cut                  --sponsorblock-remove all
    --no-sponskrub-cut               --sponsorblock-remove -all
    --sponskrub-force                Not applicable
    --no-sponskrub-force             Not applicable
    --sponskrub-location             Not applicable
    --sponskrub-args                 Not applicable

#### No longer supported
These options may no longer work as intended

    --prefer-avconv                  avconv is not officially supported by yt-dlp (Alias: --no-prefer-ffmpeg)
    --prefer-ffmpeg                  Default (Alias: --no-prefer-avconv)
    -C, --call-home                  Not implemented
    --no-call-home                   Default
    --include-ads                    No longer supported
    --no-include-ads                 Default
    --write-annotations              No supported site has annotations now
    --no-write-annotations           Default
    --avconv-location                Removed alias for --ffmpeg-location
    --cn-verification-proxy URL      Removed alias for --geo-verification-proxy URL
    --dump-headers                   Removed alias for --print-traffic
    --dump-intermediate-pages        Removed alias for --dump-pages
    --youtube-skip-dash-manifest     Removed alias for --extractor-args "youtube:skip=dash" (Alias: --no-youtube-include-dash-manifest)
    --youtube-skip-hls-manifest      Removed alias for --extractor-args "youtube:skip=hls" (Alias: --no-youtube-include-hls-manifest)
    --youtube-include-dash-manifest  Default (Alias: --no-youtube-skip-dash-manifest)
    --youtube-include-hls-manifest   Default (Alias: --no-youtube-skip-hls-manifest)
    --youtube-print-sig-code         Removed testing functionality
    --dump-user-agent                No longer supported
    --xattr-set-filesize             No longer supported
    --compat-options seperate-video-versions  No longer needed
    --compat-options no-youtube-prefer-utc-upload-date  No longer supported

#### Removed
These options were deprecated since 2014 and have now been entirely removed

    -A, --auto-number                -o "%(autonumber)s-%(id)s.%(ext)s"
    -t, -l, --title, --literal       -o "%(title)s-%(id)s.%(ext)s"

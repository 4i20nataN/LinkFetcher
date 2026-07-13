# yt-dlp: General Options, Network Options, Geo-restriction, Video Selection, Download Options, Filesystem Options

<!-- Extracted from yt-dlp README.md -->

# USAGE AND OPTIONS

    yt-dlp [OPTIONS] [--] URL [URL...]

## General Options:
    -h, --help                      Print this help text and exit
    --version                       Print program version and exit
    -U, --update                    Update this program to the latest version
    --no-update                     Do not check for updates (default)
    --update-to [CHANNEL]@[TAG]     Upgrade/downgrade to a specific version.
                                    CHANNEL can be a repository as well. CHANNEL
                                    and TAG default to "stable" and "latest"
                                    respectively if omitted; See "UPDATE" for
                                    details. Supported channels: stable,
                                    nightly, master
    -i, --ignore-errors             Ignore download and postprocessing errors.
                                    The download will be considered successful
                                    even if the postprocessing fails
    --no-abort-on-error             Continue with next video on download errors;
                                    e.g. to skip unavailable videos in a
                                    playlist (default)
    --abort-on-error                Abort downloading of further videos if an
                                    error occurs (Alias: --no-ignore-errors)
    --list-extractors               List all supported extractors and exit
    --extractor-descriptions        Output descriptions of all supported
                                    extractors and exit
    --use-extractors NAMES          Extractor names to use separated by commas.
                                    You can also use regexes, "all", "default"
                                    and "end" (end URL matching); e.g. --ies
                                    "holodex.*,end,youtube". Prefix the name
                                    with a "-" to exclude it, e.g. --ies
                                    default,-generic. Use --list-extractors for
                                    a list of extractor names. (Alias: --ies)
    --default-search PREFIX         Use this prefix for unqualified URLs. E.g.
                                    "gvsearch2:python" downloads two videos from
                                    google videos for the search term "python".
                                    Use the value "auto" to let yt-dlp guess
                                    ("auto_warning" to emit a warning when
                                    guessing). "error" just throws an error. The
                                    default value "fixup_error" repairs broken
                                    URLs, but emits an error if this is not
                                    possible instead of searching
    --ignore-config                 Don't load any more configuration files
                                    except those given to --config-locations.
                                    For backward compatibility, if this option
                                    is found inside the system configuration
                                    file, the user configuration is not loaded.
                                    (Alias: --no-config)
    --no-config-locations           Do not load any custom configuration files
                                    (default). When given inside a configuration
                                    file, ignore all previous --config-locations
                                    defined in the current file
    --config-locations PATH         Location of the main configuration file;
                                    either the path to the config or its
                                    containing directory ("-" for stdin). Can be
                                    used multiple times and inside other
                                    configuration files
    --plugin-dirs DIR               Path to an additional directory to search
                                    for plugins. This option can be used
                                    multiple times to add multiple directories.
                                    Use "default" to search the default plugin
                                    directories (default)
    --no-plugin-dirs                Clear plugin directories to search,
                                    including defaults and those provided by
                                    previous --plugin-dirs
    --js-runtimes RUNTIME[:PATH]    Additional JavaScript runtime to enable,
                                    with an optional location for the runtime
                                    (either the path to the binary or its
                                    containing directory). This option can be
                                    used multiple times to enable multiple
                                    runtimes. Supported runtimes are (in order
                                    of priority, from highest to lowest): deno,
                                    node, quickjs, bun. Only "deno" is enabled
                                    by default. The highest priority runtime
                                    that is both enabled and available will be
                                    used. In order to use a lower priority
                                    runtime when "deno" is available, --no-js-
                                    runtimes needs to be passed before enabling
                                    other runtimes
    --no-js-runtimes                Clear JavaScript runtimes to enable,
                                    including defaults and those provided by
                                    previous --js-runtimes
    --remote-components COMPONENT   Remote components to allow yt-dlp to fetch
                                    when required. This option is currently not
                                    needed if you are using an official
                                    executable or have the requisite version of
                                    the yt-dlp-ejs package installed. You can
                                    use this option multiple times to allow
                                    multiple components. Supported values:
                                    ejs:npm (external JavaScript components from
                                    npm), ejs:github (external JavaScript
                                    components from yt-dlp-ejs GitHub). By
                                    default, no remote components are allowed
    --no-remote-components          Disallow fetching of all remote components,
                                    including any previously allowed by
                                    --remote-components or defaults.
    --flat-playlist                 Do not extract a playlist's URL result
                                    entries; some entry metadata may be missing
                                    and downloading may be bypassed
    --no-flat-playlist              Fully extract the videos of a playlist
                                    (default)
    --live-from-start               Download livestreams from the start.
                                    Currently experimental and only supported
                                    for YouTube, Twitch, TVer, and mellow-fan
    --no-live-from-start            Download livestreams from the current time
                                    (default)
    --wait-for-video MIN[-MAX]      Wait for scheduled streams to become
                                    available. Pass the minimum number of
                                    seconds (or range) to wait between retries
    --no-wait-for-video             Do not wait for scheduled streams (default)
    --mark-watched                  Mark videos watched (even with --simulate)
    --no-mark-watched               Do not mark videos watched (default)
    --color [STREAM:]POLICY         Whether to emit color codes in output,
                                    optionally prefixed by the STREAM (stdout or
                                    stderr) to apply the setting to. Can be one
                                    of "always", "auto" (default), "never", or
                                    "no_color" (use non color terminal
                                    sequences). Use "auto-tty" or "no_color-tty"
                                    to decide based on terminal support only.
                                    Can be used multiple times
    --compat-options OPTS           Options that can help keep compatibility
                                    with youtube-dl or youtube-dlc
                                    configurations by reverting some of the
                                    changes made in yt-dlp. See "Differences in
                                    default behavior" for details
    --alias ALIASES OPTIONS         Create aliases for an option string. Unless
                                    an alias starts with a dash "-", it is
                                    prefixed with "--". Arguments are parsed
                                    according to the Python string formatting
                                    mini-language. E.g. --alias get-audio,-X "-S
                                    aext:{0},abr -x --audio-format {0}" creates
                                    options "--get-audio" and "-X" that takes an
                                    argument (ARG0) and expands to "-S
                                    aext:ARG0,abr -x --audio-format ARG0". All
                                    defined aliases are listed in the --help
                                    output. Alias options can trigger more
                                    aliases; so be careful to avoid defining
                                    recursive options. As a safety measure, each
                                    alias may be triggered a maximum of 100
                                    times. This option can be used multiple times
    -t, --preset-alias PRESET       Applies a predefined set of options. e.g.
                                    --preset-alias mp3. The following presets
                                    are available: mp3, aac, mp4, mkv, sleep.
                                    See the "Preset Aliases" section at the end
                                    for more info. This option can be used
                                    multiple times

## Network Options:
    --proxy URL                     Use the specified HTTP/HTTPS/SOCKS proxy. To
                                    enable SOCKS proxy, specify a proper scheme,
                                    e.g. socks5://user:pass@127.0.0.1:1080/.
                                    Pass in an empty string (--proxy "") for
                                    direct connection
    --socket-timeout SECONDS        Time to wait before giving up, in seconds
    --source-address IP             Client-side IP address to bind to
    --impersonate CLIENT[:OS]       Client to impersonate for requests. E.g.
                                    chrome, chrome-110, chrome:windows-10. Pass
                                    --impersonate="" to impersonate any client.
                                    Note that forcing impersonation for all
                                    requests may have a detrimental impact on
                                    download speed and stability
    --list-impersonate-targets      List available clients to impersonate.
    -4, --force-ipv4                Make all connections via IPv4
    -6, --force-ipv6                Make all connections via IPv6
    --enable-file-urls              Enable file:// URLs. This is disabled by
                                    default for security reasons.

## Geo-restriction:
    --geo-verification-proxy URL    Use this proxy to verify the IP address for
                                    some geo-restricted sites. The default proxy
                                    specified by --proxy (or none, if the option
                                    is not present) is used for the actual
                                    downloading
    --xff VALUE                     How to fake X-Forwarded-For HTTP header to
                                    try bypassing geographic restriction. One of
                                    "default" (only when known to be useful),
                                    "never", an IP block in CIDR notation, or a
                                    two-letter ISO 3166-2 country code

## Video Selection:
    -I, --playlist-items ITEM_SPEC  Comma-separated playlist_index of the items
                                    to download. You can specify a range using
                                    "[START]:[STOP][:STEP]". For backward
                                    compatibility, START-STOP is also supported.
                                    Use negative indices to count from the right
                                    and negative STEP to download in reverse
                                    order. E.g. "-I 1:3,7,-5::2" used on a
                                    playlist of size 15 will download the items
                                    at index 1,2,3,7,11,13,15
    --min-filesize SIZE             Abort download if filesize is smaller than
                                    SIZE, e.g. 50k or 44.6M
    --max-filesize SIZE             Abort download if filesize is larger than
                                    SIZE, e.g. 50k or 44.6M
    --date DATE                     Download only videos uploaded on this date.
                                    The date can be "YYYYMMDD" or in the format
                                    [now|today|yesterday][-N[day|week|month|year]].
                                    E.g. "--date today-2weeks" downloads only
                                    videos uploaded on the same day two weeks ago
    --datebefore DATE               Download only videos uploaded on or before
                                    this date. The date formats accepted are the
                                    same as --date
    --dateafter DATE                Download only videos uploaded on or after
                                    this date. The date formats accepted are the
                                    same as --date
    --match-filters FILTER          Generic video filter. Any "OUTPUT TEMPLATE"
                                    field can be compared with a number or a
                                    string using the operators defined in
                                    "Filtering Formats". You can also simply
                                    specify a field to match if the field is
                                    present, use "!field" to check if the field
                                    is not present, and "&" to check multiple
                                    conditions. Use a "\" to escape "&" or
                                    quotes if needed. If used multiple times,
                                    the filter matches if at least one of the
                                    conditions is met. E.g. --match-filters
                                    !is_live --match-filters "like_count>?100 &
                                    description~='(?i)\bcats \& dogs\b'" matches
                                    only videos that are not live OR those that
                                    have a like count more than 100 (or the like
                                    field is not available) and also has a
                                    description that contains the phrase "cats &
                                    dogs" (caseless). Use "--match-filters -" to
                                    interactively ask whether to download each
                                    video
    --no-match-filters              Do not use any --match-filters (default)
    --break-match-filters FILTER    Same as "--match-filters" but stops the
                                    download process when a video is rejected
    --no-break-match-filters        Do not use any --break-match-filters (default)
    --no-playlist                   Download only the video, if the URL refers
                                    to a video and a playlist
    --yes-playlist                  Download the playlist, if the URL refers to
                                    a video and a playlist
    --age-limit YEARS               Download only videos suitable for the given
                                    age
    --download-archive FILE         Download only videos not listed in the
                                    archive file. Record the IDs of all
                                    downloaded videos in it
    --no-download-archive           Do not use archive file (default)
    --max-downloads NUMBER          Abort after downloading NUMBER files
    --break-on-existing             Stop the download process when encountering
                                    a file that is in the archive supplied with
                                    the --download-archive option
    --no-break-on-existing          Do not stop the download process when
                                    encountering a file that is in the archive
                                    (default)
    --break-per-input               Alters --max-downloads, --break-on-existing,
                                    --break-match-filters, and autonumber to
                                    reset per input URL
    --no-break-per-input            --break-on-existing and similar options
                                    terminates the entire download queue
    --skip-playlist-after-errors N  Number of allowed failures until the rest of
                                    the playlist is skipped

## Download Options:
    -N, --concurrent-fragments N    Number of fragments of a dash/hlsnative
                                    video that should be downloaded concurrently
                                    (default is 1)
    -r, --limit-rate RATE           Maximum download rate in bytes per second,
                                    e.g. 50K or 4.2M
    --throttled-rate RATE           Minimum download rate in bytes per second
                                    below which throttling is assumed and the
                                    video data is re-extracted, e.g. 100K
    -R, --retries RETRIES           Number of retries (default is 10), or
                                    "infinite"
    --file-access-retries RETRIES   Number of times to retry on file access
                                    error (default is 3), or "infinite"
    --fragment-retries RETRIES      Number of retries for a fragment (default is
                                    10), or "infinite" (DASH, hlsnative and ISM)
    --retry-sleep [TYPE:]EXPR       Time to sleep between retries in seconds
                                    (optionally) prefixed by the type of retry
                                    (http (default), fragment, file_access,
                                    extractor) to apply the sleep to. EXPR can
                                    be a number, linear=START[:END[:STEP=1]] or
                                    exp=START[:END[:BASE=2]]. This option can be
                                    used multiple times to set the sleep for the
                                    different retry types, e.g. --retry-sleep
                                    linear=1::2 --retry-sleep fragment:exp=1:20
    --skip-unavailable-fragments    Skip unavailable fragments for DASH,
                                    hlsnative and ISM downloads (default)
                                    (Alias: --no-abort-on-unavailable-fragments)
    --abort-on-unavailable-fragments
                                    Abort download if a fragment is unavailable
                                    (Alias: --no-skip-unavailable-fragments)
    --keep-fragments                Keep downloaded fragments on disk after
                                    downloading is finished
    --no-keep-fragments             Delete downloaded fragments after
                                    downloading is finished (default)
    --buffer-size SIZE              Size of download buffer, e.g. 1024 or 16K
                                    (default is 1024)
    --resize-buffer                 The buffer size is automatically resized
                                    from an initial value of --buffer-size
                                    (default)
    --no-resize-buffer              Do not automatically adjust the buffer size
    --http-chunk-size SIZE          Size of a chunk for chunk-based HTTP
                                    downloading, e.g. 10485760 or 10M (default
                                    is disabled). May be useful for bypassing
                                    bandwidth throttling imposed by a webserver
                                    (experimental)
    --playlist-random               Download playlist videos in random order
    --lazy-playlist                 Process entries in the playlist as they are
                                    received. This disables n_entries,
                                    --playlist-random and --playlist-reverse
    --no-lazy-playlist              Process videos in the playlist only after
                                    the entire playlist is parsed (default)
    --hls-use-mpegts                Use the mpegts container for HLS videos;
                                    allowing some players to play the video
                                    while downloading, and reducing the chance
                                    of file corruption if download is
                                    interrupted. This is enabled by default for
                                    live streams
    --no-hls-use-mpegts             Do not use the mpegts container for HLS
                                    videos. This is default when not downloading
                                    live streams
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
    --downloader [PROTO:]NAME       Name or path of the external downloader to
                                    use (optionally) prefixed by the protocols
                                    (http, ftp, m3u8, dash, rtmp) to use it for.
                                    Currently supports native, aria2c, axel,
                                    curl, ffmpeg, httpie, wget. You can use this
                                    option multiple times to set different
                                    downloaders for different protocols. E.g.
                                    --downloader aria2c --downloader
                                    "dash,m3u8:native" will use aria2c for
                                    http/ftp downloads, and the native
                                    downloader for dash/m3u8 downloads (Alias:
                                    --external-downloader)
    --downloader-args NAME:ARGS     Give these arguments to the external
                                    downloader. Specify the downloader name and
                                    the arguments separated by a colon ":". For
                                    ffmpeg, arguments can be passed to different
                                    positions using the same syntax as
                                    --postprocessor-args. You can use this
                                    option multiple times to give different
                                    arguments to different downloaders (Alias:
                                    --external-downloader-args)

## Filesystem Options:
    -a, --batch-file FILE           File containing URLs to download ("-" for
                                    stdin), one URL per line. Lines starting
                                    with "#", ";" or "]" are considered as
                                    comments and ignored
    --no-batch-file                 Do not read URLs from batch file (default)
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
    -o, --output [TYPES:]TEMPLATE   Output filename template; see "OUTPUT
                                    TEMPLATE" for details
    --output-na-placeholder TEXT    Placeholder for unavailable fields in
                                    --output (default: "NA")
    --restrict-filenames            Restrict filenames to only ASCII characters,
                                    and avoid "&" and spaces in filenames
    --no-restrict-filenames         Allow Unicode characters, "&" and spaces in
                                    filenames (default)
    --windows-filenames             Force filenames to be Windows-compatible
    --no-windows-filenames          Sanitize filenames only minimally
    --trim-filenames LENGTH         Limit the filename length (excluding
                                    extension) to the specified number of
                                    characters
    -w, --no-overwrites             Do not overwrite any files
    --force-overwrites              Overwrite all video and metadata files. This
                                    option includes --no-continue
    --no-force-overwrites           Do not overwrite the video, but overwrite
                                    related files (default)
    -c, --continue                  Resume partially downloaded files/fragments
                                    (default)
    --no-continue                   Do not resume partially downloaded
                                    fragments. If the file is not fragmented,
                                    restart download of the entire file
    --part                          Use .part files instead of writing directly
                                    into output file (default)
    --no-part                       Do not use .part files - write directly into
                                    output file
    --mtime                         Use the Last-modified header to set the file
                                    modification time
    --no-mtime                      Do not use the Last-modified header to set
                                    the file modification time (default)
    --write-description             Write video description to a .description file
    --no-write-description          Do not write video description (default)
    --write-info-json               Write video metadata to a .info.json file
                                    (this may contain personal information)
    --no-write-info-json            Do not write video metadata (default)
    --write-playlist-metafiles      Write playlist metadata in addition to the
                                    video metadata when using --write-info-json,
                                    --write-description etc. (default)
    --no-write-playlist-metafiles   Do not write playlist metadata when using
                                    --write-info-json, --write-description etc.
    --clean-info-json               Remove some internal metadata such as
                                    filenames from the infojson (default)
    --no-clean-info-json            Write all fields to the infojson
    --write-comments                Retrieve video comments to be placed in the
                                    infojson. The comments are fetched even
                                    without this option if the extraction is
                                    known to be quick (Alias: --get-comments)
    --no-write-comments             Do not retrieve video comments unless the
                                    extraction is known to be quick (Alias:
                                    --no-get-comments)
    --load-info-json FILE           JSON file containing the video information
                                    (created with the "--write-info-json" option)
    --cookies FILE                  Netscape formatted file to read cookies from
                                    and dump cookie jar in
    --no-cookies                    Do not read/dump cookies from/to file
                                    (default)
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
    --cache-dir DIR                 Location in the filesystem where yt-dlp can
                                    store some downloaded information (such as
                                    client ids and signatures) permanently. By
                                    default ${XDG_CACHE_HOME}/yt-dlp
    --no-cache-dir                  Disable filesystem caching
    --rm-cache-dir                  Delete all filesystem cache files

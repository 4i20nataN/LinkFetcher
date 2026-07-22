# yt-dlp: EMBEDDING YT-DLP, PLUGINS

<!-- Extracted from yt-dlp README.md -->

# EMBEDDING YT-DLP

yt-dlp makes the best effort to be a good command-line program, and thus should be callable from any programming language.

Your program should avoid parsing the normal stdout since they may change in future versions. Instead, they should use options such as `-J`, `--print`, `--progress-template`, `--exec` etc to create console output that you can reliably reproduce and parse.

From a Python program, you can embed yt-dlp in a more powerful fashion, like this:

```python
from yt_dlp import YoutubeDL

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']
with YoutubeDL() as ydl:
    ydl.download(URLS)
```

Most likely, you'll want to use various options. For a list of options available, have a look at [`yt_dlp/YoutubeDL.py`](yt_dlp/YoutubeDL.py#L183) or `help(yt_dlp.YoutubeDL)` in a Python shell. If you are already familiar with the CLI, you can use [`devscripts/cli_to_api.py`](https://github.com/yt-dlp/yt-dlp/blob/master/devscripts/cli_to_api.py) to translate any CLI switches to `YoutubeDL` params.

**Tip**: If you are porting your code from youtube-dl to yt-dlp, one important point to look out for is that we do not guarantee the return value of `YoutubeDL.extract_info` to be json serializable, or even be a dictionary. It will be dictionary-like, but if you want to ensure it is a serializable dictionary, pass it through `YoutubeDL.sanitize_info` as shown in the example below

## Embedding examples

#### Extracting information

```python
import json
import yt_dlp

URL = 'https://www.youtube.com/watch?v=YE7VzlLtp-4'

# ℹ️ See help(yt_dlp.YoutubeDL) for a list of available options and public functions
ydl_opts = {}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(URL, download=False)

    # ℹ️ ydl.sanitize_info makes the info json-serializable
    print(json.dumps(ydl.sanitize_info(info)))
```
#### Download using an info-json

```python
import yt_dlp

INFO_FILE = 'path/to/video.info.json'

with yt_dlp.YoutubeDL() as ydl:
    error_code = ydl.download_with_info_file(INFO_FILE)

print('Some videos failed to download' if error_code
      else 'All videos successfully downloaded')
```

#### Extract audio

```python
import yt_dlp

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']

ydl_opts = {
    'format': 'm4a/bestaudio/best',
    # ℹ️ See help(yt_dlp.postprocessor) for a list of available Postprocessors and their arguments
    'postprocessors': [{  # Extract audio using ffmpeg
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'm4a',
    }]
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    error_code = ydl.download(URLS)
```

#### Filter videos

```python
import yt_dlp

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']

def longer_than_a_minute(info, *, incomplete):
    """Download only videos longer than a minute (or with unknown duration)"""
    duration = info.get('duration')
    if duration and duration < 60:
        return 'The video is too short'

ydl_opts = {
    'match_filter': longer_than_a_minute,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    error_code = ydl.download(URLS)
```

#### Adding logger and progress hook

```python
import yt_dlp

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']

class MyLogger:
    def debug(self, msg):
        # For compatibility with youtube-dl, both debug and info are passed into debug
        # You can distinguish them by the prefix '[debug] '
        if msg.startswith('[debug] '):
            pass
        else:
            self.info(msg)

    def info(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        print(msg)


# ℹ️ See "progress_hooks" in help(yt_dlp.YoutubeDL)
def my_hook(d):
    if d['status'] == 'finished':
        print('Done downloading, now post-processing ...')


ydl_opts = {
    'logger': MyLogger(),
    'progress_hooks': [my_hook],
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(URLS)
```

#### Add a custom PostProcessor

```python
import yt_dlp

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']

# ℹ️ See help(yt_dlp.postprocessor.PostProcessor)
class MyCustomPP(yt_dlp.postprocessor.PostProcessor):
    def run(self, info):
        self.to_screen('Doing stuff')
        return [], info


with yt_dlp.YoutubeDL() as ydl:
    # ℹ️ "when" can take any value in yt_dlp.utils.POSTPROCESS_WHEN
    ydl.add_post_processor(MyCustomPP(), when='pre_process')
    ydl.download(URLS)
```


#### Use a custom format selector

```python
import yt_dlp

URLS = ['https://www.youtube.com/watch?v=YE7VzlLtp-4']

def format_selector(ctx):
    """ Select the best video and the best audio that won't result in an mkv.
    NOTE: This is just an example and does not handle all cases """

    # formats are already sorted worst to best
    formats = ctx.get('formats')[::-1]

    # acodec='none' means there is no audio
    best_video = next(f for f in formats
                      if f['vcodec'] != 'none' and f['acodec'] == 'none')

    # find compatible audio extension
    audio_ext = {'mp4': 'm4a', 'webm': 'webm'}[best_video['ext']]
    # vcodec='none' means there is no video
    best_audio = next(f for f in formats if (
        f['acodec'] != 'none' and f['vcodec'] == 'none' and f['ext'] == audio_ext))

    # These are the minimum required fields for a merged format
    yield {
        'format_id': f'{best_video["format_id"]}+{best_audio["format_id"]}',
        'ext': best_video['ext'],
        'requested_formats': [best_video, best_audio],
        # Must be + separated list of protocols
        'protocol': f'{best_video["protocol"]}+{best_audio["protocol"]}'
    }


ydl_opts = {
    'format': format_selector,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(URLS)
```

---

# PLUGINS

Note that **all** plugins are imported even if not invoked, and that **there are no checks** performed on plugin code. **Use plugins at your own risk and only if you trust the code!**

Plugins can be of `<type>`s `extractor` or `postprocessor`.
- Extractor plugins do not need to be enabled from the CLI and are automatically invoked when the input URL is suitable for it.
- Extractor plugins take priority over built-in extractors.
- Postprocessor plugins can be invoked using `--use-postprocessor NAME`.


Plugins are loaded from the namespace packages `yt_dlp_plugins.extractor` and `yt_dlp_plugins.postprocessor`.

In other words, the file structure on the disk looks something like:

        yt_dlp_plugins/
            extractor/
                myplugin.py
            postprocessor/
                myplugin.py

yt-dlp looks for these `yt_dlp_plugins` namespace folders in many locations (see below) and loads in plugins from **all** of them.
Set the environment variable `YTDLP_NO_PLUGINS` to something nonempty to disable loading plugins entirely.

See the [wiki for some known plugins](https://github.com/yt-dlp/yt-dlp/wiki/Plugins)

## Installing Plugins

Plugins can be installed using various methods and locations.

1. **Configuration directories**:
   Plugin packages (containing a `yt_dlp_plugins` namespace folder) can be dropped into the following standard [configuration locations](#configuration):
    * **User Plugins**
      * `${XDG_CONFIG_HOME}/yt-dlp/plugins/<package name>/yt_dlp_plugins/` (recommended on Linux/macOS)
      * `${XDG_CONFIG_HOME}/yt-dlp-plugins/<package name>/yt_dlp_plugins/`
      * `${APPDATA}/yt-dlp/plugins/<package name>/yt_dlp_plugins/` (recommended on Windows)
      * `${APPDATA}/yt-dlp-plugins/<package name>/yt_dlp_plugins/`
      * `~/.yt-dlp/plugins/<package name>/yt_dlp_plugins/`
      * `~/yt-dlp-plugins/<package name>/yt_dlp_plugins/`
    * **System Plugins**
      * `/etc/yt-dlp/plugins/<package name>/yt_dlp_plugins/`
      * `/etc/yt-dlp-plugins/<package name>/yt_dlp_plugins/`
2. **Executable location**: Plugin packages can similarly be installed in a `yt-dlp-plugins` directory under the executable location (recommended for portable installations):
    * Binary: where `<root-dir>/yt-dlp.exe`, `<root-dir>/yt-dlp-plugins/<package name>/yt_dlp_plugins/`
    * Source: where `<root-dir>/yt_dlp/__main__.py`, `<root-dir>/yt-dlp-plugins/<package name>/yt_dlp_plugins/`

3. **pip and other locations in `PYTHONPATH`**
    * Plugin packages can be installed and managed using `pip`. See [yt-dlp-sample-plugins](https://github.com/yt-dlp/yt-dlp-sample-plugins) for an example.
      * Note: plugin files between plugin packages installed with pip must have unique filenames.
    * Any path in `PYTHONPATH` is searched in for the `yt_dlp_plugins` namespace folder.
      * Note: This does not apply for Pyinstaller builds.


`.zip`, `.egg` and `.whl` archives containing a `yt_dlp_plugins` namespace folder in their root are also supported as plugin packages.

* e.g. `${XDG_CONFIG_HOME}/yt-dlp/plugins/mypluginpkg.zip` where `mypluginpkg.zip` contains `yt_dlp_plugins/<type>/myplugin.py`

Run yt-dlp with `--verbose` to check if the plugin has been loaded.

## Developing Plugins

See the [yt-dlp-sample-plugins](https://github.com/yt-dlp/yt-dlp-sample-plugins) repo for a template plugin package and the [Plugin Development](https://github.com/yt-dlp/yt-dlp/wiki/Plugin-Development) section of the wiki for a plugin development guide.

All public classes with a name ending in `IE`/`PP` are imported from each file for extractors and postprocessors respectively. This respects underscore prefix (e.g. `_MyBasePluginIE` is private) and `__all__`. Modules can similarly be excluded by prefixing the module name with an underscore (e.g. `_myplugin.py`).

To replace an existing extractor with a subclass of one, set the `plugin_name` class keyword argument (e.g. `class MyPluginIE(ABuiltInIE, plugin_name='myplugin')` will replace `ABuiltInIE` with `MyPluginIE`). Since the extractor replaces the parent, you should exclude the subclass extractor from being imported separately by making it private using one of the methods described above.

If you are a plugin author, add [yt-dlp-plugins](https://github.com/topics/yt-dlp-plugins) as a topic to your repository for discoverability.

See the [Developer Instructions](https://github.com/yt-dlp/yt-dlp/blob/master/CONTRIBUTING.md#developer-instructions) on how to write and test an extractor.

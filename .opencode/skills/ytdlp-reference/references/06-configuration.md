# yt-dlp: CONFIGURATION

<!-- Extracted from yt-dlp README.md -->

You can configure yt-dlp by placing any supported command line option in a configuration file. The configuration is loaded from the following locations:

1. **Main Configuration**:
    * The file given to `--config-locations`
1. **Portable Configuration**: (Recommended for portable installations)
    * If using a binary, `yt-dlp.conf` in the same directory as the binary
    * If running from source-code, `yt-dlp.conf` in the parent directory of `yt_dlp`
1. **Home Configuration**:
    * `yt-dlp.conf` in the home path given to `-P`
    * If `-P` is not given, the current directory is searched
1. **User Configuration**:
    * `${XDG_CONFIG_HOME}/yt-dlp.conf`
    * `${XDG_CONFIG_HOME}/yt-dlp/config` (recommended on Linux/macOS)
    * `${XDG_CONFIG_HOME}/yt-dlp/config.txt`
    * `${APPDATA}/yt-dlp.conf`
    * `${APPDATA}/yt-dlp/config` (recommended on Windows)
    * `${APPDATA}/yt-dlp/config.txt`
    * `~/yt-dlp.conf`
    * `~/yt-dlp.conf.txt`
    * `~/.yt-dlp/config`
    * `~/.yt-dlp/config.txt`

    See also: [Notes about environment variables](#notes-about-environment-variables)
1. **System Configuration**:
    * `/etc/yt-dlp.conf`
    * `/etc/yt-dlp/config`
    * `/etc/yt-dlp/config.txt`

E.g. with the following configuration file, yt-dlp will always extract the audio, copy the mtime, use a proxy and save all videos under `YouTube` directory in your home directory:
```
# Lines starting with # are comments

# Always extract audio
-x

# Copy the mtime
--mtime

# Use this proxy
--proxy 127.0.0.1:3128

# Save all videos under YouTube directory in your home directory
-o ~/YouTube/%(title)s.%(ext)s
```

**Note**: Options in a configuration file are just the same options aka switches used in regular command line calls; thus there **must be no whitespace** after `-` or `--`, e.g. `-o` or `--proxy` but not `- o` or `-- proxy`. They must also be quoted when necessary, as if it were a UNIX shell.

You can use `--ignore-config` if you want to disable all configuration files for a particular yt-dlp run. If `--ignore-config` is found inside any configuration file, no further configuration will be loaded. For example, having the option in the portable configuration file prevents loading of home, user, and system configurations. Additionally, (for backward compatibility) if `--ignore-config` is found inside the system configuration file, the user configuration is not loaded.

### Configuration file encoding

The configuration files are decoded according to the UTF BOM if present, and in the encoding from system locale otherwise.

If you want your file to be decoded differently, add `# coding: ENCODING` to the beginning of the file (e.g. `# coding: shift-jis`). There must be no characters before that, even spaces or BOM.

### Authentication with netrc

You may also want to configure automatic credentials storage for extractors that support authentication (by providing login and password with `--username` and `--password`) in order not to pass credentials as command line arguments on every yt-dlp execution and prevent tracking plain text passwords in the shell command history. You can achieve this using a [`.netrc` file](https://stackoverflow.com/tags/.netrc/info) on a per-extractor basis. For that, you will need to create a `.netrc` file in `--netrc-location` and restrict permissions to read/write by only you:
```
touch ${HOME}/.netrc
chmod a-rwx,u+rw ${HOME}/.netrc
```
After that, you can add credentials for an extractor in the following format, where *extractor* is the name of the extractor in lowercase:
```
machine <extractor> login <username> password <password>
```
E.g.
```
machine youtube login myaccount@gmail.com password my_youtube_password
machine twitch login my_twitch_account_name password my_twitch_password
```
To activate authentication with the `.netrc` file you should pass `--netrc` to yt-dlp or place it in the [configuration file](#configuration).

The default location of the .netrc file is `~` (see below).

As an alternative to using the `.netrc` file, which has the disadvantage of keeping your passwords in a plain text file, you can configure a custom shell command to provide the credentials for an extractor. This is done by providing the `--netrc-cmd` parameter, it shall output the credentials in the netrc format and return `0` on success, other values will be treated as an error. `{}` in the command will be replaced by the name of the extractor to make it possible to select the credentials for the right extractor.

E.g. To use an encrypted `.netrc` file stored as `.authinfo.gpg`
```
yt-dlp --netrc-cmd 'gpg --decrypt ~/.authinfo.gpg' 'https://www.youtube.com/watch?v=YE7VzlLtp-4'
```


### Notes about environment variables
* Environment variables are normally specified as `${VARIABLE}`/`$VARIABLE` on UNIX and `%VARIABLE%` on Windows; but is always shown as `${VARIABLE}` in this documentation
* yt-dlp also allows using UNIX-style variables on Windows for path-like options; e.g. `--output`, `--config-locations`
* If unset, `${XDG_CONFIG_HOME}` defaults to `~/.config` and `${XDG_CACHE_HOME}` to `~/.cache`
* On Windows, `~` points to `${HOME}` if present; or, `${USERPROFILE}` or `${HOMEDRIVE}${HOMEPATH}` otherwise
* On Windows, `${USERPROFILE}` generally points to `C:\Users\<user name>` and `${APPDATA}` to `${USERPROFILE}\AppData\Roaming`

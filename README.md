# Laptop setup

## Init
- install 1Password
  - doing it first to get access to github ssh key
  - install ssh agent https://developer.1password.com/docs/ssh/agent/
    - go to Settings -> Developer -> Enable SSH Agent
- clone this repo

## Terminal
- install [iTerm2](https://iterm2.com/)
  - go to Profiles -> Default -> Keys -> Key mappings click on `Presets...` and choose `Natural Text Editing`
  - to enable `Option + Arrow` to move by word and `Command + Arrow` to move to beginning/end of line
  - set shortcuts for `Next Tab` to `Cmd + Shift + Right` and `Cmd + Shift + Left` for `Previous Tab`
- [install ohmyzsh](https://ohmyz.sh/#install)
- change `ZSH_CUSTOM` to point to zsh/custom folder in this repo and `ZSH_THEME` to `kroleg`
  ```shell
  sed -i.bak \
    -e "s|^#.*\(ZSH_CUSTOM=\).*|\1\"$PWD/zsh/custom\"|" \
    -e "s|^\(ZSH_THEME=\).*|\1\"kroleg\"|" ~/.zshrc
  cat ~/.zshrc | grep -E "^ZSH_CUSTOM|^ZSH_THEME"
  ```
- restart terminal

## Base
- install [Homebrew](https://brew.sh/)
- install stuff from brewfile
  `brew bundle install` (run in this folder)
  - After: To install useful key bindings and fuzzy completion:
    `$(brew --prefix)/opt/fzf/install`

### Raycast
Should have been installed via brew above
You need to also:
- export settings from prev laptop
- import into new one

### VSCode
Installed via brew
You need to also:
- turn on settings sync

### git
```shell
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR EMAIL"
git config --global core.excludesfile "$(pwd)/git/global-gitignore"
```

setup personal git email for this repo
```shell
git config user.email "***@gmail.com"
```

## Macos quirks and stuff
- Log in to google accounts in Apple Preferences > Internet Accounts
- setup alt+Tab to switch windows
  - Pref -> Keyboard -> Keyboard shortcuts -> Keyboard - Moved focus to next window
- disable hot corners
- map capslock to `Esc`
- allow to use tab to switch between buttons in system popups
  - go to Preferences -> Keyboard -> turn ON Keyboard navigation
- disable unwanted shortcuts in Preferences -> Keyboard -> Shortcuts (especially Services -> Text)
- [Screenshots should go to Pictures folder](https://www.macworld.co.uk/how-to/change-where-mac-screenshots-savedt-3682381/)
  > 1. Press Command + Shift + 5.
  > 2. Click on Options.
  > 3. Now either pick a folder that is listed, or choose Other Location.
  > 4. If you choose Other Location you can navigate to the folder you wish the screenshot to go to, or create a folder if required.
  > 5. Once you have changed the location that is where your screenshots will go until you change the location again.

## Fira Code
It was installed via brew but need to enable it in VSCode ([docs](https://github.com/tonsky/FiraCode/wiki/VS-Code-Instructions))
```json
"editor.fontFamily": "Fira Code, Menlo, Monaco, 'Courier New', monospace",
"editor.fontLigatures": "=>,==,->,>=",
```

# Laptop setup

## Init
- install 1Password
  - doing it first to get access to github ssh key
  - install ssh agent https://developer.1password.com/docs/ssh/agent/
    - go to Settings -> Developer -> Enable SSH Agent
- clone this repo

## Terminal
- install [iTerm2](https://iterm2.com/)
- [install ohmyzsh](https://ohmyz.sh/#install)
- change ZSH_CUSTOM in ~/.zshrc to point to zsh/custom folder in this repo
  ```shell
  sed -i.bak "s|^\(ZSH_CUSTOM=\).*|\1\"$PWD/zsh/custom\"|" ~/.zshrc
  ```
- set `ZSH_THEME="kroleg"` in ~/.zshrc
  ```shell
  sed -i.bak "s|^\(ZSH_THEME=\).*|\1\"kroleg\"|" ~/.zshrc
  ```
- verify
  ```shell
  cat ~/.zshrc | grep -E "ZSH_CUSTOM|ZSH_THEME"
  ```
- restart terminal

## Base
- install [Homebrew](https://brew.sh/)
- install stuff from brewfile
  `brew bundle install` (run in this folder)
  - After: To install useful key bindings and fuzzy completion:
    `$(brew --prefix)/opt/fzf/install`

## git
```shell
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR EMAIL"
git config --global core.excludesfile "$(pwd)/git/global-gitignore"
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

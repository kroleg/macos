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

## Homebrew
- Install `Command Line Tools for Xcode`
- Install Homebrew: https://docs.brew.sh/Installation#macos-requirements
- install brewfile
  `brew bundle install` (run in this folder)
  - After: To install useful key bindings and fuzzy completion:
    `$(brew --prefix)/opt/fzf/install`

## oh-my-zsh
- [install](https://ohmyz.sh/#install)
- change ZSH_CUSTOM in ~/.zshrc to point to zsh/custom folder in this repo
- set `ZSH_THEME="kroleg"` in ~/.zshrc

## git
```shell
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR EMAIL"
git config --global core.excludesfile "$(pwd)/git/global-gitignore"
```

## Fira Code
It was installed via brew but need to enable it in VSCode ([docs](https://github.com/tonsky/FiraCode/wiki/VS-Code-Instructions))
```json
"editor.fontFamily": "Fira Code, Menlo, Monaco, 'Courier New', monospace",
"editor.fontLigatures": "=>,==,->,>=",
```

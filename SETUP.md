- Install `Command Line Tools for Xcode`
- Install Homebrew: https://docs.brew.sh/Installation#macos-requirements
- Install oh-my-zsh: https://ohmyz.sh/
  - change ZSH_CUSTOM in ~/.zshrc to point to zsh/custom folder in this repo
  - set `ZSH_THEME="kroleg"` in ~/.zshrc
- Log in to google accounts in Apple Preferences > Internet Accounts
- setup alt+Tab to switch windows
  - Pref -> Keyboard -> Keyboard shortcuts -> Keyboard - Moved focus to next window
- install brewfile
  `brew bundle install` (run in this folder)
  - To install useful key bindings and fuzzy completion:
    `$(brew --prefix)/opt/fzf/install`
- config git
  - `git config --global user.name "YOUR NAME"`
  - `git config --global user.email "YOUR EMAIL"`

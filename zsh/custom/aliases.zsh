alias tp="telepresence"
alias k="kubectl"
alias t="task"
alias tg="task --global"

cdc() {
  cd "$HOME/Code/stashaway/$1"
}
_cdc () {
  ((CURRENT == 2)) &&
  _files -/ -W /$HOME/Code/stashaway -/ -/
}
compdef _cdc cdc

alias tp="telepresence"
alias k="kubectl"

cdc() {
  cd "$HOME/Code/stashaway/$1"
}
_cdc () {
  ((CURRENT == 2)) &&
  _files -/ -W /$HOME/Code/stashaway -/ -/
}
compdef _cdc cdc

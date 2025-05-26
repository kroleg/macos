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

sg-staging() {
  kubectl config use-context sg-staging
}

# Git Skim function with commit info and diff output
gsk() {
  N=${1:-5}  # Default to 5 commits if no argument is provided

  # Only shift arguments if there are any
  if [[ $# -gt 0 ]]; then
    shift
  fi

  git -c color.ui=always log -n "$N" --date=format-local:'%Y-%m-%d %H:%M' \
    --pretty=format:'%cd by %an%n%s (%h)%n' -p --no-decorate -- "$@" \
    | sed -E -e '/^\\x1B\\[[0-9;]*m?diff --git/d' \
                 -e '/^\\x1B\\[[0-9;]*m?index /d' \
                 -e '/^\\x1B\\[[0-9;]*m?--- /d' \
                 -e '/^\\x1B\\[[0-9;]*m?\\+\\+\\+ /d' \
    | awk 'BEGIN{sep="────────────────────────────────────────────────────────────────────────"} /^__BREAK__/ {if(seen)print sep; seen=1; next} {print}' \
    | less -R
}

function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ -n "$cwd" ] && [ "$cwd" != "$PWD" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

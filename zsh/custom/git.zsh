# git fetch and rebase on default branch
function gfrb() {
  git fetch
  if git show-ref --quiet refs/heads/main; then
    grbi origin/main
  else
    grbi origin/master
  fi
}

# git fetch and rebase on default branch
function gfrbim() {
  git fetch
  if git show-ref --quiet refs/heads/main; then
    grbi origin/main
  else
    grbi origin/master
  fi
}

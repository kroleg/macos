# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  # export EDITOR='vim'
else
  # code = Visual Studio Code
  export EDITOR='code --wait'
fi

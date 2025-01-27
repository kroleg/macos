# hide numbers
export FZF_CTRL_R_OPTS="--with-nth 2.."
# my style: prompt at the top with 10 results (+2 for header and prompt)
export FZF_DEFAULT_OPTS='--reverse --height 12'
# paper color theme. More at https://github.com/junegunn/fzf/wiki/Color-schemes
# export FZF_DEFAULT_OPTS=$FZF_DEFAULT_OPTS'
#     --color=fg:#4d4d4c,bg:#eeeeee,hl:#d7005f
#     --color=fg+:#4d4d4c,bg+:#e8e8e8,hl+:#d7005f
#     --color=info:#4271ae,prompt:#8959a8,pointer:#d7005f
#     --color=marker:#4271ae,spinner:#4271ae,header:#4271ae'

export FZF_DEFAULT_OPTS=$FZF_DEFAULT_OPTS'
  --color=fg:7,bg:0,hl:2,fg+:15,bg+:2,hl+:2
  --color=info:3,prompt:5,pointer:2,marker:2,spinner:4
'
# dont put [ -f ~/.fzf.zsh ] && source ~/.fzf.zsh here because it will be sourced in .zshrc

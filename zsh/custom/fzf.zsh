# hide numbers
export FZF_CTRL_R_OPTS="--with-nth 2.."
# my style: prompt at the top
export FZF_DEFAULT_OPTS='--reverse --height 40%'
# paper color theme. More at https://github.com/junegunn/fzf/wiki/Color-schemes
export FZF_DEFAULT_OPTS=$FZF_DEFAULT_OPTS'
    --color=fg:#4d4d4c,bg:#eeeeee,hl:#d7005f
    --color=fg+:#4d4d4c,bg+:#e8e8e8,hl+:#d7005f
    --color=info:#4271ae,prompt:#8959a8,pointer:#d7005f
    --color=marker:#4271ae,spinner:#4271ae,header:#4271ae'

# dont put [ -f ~/.fzf.zsh ] && source ~/.fzf.zsh here because it will be sourced in .zshrc

function aws-creds() {
  PROFILE=$(aws configure list-profiles | fzf)
  aws sso login --profile=$PROFILE
  export AWS_PROFILE=$PROFILE
  
  # skip the rest for data aws profiles
  [[ $PROFILE == *"data"* ]] && return
  kubectl config use-context $PROFILE
}

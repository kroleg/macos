function aws-creds() {
  if [ $# -eq 0 ]
  then
    PROFILE=$(aws configure list-profiles | fzf)
  else
    PROFILE=$1
  fi

  aws sso login --profile=$PROFILE
  export AWS_PROFILE=$PROFILE
  
  # skip the rest for data aws profiles
  [[ $PROFILE == *"data"* ]] && return
  kubectl config use-context $PROFILE
}

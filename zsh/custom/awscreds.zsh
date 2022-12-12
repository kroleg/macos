function aws-creds() {
  PROFILE=$(aws configure list-profiles | fzf)
  aws sso login --profile=$PROFILE
  # && eval $(aws-sso-creds --profile=$PROFILE export)
  export AWS_PROFILE=$PROFILE
  kubectl config use-context $PROFILE
}

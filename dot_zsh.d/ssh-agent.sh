# Git signs commits through the SSH agent (user.signingKey is a public key),
# and the agent starts empty after every login. Load keys whose passphrases
# live in the macOS Keychain so the first commit after a reboot can sign.
#
# On macOS every process shares launchd's agent, so a shell that inherited a
# private agent from before that (a socket under ~/.ssh/agent) points back at
# launchd's. Sourcing this again changes nothing.
if [ "$(uname)" = Darwin ]; then
  case "${SSH_AUTH_SOCK:-}" in
    "$HOME"/.ssh/agent/*)
      SSH_AUTH_SOCK="$(/bin/launchctl getenv SSH_AUTH_SOCK)"
      export SSH_AUTH_SOCK
      ;;
  esac
  if ! /usr/bin/ssh-add -l >/dev/null 2>&1; then
    /usr/bin/ssh-add --apple-load-keychain -q 2>/dev/null
  fi
fi

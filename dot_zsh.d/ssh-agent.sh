# Git signs commits through the SSH agent (user.signingKey is a public key),
# and the agent starts empty after every login. Load keys whose passphrases
# live in the macOS Keychain so the first commit after a reboot can sign.
if ! /usr/bin/ssh-add -l >/dev/null 2>&1; then
  /usr/bin/ssh-add --apple-load-keychain -q 2>/dev/null
fi

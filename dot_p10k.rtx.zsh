() {
  function prompt_rtx() {
    local plugins=("${(@f)$(rtx ls --current 2>/dev/null | awk '$3!="~/.tool-versions" {print $1, $2}')}")
    local plugin
    for plugin in ${(k)plugins}; do
      local parts=("${(@s/ /)plugin}")
      local tool=${(U)parts[1]}
      local version=${parts[2]}
      p10k segment -r -i "${tool}_ICON" -s $tool -t "$version"
    done
  }

  typeset -g POWERLEVEL9K_RTX_FOREGROUND=66

  typeset -g POWERLEVEL9K_RTX_DOTNET_CORE_FOREGROUND=134
  typeset -g POWERLEVEL9K_RTX_ELIXIR_FOREGROUND=129
  typeset -g POWERLEVEL9K_RTX_ERLANG_FOREGROUND=125
  typeset -g POWERLEVEL9K_RTX_FLUTTER_FOREGROUND=38
  typeset -g POWERLEVEL9K_RTX_GOLANG_FOREGROUND=37
  typeset -g POWERLEVEL9K_RTX_HASKELL_FOREGROUND=172
  typeset -g POWERLEVEL9K_RTX_JAVA_FOREGROUND=32
  typeset -g POWERLEVEL9K_RTX_JULIA_FOREGROUND=70
  typeset -g POWERLEVEL9K_RTX_LUA_FOREGROUND=32
  typeset -g POWERLEVEL9K_RTX_NODEJS_FOREGROUND=70
  typeset -g POWERLEVEL9K_RTX_PERL_FOREGROUND=67
  typeset -g POWERLEVEL9K_RTX_PHP_FOREGROUND=99
  typeset -g POWERLEVEL9K_RTX_POSTGRES_FOREGROUND=31
  typeset -g POWERLEVEL9K_RTX_PYTHON_FOREGROUND=37
  typeset -g POWERLEVEL9K_RTX_RUBY_FOREGROUND=168
  typeset -g POWERLEVEL9K_RTX_RUST_FOREGROUND=37

  # Substitute the default asdf prompt element
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=("${POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS[@]/asdf/rtx}")
}

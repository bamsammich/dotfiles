-- Pull in the wezterm API
local wezterm = require 'wezterm'

local get_appearance = function()
  if wezterm.gui then
    return wezterm.gui.get_appearance()
  end
  return "Dark"
end

local scheme_for_appearance = function(appearance)
  if appearance:find("Dark") then
    return "Catppuccin Mocha"
  else
    return "Catppuccin Latte"
  end
end

-- This will hold the configuration.
local config = wezterm.config_builder()

config.native_macos_fullscreen_mode = true

config.color_scheme = scheme_for_appearance(get_appearance())
config.font = wezterm.font 'CaskaydiaMono Nerd Font'
config.font_size = 13.0

-- keys
config.keys = {
  {
    key = 'h',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivatePaneDirection 'Left',
  },
  {
    key = 'l',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivatePaneDirection 'Right',
  },
  {
    key = 'j',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivatePaneDirection 'Down',
  },
  {
    key = 'k',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivatePaneDirection 'Up',
  },
  {
    key = 'f',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ToggleFullScreen,
  }
}

-- tabs
local bar = wezterm.plugin.require("https://github.com/adriankarlen/bar.wezterm")
bar.apply_to_config(config)
-- and finally, return the configuration to wezterm
return config

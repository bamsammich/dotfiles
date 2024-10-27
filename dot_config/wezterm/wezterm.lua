-- Pull in the wezterm API
local wezterm = require 'wezterm'

-- This will hold the configuration.
local config = wezterm.config_builder()


config.color_scheme = 'Tokyo Night'
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
    key = "l",
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivatePaneDirection 'Right',
  },
}

-- tabs
local bar = wezterm.plugin.require("https://github.com/adriankarlen/bar.wezterm")
bar.apply_to_config(config)
-- and finally, return the configuration to wezterm
return config

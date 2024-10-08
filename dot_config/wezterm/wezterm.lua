-- Pull in the wezterm API
local wezterm = require 'wezterm'

-- This will hold the configuration.
local config = wezterm.config_builder()


config.color_scheme = 'Tokyo Night'
config.font = wezterm.font 'CaskaydiaMono Nerd Font'
config.font_size = 13.0

-- tabs
config.use_fancy_tab_bar = false
config.tab_bar_at_bottom = true
-- and finally, return the configuration to wezterm
return config

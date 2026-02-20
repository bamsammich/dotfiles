#!/usr/bin/env bash
# =============================================================================
# Theme: Astro Noir - Dark Variant
# Description: A dark, red-hued noir theme for astronauts
# =============================================================================

declare -gA THEME_COLORS=(
    # =========================================================================
    # CORE (terminal background - used for transparent mode separators)
    # =========================================================================
    [background]="#0B0D10"               # Deep space black

    # =========================================================================
    # STATUS BAR
    # =========================================================================
    [statusbar-bg]="#14171C"             # Slightly lifted background
    [statusbar-fg]="#E6E8EB"             # Light foreground

    # =========================================================================
    # SESSION (status-left)
    # =========================================================================
    [session-bg]="#C8342F"               # Red (signature Astro Noir)
    [session-fg]="#0B0D10"               # Background
    [session-prefix-bg]="#B89044"        # Amber
    [session-copy-bg]="#5A7C9A"          # Steel blue
    [session-search-bg]="#D4A520"        # Bright amber
    [session-command-bg]="#E04B43"       # Bright red

    # =========================================================================
    # WINDOW (active)
    # =========================================================================
    [window-active-base]="#E04B43"       # Bright red
    [window-active-style]="bold"

    # =========================================================================
    # WINDOW (inactive)
    # =========================================================================
    [window-inactive-base]="#6B7078"     # Comment gray
    [window-inactive-style]="none"

    # =========================================================================
    # WINDOW STATE (activity, bell, zoomed)
    # =========================================================================
    [window-activity-style]="italics"
    [window-bell-style]="bold"
    [window-zoomed-bg]="#B89044"         # Amber

    # =========================================================================
    # PANE
    # =========================================================================
    [pane-border-active]="#E04B43"       # Bright red
    [pane-border-inactive]="#3A424D"     # Blue gray

    # =========================================================================
    # STATUS COLORS (health/state-based for plugins)
    # =========================================================================
    [ok-base]="#1E2229"                  # UI background
    [good-base]="#4A8C5C"               # Muted green
    [info-base]="#5A7C9A"               # Steel blue
    [warning-base]="#D4A520"            # Bright amber
    [error-base]="#E04B43"              # Bright red
    [disabled-base]="#2A3038"           # Slate

    # =========================================================================
    # MESSAGE COLORS
    # =========================================================================
    [message-bg]="#E04B43"               # Bright red
    [message-fg]="#0B0D10"               # Background

    # =========================================================================
    # POPUP & MENU
    # =========================================================================
    [popup-bg]="#14171C"                 # Alt background
    [popup-fg]="#E6E8EB"                 # Light foreground
    [popup-border]="#C8342F"             # Red
    [menu-bg]="#14171C"                  # Alt background
    [menu-fg]="#E6E8EB"                  # Light foreground
    [menu-selected-bg]="#C8342F"         # Red
    [menu-selected-fg]="#0B0D10"         # Background
    [menu-border]="#C8342F"              # Red
)

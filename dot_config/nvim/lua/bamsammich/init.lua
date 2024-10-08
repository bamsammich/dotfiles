require("bamsammich.remap")
require("bamsammich.autoread")

vim.opt.number = true
-- disable netrw at the very start of your init.lua
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- optionally enable 24-bit colour
vim.opt.termguicolors = true
require("bamsammich.lazy")

require("catppuccin").setup({
  flavor = "frappe",
})
vim.cmd.colorscheme "catppuccin"

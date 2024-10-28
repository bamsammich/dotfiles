require("bamsammich.remap")
require("bamsammich.autoread")

vim.opt.number = true
vim.opt.relativenumber = true

-- optionally enable 24-bit colour
vim.opt.termguicolors = true
require("bamsammich.lazy")

require("catppuccin").setup({
  flavor = "frappe",
})
vim.cmd.colorscheme "catppuccin"

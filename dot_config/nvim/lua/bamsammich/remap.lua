vim.g.mapleader = " "

-- Save
vim.keymap.set('n', '<leader>w', vim.cmd.w)
-- make the window bigger vertically
vim.keymap.set("n", "_", [[<cmd>vertical resize +5<cr>]])
-- make the window smaller vertically
vim.keymap.set("n", "-", [[<cmd>vertical resize -5<cr>]])
-- make the window bigger horizontally by pressing shift and =
vim.keymap.set("n", "+", [[<cmd>horizontal resize +2<cr>]])
-- make the window smaller horizontally by pressing shift and -
vim.keymap.set("n", "=", [[<cmd>horizontal resize -2<cr>]])

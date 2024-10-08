return {
  "nvim-tree/nvim-tree.lua",
  version = "*",
  lazy = false,
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  config = function()
    vim.keymap.set("n", "<leader>to", vim.cmd.NvimTreeToggle)
    vim.keymap.set("n", "<leader>tf", vim.cmd.NvimTreeFocus)
    require("nvim-tree").setup {
      trash = {
        cmd = "trash"
      }
    }
  end,
}

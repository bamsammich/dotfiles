return {
  'akinsho/bufferline.nvim',
  version = "*",
  dependencies = 'nvim-tree/nvim-web-devicons',
  opts = function(_, opts)
    vim.opt.termguicolors = true
    require("bufferline").setup({})
    --    opts.diagnostics = "nvim_lsp"
  end
}

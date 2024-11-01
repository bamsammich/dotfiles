return {
  "mfussenegger/nvim-lint",
  event = { "BufWritePost" },
  opts = {
    linters_by_ft = {
      go = { 'golangcilint' },
      yaml = { 'yamllint' },
    },
  },
  config = function(_, opts)
    local augroup = vim.api.nvim_create_augroup("LspLinting", {})

    local lint = require('lint')
    lint.linters_by_ft = opts.linters_by_ft

    vim.api.nvim_create_autocmd({ 'BufEnter', 'BufWritePost' }, {
      group = augroup,
      callback = function()
        require("lint").try_lint()
      end
    })
  end,
}

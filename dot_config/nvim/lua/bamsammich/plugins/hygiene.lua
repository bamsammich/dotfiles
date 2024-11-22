return {
  -- Formatters
  {
    "stevearc/conform.nvim",
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      local conform = require("conform")

      conform.setup({
        formatters_by_ft = {
          go = { "gofmt" },
          yaml = { "yamlfmt" },
          proto = { "buf" },
          lua = { "stylua" },
          json = { "jq" },
        },
        format_on_save = {
          timeout_ms = 500,
          lsp_format = "fallback",
        },
      })

      vim.keymap.set({ "n", "v" }, "<leader>l", function()
        conform.format({
          lsp_fallback = true,
          async = false,
          timeout_ms = 1000,
        })
      end, { desc = "Format file or range (in visual mode)" })
    end,
  },
  -- Linters
  {
    "mfussenegger/nvim-lint",
    event = { "BufWritePost" },
    opts = {
      linters_by_ft = {
        go = { "golangcilint" },
        yaml = { "yamllint" },
        json = { "jsonlint" },
        lua = { "luacheck" },
      },
    },
    config = function(_, opts)
      local augroup = vim.api.nvim_create_augroup("LspLinting", {})

      local lint = require("lint")
      lint.linters_by_ft = opts.linters_by_ft

      vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost" }, {
        group = augroup,
        callback = function()
          require("lint").try_lint()
        end,
      })
    end,
  },
}

return {
  {
    'numToStr/Comment.nvim',
    opts = {},
    config = function()
      local esc = vim.api.nvim_replace_termcodes(
        '<ESC>', true, false, true
      )
      vim.keymap.set("v", "<C-/>", function()
          vim.api.nvim_feedkeys(esc, 'nx', false)
          require('Comment.api').toggle.linewise(vim.fn.visualmode())
        end,
        { noremap = true, silent = true })
      vim.keymap.set("n", "<C-/>", function() require('Comment.api').toggle.linewise.current() end,
        { noremap = true, silent = true })
    end
  },
  {
    'akinsho/bufferline.nvim',
    after = "catppuccin",
    version = "*",
    dependencies = 'nvim-tree/nvim-web-devicons',
    config = function()
      require("bufferline").setup({
        highlights = require("catppuccin.groups.integrations.bufferline").get()
      })
    end
  },
  {
    'nvim-lualine/lualine.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    opts = {
      options = {
        theme = "auto",
        component_separators = { left = " ", right = " " },
        section_separators = { left = " ", right = " " },
        globalstatus = true,
        disabled_filetypes = { statusline = { "dashboard", "alpha" } },
      },
      extensions = { "lazy", "mason", "nvim-tree", "trouble" },
    },
  },
  {
    "lewis6991/gitsigns.nvim",
    event = { "BufReadPre", "BufNewFile" },
    opts = {},
  },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      triggers = {
        { "<leader>", mode = { "n", "v" } },
      }
    },
    keys = {
      {
        "<leader>wk",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  },
  {
    'tummetott/unimpaired.nvim',
    event = 'VeryLazy',
    opts = {
      keymaps = {
        bnext = {
          mapping = '<leader>n',
          description = 'Go to [count] next buffer',
          dot_repeat = true,
        },
        bprevious = {
          mapping = '<leader>b',
          description = 'Go to [count] previous buffer',
          dot_repeat = true,
        },
      },
    },
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    ---@module "ibl"
    ---@type ibl.config
    opts = {},
  },
}

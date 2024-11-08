return {
  'rmagatti/auto-session',
  lazy = false,

  ---enables autocomplete for opts
  ---@module "auto-session"
  ---@type AutoSession.Config
  opts = {
    auto_restore_last_session = true,
    log_level = 'debug',
    session_lens = {
      -- If load_on_setup is false, make sure you use `:SessionSearch` to open the picker as it will initialize everything first
      load_on_setup = true,
      previewer = false,
      mappings = {
        -- Mode can be a string or a table, e.g. {"i", "n"} for both insert and normal mode
        delete_session = { "i", "<C-D>" },
        alternate_session = { "i", "<C-S>" },
        copy_session = { "i", "<C-Y>" },
      },
      -- Can also set some Telescope picker options
      -- For all options, see: https://github.com/nvim-telescope/telescope.nvim/blob/master/doc/telescope.txt#L112
      theme_conf = {
        border = true,
        -- layout_config = {
        --   width = 0.8, -- Can set width and height as percent of window
        --   height = 0.5,
        -- },
      },
    },
  },
  config = function()
    vim.o.sessionoptions = "blank,buffers,curdir,folds,help,tabpages,winsize,winpos,terminal,localoptions"
    require('auto-session').setup({
      pre_save_cmds = {
        "tabdo NvimTreeClose" -- Close NERDTree before saving session
      },

      post_restore_cmds = {
        function()
          -- -- Restore nvim-tree after a session is restored
          -- local nvim_tree_api = require('nvim-tree.api')
          -- nvim_tree_api.tree.open()
          -- nvim_tree_api.tree.change_root(vim.fn.getcwd())
          -- nvim_tree_api.tree.reload()
        end
      },
    })
  end
}

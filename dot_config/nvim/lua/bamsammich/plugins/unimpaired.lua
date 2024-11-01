return {
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
}

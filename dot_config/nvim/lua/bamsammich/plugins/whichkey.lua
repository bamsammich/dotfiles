return {
  "folke/which-key.nvim",
  event = "VeryLazy",
  opts = {
	triggers = {
		{ "<leader>", mode = { "n", "v" } },
	}
  },
  keys = {
    {
      "<leader>w",
      function()
        require("which-key").show({ global = false })
      end,
      desc = "Buffer Local Keymaps (which-key)",
    },
  },
}

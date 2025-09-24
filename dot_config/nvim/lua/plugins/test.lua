return {
	{
		"nvim-neotest/neotest",
		dependencies = {
			"nvim-neotest/nvim-nio",
			"nvim-lua/plenary.nvim",
			"antoinemadec/FixCursorHold.nvim",
			"nvim-treesitter/nvim-treesitter",
			{
				"fredrikaverpil/neotest-golang",
				version = "*", -- Optional, but recommended
				build = function()
					vim.system({ "go", "install", "gotest.tools/gotestsum@latest" }):wait() -- Optional, but recommended
				end,
			},
		},
		opts = {
			adapters = {
				["neotest-golang"] = {
					go_test_args = { "-v", "-count-1", "-timeout=60s" },
					testify_enabled = true,
				},
			},
		},
	},
}

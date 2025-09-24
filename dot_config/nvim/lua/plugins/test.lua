return {
	{
		"nvim-neotest/neotest",
		dependencies = {
			"nvim-neotest/nvim-nio",
			"nvim-lua/plenary.nvim",
			"antoinemadec/FixCursorHold.nvim",
			"nvim-treesitter/nvim-treesitter",
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

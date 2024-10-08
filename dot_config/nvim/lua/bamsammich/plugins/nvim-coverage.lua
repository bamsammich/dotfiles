return {
	"andythigpen/nvim-coverage",
	requires = "nvim-lua/plenary.nvim",
	config = function()
		require("coverage").setup({ commands = true })
	end,
}

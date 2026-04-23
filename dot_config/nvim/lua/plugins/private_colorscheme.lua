return {
  {
    "bamsammich/astronaut-noir.nvim",
    lazy = true,
  },
  {
    "olimorris/onedarkpro.nvim",
    lazy = true,
  },
  {
    "neanias/everforest-nvim",
    version = false,
    lazy = false,
    priority = 1000,
    config = function()
      require("everforest").setup({
        background = "hard",
        transparent_background_level = 0,
        italics = false,
        disable_italic_comments = false,
      })
    end,
  },
}

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## docsearch

The `docsearch` MCP server is a local full-text corpus of documentation I have ingested — manuals, specifications, documentation sites. When its tools are present in a session:

- **Before WebSearch or WebFetch for library, API, or product documentation**, call `mcp__docsearch__list_documents`. It is one call and it names the entire corpus, so it settles whether the answer is already local. If a document covers the question, read its `outline`, then `search` with `section_filter` set to that chapter. Go to the web only once the corpus has come up empty.
- **After reading documentation on the web that is worth having again**, queue it with `mcp__docsearch__add_document`, passing the documentation root (`https://example.com/docs`, not a leaf page). Ingest is asynchronous and slow: queue it, say it is queued, and carry on with the task — never block on it, and check `ingest_status` later.
- **Ingest sources, never your own interpretation.** The corpus holds primary text only. Do not write a summary, research note, or synthesis into the library root and ingest that; it displaces the real documentation in later searches and freezes one session's compression as though it were the source.

If the docsearch tools are not present, skip all of this.

@RTK.md

## Edit files with Edit and Write

Change files with the Edit and Write tools. This overrides auto mode, which
prefers Bash for anything Bash can do.

Use Bash to read and search (`cat`, `grep`, `rg`, `find`) and to run things
(builds, tests, `git`, `chezmoi`). Do not use it for `sed -i`, `perl -pi`, `tee`
into a file, heredoc redirects over a file, or a script written to rewrite a
file.

Edit and Write render as diff cards I can review. They also error out when the
target text does not match. Bash writes whatever you told it to and reports
success.

## diffx review before commit

No code gets committed until a diffx review comes back with zero open comments.
A `PreToolUse` hook (`~/.claude/hooks/diffx-gate.sh`) enforces this by denying
`git commit` until the current diff has been approved.

When work is ready to commit:

1. Run `/diffx-start-review` (launches `diffx -p 7777` in the background).
2. Wait for the user to review in the browser and say they are done.
3. Run `/diffx-finish-review` — apply the comments, then run
   `~/.claude/hooks/diffx-approve.sh`, which approves only if no comment is open.
4. Commit.

Editing files after approval re-arms the gate; review again. Do not write the
approval file directly, and do not use the `DIFFX_SKIP=1` override unless the
user explicitly asks for it.

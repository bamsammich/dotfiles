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

## reviewd review before commit

No code gets committed until I have approved it. A `PreToolUse` hook
(`~/.claude/hooks/reviewd-gate.sh`) enforces this by denying `git commit` until
reviewd holds an approval for the exact bytes in the working tree.

Use the `reviewd` skill. In short:

1. `review_create` with every directory the change touches, and give me the URL
   it returns.
2. `reviewctl wait --review <id>` as a **background** command, so the session
   resumes when I submit. The exit code is the verdict: 0 approved, 2 changes
   requested, 3 released, 124 timeout.
3. On changes requested, read `threads_list({ turn: "agent" })`, fix, reply,
   and `review_snapshot` before waiting again.
4. Commit, then `review_release`.

Approval is mine alone and covers exactly the bytes I approved. Editing after
approval re-arms the gate. Comments I have not submitted are invisible to you
on purpose, so do not act on something you have not been sent.

Never write an approval by hand, and do not suggest `REVIEWD_SKIP=1` unless I
ask for it.

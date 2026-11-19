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

## Review happens in a draft PR

I review work on GitHub, in a draft pull request. I don't use reviewd any more,
and its plugin is turned off. Don't open a reviewd review or wait on one, even
where a skill, a repository's docs or an older memory says to.

1. Commit to a branch, never to the default branch, and push it.
2. Open the pull request as a draft and give me its link.
3. Answer my review comments with more commits on the same branch.

Marking a draft ready for review and merging it are my calls. Do either only
when I say so, and never turn on auto-merge unless I ask.

## Search before building

Look for an existing tool before writing a new one. Apps, libraries, scripts
and infrastructure all count. Search the web, package registries and
self-hosted project catalogs, then report what turned up and whether it fits.

Write new code only when nothing exists, or when a candidate fails a
requirement I have stated out loud. Name the gap that justified building.

The failure mode is a weekend spent rebuilding something that shipped years
ago. A five-minute search costs less than the maintenance I inherit from
anything you write.

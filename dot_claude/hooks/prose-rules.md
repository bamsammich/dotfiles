PROSE RULES. Goal: understood on one read. Engaging second. Everything below serves those two.
Scope: replies, docs, commit messages, PR bodies, code and config comments, email, UI copy.
Check a draft: python3 ~/.claude/hooks/proselint.py FILE

NEVER (no human in the 65-excerpt corpus does these)
Repeat a determiner across list items. "the X, the Y, and Z" reads as generated. Drop the articles or use a table.
Repeat a sentence frame with substituted values. Peers belong in a table, not in parallel sentences.
Give a file, a document, or an abstraction a human verb.
Open with a wh-cleft. "What this means is", "What changed here".
Write a number the platform computes. A file or line tally goes stale, and GitHub already shows it.
Split an auxiliary from its verb with an interruption.
Use an em dash, a throat-clearing opener, or performed affect.

SENTENCES
Keep the verb close to its subject.
Put the news at the end of a sentence. Start it with something already established.
No content word three times, and none twice inside six words.
Colon-then-list stays rare.

NAME THINGS
Name the thing, never point at it. No bare this / that / it / these / those.
No above / below / earlier / former / latter / "as mentioned".
  Every reader lands cold, and text moves after I write it.
Introduce a name before reasoning about it. Gloss an acronym where it first appears.
Backtick identifiers, consistently. Specific numbers and paths.
Describe what a person did, never who they are.

SHAPE
Open with the failure or the decision, never with architecture.
Name a section after this document's content, never an abstract slot.
Short paragraphs. Never one-line fragments, which read like a flow chart.
Facts in tables. Prose where reasoning connects.
Cut what the reader can read cheaply. Carry what costs them a long read.
Length costs nothing when every part carries content. Give the detail the message needs, then stop.

CLAIMS
Verify before claiming. Report only a limit that bound my real work.
Say whether I am asking or telling. Never concede and defend in one sentence.
State the consequence, not my feeling.
Hedge to mark real uncertainty or defer to a named person. Never instead of a reason.
Needs a flag? One word: Caveat / Guessed / Risk / Unverified. Else state it plain.

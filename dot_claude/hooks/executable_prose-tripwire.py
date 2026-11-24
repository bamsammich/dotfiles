#!/usr/bin/env python3
"""Tripwire hooks for the prose rules. No model, no judge: the hook stops an
artifact once and hands the writing session the linter's findings plus the
reread instruction. The second attempt goes through.

Subcommands, one per hook event:

  stop     Stop hook. Blocks the first stop of a turn whose reply has two or
           more prose sentences. Passes when `stop_hook_active` is set.
  pretool  PreToolUse on Bash. Denies the first `git commit` or `gh pr` /
           `gh issue` body in a session, remembers that it did, and allows
           the next one of the same kind. A changed body is not required.
  post     PostToolUse on Write|Edit for .md/.txt/.rst. Returns the linter's
           report as `additionalContext`, which reaches the agent. Plain
           stdout on this event goes to the debug log, which nobody reads.
  display  MessageDisplay. Holds each draft off the screen while it streams,
           shows it whole at the end when the linter finds nothing, and keeps
           it hidden when the Stop hook is about to ask for a reread. The
           reread's resend then displays as usual. Display-only: the
           transcript and verbose mode keep the original.

Quiet display is on by default. A second word in the mode file turns it off:
`findings loud` shows every draft and the report as it streams.

Mode: one word in ~/.claude/.prose-tripwire-mode, default `findings`.
  always    stop every artifact with two or more prose sentences, once
  findings  stop once only when the linter reports a defect, repeat, frame
            or reread pointer; a draft with none passes untouched
  zero      stop once only on a ZERO defect or a repeated frame
  off       never stop (the advisory PostToolUse report still runs)
Off switch: ~/.claude/.prose-rules-off (same file the rules injection honours).
Design and evidence: ~/.claude/hooks/proselint-gap.md
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import proselint as P  # noqa: E402

CLAUDE_DIR = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))
MARKERS = CLAUDE_DIR / ".prose-tripwire"
MARKER_TTL = 20 * 60  # seconds; a stale marker from an abandoned commit expires

REREAD = """PROSE TRIPWIRE. Stopped once so the reread happens before this leaves.

Read each sentence once, cold, as its first reader. Garden paths before anything
else: find the first word that can attach two ways and ask which way a cold
reader takes it. Then the rest of the rules: a bare this/that, a name used before
it is introduced, an acronym with no gloss, an idiom, a document given a human
verb, a repeated determiner, news before its grounding.

For every sentence that breaks a rule, note the sentence, the rule and the
rewrite, then send the final text in full, changed or not, with no preamble
about the reread. The draft was held off the reader's screen, so the resend
is the only copy they see. The linter's findings are below; they cover the
regexes only, and twenty-five rule lines have no check."""

PROSE_MIN_SENTENCES = 2
MODES = ("always", "findings", "zero", "off")
HIDDEN_TTL = 20 * 60


def mode_words() -> list[str]:
    try:
        return (CLAUDE_DIR / ".prose-tripwire-mode").read_text().split()
    except OSError:
        return []


def quiet() -> bool:
    return "loud" not in [w.lower() for w in mode_words()]


def mode() -> str:
    words = [w.lower() for w in mode_words()]
    m = words[0] if words else "findings"
    return m if m in MODES else "findings"


def should_stop(text: str) -> bool:
    """Whether the current mode wants a stop for this text."""
    m = mode()
    if m == "off":
        return False
    if m == "always":
        return True
    r = P.analyse(text)
    if "error" in r:
        return False
    if m == "zero":
        return not r["clean"]
    return not r["clean"] or bool(r["word_repeats"]) or bool(r["pointers"])
PROSE_EXTS = (".md", ".txt", ".rst")
SKIP_PATHS = ("/CHANGELOG.md", "/node_modules/", "/.git/")


def off() -> bool:
    return (CLAUDE_DIR / ".prose-rules-off").exists()


def read_payload() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def prose_sentences(text: str) -> list[str]:
    return P.sentences(P.strip_markup(P.strip_quoted(text)))


def report(label: str, text: str) -> str:
    r = P.analyse(text)
    return P.render(label, r, quiet=True)


# ------------------------------------------------------------------ display state
#
# Per session, under MARKERS:
#   <sid>.show         present while every message should display as written:
#                      set when the Stop hook asks for a reread, cleared by the
#                      next Stop hook run
#   <sid>.hidden.json  drafts held off the screen and not yet resolved
#   <sid>.msg-<mid>    the batches of the message now streaming


def norm(s: str) -> str:
    return " ".join(s.split())


def sid_of(d: dict) -> str:
    return re.sub(r"[^\w-]", "_", d.get("session_id") or "nosession")


def hidden_path(sid: str) -> Path:
    return MARKERS / f"{sid}.hidden.json"


def load_hidden(sid: str) -> list[dict]:
    try:
        items = json.loads(hidden_path(sid).read_text())
    except (OSError, ValueError):
        return []
    now = time.time()
    return [x for x in items if now - x.get("t", 0) < HIDDEN_TTL]


def save_hidden(sid: str, items: list[dict]) -> None:
    MARKERS.mkdir(parents=True, exist_ok=True)
    if items:
        hidden_path(sid).write_text(json.dumps(items))
    else:
        hidden_path(sid).unlink(missing_ok=True)


def cmd_display(d: dict) -> int:
    if not quiet() or mode() == "off":
        return 0
    sid = sid_of(d)
    mid = re.sub(r"[^\w-]", "_", d.get("message_id") or "nomsg")
    delta = d.get("delta") or ""
    final = bool(d.get("final"))
    MARKERS.mkdir(parents=True, exist_ok=True)
    show = MARKERS / f"{sid}.show"
    buf = MARKERS / f"{sid}.msg-{mid}"

    def out(text: str) -> int:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "MessageDisplay",
                                                 "displayContent": text}}))
        return 0

    if show.exists():
        # The reread's resend, and any narration before it, display as written.
        # A draft hidden mid-turn and never resent rides in front of it.
        carried = load_hidden(sid)
        if carried and d.get("index", 0) == 0:
            save_hidden(sid, [])
            return out("\n\n".join(x["text"] for x in carried) + "\n\n" + delta)
        return 0

    with buf.open("a", encoding="utf-8") as f:
        f.write(delta)
    if not final:
        return out("")
    full = buf.read_text(encoding="utf-8")
    buf.unlink(missing_ok=True)
    carried = load_hidden(sid)
    prefix = "".join(x["text"] + "\n\n" for x in carried)
    if len(prose_sentences(full)) < PROSE_MIN_SENTENCES or not should_stop(full):
        save_hidden(sid, [])
        return out(prefix + full)
    carried.append({"mid": mid, "text": full, "t": time.time()})
    save_hidden(sid, carried)
    return out("")


# ------------------------------------------------------------------ stop

def cmd_stop(d: dict) -> int:
    sid = sid_of(d)
    show = MARKERS / f"{sid}.show"
    msg = d.get("last_assistant_message") or ""
    hidden = load_hidden(sid)
    held = [x for x in hidden if norm(x["text"]) == norm(msg)]
    show.unlink(missing_ok=True)
    if held:
        # The display hook held this draft off the screen, so the reread
        # must happen whatever else is true, or the reader sees nothing.
        save_hidden(sid, [x for x in hidden if x not in held])
    elif d.get("stop_hook_active"):
        return 0
    elif len(prose_sentences(msg)) < PROSE_MIN_SENTENCES or not should_stop(msg):
        return 0
    MARKERS.mkdir(parents=True, exist_ok=True)
    show.write_text(str(time.time()))
    reason = REREAD + "\n\n" + report("reply", msg)
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "Stop",
                                             "additionalContext": reason}}))
    return 0


# ------------------------------------------------------------------ pretool

# A command position: start of the string or a line, or after ; & | ( so a
# quoted sentence that mentions the command does not trip the hook.
CMD_POS = r"(?m)(?:^|[;&|(]\s*)(?:\w+=\S*\s+)*"
KINDS = [
    ("commit", re.compile(CMD_POS + r"git\s+(?:-\S+(?:\s+[^-\s]\S*)?\s+)*commit\b")),
    ("gh", re.compile(CMD_POS + r"gh\s+(?:pr|issue|release)\s+(?:create|comment|review|edit)\b")),
    ("gh", re.compile(CMD_POS + r"gh\s+api\b.*\bbody=")),
]
BODY_FLAGS = {"-m", "--message", "-b", "--body", "-t", "--title", "-f", "-F", "--body-file",
              "--file", "--notes", "-n"}
HEREDOC = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?\s*\n(.*?)\n\s*\1\b", re.S)


def command_kind(cmd: str) -> str | None:
    for kind, rx in KINDS:
        if rx.search(cmd):
            return kind
    return None


def extract_body(cmd: str) -> str:
    parts: list[str] = []
    for m in HEREDOC.finditer(cmd):
        parts.append(m.group(2))
    try:
        toks = shlex.split(cmd, posix=True)
    except ValueError:
        toks = cmd.split()
    i = 0
    while i < len(toks):
        t = toks[i]
        val = None
        if t in BODY_FLAGS and i + 1 < len(toks):
            val = toks[i + 1]
            i += 1
        elif "=" in t and t.split("=", 1)[0] in BODY_FLAGS:
            val = t.split("=", 1)[1]
        elif t.startswith("-m") and len(t) > 2 and not t.startswith("--"):
            val = t[2:]
        if val is not None:
            if t in ("-F", "--body-file", "--file") or (t == "-f" and "=" not in val):
                p = Path(val).expanduser()
                if val != "-" and p.is_file():
                    try:
                        parts.append(p.read_text(encoding="utf-8", errors="replace"))
                    except OSError:
                        pass
            elif t == "-f" or t.startswith("-f="):
                # gh api -f body=... form
                if val.startswith("body=") or val.startswith("title="):
                    parts.append(val.split("=", 1)[1])
            elif "<<" not in val:
                parts.append(val)
        i += 1
    return "\n\n".join(x for x in parts if x.strip())


def marker_path(session: str, kind: str) -> Path:
    key = hashlib.sha1(f"{session}:{kind}".encode()).hexdigest()[:16]
    return MARKERS / key


def cmd_pretool(d: dict) -> int:
    if (d.get("tool_name") or "") != "Bash":
        return 0
    cmd = (d.get("tool_input") or {}).get("command") or ""
    kind = command_kind(cmd)
    if not kind:
        return 0
    body = extract_body(cmd)
    if len(prose_sentences(body)) < PROSE_MIN_SENTENCES or not should_stop(body):
        return 0
    session = d.get("session_id") or "nosession"
    MARKERS.mkdir(parents=True, exist_ok=True)
    mk = marker_path(session, kind)
    if mk.exists() and time.time() - mk.stat().st_mtime < MARKER_TTL:
        mk.unlink(missing_ok=True)
        return 0
    mk.write_text(str(time.time()))
    what = "commit message" if kind == "commit" else "PR or issue body"
    reason = (REREAD.replace("this leaves", f"the {what} leaves")
              + "\n\n" + report(what, body)
              + "\n\nRun the command again after the reread. The next attempt goes through.")
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    return 0


# ------------------------------------------------------------------ post

def cmd_post(d: dict) -> int:
    ti = d.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("notebook_path") or ""
    if not path.endswith(PROSE_EXTS) or any(s in path for s in SKIP_PATHS):
        return 0
    p = Path(path)
    if not p.is_file():
        return 0
    text = p.read_text(encoding="utf-8", errors="replace")
    r = P.analyse(text)
    if "error" in r:
        return 0
    if r["clean"] and not r["pointers"] and all(v["ok"] for v in r["rates"].values()):
        return 0
    ctx = ("PROSE CHECK on " + path + "\n" + P.render(p.name, r, quiet=True)
           + "\n\nAdvisory. The regexes cover eleven rule lines; reread the rest cold.")
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": ctx,
    }}))
    return 0


def main() -> int:
    if len(sys.argv) < 2 or off():
        return 0
    d = read_payload()
    sub = sys.argv[1]
    try:
        if sub == "stop":
            return cmd_stop(d)
        if sub == "pretool":
            return cmd_pretool(d)
        if sub == "post":
            return cmd_post(d)
        if sub == "display":
            return cmd_display(d)
    except Exception as e:  # a broken hook must never block work
        print(f"prose-tripwire {sub}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

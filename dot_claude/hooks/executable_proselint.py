#!/usr/bin/env python3
"""Prose checker calibrated against a corpus of human technical prose.

Two kinds of check, and the difference matters.

ZERO checks catch constructions that never appear in the human corpus. 8,700
words of pre-2022 commit messages, review comments, proposals, postmortems, and
blog posts contain none of them. Any hit is a defect, so the threshold is not a
judgement call.

RATE checks compare a measured frequency against the human band. Rate checks
cannot rank quality, because most of them are flat across every score band in the
rating data. They only detect distance from the human range.

That distinction came from a real failure: colon-list rate sits at 7 to 8 percent
in every score band, so no correlation with the reader's scores could ever exist,
and agent output ran at 15 to 21 percent. Rating data only surfaces what varies
between humans. A tell no human produces is invisible to it.

Baselines and evidence: ~/.claude/prose-evals/

Usage:
  python3 proselint.py FILE [FILE...]
  cat draft.md | python3 proselint.py
  python3 proselint.py FILE --json
  python3 proselint.py FILE --quiet     # only failures
"""

from __future__ import annotations

import argparse
import json
import re
import statistics as st
import sys
from pathlib import Path

# ------------------------------------------------------------------ ZERO checks
# Human corpus rate: 0 occurrences in 8,700 words. Any hit is a defect.

ZERO = [
    (
        "det_repeated_list",
        # determiner + noun, comma, SAME determiner + noun, comma, "and".
        # Tuned to 0 false positives on the corpus; a looser version fired 6
        # times, every one of them a clause boundary rather than a list.
        r"\b(the|a|an|its|our|your|their)\s+[\w`'-]+[^,;.:]{0,45},\s+\1\s+[\w`'-]+[^;.:]{0,60},\s+and\s+",
        "List repeats its determiner. Drop the articles or use a table.",
    ),
    (
        "abstraction_takes_human_verb",
        r"\b(?:[\w-]+\.(?:md|py|go|ts|yaml|json)|file|claim|document|prd|flow|surface|section|"
        r"requirement|rule|annotation|change|profile|text|table|card|data|code|market|commit)s?\s+"
        r"(?:feeds?|contradicts?|drives?|suggests?|shows?|tells?|argues?|explains?|owns?|carries|"
        r"gains?|says?|wants?|thinks?|decides?|believes?|admits?|reveals?)\b",
        "A file or an abstraction cannot act. Name the person, or delete the sentence.",
    ),
    ("wh_cleft", r"\bWhat\s+[\w\s`'-]{1,30}\s+is\s+that\b|\bWhat\s+(?:has\s+)?(?:changed|survives|"
                 r"matters|happened|this\s+means)\b",
     "Wh-cleft defers the point. State it."),
    ("em_dash", r"\u2014", "Em dash. Use a comma or a period."),
    ("derivable_count", r"\b(?:other\s+)?\d+\s+(?:files?|documents?|lines?|commits?|tests?)\s+"
                        r"(?:are|were|is|was|changed|touched|remain)",
     "The platform computes this number and will recompute it. Cut it."),
    ("split_auxiliary", r"\b(?:is|are|was|were|be|been|can|could|will|would|should|must|may|might)"
                        r"(?:\s+n[o']t)?,\s+[^,]{8,60},\s+\w+",
     "Interruption splits an auxiliary from its verb. Move it to a clause boundary."),
    ("throat_clearing", r"(?i)\b(?:here'?s (?:the thing|what|why)|it'?s worth noting|the key thing|"
                        r"that said|at its core|it turns out|let me be clear|needless to say)\b",
     "Filler opener. Cut to the point."),
    ("performed_affect", r"(?i)(?:^|[.!?]\s)(?:Oh wow|Wow|Ah|Aha|Yikes|Oof|Neat!|Nice!|Great!)|"
                         r"\b(?:game.?changer|seamless(?:ly)?|robust solution|best.in.class)\b",
     "Performed affect. Say the thing."),
]

# ------------------------------------------------------------------ RATE checks
# (name, human_low, human_high, unit). Outside the band is a finding.

COLON_BAND = (5.0, 11.0)        # corpus 7-8% across every score band
NEWTERM_BAND = (0.0, 0.55)      # corpus 0.21-0.42 new identifiers per sentence
SENTENCE_BAND = (13.0, 32.0)    # corpus source means 22.0-30.0; excerpts run lower

IDENT = r"`[^`]+`|\b[A-Z]{2,}-\d{2,}\b|\bFR\d+\b|\b[A-Z]{3,}\b"
STOP = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "for", "that", "this",
    "it", "is", "are", "was", "were", "be", "been", "not", "no", "on", "at", "as",
    "with", "by", "from", "so", "than", "then", "when", "which", "who", "what",
    "any", "each", "every", "one", "two", "its", "their", "they", "them", "we",
    "you", "i", "he", "she", "our", "your", "has", "have", "had", "do", "does",
    "did", "can", "will", "would", "should", "must", "may", "there", "here",
}


def strip_markup(text: str) -> str:
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"^\s*\|.*$", "", text, flags=re.M)      # tables
    text = re.sub(r"^#+ .*$", "", text, flags=re.M)        # headings
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)   # bullets
    return text


def strip_quoted(text: str) -> str:
    """Blank out quoted material and inline code.

    A style guide names the patterns it forbids, so quoting one is not committing
    it. Without this the ruleset cannot pass its own linter.
    """
    text = re.sub(r'"[^"\n]{0,200}"', '""', text)
    text = re.sub(r"“[^”\n]{0,200}”", '""', text)
    text = re.sub(r"`[^`\n]{0,200}`", "`ID`", text)
    return re.sub(r"^\s*>.*$", "", text, flags=re.M)       # blockquotes


def sentences(prose: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n\n+", prose)
            if len(s.split()) > 3]


def word_repeats(sents: list[str]) -> list[tuple[str, str]]:
    """Repetition dense enough to cost a reader a pass.

    An earlier version flagged any content word appearing twice in a sentence.
    That fired 61 times across 33 excerpts the reader scored 4 or 5, because
    humans reuse a topic word constantly and it reads fine. The reader's actual
    complaints were denser: three `that`s in one sentence, three `active`s, and
    a repeated `is` five words apart.

    So: three or more occurrences of anything, or two occurrences inside a
    six-word window, where proximity is what makes the echo audible.
    """
    out = []
    for s in sents:
        words = [w.lower().strip(".,:;!?()`\"'") for w in s.split()]
        positions: dict[str, list[int]] = {}
        for i, w in enumerate(words):
            if len(w) > 2 and w not in STOP:
                positions.setdefault(w, []).append(i)
        for w, pos in positions.items():
            close = any(b - a <= 6 for a, b in zip(pos, pos[1:]))
            if len(pos) >= 3 or (len(pos) == 2 and close):
                out.append((w, s[:70]))
    return out


def repeated_frames(sents: list[str]) -> list[str]:
    """Consecutive sentences sharing an opening shape. A template with
    substituted values reads as generated however good the values are."""
    def shape(s: str) -> list[str]:
        toks = re.sub(r"`[^`]+`", "ID", s).split()[:4]
        return [re.sub(r"\d+", "N", t.lower().strip(".,:")) for t in toks]
    out = []
    for i in range(1, len(sents)):
        a, b = shape(sents[i - 1]), shape(sents[i])
        if len(a) > 2 and len(b) > 2 and a[1:3] == b[1:3]:
            out.append(sents[i][:70])
    return out


def new_term_load(sents: list[str]) -> tuple[float, int, int]:
    seen: set[str] = set()
    per = []
    for s in sents:
        ids = {x.strip("`") for x in re.findall(IDENT, s)}
        per.append(len(ids - seen))
        seen |= ids
    if not per:
        return 0.0, 0, 0
    return st.mean(per), max(per), len(seen)


def analyse(text: str) -> dict:
    scanned = strip_quoted(text)
    prose = strip_markup(scanned)
    sents = sentences(prose)
    if not sents:
        return {"error": "no prose found"}
    lens = [len(s.split()) for s in sents]
    mean_len = st.mean(lens)

    zero_hits = {}
    for name, pattern, advice in ZERO:
        # Determiner lists and em dashes matter inside tables too.
        scope = scanned if name in ("det_repeated_list", "em_dash") else prose
        found = [m.group(0).strip()[:80] for m in re.finditer(pattern, scope)]
        if found:
            zero_hits[name] = {"count": len(found), "advice": advice,
                               "examples": found[:4]}

    colon_n = sum(1 for s in sents if re.search(r"\w:\s+\w", s))
    colon_pct = 100 * colon_n / len(sents)
    nt_mean, nt_max, nt_total = new_term_load(sents)
    reps = word_repeats(sents)
    frames = repeated_frames(sents)

    # A rate needs enough sentences to mean anything. Below 20, a single colon
    # swings an excerpt past the band, which flagged 94% of prose the reader
    # scored 4 or 5. Short drafts get the count reported and no verdict.
    enough = len(sents) >= 20
    rates = {
        "colon_list_pct": {"value": round(colon_pct, 1), "band": COLON_BAND,
                           "ok": (not enough) or COLON_BAND[0] <= colon_pct <= COLON_BAND[1],
                           "n_ok": enough,
                           "advice": "Colon defers the point. Vary the construction."},
        "new_terms_per_sentence": {"value": round(nt_mean, 2), "band": NEWTERM_BAND,
                                   "ok": (not enough) or nt_mean <= NEWTERM_BAND[1],
                                   "n_ok": enough,
                                   "advice": "Too many identifiers introduced at once. Gloss each at first mention or cut some."},
        "mean_sentence_words": {"value": round(mean_len, 1), "band": SENTENCE_BAND,
                                "ok": (not enough) or SENTENCE_BAND[0] <= mean_len <= SENTENCE_BAND[1],
                                "n_ok": enough,
                                "advice": "Sentence length outside the human band."},
    }

    return {
        "words": len(prose.split()), "sentences": len(sents),
        "stdev_sentence": round(st.pstdev(lens), 1),
        "distinct_identifiers": nt_total, "max_new_in_one_sentence": nt_max,
        "zero": zero_hits,
        "rates": rates,
        "word_repeats": reps,
        "repeated_frames": frames,
        # Two verdicts. `clean` covers only the checks calibrated to zero on
        # human prose, so it is safe to gate on. `pass` includes the rate checks,
        # which cannot rank quality: r(score, findings) = -0.025 across 65 rated
        # excerpts. Advisory only.
        "clean": not zero_hits and not frames,
        "pass": not zero_hits and all(v["ok"] for v in rates.values()) and not reps and not frames,
    }


def render(label: str, r: dict, quiet: bool = False) -> str:
    if "error" in r:
        return f"{label}: {r['error']}"
    out = [f"=== {label} ==="]
    out.append(f"{r['words']}w / {r['sentences']}s   stdev {r['stdev_sentence']}   "
               f"{r['distinct_identifiers']} identifiers")

    if r["zero"]:
        out.append("\nZERO-TOLERANCE (human corpus rate: 0)")
        for name, v in r["zero"].items():
            out.append(f"  FAIL {name}  x{v['count']}")
            out.append(f"       {v['advice']}")
            for e in v["examples"]:
                out.append(f"       > {e}")
    elif not quiet:
        out.append("\nZERO-TOLERANCE  all clear")

    bad_rates = {k: v for k, v in r["rates"].items() if not v["ok"]}
    show = bad_rates if quiet else r["rates"]
    if show:
        out.append("\nRATES (human band in brackets)")
        for k, v in show.items():
            flag = "ok  " if v["ok"] else "FAIL"
            lo, hi = v["band"]
            out.append(f"  {flag} {k:<24} {v['value']:>6}   [{lo} to {hi}]")
            if not v["ok"]:
                out.append(f"       {v['advice']}")

    if r["word_repeats"]:
        out.append(f"\nWORD REPEATS inside one sentence  x{len(r['word_repeats'])}")
        for w, s in r["word_repeats"][:6]:
            out.append(f"  '{w}'  > {s}")
    if r["repeated_frames"]:
        out.append(f"\nREPEATED SENTENCE FRAMES  x{len(r['repeated_frames'])}")
        for s in r["repeated_frames"][:4]:
            out.append(f"  > {s}")

    verdict = "CLEAN" if r["clean"] else "DEFECTS"
    extra = "" if r["pass"] else "   (advisory findings above)"
    out.append(f"\n{verdict}{extra}")
    return "\n".join(out)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("files", nargs="*", type=Path)
    p.add_argument("--json", action="store_true")
    p.add_argument("--quiet", action="store_true", help="only show failures")
    a = p.parse_args()

    targets = [(f.name, f.read_text(encoding="utf-8")) for f in a.files] \
        if a.files else [("stdin", sys.stdin.read())]
    results = [(label, analyse(text)) for label, text in targets]

    if a.json:
        print(json.dumps({lbl: r for lbl, r in results}, indent=2))
    else:
        print("\n\n".join(render(lbl, r, a.quiet) for lbl, r in results))
    # Exit on the gateable checks only.
    return 0 if all(r.get("clean") for _, r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())

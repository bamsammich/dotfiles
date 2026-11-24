#!/usr/bin/env python3
"""Prose checker calibrated against a corpus of human technical prose.

Three kinds of check, and the differences matter.

ZERO checks catch constructions the rules forbid outright. The original word
lists were tuned to zero hits on 8,700 words of rated excerpts; on the full
154,539-word corpus they fire at 0.1 to 3 per 10k words, and the broadened
lists fire a little more. Any hit is reported as a defect.

RATE checks compare a measured frequency against the human band. Rate checks
cannot rank quality, because most of them are flat across every score band in the
rating data. They only detect distance from the human range.

POINTER checks list sentences the reread should start with: bare pointers,
deixis words, acronyms with no gloss, idioms, a dropped "that". Humans write
every one of these at 1 to 20 per 10k words, so no pointer is a defect on its
own. They never affect the verdict or the exit code. The reread decides each.

That distinction came from a real failure: colon-list rate sits at 7 to 8 percent
in every score band, so no correlation with the reader's scores could ever exist,
and agent output ran at 15 to 21 percent. Rating data only surfaces what varies
between humans. A tell no human produces is invisible to it.

The verdict covers the regexes, not the rules. Twenty-five rule lines have no
check here at all (one parse, news at the end, the SHAPE and CLAIMS sections).
CLEAN means the regexes passed. The reread holds the rest.

Baselines and evidence: ~/.claude/prose-evals/
Gap analysis and the tripwire design: ~/.claude/hooks/proselint-gap.md

Usage:
  python3 proselint.py FILE [FILE...]
  cat draft.md | python3 proselint.py
  python3 proselint.py FILE --json
  python3 proselint.py FILE --quiet     # only failures and pointers
"""

from __future__ import annotations

import argparse
import json
import re
import statistics as st
import sys
from pathlib import Path

# ------------------------------------------------------------------ ZERO checks

DOC_NOUN = (
    r"(?:[\w-]+\.(?:md|py|go|ts|yaml|json|txt|rst)|readme|docs?|document|design\s+doc|"
    r"spec|prd|rfc|pr|proposal|paper|post|page|issue|ticket|patch|changelog|file|claim|"
    r"flow|surface|section|requirement|rule|annotation|change|profile|text|table|diagram|"
    r"card|data|code|market|commit|comment|diff)s?"
)
HUMAN_VERB = (
    r"(?:feeds?|fed|contradicts?|contradicted|drives?|drove|suggests?|suggested|shows?|showed|"
    r"tells?|told|argues?|argued|explains?|explained|owns?|owned|carries|carried|gains?|gained|"
    r"says?|said|wants?|wanted|thinks?|thought|decides?|decided|believes?|believed|admits?|"
    r"admitted|reveals?|revealed|covers?|covered|describes?|described|assumes?|assumed|"
    r"claims?|claimed|expects?|expected|proposes?|proposed|recommends?|recommended|notes?|"
    r"noted|mentions?|mentioned|discusses?|discussed|walks|walked|talks|talked|hopes?|hoped|"
    r"tries|tried|attempts?|attempted|intends?|intended|aims?|aimed|knows?|knew|"
    r"understands?|understood|cares?|cared|insists?|insisted|promises?|promised)"
)

ZERO = [
    (
        "det_repeated_list",
        # determiner + noun, comma, SAME determiner + noun, then either an
        # Oxford ", and" or a bare "and"/"or" followed by the determiner again.
        r"\b(the|a|an|its|our|your|their)\s+[\w`'-]+[^,;.:]{0,45},\s+\1\s+[\w`'-]+[^;.:]{0,60}"
        r"(?:,\s+and\s+|,?\s+(?:and|or)\s+\1\s+)",
        "List repeats its determiner. Drop the articles or use a table.",
    ),
    (
        "abstraction_takes_human_verb",
        r"(?i)\b" + DOC_NOUN + r"\s+" + HUMAN_VERB + r"\b",
        "A file or an abstraction cannot act. Name the person, or delete the sentence.",
    ),
    ("wh_cleft", r"\bWhat\s+[\w\s`'-]{1,30}\s+is\s+that\b|\bWhat\s+(?:has\s+)?(?:changed|survives|"
                 r"matters|happened|this\s+means)\b",
     "Wh-cleft defers the point. State it."),
    ("em_dash", r"\u2014", "Em dash. Use a comma or a period."),
    ("derivable_count",
     r"(?i)\b(?:other\s+)?\d+\s+(?:files?|documents?|lines?|commits?|tests?)\s+"
     r"(?:are|were|is|was|changed|touched|modified|added|removed|deleted|remain)"
     r"|\b(?:touch(?:es|ed)?|chang(?:es|ed)|modif(?:ies|ied)|updat(?:es|ed)|add(?:s|ed)?|"
     r"remov(?:es|ed)|delet(?:es|ed)|edit(?:s|ed)?|affect(?:s|ed)?)\s+(?:\w+\s+){0,2}?\d+\s+"
     r"(?:files?|documents?|lines?|commits?)\b",
     "The platform computes this number and will recompute it. Cut it."),
    ("split_auxiliary", r"\b(?:is|are|was|were|be|been|can|could|will|would|should|must|may|might)"
                        r"(?:\s+n[o']t)?,\s+[^,]{8,60},\s+\w+",
     "Interruption splits an auxiliary from its verb. Move it to a clause boundary."),
    ("throat_clearing",
     r"(?im)\b(?:here'?s (?:the thing|what|why)|it'?s worth noting|the key thing|that said|"
     r"at its core|it turns out|let me be clear|needless to say|it should be noted|"
     r"it is important to note|worth mentioning|as a reminder|just to clarify)\b"
     r"|(?:^|[.!?]\s+)(?:to be clear|note that|importantly|interestingly|notably|"
     r"basically|essentially|in other words|simply put|as you can see|obviously|clearly|"
     r"first of all|to be honest|honestly|frankly|keep in mind|to clarify|quick note|"
     r"one thing to note)\b",
     "Filler opener. Cut to the point."),
    ("performed_affect",
     r"(?im)(?:^|[.!?]\s+)(?:(?:oh wow|wow|ah|aha|yikes|oof)\b|"
     r"(?:neat|nice|great|awesome|amazing|fantastic|perfect|excellent)!)"
     r"|\b(?:game.?changer|seamless(?:ly)?|robust solution|best.in.class|"
     r"i'?m (?:excited|thrilled|delighted|happy) to|excited to (?:say|share|announce)|"
     r"love this|huge win|nailed it|crushed it)\b|[\U0001F389\U0001F680\u2728]",
     "Performed affect. Say the thing."),
]

# ------------------------------------------------------------------ POINTER checks
# Advisory. Humans do all of these. Each names the sentence the reread starts with.

ACRONYM_ALLOW = {
    "API", "HTTP", "HTTPS", "URL", "URI", "CLI", "GUI", "UI", "UX", "OS", "CPU", "GPU", "RAM",
    "ID", "OK", "USB", "PDF", "CSV", "JSON", "YAML", "XML", "HTML", "CSS", "SQL", "PR", "CI",
    "CD", "TLS", "SSL", "SSH", "DNS", "IP", "TCP", "UDP", "SDK", "IDE", "README", "TODO",
    "FAQ", "UTC", "AM", "PM", "US", "UK", "EU", "MIT", "BSD", "GNU", "GPL", "ASCII", "UTF",
    "MB", "GB", "KB", "TB", "MS", "IO", "VM", "DB", "QA", "RFC", "PEP", "AWS", "GCP", "REST",
    "LLM", "MCP", "SHA", "MD",
}
POINTER_VERBS = (
    r"is|was|are|were|has|have|had|will|would|can|could|should|may|might|must|does|did|"
    r"means|keeps|makes|lets|gives|leaves|works|happens|holds|fails|seems|looks|needs|"
    r"requires|allows|avoids|ensures|adds|removes|breaks|causes|matters|helps|includes|"
    r"applies|depends|turns|comes|goes|led|leads|took|takes|covers|explains|shows"
)
IDIOMS = (
    r"in play|on the table|moving parts|low[- ]hanging fruit|under the hood|"
    r"at the end of the day|circle back|on the same page|down the road|get the ball rolling|"
    r"front and center|boils? down to|in the weeds|up to speed|rule of thumb|bite the bullet|"
    r"nail(?:ed|ing|s)? down|kick the tires|on the fence|out of the box|a can of worms|"
    r"at face value|in the long run|the elephant in the room|table stakes|move the needle|"
    r"double[- ]edged sword|silver bullet|the devil is in the details|from the ground up|"
    r"a rabbit hole|a no[- ]brainer|a long shot|in the loop|heads[- ]up|touch base|deep dive|"
    r"going forward|sanity check|foot[- ]?gun|bikeshed\w*|blast radius|north star|"
    r"paint(?:ed|s)? (?:ourselves|yourself|myself) into a corner|shoot (?:ourselves|yourself) in the foot|"
    r"boil the ocean|the lion'?s share|par for the course|in a nutshell|hit the ground running|"
    r"hand[- ]wav\w+|back of the envelope|the short version|the long and short"
)

POINTERS = [
    ("bare_pointer",
     re.compile(r"(?m)(?:^|[.!?;:]\s+)(?:This|That|These|Those)\s+(?:" + POINTER_VERBS + r")\b"),
     "Sentence opens on a bare pointer. Name the thing."),
    ("deixis",
     re.compile(r"(?i)\b(?:see|table|section|list|example|code|snippet|diagram|figure|output|"
                r"steps?|notes?|as|shown|described|listed|mentioned|noted)\s+(?:above|below)\b"
                r"|\b(?:above|below)[.,;:)]|\b(?:the former|the latter|as (?:mentioned|noted|"
                r"discussed|described|stated)|earlier in this|mentioned earlier|later in this)\b"),
     "Points outside the sentence. Every reader lands cold."),
    ("idiom", re.compile(r"(?i)\b(?:" + IDIOMS + r")\b"),
     "Idiom. Say the literal thing."),
    ("dropped_that",
     re.compile(r"\b(?:found|said|think|thought|believe|noticed|knew|showed|assumed|realized|"
                r"realised|suggests?|argued|means|confirmed|discovered|learned|saw|felt|figured|"
                r"decided|told \w+|reported|noted)\s+(?:the|a|an|this|our|its|their|each|every)\s+"
                r"\w+(?:\s+\w+)?\s+(?:is|was|had|has|were|are|would|will|could|should|did|does|"
                r"might|may|must|can)\b"),
     "The noun after the verb reads as its object. Keep \"that\"."),
    ("det_pair", re.compile(r"\b(the)\s+\w+\s+and\s+\1\s+\w+\b"),
     "Two items, two articles. Drop one or both."),
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


def strip_fences(text: str) -> str:
    """Drop fenced code blocks, toggling only on a fence that opens its line.

    A regex for ```...``` fails whenever the block itself contains a fence, as a
    shell snippet echoing a markdown fence does. That leaked a whole GitHub
    Actions workflow into the prose checks.
    """
    out, inside = [], False
    for line in text.splitlines():
        if re.match(r"^\s{0,3}(```|~~~)", line):
            inside = not inside
            continue
        if not inside:
            out.append(line)
    return "\n".join(out)


def strip_markup(text: str) -> str:
    text = strip_fences(text)
    text = re.sub(r"^\s*\|.*$", "", text, flags=re.M)      # tables
    text = re.sub(r"^#+ .*$", "", text, flags=re.M)        # headings
    text = re.sub(r"^[A-Z][A-Z0-9 ()/&-]{2,}$", "", text, flags=re.M)  # ALL-CAPS section labels
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)   # bullets
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.M)  # numbered items
    text = re.sub(r"^\s{4,}\S.*$", "", text, flags=re.M)   # indented code
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
    substituted values reads as generated however good the values are.

    Two shapes count: the second and third words match, or the first and third
    match around a substituted second word ("The parser handles X. The lexer
    handles Y.")."""
    def shape(s: str) -> list[str]:
        toks = re.sub(r"`[^`]+`", "ID", s).split()[:4]
        return [re.sub(r"\d+", "N", t.lower().strip(".,:")) for t in toks]
    out = []
    for i in range(1, len(sents)):
        a, b = shape(sents[i - 1]), shape(sents[i])
        if len(a) > 2 and len(b) > 2 and (
            a[1:3] == b[1:3]
            or (a[0] == b[0] and a[2] == b[2] and a[1] != b[1] and a[0] not in ("i", "we", "you"))
        ):
            out.append(sents[i][:70])
    return out


def wh_cleft_sentences(sents: list[str]) -> list[str]:
    """A declarative opening on 'What ... is/are' that is not a question."""
    rx = re.compile(r"^What\s+(?:[\w`'-]+\s+){1,7}(?:is|was|are|were)\b")
    return [s[:80] for s in sents if not s.endswith("?") and rx.match(s)]


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


def unglossed_acronyms(sents: list[str]) -> list[tuple[str, str]]:
    """First use of a 2-to-6-letter capital token with no parenthetical gloss
    in the same sentence, and not on the allowlist."""
    seen: set[str] = set()
    out = []
    for s in sents:
        for m in re.finditer(r"\b[A-Z]{2,6}s?\b", s):
            a = m.group(0).rstrip("s")
            if a in seen or a in ACRONYM_ALLOW:
                continue
            seen.add(a)
            glossed = re.search(r"\(\s*" + re.escape(a) + r"s?\s*\)", s) or \
                re.search(re.escape(a) + r"s?\s*\(", s)
            if not glossed:
                out.append((a, s[:70]))
    return out


def bullet_det_repeat(raw: str) -> list[str]:
    """Three or more consecutive bullets opening on the same determiner."""
    out, run, last = [], [], None
    for line in strip_fences(raw).splitlines():
        m = re.match(r"^\s*(?:[-*+]|\d+[.)])\s+(the|a|an|its|our|your|their)\b", line, re.I)
        det = m.group(1).lower() if m else None
        if det and det == last:
            run.append(line.strip())
        else:
            if len(run) >= 3:
                out.append(run[0][:70])
            run = [line.strip()] if det else []
        last = det
    if len(run) >= 3:
        out.append(run[0][:70])
    return out


def pointer_hits(prose: str, sents: list[str], raw: str) -> dict:
    hits: dict[str, dict] = {}

    def sentence_of(pos: int) -> str:
        start = max(prose.rfind(".", 0, pos), prose.rfind("\n", 0, pos)) + 1
        end = prose.find(".", pos)
        return prose[start:end if end > 0 else pos + 70].strip()[:70]

    for name, rx, advice in POINTERS:
        found = [(m.group(0).strip(), sentence_of(m.end() - 1)) for m in rx.finditer(prose)]
        if found:
            hits[name] = {"count": len(found), "advice": advice, "examples": found[:4]}
    ac = unglossed_acronyms(sents)
    if ac:
        hits["acronym_unglossed"] = {"count": len(ac), "examples": ac[:6],
                                     "advice": "First use. Gloss it, or it is on the reader."}
    bd = bullet_det_repeat(raw)
    if bd:
        hits["bullet_det_repeat"] = {"count": len(bd), "examples": [(b, "") for b in bd],
                                     "advice": "Bullets repeat a determiner. Drop it or use a table."}
    return hits


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
    clefts = wh_cleft_sentences(sents)
    if clefts:
        prev = zero_hits.get("wh_cleft", {"count": 0, "examples": []})
        zero_hits["wh_cleft"] = {"count": prev["count"] + len(clefts),
                                 "advice": "Wh-cleft defers the point. State it.",
                                 "examples": (prev["examples"] + clefts)[:4]}

    colon_n = sum(1 for s in sents if re.search(r"\w:\s+\w", s))
    colon_pct = 100 * colon_n / len(sents)
    nt_mean, nt_max, nt_total = new_term_load(sents)
    reps = word_repeats(sents)
    frames = repeated_frames(sents)
    pointers = pointer_hits(prose, sents, text)

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
        "pointers": pointers,
        # Two verdicts. `clean` covers the ZERO regexes and repeated frames.
        # Word repeats are reported but do not flip it: humans hit the dense
        # repeat rule at 88 per 10k words, so a verdict that includes them is
        # false on every human document. `pass` adds the rate checks, which
        # cannot rank quality: r(score, findings) = -0.025 across 65 rated
        # excerpts. Neither verdict covers the pointers or the unchecked rules.
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
        out.append("\nZERO-TOLERANCE (the rules forbid these outright)")
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

    if r["pointers"]:
        out.append("\nREREAD POINTERS (advisory; humans write these too; the reread decides)")
        for name, v in r["pointers"].items():
            out.append(f"  {name}  x{v['count']}   {v['advice']}")
            for hit, sent in v["examples"][:3]:
                out.append(f"       '{hit}'  > {sent}" if sent else f"       > {hit}")

    verdict = "CLEAN" if r["clean"] else "DEFECTS"
    extra = "" if r["pass"] else "   (advisory findings above)"
    out.append(f"\n{verdict}{extra}   (regexes only; 25 rule lines have no check)")
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

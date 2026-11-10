// crew board: progress of each parent issue built through the linear-build
// workflow. One card per parent; each child issue moves through plan, build,
// review and PR, and the card says whose move it is.
//
// Data comes from crew's own files, read-only:
//   ~/.local/state/crew/wt/<repo>/<ISSUE>/.crew/   live child builds (meta, result, questions, scans)
//   ~/.local/state/crew/parents/<repo>/<KEY>.json  parent title and "waiting on you" notes
//   ~/.local/state/crew/history.jsonl              one JSON event per line, for finished builds
// Live builder status also comes from agents() whose app is "crew" (OSC 7501).
// The same mod renders the file viewer window when props().file is set.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState, Input } from "gpui-base";
import { agents, terminals, nextCommand, shared, setShared, exec, hc, home, readTextFile, run, theme, props, openOverlay, closeOverlay, notify, playSound } from "herdr";

const STATE = () => `${home()}/.local/state/crew`;
const CREW = () => `${home()}/.claude/skills/linear-build/bin/crew`;
const POLL_MS = 5000;
const CAPACITY_MS = 30000;
const HISTORY_SHOWN = 20;
const STEPS = ["Plan", "Build", "Review", "PR"];
// Row geometry: issue key column, one column per step, and the status pill.
const KEY = 66, COL = 42, PILL = 86;

// One shell call per poll: each live child and each parent as one JSON line.
const SCAN = `
for d in "$1"/wt/*/*/.crew; do
  [ -f "$d/meta.json" ] || continue
  q=false; [ -s "$d/questions.md" ] && q=true
  f=false; [ -s "$d/last-failure.txt" ] && f=true
  r=/dev/null; [ -f "$d/result.json" ] && r="$d/result.json"
  jq -cn --arg dir "$d" --argjson questions "$q" --argjson failure "$f" \\
    --slurpfile meta "$d/meta.json" --slurpfile result "$r" \\
    '{kind: "child", dir: $dir, questions: $questions, failure: $failure, meta: $meta[0], result: ($result[0] // null)}' 2>/dev/null
done
for p in "$1"/parents/*/*.json; do
  [ -f "$p" ] || continue
  jq -c '{kind: "parent"} + .' "$p" 2>/dev/null
done
for o in "$1"/orchestrators/*.json; do
  [ -f "$o" ] || continue
  jq -c '{kind: "orchestrator"} + .' "$o" 2>/dev/null
done`;

const ago = (iso) => {
  const ms = Date.now() - Date.parse(iso);
  if (!(ms >= 0)) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};

function firstQuestion(md) {
  const m = (md ?? "").match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : (md ?? "").split("\n").find((l) => l.trim())?.trim() ?? "";
}

// Where a child is: the step it's on, how that step is going, and whose move it is.
//   step: 0 plan, 1 build, 2 review, 3 PR, 4 finished
//   mode: "active" (someone is working on it) or "waiting" (it needs someone)
//   who:  "builder", "claude", "you", or null
function progressOf(c, agent) {
  const stage = c.meta.stage ?? (c.meta.stub_commit ? "building" : "planning");
  const result = c.result?.status;
  switch (stage) {
    case "planning": return { step: 0, mode: "active", who: "claude" };
    case "building":
      if (!result) return { step: 1, mode: agent?.status === "blocked" ? "waiting" : "active", who: agent?.status === "blocked" ? "claude" : "builder" };
      if (result === "passed") return { step: 2, mode: "waiting", who: "claude" };
      return { step: 1, mode: "waiting", who: "claude" };
    case "built": return { step: 2, mode: "waiting", who: "claude" };
    case "reviewing": return { step: 2, mode: "active", who: "claude" };
    case "fixing": return { step: 2, mode: "active", who: "builder" };
    case "escalated": return { step: 2, mode: "waiting", who: "you" };
    case "pr": return { step: 3, mode: "waiting", who: "you" };
    case "done": return { step: 4, mode: "active", who: null };
    default: return { step: 0, mode: "active", who: null };
  }
}

const WHO_LABEL = { builder: "builder", claude: "Claude", you: "you" };

// Reply state for one text box: created outside render, as gpui requires.
function makeReply(parentKey, placeholder) {
  const st = { input: InputState.new({ value: "", placeholder: placeholder ?? `Message Claude about ${parentKey}...` }), text: "", sent: "", onSubmit: null };
  st.input.on("change", (_e, cx) => { st.text = st.input.value(); cx.notify(); });
  st.input.on("submit", (_e, cx) => st.onSubmit && st.onSubmit(cx));
  return st;
}

// Type the reply into the orchestrating Claude's terminal, tagged with
// what it is about so Claude knows which parent or child the user means.
function sendReply(st, orch, about, cx) {
  const text = st.text.trim();
  if (!text || !orch) return;
  hc(["send", orch, `[crew board, ${about}] ${text}`]).then((r) => {
    if (r.code !== 0) notify({ title: "Could not reach Claude", body: (r.stderr || "hc send failed").slice(0, 200), level: "error" });
  }).catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
  st.sent = text.length > 60 ? `${text.slice(0, 57)}...` : text;
  st.text = "";
  st.input.set_value("");
  cx.notify();
}

function terminalsLive(address) {
  try { return terminals().some((x) => x.address === address && x.state === "live"); } catch (_) { return false; }
}

export default class CrewBoard extends View {
  init(_props, cx) {
    if (props()?.file) return this.initViewer(cx);
    if (props()?.detail) return this.initDetail(cx);
    if (props()?.decisions) return this.initDecisions(cx);
    this.inputs = new Map();
    if (props()?.pane === "decisions") return this.initDecisionsPane(cx);
    this.children_ = [];
    this.parents = new Map();
    this.history = [];
    this.capacity = "";
    this.seen = null;
    this.folded = new Set();
    this.refresh(cx);
    this.refreshCapacity(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    cx.timer.every(CAPACITY_MS, (cx) => this.refreshCapacity(cx));
    // `crew-board.next` (bindable in keys.json) opens the child that most needs you.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "next") this.openMostUrgent();
        if (c === "decisions") this.openTopDecisions();
        cx.notify();
      }
    });
  }

  // `crew-board.decisions` opens the decisions of the most urgent parent.
  openTopDecisions() {
    const groups = new Map();
    for (const c of this.children_) {
      const key = `${c.meta.repo}|${c.meta.parent ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const top = [...groups.entries()].map(([key, kids]) => ({ key, kids, parent: this.parents.get(key) ?? null }))
      .sort((a, b) => this.urgency(b) - this.urgency(a))[0];
    if (top) this.openDecisions(top, top.kids);
  }

  openMostUrgent() {
    const rank = (c) => {
      const p = progressOf(c, this.agentFor(c.meta.issue));
      if (p.mode !== "waiting") return 0;
      return { you: 3, claude: 2, builder: 1 }[p.who] ?? 0;
    };
    const best = [...this.children_].sort((a, b) => rank(b) - rank(a))[0];
    if (best) this.openDetail(best);
  }

  // ------------------------------------------------------------ data
  refresh(cx) {
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", SCAN, "crew-board", STATE()], { timeout: 10000 }).catch(() => null);
      const kids = [], parents = new Map(), orch = new Map();
      for (const line of (r?.stdout ?? "").split("\n")) {
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch (_) { continue; }
        if (o.kind === "parent") parents.set(`${o.repo}|${o.key}`, o);
        else if (o.kind === "orchestrator") orch.set(o.terminal, o);
        else kids.push(o);
      }
      for (const c of kids) {
        c.questionTitle = c.questions ? firstQuestion(await readTextFile(`${c.dir}/questions.md`)) : "";
      }
      this.children_ = kids;
      this.parents = parents;
      this.orch = orch;
      for (const [key, par] of parents) {
        if (par.orchestrator && !this.inputs.has(`card-${key}`)) this.inputs.set(`card-${key}`, makeReply(par.key));
      }
      this.history = this.parseHistory(await readTextFile(`${STATE()}/history.jsonl`), kids);
      if (props()?.pane !== "decisions") this.notifyChanges(kids, parents);
      cx.notify();
    });
  }

  refreshCapacity(cx) {
    cx.spawn(async (cx) => {
      const r = await exec(CREW(), ["builders"], { timeout: 10000 }).catch(() => null);
      this.capacity = (r?.stdout ?? "").split("\n")
        .map((l) => l.match(/^(\S+)\s+.*busy (\d+\/\d+)/))
        .filter(Boolean).map((m) => `${m[1]} ${m[2]}`).join("   ");
      cx.notify();
    });
  }

  // Finished builds: the latest events per repo/issue that is no longer live.
  parseHistory(text, live) {
    const liveKeys = new Set(live.map((c) => `${c.meta.repo}|${c.meta.issue}`));
    const byKey = new Map();
    for (const line of (text ?? "").split("\n")) {
      if (!line.trim()) continue;
      let e; try { e = JSON.parse(line); } catch (_) { continue; }
      if (e.event === "parent") continue;
      const key = `${e.repo_path}|${e.issue}`;
      const h = byKey.get(key) ?? { issue: e.issue, repo: e.repo, repo_path: e.repo_path, branch: e.branch };
      h.ts = e.ts;
      if (e.event === "result") h.status = e.status;
      if (e.event === "pr") h.pr = e.pr;
      if (e.event === "removed") h.archive = e.archive;
      byKey.set(key, h);
    }
    return [...byKey.entries()].filter(([k]) => !liveKeys.has(k)).map(([, h]) => h)
      .filter((h) => h.archive).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, HISTORY_SHOWN);
  }

  // A sound and a toast when something starts waiting on Claude or on you.
  notifyChanges(kids, parents) {
    const now = new Map();
    for (const c of kids) {
      const p = progressOf(c, this.agentFor(c.meta.issue));
      now.set(`c|${c.meta.repo}|${c.meta.issue}`, p.mode === "waiting" ? p.who : null);
    }
    for (const [k, p] of parents) {
      now.set(`p|${k}`, p.waiting === "you" ? "you" : null);
      const claude = this.claudeFor(p);
      now.set(`o|${k}`, this.claudeNeedsYou(claude) ? `you:${claude.ts}` : null);
    }
    if (this.seen) {
      for (const [k, who] of now) {
        if (!who || this.seen.get(k) === who) continue;
        const [kind, , key] = k.split("|");
        if (kind === "o") {
          playSound("blocked");
          notify({ title: `${key}: Claude needs you`, body: "Claude stopped and is waiting for your answer on the crew board.", level: "warning" });
          continue;
        }
        const c = kind === "c" ? kids.find((x) => `c|${x.meta.repo}|${x.meta.issue}` === k) : null;
        const p = kind === "p" ? parents.get(k.slice(2)) : null;
        const result = c?.result?.status;
        // A pass hands off to Claude's review: worth showing, not worth a sound.
        if (who === "claude" && result === "passed") continue;
        playSound("blocked");
        notify({
          title: `${key}: waiting on ${WHO_LABEL[who]}`,
          body: c ? (c.questionTitle || c.result?.note || c.meta.stage_note || "") : (p?.note || ""),
          level: who === "you" ? "warning" : result === "question" ? "warning" : "error",
        });
      }
    }
    this.seen = now;
  }

  // What the orchestrating Claude is doing, from the crew-activity hook.
  claudeFor(parent) {
    if (!parent?.orchestrator) return null;
    const a = this.orch?.get(parent.orchestrator) ?? null;
    if (!a) return null;
    const live = terminalsLive(parent.orchestrator);
    return { ...a, state: live ? a.state : "gone" };
  }

  claudeOn(claude, issue) {
    if (!claude || claude.state !== "working") return false;
    const text = [claude.doing, ...(claude.agents ?? []).map((x) => `${x.type} ${x.about}`)].join(" ");
    return text.includes(issue);
  }

  agentFor(issue) {
    return agents().filter((a) => a.app === "crew" && a.tab_name === issue && a.space_name.startsWith("crew "))
      .sort((a, b) => b.seq - a.seq)[0] ?? null;
  }

  // ------------------------------------------------------------ actions
  openFile(path, title) {
    openOverlay({ mod: "crew-board", kind: "window", key: "crew-board-file", width: 760, height: 560, props: { file: path, title } });
  }

  openPR(b) {
    if (b.pr) return exec("open", [b.pr]);
    exec("gh", ["pr", "list", "--head", b.branch, "--state", "all", "--json", "url", "--jq", ".[0].url"], { cwd: b.cwd, timeout: 20000 })
      .then((r) => {
        const url = r.stdout.trim();
        if (url) exec("open", [url]);
        else notify({ title: `${b.issue}: no PR yet`, body: `No pull request found for ${b.branch}.`, level: "info" });
      })
      .catch(() => notify({ title: "gh failed", body: "Could not look up the pull request.", level: "error" }));
  }

  // ------------------------------------------------------------ UI
  render(cx) {
    if (props()?.file) return this.renderViewer(cx);
    if (props()?.detail) return this.renderDetail(cx);
    if (props()?.decisions) return this.renderDecisions(cx);
    if (props()?.pane === "decisions") return this.renderDecisionsPane(cx);
    const t = theme();
    const groups = new Map();
    for (const c of this.children_) {
      const key = `${c.meta.repo}|${c.meta.parent ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    // Parents with nothing live still show while they wait on you.
    for (const [k, p] of this.parents) {
      if (!groups.has(k) && p.waiting === "you") groups.set(k, []);
    }
    const cards = [...groups.entries()]
      .map(([key, kids]) => ({ key, kids, parent: this.parents.get(key) ?? null }))
      .sort((a, b) => this.urgency(b) - this.urgency(a));

    const body = cards.map((g) => this.card(g, t));
    if (!cards.length) {
      body.push(div().px(16).py(12).text_color(t.dim).child("Nothing in flight. Ask Claude to work on a Linear issue."));
    }
    if (this.history.length) {
      body.push(this.sectionHeader("history", "Finished", this.history.length, t));
      if (!this.folded.has("history")) body.push(v_flex().mx(10).children(this.history.map((h) => this.historyRow(h, t))));
    }
    return v_flex().id("crew-board").size_full().bg(t.chrome).text_size(12).text_color(t.foreground)
      .child(h_flex().px(16).h(40).flex_none().justify_between().items_center()
        .child(h_flex().gap(8).items_center()
          .child(div().font_semibold().text_size(13).child("Crew"))
          .child(div().text_color(t.dim).child(cards.length ? `${cards.length} in flight` : "")))
        .child(div().id("crew-refresh").px(6).py(2).rounded(4).text_color(t.dim)
          .hover((s) => s.text_color(t.foreground).bg(t.hover))
          .on_click((_e, cx) => { this.refresh(cx); this.refreshCapacity(cx); }).child("Refresh")))
      .child(v_flex().id("crew-list").flex_1().min_h(0).pb(10).gap(10).overflow_y_scrollbar().children(body))
      .child(h_flex().px(16).h(30).flex_none().gap(10).items_center().border_t(1).border_color(t.border).text_color(t.dim)
        .child(div().child("Builders"))
        .children(this.capacityChips(t)));
  }

  capacityChips(t) {
    if (!this.capacity) return [div().child("...")];
    return this.capacity.split(/\s{2,}/).filter(Boolean).map((s) => {
      const [name, busy] = s.split(" ");
      const used = Number((busy ?? "0/0").split("/")[0]);
      return h_flex().gap(4).items_center()
        .child(div().w(6).h(6).rounded(3).bg(used > 0 ? t.working : t.border))
        .child(div().text_color(used > 0 ? t.foreground : t.dim).child(`${name} ${busy}`));
    });
  }

  claudeNeedsYou(claude) {
    return Boolean(claude) && (claude.state === "blocked" || claude.stuck || (claude.state === "idle" && claude.asks));
  }

  urgency(g) {
    if (g.parent?.waiting === "you" || this.claudeNeedsYou(this.claudeFor(g.parent))) return 4;
    const ps = g.kids.map((c) => progressOf(c, this.agentFor(c.meta.issue)));
    if (ps.some((p) => p.mode === "waiting" && p.who === "you")) return 3;
    if (ps.some((p) => p.mode === "waiting" && p.who === "claude")) return 2;
    return ps.some((p) => p.step < 4) ? 1 : 0;
  }

  whoColor(who, t) {
    return { you: t.blocked, claude: t.accent, builder: t.working }[who] ?? t.done;
  }

  // Whose move it is: filled when it's waiting on them, outlined while they work.
  pill(p, t) {
    if (!p.who) return div().w(PILL).flex_none().child(div().text_color(t.done).text_size(11).child("done"));
    const color = this.whoColor(p.who, t);
    const label = p.mode === "waiting" ? `needs ${WHO_LABEL[p.who]}` : WHO_LABEL[p.who];
    const chip = p.mode === "waiting"
      ? div().px(7).py(1).rounded(9).bg(color).text_color(t.background).font_semibold().child(label)
      : div().px(7).py(1).rounded(9).border(1).border_color(color).text_color(color).child(label);
    return h_flex().w(PILL).flex_none().justify_end().text_size(10).child(chip);
  }

  card(g, t) {
    const [repoPath, parentKey] = g.key.split("|");
    const repo = repoPath.split("/").pop();
    const kids = [...g.kids].sort((a, b) => a.meta.issue.localeCompare(b.meta.issue));
    const prog = kids.map((c) => ({ c, p: progressOf(c, this.agentFor(c.meta.issue)) }));
    const waiting = { you: 0, claude: 0, builder: 0 };
    for (const { p } of prog) if (p.mode === "waiting" && p.who) waiting[p.who]++;
    const working = prog.filter(({ p }) => p.mode === "active" && p.who === "builder").length;
    if (g.parent?.waiting === "you") waiting.you++;
    const claudeAsks = this.claudeNeedsYou(this.claudeFor(g.parent));
    if (claudeAsks) waiting.you++;
    const atPR = prog.filter(({ p }) => p.step >= 3).length;
    const steps = prog.reduce((n, { p }) => n + Math.min(p.step, STEPS.length), 0);
    const total = prog.length * STEPS.length;
    const id = `card-${g.key}`;
    const folded = this.folded.has(id);

    const counts = [];
    if (waiting.you) counts.push(this.count(`${waiting.you} need you`, t.blocked, true, t));
    if (waiting.claude) counts.push(this.count(`${waiting.claude} need Claude`, t.accent, false, t));
    if (working) counts.push(this.count(`${working} building`, t.working, false, t));

    return v_flex().id(id).mx(10).min_w(0).overflow_hidden().rounded(10).bg(t.surface).border(1)
      .border_color(waiting.you ? t.blocked : t.border)
      // Header
      .child(v_flex().id(`${id}-h`).px(14).pt(12).pb(10).gap(8)
        .on_click((_e, cx) => { folded ? this.folded.delete(id) : this.folded.add(id); cx.notify(); })
        .child(h_flex().gap(8).items_center()
          .child(div().font_semibold().text_size(14).child(parentKey || "No parent"))
          .child(div().flex_1().text_color(t.muted).truncate().child(g.parent?.title ?? repo))
          .child(div().text_color(t.dim).child(folded ? "▸" : "▾")))
        // Progress: one segment per child, filled to its step.
        .child(h_flex().gap(6).children(prog.map(({ p }) =>
          h_flex().flex_1().gap(2).children(STEPS.map((_s, i) =>
            div().flex_1().h(4).rounded(2).bg(i < p.step ? t.done : i === p.step && p.step < STEPS.length ? this.whoColor(p.who, t) : t.border))))))
        .child(div().text_color(t.muted).child(
          !kids.length ? "No children in flight" : atPR === kids.length ? "All ready for your review" : `${atPR} of ${kids.length} ready for review · ${steps}/${total} steps`))
        .when(counts.length > 0, (el) => el.child(h_flex().flex_wrap().gap(4).children(counts))))
      .child(this.claudeLine(g, prog, id, t))
      .child(this.decisionsSummary(g, kids, id, t))
      .when(g.parent?.waiting === "you", (el) => el.child(this.yourTurn(g.parent, id, t, kids.find((c) => c.meta.stage === "escalated"))))
      .when(!folded, (el) => el.child(this.replyBox(g, id, t)))
      .when(!folded && kids.length > 0, (el) => el
        .child(h_flex().px(14).pb(2).text_color(t.dim).text_size(10)
          .child(div().w(KEY))
          .child(h_flex().w(COL * STEPS.length).children(STEPS.map((s) => h_flex().w(COL).justify_center().child(s)))))
        .children(prog.map(({ c, p }, i) => this.childRow(c, p, i, t))));
  }

  // All decisions for a parent: its own plus each child's, newest first.
  decisionsOf(g, kids) {
    const out = [];
    for (const d of g.parent?.decisions ?? []) out.push({ d, issue: null, worktree: null });
    for (const c of kids) for (const d of c.meta.decisions ?? []) out.push({ d, issue: c.meta.issue, worktree: c.meta.worktree, dir: c.dir });
    return out.sort((a, b) => (a.d.ts < b.d.ts ? 1 : -1));
  }

  decisionsSummary(g, kids, id, t) {
    const all = this.decisionsOf(g, kids);
    if (!all.length) return div();
    const changeable = all.filter(({ d }) => d.auto && !d.overridden).length;
    const commented = all.filter(({ d }) => (d.comments ?? []).length > 0).length;
    const recent = all.slice(0, 3);
    return v_flex().id(`${id}-dec`).mx(14).mb(10).gap(6)
      .child(h_flex().gap(8).items_center()
        .child(div().font_semibold().child("Decisions"))
        .child(div().text_color(t.dim).child(String(all.length)))
        .when(changeable > 0, (el) => el.child(this.count(`${changeable} you can change`, t.accent, false, t)))
        .when(commented > 0, (el) => el.child(div().text_color(t.dim).text_size(11).child(`${commented} discussed`)))
        .child(div().flex_1())
        .child(this.link(`${id}-dec-all`, "All decisions →", () => this.openDecisions(g, kids), t, true)))
      .children(recent.map(({ d, issue }) =>
        h_flex().id(`${id}-dec-${d.id}`).gap(8).items_start().px(8).py(6).rounded(6).bg(t.background).min_w(0)
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => this.openDecisions(g, kids, d.id))
          .child(div().w(54).flex_none().text_size(11).text_color(t.dim).child(issue ?? "parent"))
          .child(div().flex_1().min_w(0).text_size(12).child(d.what))
          .when((d.comments ?? []).length > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${d.comments.length} 💬`)))));
  }

  // Show the decisions pane, scrolled to this parent (and a decision, if given).
  openDecisions(g, kids, focus) {
    const [, parentKey] = g.key.split("|");
    setShared("crew.decisions.focus", { parent: parentKey, id: focus ?? null, ts: Date.now() });
    run("layout.show", { id: "crew-decisions" });
  }

  openDecisionsWindow(g, kids, focus) {
    const [repo, parentKey] = g.key.split("|");
    openOverlay({ mod: "crew-board", kind: "window", key: `crew-decisions-${parentKey}`, width: 760, height: 700,
      props: { decisions: parentKey || "(no parent)", repo, focus: focus ?? null,
               orchestrator: g.parent?.orchestrator ?? null, dirs: kids.map((c) => c.dir) } });
  }

  // One line on what the orchestrating Claude is doing, with a nudge when
  // children wait on Claude and Claude has stopped.
  claudeLine(g, prog, id, t) {
    const claude = this.claudeFor(g.parent);
    if (!claude) return div();
    const waiting = prog.filter(({ p }) => p.mode === "waiting" && p.who === "claude").map(({ c }) => c);
    if (this.claudeNeedsYou(claude)) return this.claudeAsks(g, claude, id, t);
    const color = { working: t.working, idle: t.dim, blocked: t.blocked, gone: t.blocked }[claude.state] ?? t.dim;
    const label = { working: "Claude is working", idle: "Claude is idle", blocked: "Claude needs you", gone: "Claude's terminal is closed" }[claude.state] ?? "Claude";
    const dot = div().w(8).h(8).rounded(4).bg(color).flex_none()
      .when(claude.state === "working", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1200 }));
    const agents = claude.agents ?? [];
    return v_flex().id(`${id}-claude`).mx(14).mb(10).px(10).py(8).gap(4).rounded(8).bg(t.background).min_w(0)
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => g.parent?.orchestrator && run("agent.focus", { terminal: g.parent.orchestrator }))
      .child(h_flex().gap(8).items_center()
        .child(dot)
        .child(div().font_semibold().text_color(claude.state === "working" ? t.foreground : color).child(label))
        .child(div().flex_1())
        .child(div().text_color(t.dim).text_size(11).child(ago(claude.ts) === "now" ? "just now" : `${ago(claude.ts)} ago`)))
      .when(Boolean(claude.doing) && claude.state !== "idle", (el) => el.child(div().pl(16).min_w(0).text_color(t.muted).child(claude.doing)))
      .when(agents.length > 0, (el) => el.child(v_flex().pl(16).gap(2).children(agents.map((a) =>
        h_flex().gap(6).items_center().text_size(11)
          .child(div().w(6).h(6).rounded(3).bg(t.working).flex_none().loop("opacity", { from: 0.35, to: 1, period: 1200 }))
          .child(div().text_color(t.foreground).child(a.type ?? "subagent"))
          .child(div().flex_1().min_w(0).text_color(t.dim).child(a.about ?? ""))))))
      .when(claude.state === "idle" && waiting.length > 0, (el) => el.child(h_flex().pl(16).pt(2).gap(8).items_center()
        .child(div().flex_1().min_w(0).text_color(t.accent).text_size(12)
          .child(`${waiting.map((c) => c.meta.issue).join(", ")} ${waiting.length === 1 ? "waits" : "wait"} on Claude`))
        .child(h_flex().id(`${id}-nudge`).h(26).px(10).items_center().rounded(6).bg(t.solid).text_color(t.solid_foreground)
          .text_size(12).cursor_pointer()
          .on_click((e, cx) => { cx.stop_propagation(); this.nudge(g, waiting); })
          .child("Nudge Claude"))));
  }

  // Claude stopped and is waiting on the user: show what it said, loudly.
  claudeAsks(g, claude, id, t) {
    const title = claude.state === "blocked" ? "Claude is waiting for you"
      : claude.stuck ? "Claude stopped with work left and needs you" : "Claude is asking you something";
    const said = (claude.last_message || claude.doing || "").trim();
    const tail = said.length > 900 ? `...${said.slice(-900)}` : said;
    return v_flex().id(`${id}-asks`).mx(14).mb(10).px(12).py(10).gap(8).rounded(8).bg(t.raised).border(1).border_color(t.blocked).min_w(0)
      .child(h_flex().gap(8).items_center()
        .child(div().w(8).h(8).rounded(4).bg(t.blocked).flex_none().loop("opacity", { from: 0.35, to: 1, period: 900 }))
        .child(div().font_semibold().text_color(t.blocked).child(title))
        .child(div().flex_1())
        .child(div().text_color(t.dim).text_size(11).child(ago(claude.ts) === "now" ? "just now" : `${ago(claude.ts)} ago`)))
      .when(Boolean(tail), (el) => el.child(div().max_h(220).overflow_y_scrollbar().id(`${id}-asks-body`)
        .child(TextView.markdown(`${id}-asks-md-${claude.ts}`, tail))))
      .child(div().text_size(11).text_color(t.dim).child("Answer in the box below, or open Claude's terminal."));
  }

  nudge(g, waiting) {
    const [, parentKey] = g.key.split("|");
    const list = waiting.map((c) => `${c.meta.issue} (${c.meta.stage_note || c.meta.stage})`).join("; ");
    hc(["send", g.parent.orchestrator, `[crew board, ${parentKey}] Please continue with the children waiting on you: ${list}`])
      .then(() => notify({ title: "Nudged Claude", body: list, level: "info" }))
      .catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
  }

  count(text, color, filled, t) {
    return filled
      ? div().px(6).py(1).rounded(9).bg(color).text_color(t.background).text_size(10).font_semibold().child(text)
      : div().px(6).py(1).rounded(9).border(1).border_color(color).text_color(color).text_size(10).child(text);
  }

  yourTurn(parent, id, t, child) {
    return h_flex().id(`${id}-turn`).mx(14).mb(10).gap(8).items_start().px(10).py(8).rounded(8).bg(t.raised).min_w(0)
      .when(Boolean(child), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.openDetail(child)))
      .child(div().mt(4).w(8).h(8).rounded(4).bg(t.blocked).flex_none())
      .child(v_flex().flex_1().min_w(0).gap(4)
        .child(div().child(parent.note || "Your turn"))
        .when(Boolean(child), (el) => el.child(div().text_color(t.accent).text_size(11).child("Decide →"))))
      .when(Boolean(parent.link), (el) => el.child(this.link(`${id}-link`, "Open", () => exec("open", [parent.link]), t)));
  }

  // A reply box that types into the orchestrating Claude's Herdr terminal.
  replyBox(g, id, t) {
    const parent = g.parent;
    const orch = parent?.orchestrator;
    const [, parentKey] = g.key.split("|");
    if (!orch) {
      return div().mx(14).mb(10).text_size(11).text_color(t.dim)
        .child("To reply to Claude here, start the work from Claude Code in a Herdr tab.");
    }
    const st = this.inputs.get(id);
    if (!st) return div();
    st.onSubmit = (cx) => sendReply(st, orch, parentKey, cx);
    const live = terminalsLive(orch);
    return v_flex().mx(14).mb(10).gap(4)
      .child(h_flex().gap(6).items_center()
        .child(Input.new(st.input).flex_1().min_w(0).h(30).px(8).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12))
        .child(h_flex().id(`${id}-send`).h(30).px(10).items_center().rounded(7).bg(st.text.trim() ? t.solid : t.raised)
          .text_color(st.text.trim() ? t.solid_foreground : t.dim).text_size(12).cursor_pointer()
          .on_click((_e, cx) => sendReply(st, orch, parentKey, cx)).child("Send")))
      .child(h_flex().gap(10).text_size(11)
        .child(this.link(`${id}-goto`, "Open Claude's terminal", () => run("agent.focus", { terminal: orch }), t))
        .child(div().text_color(t.dim).child(st.sent ? `Sent: ${st.sent}` : live ? "" : "Claude's terminal isn't running")));
  }



  // A dot per step, each centered in a fixed column so it sits under its label.
  track(p, t) {
    const clear = "#00000000";
    return h_flex().w(COL * STEPS.length).flex_none().items_center().children(STEPS.map((_s, i) =>
      h_flex().w(COL).items_center()
        .child(div().flex_1().h(2).bg(i === 0 ? clear : i <= p.step ? t.done : t.border))
        .child(this.dot(i, p, t))
        .child(div().flex_1().h(2).bg(i === STEPS.length - 1 ? clear : i < p.step ? t.done : t.border))));
  }

  dot(i, p, t) {
    const base = div().w(12).h(12).flex_none();
    if (i < p.step || p.step >= STEPS.length) return base.rounded(6).bg(t.done);
    if (i > p.step) return base.rounded(6).border(2).border_color(t.border).bg(t.surface);
    const color = this.whoColor(p.who, t);
    if (p.mode === "waiting") return base.rounded(3).bg(color);
    return base.rounded(6).border(2).border_color(color).bg(t.surface)
      .loop("opacity", { from: 0.35, to: 1, period: 1200 });
  }

  childRow(c, p, index, t) {
    const issue = c.meta.issue;
    const claude = this.claudeFor(this.parents.get(`${c.meta.repo}|${c.meta.parent ?? ""}`));
    if (p.who === "claude" && this.claudeOn(claude, issue)) p = { ...p, mode: "active" };
    const agent = this.agentFor(issue);
    const why = this.reason(c, p);
    const whyColor = p.mode === "waiting" ? this.whoColor(p.who, t) : t.muted;
    const links = this.links(c, t);
    return v_flex().id(`row-${c.dir}`).w_full().min_w(0).px(14).py(9).gap(5).border_t(1).border_color(t.border)
      .when(index === 0, (el) => el.mt(4))
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.openDetail(c))
      .child(h_flex().items_center()
        .child(div().w(KEY).flex_none().font_semibold().child(issue))
        .child(this.track(p, t))
        .child(div().flex_1())
        .child(this.pill(p, t)))
      .when(Boolean(why) || Boolean(c.result?.risk?.security), (el) => el.child(h_flex().w_full().min_w(0).pl(KEY).gap(6).items_start()
        .when(Boolean(c.result?.risk?.security), (r) => r.child(
          div().flex_none().px(5).rounded(4).bg(t.raised).text_color(t.blocked).text_size(10).child("security")))
        .child(div().flex_1().min_w(0).text_color(whyColor).child(why))))
      .when((c.meta.decisions ?? []).some((d) => d.auto && !d.overridden), (el) => el.child(h_flex().pl(KEY).child(
        this.count(`${(c.meta.decisions ?? []).filter((d) => d.auto && !d.overridden).length} decided for you · review`, t.accent, false, t))))
      .when(links.length > 0, (el) => el.child(h_flex().pl(KEY).gap(12).children(links)));
  }

  // The one line that explains the child's state.
  reason(c, p) {
    const r = c.result, m = c.meta;
    if (c.questionTitle && (!r || r.status === "question")) return `Question: ${c.questionTitle}`;
    if (r && r.status !== "passed" && (m.stage ?? "building") === "building") return r.note || `Build ${r.status}`;
    if (["reviewing", "escalated", "pr", "fixing"].includes(m.stage)) {
      const rv = Object.entries(m.reviews ?? {}).map(([lens, v]) => v.verdict === "pass"
        ? `${lens} passed${v.findings ? ` (${v.findings} to tidy)` : ""}` : `${lens}: ${v.findings} to fix`);
      const note = (m.stage_note || "").replace(/^Claude: /, "");
      return [note, rv.join(", ")].filter(Boolean).join(" · ");
    }
    if (!r && p.who === "builder") {
      const a = this.agentFor(m.issue);
      return `${a ? "Building" : "Queued"} · ${(m.attempts ?? []).join(" then ")}`;
    }
    return m.stage_note || "";
  }

  openDetail(c) {
    const key = `${c.meta.repo}|${c.meta.parent ?? ""}`;
    const par = this.parents.get(key);
    openOverlay({ mod: "crew-board", kind: "window", key: `crew-detail-${c.meta.issue}`, width: 760, height: 680,
      props: { detail: c.dir, issue: c.meta.issue, parentKey: c.meta.parent ?? "", orchestrator: par?.orchestrator ?? null } });
  }

  links(c, t) {
    const issue = c.meta.issue, out = [];
    const agent = this.agentFor(issue);
    if (agent) out.push(this.link(`t-${c.dir}`, "Terminal", () => run("agent.focus", { terminal: agent.address }), t));
    if (c.questions) out.push(this.link(`q-${c.dir}`, "Questions", () => this.openFile(`${c.dir}/questions.md`, `${issue} questions`), t, true));
    if (c.failure) out.push(this.link(`f-${c.dir}`, "Failure", () => this.openFile(`${c.dir}/last-failure.txt`, `${issue} last failure`), t, true));
    for (const s of c.result?.scans ?? []) {
      const lens = s.replace(/^.*scan-/, "").replace(/\.md$/, "");
      out.push(this.link(`s-${c.dir}-${lens}`, `${lens[0].toUpperCase()}${lens.slice(1)} scan`, () => this.openFile(`${c.meta.worktree}/${s}`, `${issue} ${lens} scan`), t));
    }
    out.push(this.link(`l-${c.dir}`, "Log", () => this.openFile(`${c.dir}/build.log`, `${issue} build log`), t));
    if (c.meta.pr || c.meta.stage === "pr") out.push(this.link(`p-${c.dir}`, "PR", () => this.openPR({ issue, branch: c.meta.branch, cwd: c.meta.worktree, pr: c.meta.pr }), t, true));
    return out;
  }

  sectionHeader(id, label, count, t) {
    const folded = this.folded.has(id);
    return h_flex().id(`h-${id}`).px(16).pt(6).gap(6).items_center().text_color(t.muted)
      .on_click((_e, cx) => { folded ? this.folded.delete(id) : this.folded.add(id); cx.notify(); })
      .child(div().font_semibold().child(label))
      .child(div().text_color(t.dim).child(String(count)))
      .child(div().flex_1())
      .child(div().text_color(t.dim).child(folded ? "▸" : "▾"));
  }

  link(id, label, onClick, t, strong = false) {
    return div().id(id).text_size(11).text_color(strong ? t.accent : t.dim)
      .hover((s) => s.text_color(t.accent).underline())
      .on_click((e, cx) => { cx.stop_propagation(); onClick(); }).child(label);
  }

  historyRow(h, t) {
    const color = h.status === "passed" ? t.done : h.status ? t.blocked : t.muted;
    const links = [];
    if (h.pr) links.push(this.link(`hp-${h.archive}`, "PR", () => this.openPR({ issue: h.issue, branch: h.branch, cwd: h.repo_path, pr: h.pr }), t, true));
    links.push(this.link(`hl-${h.archive}`, "Log", () => this.openFile(`${h.archive}/build.log`, `${h.issue} build log`), t));
    return h_flex().id(`hist-${h.archive}`).px(6).py(5).gap(8).items_center().rounded(6).hover((s) => s.bg(t.hover))
      .child(div().w(8).h(8).rounded(4).bg(color).flex_none())
      .child(div().font_semibold().child(h.issue))
      .child(div().text_color(t.dim).truncate().child(h.repo))
      .child(div().flex_1())
      .children(links)
      .child(div().w(28).text_color(t.dim).child(ago(h.ts)));
  }

  // ------------------------------------------------------------ decisions pane
  // A sidebar pane with every decision on the board, grouped by parent and
  // child, with change buttons, comment threads and one comment box.
  initDecisionsPane(cx) {
    this.children_ = [];
    this.parents = new Map();
    this.history = [];
    this.folded = new Set();
    this.target = null;
    this.focusTs = 0;
    this.composer = makeReply("", "Comment on the selected decision...");
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
  }

  paneGroups() {
    const groups = new Map();
    for (const c of this.children_) {
      const key = `${c.meta.repo}|${c.meta.parent ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const [k, par] of this.parents) if (!groups.has(k) && (par.decisions ?? []).length) groups.set(k, []);
    return [...groups.entries()].map(([key, kids]) => {
      const [repo, parentKey] = key.split("|");
      const parent = this.parents.get(key) ?? null;
      const p = { decisions: parentKey || "(no parent)", repo, orchestrator: parent?.orchestrator ?? null };
      const sections = [];
      if ((parent?.decisions ?? []).length) sections.push({ g: { issue: null, worktree: null }, list: parent.decisions });
      for (const c of [...kids].sort((a, b) => a.meta.issue.localeCompare(b.meta.issue))) {
        if ((c.meta.decisions ?? []).length) sections.push({ g: { issue: c.meta.issue, worktree: c.meta.worktree }, list: c.meta.decisions });
      }
      return { key, parentKey, title: parent?.title ?? repo.split("/").pop(), p, sections };
    }).filter((x) => x.sections.length);
  }

  renderDecisionsPane(cx) {
    const t = theme();
    const focus = shared("crew.decisions.focus");
    if (focus && focus.ts !== this.focusTs) {
      this.focusTs = focus.ts;
      if (focus.id) this.target = focus.id;
      if (focus.parent) this.folded.delete(`dp-${focus.parent}`);
    }
    const groups = this.paneGroups();
    const all = groups.flatMap((gr) => gr.sections.flatMap((s) => s.list.map((d) => ({ d, g: s.g, p: gr.p }))));
    const changeable = all.filter(({ d }) => d.auto && !d.overridden).length;
    const target = all.find(({ d }) => d.id === this.target) ?? null;

    const body = !groups.length
      ? div().px(16).py(12).text_color(t.dim).child("No decisions yet. Claude logs them here as it works.")
      : v_flex().gap(14).children(groups.map((gr) => {
          const id = `dp-${gr.parentKey}`;
          const folded = this.folded.has(id);
          const n = gr.sections.reduce((k, s) => k + s.list.length, 0);
          return v_flex().gap(8)
            .child(h_flex().id(id).gap(8).items_center().cursor_pointer()
              .on_click((_e, cx) => { folded ? this.folded.delete(id) : this.folded.add(id); cx.notify(); })
              .child(div().font_semibold().text_size(13).child(gr.parentKey || "No parent"))
              .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(gr.title))
              .child(div().text_color(t.dim).child(String(n)))
              .child(div().text_color(t.dim).child(folded ? "▸" : "▾")))
            .when(!folded, (el) => el.children(gr.sections.map((s) => v_flex().gap(6)
              .child(div().text_size(11).text_color(t.dim).child(s.g.issue ?? "Parent"))
              .children([...s.list].reverse().map((d) => this.decisionCard(d, s.g, gr.p, t))))));
        }));

    return v_flex().id("crew-decisions-pane").size_full().bg(t.chrome).text_size(12).text_color(t.foreground)
      .child(h_flex().px(16).h(40).flex_none().gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().text_size(13).child("Decisions"))
        .child(div().text_color(t.dim).child(String(all.length)))
        .when(changeable > 0, (el) => el.child(this.count(`${changeable} you can change`, t.accent, false, t))))
      .child(div().id("crew-decisions-pane-body").flex_1().min_h(0).px(10).py(10).overflow_y_scrollbar().child(body))
      .child(this.decisionComposer(target, target?.p ?? null, t));
  }

  // ------------------------------------------------------------ decisions window
  // Every decision for one parent, grouped by child, each with its reasoning,
  // the choices Claude didn't take, and a comment thread with Claude.
  initDecisions(cx) {
    const p = props();
    this.decGroups = [];
    this.target = p.focus ?? null;
    this.composer = makeReply(p.decisions, "Comment on the selected decision...");
    this.loadDecisions(cx);
    cx.timer.every(POLL_MS, (cx) => this.loadDecisions(cx));
  }

  loadDecisions(cx) {
    cx.spawn(async (cx) => {
      const p = props();
      const groups = [];
      const repoName = p.repo.split("/").pop();
      const parentText = await readTextFile(`${STATE()}/parents/${repoName}/${p.decisions}.json`).catch(() => null);
      const parent = parentText ? JSON.parse(parentText) : null;
      if (parent?.decisions?.length) groups.push({ issue: null, worktree: null, decisions: parent.decisions });
      for (const dir of p.dirs ?? []) {
        const text = await readTextFile(`${dir}/meta.json`).catch(() => null);
        if (!text) continue;
        const m = JSON.parse(text);
        if (m.decisions?.length) groups.push({ issue: m.issue, worktree: m.worktree, meta: m, decisions: m.decisions });
      }
      this.decGroups = groups;
      cx.notify();
    });
  }

  renderDecisions(cx) {
    const t = theme(), p = props();
    const total = this.decGroups.reduce((n, g) => n + g.decisions.length, 0);
    const target = this.decGroups.flatMap((g) => g.decisions.map((d) => ({ d, g }))).find(({ d }) => d.id === this.target);
    const body = !this.decGroups.length
      ? div().p(16).text_color(t.dim).child("No decisions recorded yet.")
      : v_flex().gap(16).children(this.decGroups.map((g) => v_flex().gap(8)
          .child(h_flex().gap(8).items_center()
            .child(div().font_semibold().text_size(14).child(g.issue ?? `${p.decisions} (parent)`))
            .child(div().text_color(t.dim).child(String(g.decisions.length))))
          .children([...g.decisions].reverse().map((d) => this.decisionCard(d, g, p, t)))));

    return v_flex().id("crew-decisions").size_full().bg(t.surface).text_color(t.foreground).text_size(13)
      .child(h_flex().px(16).h(44).flex_none().gap(10).items_center().border_b(1).border_color(t.border).bg(t.chrome)
        .child(div().font_semibold().text_size(15).child(`Decisions · ${p.decisions}`))
        .child(div().text_color(t.dim).child(`${total} recorded`))
        .child(div().flex_1())
        .child(div().id("crew-dec-close").px(6).text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((e, cx) => { cx.stop_propagation(); closeOverlay(p.overlay); }).child("Close")))
      .child(div().id("crew-dec-body").flex_1().min_h(0).p(16).overflow_y_scrollbar().child(body))
      .child(this.decisionComposer(target, p, t));
  }

  decisionCard(d, g, p, t) {
    const SOURCE = { plan: "Plan", ratified: "Ratified", escalation: "Decided for you", design: "Design" };
    const selected = this.target === d.id;
    const changed = Boolean(d.overridden);
    return v_flex().id(`dec-${d.id}`).gap(6).px(12).py(10).rounded(10).bg(t.raised)
      .border(1).border_color(selected ? t.accent : d.auto && !changed ? t.accent : t.border)
      .child(h_flex().gap(8).items_center()
        .child(this.count(SOURCE[d.source] ?? d.source, d.auto && !changed ? t.accent : t.muted, d.auto && !changed, t))
        .when(changed, (el) => el.child(this.count("You changed this", t.done, true, t)))
        .child(div().text_color(t.dim).text_size(11).child(d.id))
        .child(div().flex_1())
        .child(div().text_color(t.dim).text_size(11).child(d.ts ? `${ago(d.ts)} ago` : "")))
      .child(div().child(d.what))
      .when(Boolean(d.why), (el) => el.child(div().text_color(t.muted).text_size(12).child(d.why)))
      .when(changed, (el) => el.child(div().text_color(t.muted).text_size(12).child(`You changed "${d.choice}" to "${d.overridden}".`)))
      .when(d.auto && !changed && (d.options ?? []).length > 1, (el) => el.child(h_flex().gap(6).flex_wrap()
        .children(d.options.filter((o) => o.label !== d.choice).map((o, j) =>
          div().id(`chg-${d.id}-${j}`).px(10).py(5).rounded(7).border(1).border_color(t.border).bg(t.surface).cursor_pointer()
            .hover((s) => s.bg(t.hover)).text_size(12)
            .on_click((_e, cx) => this.changeDecision(d, g, p, o, cx))
            .child(`Change to: ${o.label}`)))))
      .when(!d.auto && (d.options ?? []).length > 0, (el) => el.child(div().text_color(t.dim).text_size(12)
        .child(`Alternatives: ${d.options.map((o) => o.label).join("; ")}`)))
      .when((d.comments ?? []).length > 0, (el) => el.child(v_flex().gap(4).pl(10).border_l(2).border_color(t.border)
        .children(d.comments.map((c) => v_flex().gap(1)
          .child(h_flex().gap(6).text_size(11)
            .child(div().font_semibold().text_color(c.by === "user" ? t.foreground : t.accent).child(c.by === "user" ? "You" : "Claude"))
            .child(div().text_color(t.dim).child(`${ago(c.ts)} ago`)))
          .child(div().text_size(12).child(c.text))))))
      .child(h_flex().gap(12)
        .child(this.link(`cmt-${d.id}`, selected ? "Commenting…" : "Comment", () => { this.target = d.id; this.composer.input.focus(); }, t, true)));
  }

  decisionComposer(target, p, t) {
    const st = this.composer;
    if (!target) {
      return div().px(16).py(12).flex_none().border_t(1).border_color(t.border).bg(t.chrome).text_size(12).text_color(t.dim)
        .child("Pick Comment on a decision to discuss it with Claude.");
    }
    const send = (cx) => this.commentOn(target.d, target.g, p, cx);
    st.onSubmit = send;
    return v_flex().px(16).py(10).gap(4).flex_none().border_t(1).border_color(t.border).bg(t.chrome)
      .child(h_flex().gap(6).text_size(11).text_color(t.dim)
        .child(div().child(`Commenting on ${target.d.id}:`))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(target.d.what))
        .child(div().id("cmt-cancel").text_color(t.dim).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { this.target = null; cx.notify(); }).child("✕")))
      .child(h_flex().gap(8).items_center()
        .child(Input.new(st.input).flex_1().min_w(0).h(34).px(10).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(13))
        .child(h_flex().id("cmt-send").h(34).px(14).items_center().rounded(8)
          .bg(st.text.trim() ? t.solid : t.raised).text_color(st.text.trim() ? t.solid_foreground : t.dim).cursor_pointer()
          .on_click((_e, cx) => send(cx)).child("Send")))
      .child(div().text_size(11).text_color(t.dim)
        .child(p.orchestrator ? "Claude gets your comment, acts on it, and replies here." : "Saved with the decision; Claude reads it from crew's files."));
  }

  commentOn(d, g, p, cx) {
    const st = this.composer, text = st.text.trim();
    if (!text) return;
    exec(CREW(), ["comment", d.id, "--text", text, "--by", "user"], { cwd: g.worktree ?? p.repo, timeout: 15000 })
      .then((r) => { if (r.code !== 0) notify({ title: "Comment not saved", body: (r.stderr || "").slice(0, 200), level: "error" }); })
      .catch(() => notify({ title: "Comment not saved", body: "crew comment failed", level: "error" }));
    if (p.orchestrator) {
      const about = g.issue ? `${p.decisions} / ${g.issue}` : p.decisions;
      hc(["send", p.orchestrator, `[crew board, ${about}] Comment on decision ${d.id} ("${d.what}"): ${text} Act on it if needed, then reply with crew comment ${d.id} --by claude --text "...".`])
        .catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
    }
    st.text = ""; st.input.set_value("");
    this.reloadDecisions(cx);
    cx.notify();
  }

  reloadDecisions(cx) {
    if (props()?.pane === "decisions") this.refresh(cx);
    else this.loadDecisions(cx);
  }

  changeDecision(d, g, p, o, cx) {
    const lock = `${d.id}|${o.label}`;
    if (this.choosing === lock) return;
    this.choosing = lock;
    exec(CREW(), ["answer", g.issue, o.label], { cwd: g.worktree, timeout: 15000 })
      .catch(() => notify({ title: "Could not record the change", body: "crew answer failed", level: "error" }));
    if (p.orchestrator) {
      hc(["send", p.orchestrator, `[crew board, ${p.decisions} / ${g.issue}] I'm changing your decision ${d.id} ("${d.question ?? d.what}") from "${d.choice}" to "${o.label}".${o.detail ? ` ${o.detail}` : ""} Redo the affected work.`])
        .catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
    }
    notify({ title: `${g.issue}: changed to ${o.label}`, body: p.orchestrator ? "Sent to Claude." : "Recorded.", level: "success" });
    this.reloadDecisions(cx);
  }

  // ------------------------------------------------------------ child detail window
  // Everything about one child, rendered: where it stands, the open question,
  // reviewer verdicts, and its spec, reviews, scans and failures as markdown.
  initDetail(cx) {
    const p = props();
    this.doc = null;
    this.docs = [];
    this.meta = null;
    this.result = null;
    this.reply = p.orchestrator ? makeReply(p.issue, `Reply to Claude about ${p.issue}...`) : null;
    this.loadDetail(cx);
    cx.timer.every(POLL_MS, (cx) => this.loadDetail(cx));
  }

  loadDetail(cx) {
    cx.spawn(async (cx) => {
      const dir = props().detail;
      const read = (name) => readTextFile(`${dir}/${name}`).catch(() => null);
      const metaText = await read("meta.json");
      this.meta = metaText ? JSON.parse(metaText) : null;
      const resultText = await read("result.json");
      this.result = resultText ? JSON.parse(resultText) : null;
      const wanted = [
        ["questions.md", "Questions"], ["review-critic.md", "Critic review"], ["review-security.md", "Security review"],
        ["review-qa.md", "QA review"], ["review-staff.md", "Staff review"], ["spec.md", "Spec"],
        ["scan-critic.md", "Critic scan"], ["scan-security.md", "Security scan"], ["last-failure.txt", "Last failure"],
      ];
      const docs = [];
      for (const [name, label] of wanted) {
        const text = await read(name);
        if (text && text.trim()) docs.push({ name, label, text });
      }
      this.docs = docs;
      if (!this.doc || !docs.some((d) => d.name === this.doc)) this.doc = docs[0]?.name ?? null;
      cx.notify();
    });
  }

  renderDetail(cx) {
    const t = theme(), p = props(), m = this.meta;
    if (!m) return v_flex().size_full().bg(t.surface).p(16).text_color(t.muted).child("Loading...");
    const c = { meta: m, result: this.result, questionTitle: "" };
    const prog = progressOf(c, this.agentFor(m.issue));
    const color = this.whoColor(prog.who, t);
    const doc = this.docs.find((d) => d.name === this.doc);
    const reviews = Object.entries(m.reviews ?? {});
    const agent = this.agentFor(m.issue);

    const tabs = h_flex().gap(4).flex_wrap().children(this.docs.map((d) =>
      div().id(`doc-${d.name}`).px(10).py(4).rounded(6).text_size(12)
        .bg(d.name === this.doc ? t.selected : t.surface)
        .text_color(d.name === this.doc ? t.foreground : t.muted)
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.doc = d.name; cx.notify(); })
        .child(d.label)));

    const body = !doc ? div().text_color(t.dim).child("Nothing written for this child yet.")
      : /\.md$/.test(doc.name) ? TextView.markdown(`crew-doc-${p.detail}-${doc.name}`, doc.text)
      : div().font_family("monospace").text_size(12).child(doc.text.length > 60000 ? doc.text.slice(-60000) : doc.text);

    return v_flex().id("crew-detail").size_full().bg(t.surface).text_color(t.foreground).text_size(13)
      // Title bar
      .child(h_flex().px(16).h(44).flex_none().gap(10).items_center().border_b(1).border_color(t.border).bg(t.chrome)
        .child(div().font_semibold().text_size(15).child(m.issue))
        .child(div().text_color(t.dim).child(m.parent ? `in ${m.parent}` : ""))
        .child(div().flex_1())
        .child(this.pill(prog, t))
        .child(div().id("crew-detail-close").px(6).text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((e, cx) => { cx.stop_propagation(); closeOverlay(p.overlay); }).child("Close")))
      // Where it stands
      .child(v_flex().px(16).py(12).gap(8).flex_none().border_b(1).border_color(t.border)
        .child(h_flex().items_center().gap(12)
          .child(this.track(prog, t))
          .child(div().flex_1())
          .when(Boolean(agent), (el) => el.child(this.link("crew-detail-term", "Open builder terminal", () => run("agent.focus", { terminal: agent.address }), t))))
        .when(Boolean(m.ask) && m.stage === "escalated", (el) => el.child(this.decision(m, p, t)))
        .when((m.decisions ?? []).length > 0, (el) => el.child(h_flex().gap(8).items_center()
          .child(this.count(`${m.decisions.length} decision${m.decisions.length === 1 ? "" : "s"}`, t.accent, false, t))
          .when(m.decisions.some((d) => d.auto && !d.overridden), (e) => e.child(div().text_color(t.accent).text_size(12).child("some decided for you")))
          .child(this.link("crew-detail-dec", "Show in decisions pane →", () => {
            setShared("crew.decisions.focus", { parent: p.parentKey || m.issue, id: null, ts: Date.now() });
            run("layout.show", { id: "crew-decisions" });
          }, t, true))))
        .when(Boolean(m.answer) && m.stage !== "escalated", (el) => el.child(h_flex().gap(8).items_center()
          .child(this.count(`You chose: ${m.answer.choice}`, t.done, true, t))
          .child(div().text_color(t.dim).text_size(12).child(ago(m.answer.ts) === "now" ? "just now" : `${ago(m.answer.ts)} ago`))))
        .when(Boolean(m.stage_note) && !(m.ask && m.stage === "escalated"), (el) => el.child(div().px(10).py(8).rounded(8).bg(t.raised)
          .text_color(prog.mode === "waiting" ? color : t.foreground).child(m.stage_note)))
        .when(reviews.length > 0, (el) => el.child(h_flex().gap(6).flex_wrap().children(reviews.map(([lens, v]) =>
          this.count(`${lens}: ${v.verdict === "pass" ? "passed" : `${v.findings} to fix`}`, v.verdict === "pass" ? t.done : t.blocked, v.verdict !== "pass", t))))))
      // Documents
      .child(v_flex().flex_1().min_h(0)
        .child(div().px(16).pt(10).pb(6).flex_none().child(tabs))
        .child(div().id("crew-detail-body").flex_1().min_h(0).px(16).pb(16).overflow_y_scrollbar().child(body)))
      // Reply
      .child(this.detailReply(p, t));
  }

  // An open decision: the question, then one button per option. The
  // recommended option comes first and is drawn as the primary button.
  decision(m, p, t) {
    const ask = m.ask;
    const rec = (ask.recommend ?? 0) - 1;
    const order = ask.options.map((o, i) => ({ o, i })).sort((a, b) => (b.i === rec) - (a.i === rec));
    return v_flex().gap(10).px(12).py(12).rounded(10).bg(t.raised).border(1).border_color(t.blocked)
      .child(h_flex().gap(8).items_start()
        .child(div().mt(5).w(8).h(8).rounded(4).bg(t.blocked).flex_none())
        .child(div().flex_1().min_w(0).font_semibold().child(ask.question)))
      .child(v_flex().gap(6).children(order.map(({ o, i }) => {
        const primary = i === rec;
        const locked = this.choosing === ask.ts;
        return v_flex().id(`opt-${i}`).px(12).py(9).gap(2).rounded(8).cursor_pointer().opacity(locked ? 0.5 : 1)
          .bg(primary ? t.solid : t.surface).border(1).border_color(primary ? t.solid : t.border)
          .hover((s) => s.opacity(0.9))
          .on_click((_e, cx) => this.choose(m, p, o, cx))
          .child(h_flex().gap(8).items_center()
            .child(div().font_semibold().text_color(primary ? t.solid_foreground : t.foreground).child(o.label))
            .when(primary, (el) => el.child(div().px(6).rounded(8).bg(t.solid_foreground).text_color(t.solid).text_size(10).child("Recommended"))))
          .when(Boolean(o.detail), (el) => el.child(div().text_size(12).text_color(primary ? t.solid_foreground : t.muted).child(o.detail)));
      })))
      .child(div().text_size(11).text_color(t.dim).child("Or type a different answer below."));
  }

  // A decision Claude made so the run could continue overnight. The user can
  // keep it or change it; a change goes to Claude like any other answer.
  decidedForYou(m, p, d, i, t) {
    const changed = Boolean(d.overridden);
    return v_flex().gap(8).px(12).py(10).rounded(10).bg(t.raised).border(1).border_color(changed ? t.border : t.accent)
      .child(h_flex().gap(8).items_center()
        .child(this.count(changed ? "You changed this" : "Decided for you", changed ? t.done : t.accent, !changed, t))
        .child(div().flex_1())
        .child(div().text_color(t.dim).text_size(11).child(d.ts ? `${ago(d.ts)} ago` : "")))
      .child(div().font_semibold().child(d.question))
      .child(div().text_color(t.muted).child(changed ? `Claude chose "${d.choice}"; you changed it to "${d.overridden}".` : `Claude chose "${d.choice}".`))
      .when(!changed, (el) => el.child(h_flex().gap(6).flex_wrap().children((d.options ?? []).filter((o) => o.label !== d.choice).map((o, j) =>
        div().id(`chg-${i}-${j}`).px(10).py(5).rounded(7).border(1).border_color(t.border).bg(t.surface).cursor_pointer()
          .hover((s) => s.bg(t.hover)).text_size(12)
          .on_click((_e, cx) => this.choose(m, p, o, cx, d))
          .child(`Change to: ${o.label}`)))));
  }

  choose(m, p, o, cx, decided) {
    // One choice per question: stay locked until the recorded answer loads.
    const lock = decided ? `${decided.ts}|${o.label}` : m.ask.ts;
    if (this.choosing === lock) return;
    this.choosing = lock;
    exec(CREW(), ["answer", m.issue, o.label], { cwd: m.worktree, timeout: 15000 })
      .then((r) => {
        if (r.code !== 0) notify({ title: "Could not record your choice", body: (r.stderr || "").slice(0, 200), level: "error" });
      })
      .catch(() => notify({ title: "Could not record your choice", body: "crew answer failed", level: "error" }));
    if (p.orchestrator) {
      const about = p.parentKey ? `${p.parentKey} / ${p.issue}` : p.issue;
      const said = decided
        ? `I'm changing your decision on "${decided.question}" from "${decided.choice}" to "${o.label}".${o.detail ? ` ${o.detail}` : ""} Redo the affected work.`
        : `My decision: ${o.label}.${o.detail ? ` ${o.detail}` : ""}`;
      hc(["send", p.orchestrator, `[crew board, ${about}] ${said}`])
        .catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
    }
    notify({ title: `${m.issue}: ${o.label}`, body: p.orchestrator ? "Sent to Claude." : "Recorded. Claude picks it up from crew's files.", level: "success" });
    this.loadDetail(cx);
    cx.notify();
  }

  detailReply(p, t) {
    const st = this.reply;
    if (!st) {
      return div().px(16).py(10).flex_none().border_t(1).border_color(t.border).text_size(12).text_color(t.dim)
        .child("To reply here, start the work from Claude Code in a Herdr tab.");
    }
    const about = p.parentKey ? `${p.parentKey} / ${p.issue}` : p.issue;
    st.onSubmit = (cx) => sendReply(st, p.orchestrator, about, cx);
    return v_flex().px(16).py(10).gap(4).flex_none().border_t(1).border_color(t.border).bg(t.chrome)
      .child(h_flex().gap(8).items_center()
        .child(Input.new(st.input).flex_1().min_w(0).h(34).px(10).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(13))
        .child(h_flex().id("crew-detail-send").h(34).px(14).items_center().rounded(8)
          .bg(st.text.trim() ? t.solid : t.raised).text_color(st.text.trim() ? t.solid_foreground : t.dim).cursor_pointer()
          .on_click((_e, cx) => sendReply(st, p.orchestrator, about, cx)).child("Send")))
      .child(h_flex().gap(10).text_size(11)
        .child(this.link("crew-detail-claude", "Open Claude's terminal", () => run("agent.focus", { terminal: p.orchestrator }), t))
        .child(div().text_color(t.dim).child(st.sent ? `Sent: ${st.sent}` : terminalsLive(p.orchestrator) ? "" : "Claude's terminal isn't running")));
  }

  // ------------------------------------------------------------ file viewer window
  initViewer(cx) {
    this.text = null;
    cx.spawn(async (cx) => {
      this.text = (await readTextFile(props().file)) ?? "(file not found)";
      cx.notify();
    });
  }

  renderViewer(cx) {
    const t = theme(), p = props();
    const markdown = /\.md$/.test(p.file);
    const body = this.text === null ? div().p(12).text_color(t.muted).child("Loading...")
      : markdown ? TextView.markdown(`crew-view-${p.file}`, this.text)
      : div().font_family("monospace").text_size(12).child(this.text.length > 60000 ? this.text.slice(-60000) : this.text);
    return v_flex().id("crew-viewer").size_full().bg(t.surface).text_color(t.foreground)
      .child(h_flex().px(10).py(6).justify_between().items_center().border_b(1).border_color(t.border).bg(t.chrome)
        .child(div().font_semibold().truncate().child(p.title ?? p.file))
        .child(div().id("crew-viewer-close").text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((e, cx) => { cx.stop_propagation(); closeOverlay(p.overlay); }).child("close")))
      .child(div().id("crew-viewer-body").flex_1().min_h(0).p(12).overflow_y_scrollbar().child(body));
  }
}

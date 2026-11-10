// crew board: every build from the linear-build workflow in one panel.
//
// Data comes from crew's own files, read-only:
//   ~/.local/state/crew/wt/<repo>/<ISSUE>/.crew/   live builds (meta, result, questions, scans)
//   ~/.local/state/crew/history.jsonl              one JSON event per line (started, result, pr, removed)
//   ~/.local/state/crew/archive/...                .crew/ copies of removed builds
// Live status comes from agents() whose app is "crew" (crew prints OSC 7501).
// The same mod renders the file viewer window, when props().file is set.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, exec, home, readTextFile, run, theme, props, openOverlay, closeOverlay, notify, playSound } from "herdr";

const STATE = () => `${home()}/.local/state/crew`;
const CREW = () => `${home()}/.claude/skills/linear-build/bin/crew`;
const POLL_MS = 5000;
const CAPACITY_MS = 30000;
const HISTORY_SHOWN = 25;

// One shell call per poll lists every live build's state, one compact JSON
// object per line (meta.json and result.json are pretty-printed, so jq -c).
const SCAN = `
for d in "$1"/wt/*/*/.crew; do
  [ -f "$d/meta.json" ] || continue
  q=false; [ -s "$d/questions.md" ] && q=true
  f=false; [ -s "$d/last-failure.txt" ] && f=true
  r=/dev/null; [ -f "$d/result.json" ] && r="$d/result.json"
  jq -cn --arg dir "$d" --argjson questions "$q" --argjson failure "$f" \\
    --slurpfile meta "$d/meta.json" --slurpfile result "$r" \\
    '{dir: $dir, questions: $questions, failure: $failure, meta: $meta[0], result: ($result[0] // null)}' 2>/dev/null
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

// What a row's state is called and which theme color draws it.
const LOOK = {
  working: ["building", "working"],
  blocked: ["needs Claude", "blocked"],
  question: ["needs Claude", "blocked"],
  done: ["passed", "done"],
  passed: ["passed", "done"],
  failed: ["failed", "blocked"],
  error: ["error", "blocked"],
  timeout: ["timed out", "blocked"],
  starting: ["starting", "unknown"],
};
const URGENT = { question: 4, blocked: 4, failed: 3, error: 3, timeout: 3, working: 2, starting: 2, passed: 1, done: 1 };

function firstQuestion(md) {
  const m = (md ?? "").match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : (md ?? "").split("\n").find((l) => l.trim())?.trim() ?? "";
}

export default class CrewBoard extends View {
  init(_props, cx) {
    if (props()?.file) return this.initViewer(cx);
    this.live = [];
    this.history = [];
    this.capacity = "";
    this.seen = null; // issue -> last result status, to notify on changes only
    this.folded = new Set();
    this.refresh(cx);
    this.refreshCapacity(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    cx.timer.every(CAPACITY_MS, (cx) => this.refreshCapacity(cx));
  }

  // ------------------------------------------------------------ data
  refresh(cx) {
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", SCAN, "crew-board", STATE()], { timeout: 10000 }).catch(() => null);
      const live = [];
      for (const line of (r?.stdout ?? "").split("\n")) {
        if (!line.trim()) continue;
        try { live.push(JSON.parse(line)); } catch (_) { /* a file mid-write; next poll */ }
      }
      for (const b of live) {
        b.questionTitle = b.questions ? firstQuestion(await readTextFile(`${b.dir}/questions.md`)) : "";
      }
      this.live = live;
      this.history = this.parseHistory(await readTextFile(`${STATE()}/history.jsonl`), live);
      this.notifyChanges(live);
      cx.notify();
    });
  }

  refreshCapacity(cx) {
    cx.spawn(async (cx) => {
      const r = await exec(CREW(), ["builders"], { timeout: 10000 }).catch(() => null);
      // "deepseek   cmhcluster/Deepseek v4.1 Flash   busy 1/4" -> "deepseek 1/4"
      this.capacity = (r?.stdout ?? "").split("\n")
        .map((l) => l.match(/^(\S+)\s+.*busy (\d+\/\d+)/))
        .filter(Boolean).map((m) => `${m[1]} ${m[2]}`).join("   ");
      cx.notify();
    });
  }

  // Finished builds: newest event per repo/issue that is no longer live.
  parseHistory(text, live) {
    const liveKeys = new Set(live.map((b) => `${b.meta.repo}|${b.meta.issue}`));
    const byKey = new Map();
    for (const line of (text ?? "").split("\n")) {
      if (!line.trim()) continue;
      let e; try { e = JSON.parse(line); } catch (_) { continue; }
      const key = `${e.repo_path}|${e.issue}`;
      const h = byKey.get(key) ?? { issue: e.issue, repo: e.repo, repo_path: e.repo_path, branch: e.branch };
      h.ts = e.ts;
      if (e.event === "result") { h.status = e.status; h.attempt_log = e.attempt_log; h.security = e.risk_security; }
      if (e.event === "pr") h.pr = e.pr;
      if (e.event === "removed") h.archive = e.archive;
      byKey.set(key, h);
    }
    return [...byKey.entries()].filter(([k]) => !liveKeys.has(k)).map(([, h]) => h)
      .filter((h) => h.archive).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, HISTORY_SHOWN);
  }

  notifyChanges(live) {
    const now = new Map(live.map((b) => [`${b.meta.repo}|${b.meta.issue}`, b.result?.status ?? null]));
    if (this.seen) {
      for (const b of live) {
        const key = `${b.meta.repo}|${b.meta.issue}`, s = now.get(key);
        if (!s || s === this.seen.get(key)) continue;
        if (s === "passed") continue;
        playSound("blocked");
        notify({
          title: `${b.meta.issue}: ${LOOK[s]?.[0] ?? s}`,
          body: s === "question" ? (b.questionTitle || "Open questions for Claude") : (b.result?.note || ""),
          level: s === "question" ? "warning" : "error",
        });
      }
    }
    this.seen = now;
  }

  // The live agent for a build: a tab named after the issue in a "crew ..." space.
  agentFor(issue) {
    return agents().filter((a) => a.app === "crew" && a.tab_name === issue && a.space_name.startsWith("crew "))
      .sort((a, b) => b.seq - a.seq)[0] ?? null;
  }

  stateOf(b) {
    const a = this.agentFor(b.meta.issue);
    if (!b.result) return a?.status === "blocked" ? "blocked" : "working";
    return b.result.status;
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
    const t = theme();
    const live = [...this.live].sort((a, b) =>
      (URGENT[this.stateOf(b)] ?? 0) - (URGENT[this.stateOf(a)] ?? 0) || a.meta.issue.localeCompare(b.meta.issue));
    const byRepo = new Map();
    for (const b of live) {
      const repo = b.meta.repo.split("/").pop();
      if (!byRepo.has(repo)) byRepo.set(repo, []);
      byRepo.get(repo).push(b);
    }
    const sections = [];
    for (const [repo, builds] of byRepo) {
      sections.push(this.header(`live-${repo}`, repo, builds.length, t));
      if (!this.folded.has(`live-${repo}`)) sections.push(...builds.map((b) => this.liveRow(b, t)));
    }
    if (!live.length) {
      sections.push(div().px(10).py(8).text_color(t.dim).child("No builds running. Ask Claude to work on a Linear issue."));
    }
    if (this.history.length) {
      sections.push(this.header("history", "Finished", this.history.length, t));
      if (!this.folded.has("history")) sections.push(...this.history.map((h) => this.historyRow(h, t)));
    }
    return v_flex().id("crew-board").size_full().bg(t.chrome).text_size(12).text_color(t.foreground)
      .child(h_flex().px(10).py(8).justify_between().items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().text_size(13).child("crew"))
        .child(div().id("crew-refresh").text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { this.refresh(cx); this.refreshCapacity(cx); }).child("refresh")))
      .child(v_flex().id("crew-list").flex_1().min_h(0).py(4).overflow_y_scrollbar().children(sections))
      .child(div().px(10).py(6).border_t(1).border_color(t.border).text_color(t.muted).truncate()
        .child(this.capacity ? `builders  ${this.capacity}` : "builders  ..."));
  }

  header(id, label, count, t) {
    const folded = this.folded.has(id);
    return h_flex().id(`h-${id}`).px(10).pt(8).pb(2).gap(6).items_center().text_color(t.muted)
      .on_click((_e, cx) => { folded ? this.folded.delete(id) : this.folded.add(id); cx.notify(); })
      .child(div().child(folded ? "▸" : "▾"))
      .child(div().font_semibold().child(label))
      .child(div().text_color(t.dim).child(String(count)));
  }

  badge(text, color, t) {
    return div().px(5).rounded(4).border(1).border_color(color).text_color(color).text_size(10).child(text);
  }

  link(id, label, onClick, t) {
    return div().id(id).text_color(t.accent).hover((s) => s.underline()).on_click((e, cx) => { cx.stop_propagation(); onClick(); }).child(label);
  }

  liveRow(b, t) {
    const issue = b.meta.issue, state = this.stateOf(b), [word, colorName] = LOOK[state] ?? [state, "unknown"];
    const color = t[colorName] ?? t.muted;
    const agent = this.agentFor(issue);
    const builders = (b.result?.attempt_log ?? []).map((a) => a.builder).join(" → ") || (b.meta.attempts ?? []).join(" → ");
    const files = [];
    if (b.questions) files.push(this.link(`q-${b.dir}`, "questions", () => this.openFile(`${b.dir}/questions.md`, `${issue} questions`), t));
    if (b.failure) files.push(this.link(`f-${b.dir}`, "failure", () => this.openFile(`${b.dir}/last-failure.txt`, `${issue} last failure`), t));
    for (const s of b.result?.scans ?? []) {
      const lens = s.replace(/^.*scan-/, "").replace(/\.md$/, "");
      files.push(this.link(`s-${b.dir}-${lens}`, lens, () => this.openFile(`${b.meta.worktree}/${s}`, `${issue} ${lens} scan`), t));
    }
    files.push(this.link(`l-${b.dir}`, "log", () => this.openFile(`${b.dir}/build.log`, `${issue} build log`), t));
    if (b.result?.status === "passed") files.push(this.link(`p-${b.dir}`, "PR", () => this.openPR({ issue, branch: b.meta.branch, cwd: b.meta.worktree, pr: b.meta.pr }), t));

    return v_flex().id(`row-${b.dir}`).mx(6).px(6).py(5).gap(3).rounded(6)
      .hover((s) => s.bg(t.hover))
      .on_click(() => agent && run("agent.focus", { terminal: agent.address }))
      .child(h_flex().gap(6).items_center()
        .child(div().w(7).h(7).rounded(4).bg(color).flex_none())
        .child(div().font_semibold().child(issue))
        .child(div().text_color(color).child(word))
        .when(Boolean(b.result?.risk?.security), (el) => el.child(this.badge("security", t.blocked, t)))
        .child(div().flex_1())
        .child(div().text_color(t.dim).truncate().child(builders)))
      .when(Boolean(b.questionTitle), (el) => el.child(div().pl(13).text_color(t.blocked).truncate().child(`? ${b.questionTitle}`)))
      .when(state === "failed" && Boolean(b.result?.note), (el) => el.child(div().pl(13).text_color(t.muted).truncate().child(b.result.note)))
      .child(h_flex().pl(13).gap(10).child(div().text_color(t.dim).truncate().max_w(140).child(b.meta.branch)).children(files));
  }

  historyRow(h, t) {
    const [word, colorName] = LOOK[h.status] ?? [h.status ?? "removed", "unknown"];
    const color = t[colorName] ?? t.muted;
    const links = [];
    if (h.pr) links.push(this.link(`hp-${h.archive}`, "PR", () => this.openPR({ issue: h.issue, branch: h.branch, cwd: h.repo_path, pr: h.pr }), t));
    links.push(this.link(`hl-${h.archive}`, "log", () => this.openFile(`${h.archive}/build.log`, `${h.issue} build log`), t));
    links.push(this.link(`hs-${h.archive}`, "critic", () => this.openFile(`${h.archive}/scan-critic.md`, `${h.issue} critic scan`), t));
    return h_flex().id(`hist-${h.archive}`).mx(6).px(6).py(3).gap(6).items_center().rounded(6).hover((s) => s.bg(t.hover))
      .child(div().w(7).h(7).rounded(4).bg(color).flex_none())
      .child(div().child(h.issue))
      .child(div().text_color(t.dim).child(h.repo))
      .child(div().text_color(color).child(word))
      .child(div().flex_1())
      .children(links)
      .child(div().text_color(t.dim).child(ago(h.ts)));
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

// claude-chat: a chat view of a Claude Code session running in a Herdr
// terminal. It reads the session's transcript and shows the conversation:
// your messages, Claude's replies as rendered markdown, and tool calls folded
// to one line each. The message box types into the same terminal, so you are
// talking to the real session; the terminal stays one click away.
//
// Which session: props().terminal, else the most recently active Claude that
// the crew-activity hook has recorded. That hook stores each session's
// transcript path in ~/.local/state/crew/orchestrators/<terminal>.json.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, InputState, Input, ScrollHandle } from "gpui-base";
import { exec, hc, home, run, theme, props, terminals, notify } from "herdr";

const STATE = () => `${home()}/.local/state/crew/orchestrators`;
const POLL_MS = 2000;
const TAIL_LINES = 1500;
const MAX_ITEMS = 300;

// The newest activity record, or the one for a given terminal.
const PICK = `
dir="$1"; want="$2"
for f in "$dir"/*.json; do [ -f "$f" ] && jq -c . "$f" 2>/dev/null; done |
  jq -s --arg w "$want" 'map(select(.transcript != null)) | if $w != "" then map(select(.terminal == $w)) else . end | sort_by(.ts) | last // empty'`;

// The transcript's modification time on the first line, then its tail.
const TAIL = `f="$1"; date -r "$f" +%s 2>/dev/null || echo 0; tail -n "$2" "$f" 2>/dev/null`;

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b) => (typeof b === "string" ? b : b?.type === "text" ? b.text : "")).join("\n");
}

// A user turn is a real message unless the harness wrote it.
function isHumanText(s) {
  const t = (s ?? "").trim();
  if (!t) return false;
  if (t.startsWith("<") && /^<[a-z-]+[ >]/.test(t)) return false; // system-reminder, command tags
  if (t.startsWith("[Request interrupted")) return false;
  return true;
}

function toolSummary(name, input) {
  const i = input ?? {};
  switch (name) {
    case "Bash": return i.description || (i.command ?? "").slice(0, 100);
    case "Read": case "Edit": case "Write": case "MultiEdit": return (i.file_path ?? "").split("/").pop();
    case "Agent": case "Task": return `${i.subagent_type ?? "subagent"}: ${i.description ?? ""}`;
    case "Grep": return `${i.pattern ?? ""}`;
    case "Glob": return `${i.pattern ?? ""}`;
    case "Skill": return i.skill ?? "";
    default: return name.startsWith("mcp__") ? name.split("__").pop() : "";
  }
}

// Turn transcript lines into chat items, in order.
function parse(lines) {
  const items = [], tools = new Map();
  // A stop hook can send Claude back to rewrite its reply (the prose
  // tripwire does). The reply before the hook then becomes a draft.
  let lastText = -1, afterStopHook = -1;
  for (const line of lines) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (_) { continue; }
    if (e.type === "system" && e.subtype === "stop_hook_summary") { afterStopHook = lastText; continue; }
    if ((e.type !== "user" && e.type !== "assistant") || e.isSidechain || e.isMeta) continue;
    const content = e.message?.content;
    if (e.type === "user") {
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === "tool_result") {
            const tool = tools.get(b.tool_use_id);
            if (tool) { tool.result = textOf(b.content); tool.error = Boolean(b.is_error); }
          }
        }
      }
      const text = textOf(content);
      if (isHumanText(text) && !(Array.isArray(content) && content.every((b) => b?.type === "tool_result"))) {
        const board = /^\[crew board, ([^\]]+)\]\s*/.exec(text);
        items.push({ kind: "you", id: e.uuid, ts: e.timestamp, text: board ? text.slice(board[0].length) : text, via: board ? board[1] : null });
        lastText = -1; afterStopHook = -1;
      }
      continue;
    }
    // Claude spoke again after a stop hook: the earlier reply was a draft.
    if (afterStopHook >= 0 && (Array.isArray(content) ? content : []).some((b) => b?.type === "text" || b?.type === "tool_use")) {
      if (items[afterStopHook]?.kind === "claude") items[afterStopHook].draft = true;
      afterStopHook = -1;
    }
    for (const b of Array.isArray(content) ? content : []) {
      if (b?.type === "text" && b.text?.trim()) {
        const last = items[items.length - 1];
        // Streamed replies arrive as several records of one message: join them.
        if (last?.kind === "claude" && last.msg === e.message?.id) last.text += `\n\n${b.text}`;
        else items.push({ kind: "claude", id: `${e.uuid}-${items.length}`, msg: e.message?.id, ts: e.timestamp, text: b.text });
        lastText = items.length - 1;
      } else if (b?.type === "tool_use") {
        const tool = { kind: "tool", id: b.id, ts: e.timestamp, name: b.name, input: b.input, summary: toolSummary(b.name, b.input), result: null, error: false };
        tools.set(b.id, tool);
        items.push(tool);
      }
    }
  }
  return items.slice(-MAX_ITEMS);
}

const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n)}\n... (${s.length - n} more characters)` : s ?? "");

export default class ClaudeChat extends View {
  init(_props, cx) {
    this.wanted = props()?.terminal ?? "";
    this.session = null;
    this.items = [];
    this.mtime = null;
    this.open = new Set();
    this.scroll = ScrollHandle.new();
    this.input = InputState.new({ value: "", placeholder: "Message Claude..." });
    this.text = "";
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.send(cx));
    this.load(cx);
    cx.timer.every(POLL_MS, (cx) => this.load(cx));
  }

  load(cx) {
    cx.spawn(async (cx) => {
      const pick = await exec("sh", ["-c", PICK, "pick", STATE(), this.wanted], { timeout: 10000 }).catch(() => null);
      let s = null; try { s = pick?.stdout?.trim() ? JSON.parse(pick.stdout) : null; } catch (_) { s = null; }
      const changedSession = s?.transcript !== this.session?.transcript;
      this.session = s;
      if (!s?.transcript) { this.items = []; cx.notify(); return; }
      const r = await exec("sh", ["-c", TAIL, "tail", s.transcript, String(TAIL_LINES)], { timeout: 15000 }).catch(() => null);
      const out = r?.stdout ?? "";
      const nl = out.indexOf("\n");
      const mtime = out.slice(0, nl);
      if (mtime === this.mtime && !changedSession) { cx.notify(); return; }
      this.mtime = mtime;
      const before = this.items.length;
      this.items = parse(out.slice(nl + 1).split("\n"));
      if (this.items.length !== before) this.scroll.scroll_to_item(this.items.length - 1);
      cx.notify();
    });
  }

  send(cx) {
    const text = this.text.trim();
    const term = this.session?.terminal;
    if (!text || !term) return;
    hc(["send", term, text]).then((r) => {
      if (r.code !== 0) notify({ title: "Could not reach Claude", body: (r.stderr || "hc send failed").slice(0, 200), level: "error" });
    }).catch(() => notify({ title: "Could not reach Claude", body: "hc send failed", level: "error" }));
    this.text = "";
    this.input.set_value("");
    cx.notify();
  }

  live() {
    const term = this.session?.terminal;
    try { return Boolean(term) && terminals().some((x) => x.address === term && x.state === "live"); } catch (_) { return false; }
  }

  render(cx) {
    const t = theme(), s = this.session;
    const live = this.live();
    const state = !s ? "none" : !live ? "gone" : s.state;
    const STATUS = {
      working: ["Working", t.working], idle: ["Idle", t.dim], blocked: ["Needs you in the terminal", t.blocked],
      gone: ["Session ended", t.blocked], none: ["No session", t.dim],
    };
    const [label, color] = STATUS[state] ?? [state, t.dim];
    const where = (s?.cwd ?? "").split("/").pop();

    const header = h_flex().px(16).h(44).flex_none().gap(10).items_center().border_b(1).border_color(t.border).bg(t.chrome)
      .child(div().font_semibold().text_size(14).child("Claude"))
      .child(div().text_color(t.dim).truncate().child(where))
      .child(div().flex_1())
      .child(h_flex().gap(6).items_center()
        .child(div().w(8).h(8).rounded(4).bg(color).flex_none()
          .when(state === "working", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1200 })))
        .child(div().text_color(color).text_size(12).child(label)))
      .when(Boolean(s?.terminal), (el) => el.child(div().id("chat-term").px(8).py(3).rounded(6).text_size(12).text_color(t.muted)
        .hover((st) => st.bg(t.hover).text_color(t.foreground))
        .on_click(() => run("agent.focus", { terminal: s.terminal })).child("Terminal")));

    const body = !s
      ? div().p(20).text_color(t.dim).child("No Claude session found. Start Claude Code in a Herdr tab; the chat appears after its first action.")
      : v_flex().id("chat-scroll").flex_1().min_h(0).px(16).py(12).gap(10).overflow_y_scrollbar().track_scroll(this.scroll)
          .children(this.items.map((it) => this.item(it, t)));

    const working = state === "working" && Boolean(s?.doing);
    const composer = v_flex().px(16).py(10).gap(6).flex_none().border_t(1).border_color(t.border).bg(t.chrome)
      .when(working, (el) => el.child(h_flex().gap(6).items_center().text_size(12).text_color(t.muted)
        .child(div().w(6).h(6).rounded(3).bg(t.working).flex_none().loop("opacity", { from: 0.35, to: 1, period: 1200 }))
        .child(div().flex_1().min_w(0).truncate().child(s.doing))
        .when((s.agents ?? []).length > 0, (e) => e.child(div().text_color(t.dim).child(`${s.agents.length} subagent${s.agents.length === 1 ? "" : "s"} out`)))))
      .when(state === "blocked", (el) => el.child(div().text_size(12).text_color(t.blocked)
        .child("Claude is waiting on a prompt only the terminal can show. Open the terminal to answer it.")))
      .child(h_flex().gap(8).items_center()
        .child(Input.new(this.input).flex_1().min_w(0).h(36).px(10).rounded(9).border_1().border_color(t.input).bg(t.background).text_size(13))
        .child(h_flex().id("chat-send").h(36).px(16).items_center().rounded(9)
          .bg(this.text.trim() && live ? t.solid : t.raised).text_color(this.text.trim() && live ? t.solid_foreground : t.dim)
          .cursor_pointer().on_click((_e, cx) => this.send(cx)).child("Send")));

    return v_flex().id("claude-chat").size_full().bg(t.surface).text_color(t.foreground).text_size(13)
      .child(header).child(body).when(Boolean(s), (el) => el.child(composer));
  }

  item(it, t) {
    if (it.kind === "you") {
      return h_flex().id(`m-${it.id}`).justify_end()
        .child(v_flex().max_w(560).gap(2).px(12).py(8).rounded(12).bg(t.raised)
          .when(Boolean(it.via), (el) => el.child(div().text_size(10).text_color(t.dim).child(`via crew board · ${it.via}`)))
          .child(div().child(it.text)));
    }
    if (it.kind === "claude" && it.draft) {
      const open = this.open.has(it.id);
      return v_flex().id(`m-${it.id}`).gap(4)
        .child(h_flex().id(`draft-${it.id}`).gap(6).items_center().cursor_pointer().text_size(11).text_color(t.dim)
          .on_click((_e, cx) => { open ? this.open.delete(it.id) : this.open.add(it.id); cx.notify(); })
          .child(div().child(open ? "▾" : "▸"))
          .child(div().child("Earlier draft, replaced after a stop hook")))
        .when(open, (el) => el.child(div().pl(14).opacity(0.6).child(TextView.markdown(`md-${it.id}`, it.text))));
    }
    if (it.kind === "claude") {
      return v_flex().id(`m-${it.id}`).gap(2)
        .child(TextView.markdown(`md-${it.id}`, it.text));
    }
    // A tool call: one line, open for its input and result.
    const open = this.open.has(it.id);
    const pending = it.result === null;
    return v_flex().id(`tool-${it.id}`).rounded(8).bg(open ? t.background : t.surface)
      .child(h_flex().id(`toolh-${it.id}`).px(8).py(4).gap(8).items_center().rounded(8).cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { open ? this.open.delete(it.id) : this.open.add(it.id); cx.notify(); })
        .child(div().text_color(t.dim).text_size(11).child(open ? "▾" : "▸"))
        .child(div().font_semibold().text_size(12).text_color(it.error ? t.blocked : t.muted).child(it.name))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(it.summary))
        .when(pending, (el) => el.child(div().w(6).h(6).rounded(3).bg(t.working).loop("opacity", { from: 0.35, to: 1, period: 1200 }))))
      .when(open, (el) => el.child(v_flex().px(10).pb(8).gap(6)
        .child(div().text_size(11).text_color(t.dim).child("Input"))
        .child(div().font_family("monospace").text_size(11).child(clip(JSON.stringify(it.input, null, 2), 3000)))
        .when(!pending, (e) => e
          .child(div().text_size(11).text_color(t.dim).child(it.error ? "Error" : "Result"))
          .child(div().font_family("monospace").text_size(11).text_color(it.error ? t.blocked : t.foreground).child(clip(it.result, 4000))))));
  }
}

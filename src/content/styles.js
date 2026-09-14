/* CleanRead — CSS của vùng đọc.
 * Để dạng chuỗi trong JS để nhét thẳng vào shadow DOM: không phải fetch tài
 * nguyên (tránh CSP của trang), và không bị CSS của trang gốc đè lên. */

var CLEANREAD_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

.cr-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--cr-paper);
  color: var(--cr-ink);
  font-family: var(--cr-ui-font);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  color-scheme: normal;
}

.cr-root ::selection { background: var(--cr-mark); }

/* ---------- thanh công cụ ---------- */

.cr-bar {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 14px 0 18px;
  background: var(--cr-bar);
  backdrop-filter: saturate(1.4) blur(12px);
  -webkit-backdrop-filter: saturate(1.4) blur(12px);
  border-bottom: 1px solid var(--cr-rule);
}

.cr-source {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 12.5px;
  color: var(--cr-muted);
}

.cr-source b {
  font-weight: 600;
  color: var(--cr-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cr-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 1 auto;
  max-width: 72vw;
  overflow-x: auto;
  scrollbar-width: none;
}
.cr-actions::-webkit-scrollbar { display: none; }

.cr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  min-width: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--cr-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.cr-btn:hover { background: var(--cr-mark); color: var(--cr-ink); }
.cr-btn[aria-expanded="true"] { background: var(--cr-mark); color: var(--cr-ink); }
.cr-btn:focus-visible { outline: 2px solid var(--cr-accent); outline-offset: 2px; }
.cr-btn svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.cr-btn-type { font-family: var(--cr-body-font); font-size: 15px; letter-spacing: 0.01em; }
.cr-btn-mark, .cr-btn-underline, .cr-btn-italic, .cr-btn-bold { font-family: Georgia, "Times New Roman", serif; font-size: 16px; }
.cr-btn-mark { text-decoration: underline; text-decoration-color: var(--cr-accent); text-decoration-thickness: 4px; text-underline-offset: -2px; }
.cr-btn-underline { text-decoration: underline; }
.cr-btn-italic { font-style: italic; }
.cr-btn-bold { font-weight: 700; }

.cr-progress {
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  width: 0;
  background: var(--cr-accent);
  transition: width 80ms linear;
}

/* ---------- bảng tuỳ chỉnh ---------- */

.cr-panel {
  position: absolute;
  top: 52px;
  right: 12px;
  z-index: 3;
  width: 268px;
  padding: 14px 16px 16px;
  border: 1px solid var(--cr-rule);
  border-radius: 12px;
  background: var(--cr-paper);
  box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.45);
  display: none;
}

.cr-panel[data-open="true"] { display: block; }

.cr-row { margin-top: 14px; }
.cr-row:first-child { margin-top: 0; }

.cr-row > span {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  color: var(--cr-muted);
}

.cr-seg { display: flex; gap: 6px; }

.cr-chip {
  flex: 1 1 0;
  height: 34px;
  border: 1px solid var(--cr-rule);
  border-radius: 8px;
  background: transparent;
  color: var(--cr-ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.cr-chip[aria-pressed="true"] {
  border-color: var(--cr-accent);
  box-shadow: inset 0 0 0 1px var(--cr-accent);
  color: var(--cr-accent);
}

.cr-chip:focus-visible { outline: 2px solid var(--cr-accent); outline-offset: 2px; }
.cr-chip-serif { font-family: Georgia, "Times New Roman", serif; }

.cr-range { width: 100%; accent-color: var(--cr-accent); }
.cr-range:focus-visible { outline: 2px solid var(--cr-accent); outline-offset: 3px; }

.cr-check {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  cursor: pointer;
}

.cr-check input { accent-color: var(--cr-accent); width: 15px; height: 15px; }

/* ---------- vùng chữ ---------- */

.cr-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: auto;
}

.cr-article {
  max-width: var(--cr-measure);
  margin: 0 auto;
  padding: 56px 24px 45vh;
  font-family: var(--cr-body-font);
  font-size: var(--cr-size);
  line-height: var(--cr-leading);
  text-align: left;
  hyphens: auto;
}

.cr-head { margin-bottom: 34px; }

.cr-title {
  margin: 0;
  font-size: calc(var(--cr-size) * 1.95);
  line-height: 1.14;
  font-weight: 600;
  letter-spacing: -0.012em;
  text-wrap: balance;
}

.cr-meta {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cr-rule);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-family: var(--cr-ui-font);
  font-size: 12.5px;
  color: var(--cr-muted);
}

.cr-body > *:first-child { margin-top: 0; }
.cr-body p, .cr-body li { margin: 0 0 1.05em; }
.cr-body li { margin-bottom: 0.45em; }
.cr-body ul, .cr-body ol { margin: 0 0 1.05em; padding-left: 1.4em; }
.cr-body h1, .cr-body h2, .cr-body h3, .cr-body h4 {
  margin: 1.9em 0 0.6em;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.008em;
}
.cr-body h1, .cr-body h2 { font-size: calc(var(--cr-size) * 1.32); }
.cr-body h3, .cr-body h4 { font-size: calc(var(--cr-size) * 1.1); }

.cr-body a { color: var(--cr-accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.cr-body a:hover { background: var(--cr-mark); }

.cr-annotation { border-radius: 2px; }
.cr-highlight { background: var(--cr-mark); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.cr-underline { text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 0.14em; }
.cr-italic { font-style: italic; }
.cr-bold { font-weight: 700; }
.cr-note { text-decoration: underline wavy var(--cr-accent); text-decoration-thickness: 1px; text-underline-offset: 0.18em; cursor: help; }

.cr-note-editor {
  position: absolute;
  right: 18px;
  bottom: 22px;
  z-index: 4;
  width: min(340px, calc(100% - 36px));
  padding: 12px;
  border: 1px solid var(--cr-rule);
  border-radius: 10px;
  background: var(--cr-paper);
  box-shadow: 0 16px 38px -18px rgba(0, 0, 0, 0.5);
}
.cr-note-editor textarea {
  display: block;
  width: 100%;
  min-height: 68px;
  resize: vertical;
  border: 1px solid var(--cr-rule);
  border-radius: 7px;
  padding: 8px 9px;
  background: transparent;
  color: var(--cr-ink);
  font: 13px/1.45 var(--cr-ui-font);
}
.cr-note-editor textarea:focus { outline: 2px solid var(--cr-accent); outline-offset: 1px; }
.cr-note-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 9px; }
.cr-note-actions button { border: 0; border-radius: 6px; padding: 6px 10px; font: 12px var(--cr-ui-font); cursor: pointer; }
.cr-note-cancel { background: transparent; color: var(--cr-muted); }
.cr-note-save { background: var(--cr-accent); color: var(--cr-paper); }

.cr-body img, .cr-body video, .cr-body svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.6em auto;
  border-radius: 3px;
}

.cr-body figure { margin: 1.6em 0; }
.cr-body figure img { margin: 0 auto 0.6em; }
.cr-body figcaption {
  font-family: var(--cr-ui-font);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--cr-muted);
  text-align: left;
}

.cr-body blockquote {
  margin: 1.5em 0;
  padding-left: 1.1em;
  border-left: 2px solid var(--cr-accent);
  color: var(--cr-muted);
}

.cr-body pre {
  margin: 1.5em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid var(--cr-rule);
  border-radius: 8px;
  font-size: calc(var(--cr-size) * 0.8);
  line-height: 1.55;
}

.cr-body code, .cr-body pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.cr-body p > code { font-size: 0.86em; padding: 0.12em 0.35em; border-radius: 4px; background: var(--cr-mark); }

.cr-body table {
  width: 100%;
  margin: 1.5em 0;
  border-collapse: collapse;
  font-size: calc(var(--cr-size) * 0.88);
}
.cr-body th, .cr-body td { padding: 8px 10px; border: 1px solid var(--cr-rule); text-align: left; }

.cr-body hr { margin: 2.2em 0; border: 0; border-top: 1px solid var(--cr-rule); }

.cr-root[data-images="off"] .cr-body img,
.cr-root[data-images="off"] .cr-body figure,
.cr-root[data-images="off"] .cr-body video { display: none; }

/* ---------- trạng thái rỗng & thông báo ---------- */

.cr-empty {
  max-width: 420px;
  margin: 18vh auto 0;
  padding: 0 24px;
  text-align: left;
}
.cr-empty h2 { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
.cr-empty p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--cr-muted); }

.cr-toast {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  padding: 9px 15px;
  border-radius: 999px;
  background: var(--cr-ink);
  color: var(--cr-paper);
  font-size: 13px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}
.cr-toast[data-show="true"] { opacity: 1; }

@media (max-width: 600px) {
  .cr-article { padding: 34px 20px 45vh; }
  .cr-panel { right: 8px; left: 8px; width: auto; }
  .cr-source b { max-width: 40vw; }
}

@media (prefers-reduced-motion: reduce) {
  .cr-progress, .cr-toast, .cr-btn { transition: none; }
}

@media print {
  .cr-root { position: static; height: auto; background: #fff; color: #000; }
  .cr-bar, .cr-panel, .cr-toast { display: none !important; }
  .cr-scroll { overflow: visible; height: auto; }
  .cr-article { max-width: none; padding: 0; font-size: 12pt; }
  .cr-body a { color: #000; }
}
`;

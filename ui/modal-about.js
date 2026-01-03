// /ui/modal-about.js
import { eventBus } from "../core/event-bus.js";
import { openModal } from "./modal-service.js";

/**
 * Google Play: external donation links/buttons are risky (Payments policy).
 * Поэтому для Play-сборки держи DONATIONS_ENABLED = false.
 */
const DONATIONS_ENABLED = false; // <-- ДЛЯ GOOGLE PLAY: false
const DONATE_URL = "https://supporttabharbor.alevito.es"; // для сайта/десктопа

function openExternal(url) {
  // Electron-бридж (если позже добавишь): shell.openExternal на стороне main
  if (window.desktop?.platform?.openExternal) {
    return window.desktop.platform.openExternal(url);
  }

  // Capacitor Browser (кастомная вкладка с крестиком)
  const capBrowser = window.Capacitor?.Plugins?.Browser;
  if (capBrowser?.open) return capBrowser.open({ url });

  // Web fallback
  window.open(url, "_blank", "noopener,noreferrer");
}

export function initAboutModal() {
  eventBus.on("ui:about:open", () => {
    const baseHTML = `
      <div class="about-content">
        <p><strong>Tab Harbor</strong>: Link & Smart Tools</p>
        <p>Author: <em>Angevicka Bond Lab</em></p>
        <p>Version: 2.0.0</p>
      </div>
    `;

    const donateBlockHTML = DONATIONS_ENABLED
      ? `
        <hr style="border:none;border-top:1px solid var(--border); margin: 14px 0; opacity:.7;" />

        <div class="about-donate-row">
          <button class="about-donate-btn" type="button" data-act="donate" aria-label="Support / Donate">
            <span class="donut" aria-hidden="true">🍩</span>
          </button>

          <div class="about-donate-text">
            <p style="margin:0 0 10px; opacity:.9;">
              If you’d like to support the project, you can leave a voluntary tip via the donut button
              (and keep a very work-immersed author properly fed
              <img class="inline-emoji" src="./assets/icons/kolobok-dev.png" alt="" />).
            </p>

            <p style="margin:0; opacity:.9;">
              Donations are optional and do not affect the current functionality.
            </p>
          </div>
        </div>
      `
      : "";

    const bodyHTML = `
      <div class="modal-buttons-group" style="justify-content:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
        <button class="btn" type="button" data-scroll="#about-guide">Quick guide</button>
        <button class="btn" type="button" data-scroll="#about-what">What you can do</button>
        <button class="btn" type="button" data-scroll="#about-hotkeys">Hotkeys (desktop)</button>
      </div>

      <section id="about-guide" class="about-block guide">
        <h3 style="margin:0 0 8px;">Quick guide</h3>
        <ul style="margin:0; padding-left: 18px; line-height:1.45;">
          <li><b>Quick Add (header input)</b>: paste a URL (or <code>Title | URL</code>) and press <b>Enter</b> or click <b>+</b>.</li>
          <li><b>Choose destination</b>: use the <b>To: …</b> button to select where the new link goes (Inbox / a page / a section).</li>
          <li><b>Search</b>: press <b>/</b> to focus Search. Use the <b>×</b> button to clear the query.</li>
          <li>
            <b>Save workspaces</b>: use <b>Save</b> / <b>Save As…</b> to store your workspace under a name.
            The status bar shows the current workspace name and a small dot that changes when there are unsaved changes.
          </li>
          <li>
            <b>Demo template</b>: in <b>Settings</b> → <b>Load demo template</b> resets data to the clean demo.
            To keep your edits, use <b>Save As…</b> and open that workspace later via <b>Open</b>.
          </li>
          <li>
            <b>Archive (Snapshots)</b>: create manual “checkpoints” of your workspace.
            Unlike <b>Deletion History</b>, snapshots are meant for long-term keeping (no 30-day auto cleanup).
          </li>
          <li>
            <b>Trash / Deletion History</b>: deleted pages/sections/buttons can be restored.
            If the original parent is missing, the restore policy from Settings is used.
          </li>
          <li><b>Auto cleanup</b>: items older than <b>30 days</b> are removed from Deletion History automatically.</li>
        </ul>
      </section>

      <hr style="border:none;border-top:1px solid var(--border); margin: 14px 0; opacity:.7;" />

      <section id="about-what" class="about-block what">
        <h3 style="margin:0 0 8px;">What you can do</h3>
        <ul style="margin:0; padding-left: 18px; line-height:1.45;">
          <li>Create pages → sections → buttons (links), rename and reorder them (drag & drop).</li>
          <li><b>Drag & drop</b> currently works on <b>desktop</b>; mobile support is planned in a next update.</li>
          <li>Quickly add new links from the header with destination picker.</li>
          <li>Search by title/URL and open results instantly.</li>
          <li>Export/Import JSON for backups and moving data between devices (manual sync for now).</li>
          <li>Restore deleted items from Deletion History.</li>
        </ul>

        <hr style="border:none;border-top:1px solid var(--border); margin: 14px 0; opacity:.7;" />

        <p style="margin:0 0 10px; opacity:.95; line-height:1.45;">
          <b>Tab Harbor is the free edition.</b>
          Pro ideas include a “gentle” all-in-one planner that fights distraction, forgetfulness,
          and the “I’ll do it later” mood (…well, it does its best ❤️),
          a multi-format book reader with tools for notes &amp; quotes (plus an author mode),
          and a visual mind/project map (for code, marketing, a book — anything).
        </p>

        <p style="margin:0; opacity:.85; font-size:13px; line-height:1.45;">
          Pro is planned for later (please don’t rush the author 😄).
          My main “bug” is having too many exciting ideas at the same time — I have to ship them one by one.
          It will add extra tools and quality-of-life features, including <b>cross-device sync</b>.
        </p>

        ${donateBlockHTML}
      </section>

      <hr style="border:none;border-top:1px solid var(--border); margin: 14px 0; opacity:.7;" />

      <section id="about-hotkeys" class="about-block hotkeys">
        <h3 class="hotkeys-title">Keyboard Shortcuts (desktop)</h3>
        <table class="hotkeys-table" role="table" aria-label="Keyboard Shortcuts">
          <tbody>
            <tr><td><kbd>Alt</kbd> + <kbd>←</kbd>/<kbd>→</kbd></td><td>Switch page</td></tr>
            <tr><td><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd></td><td>Reorder page</td></tr>
            <tr><td><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>N</kbd></td><td>New section</td></tr>
            <tr><td><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd></td><td>Focus Quick Add</td></tr>
            <tr><td><kbd>/</kbd></td><td>Focus Search</td></tr>
            <tr><td><kbd>Enter</kbd></td><td>Confirm (modals, rename, Quick Add)</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Cancel / close modal</td></tr>
            <tr><td><kbd>Alt</kbd> + <kbd>T</kbd></td><td>Cycle theme</td></tr>
            <tr><td><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>P</kbd></td><td>Go to page (focus "Go to…")</td></tr>
          </tbody>
        </table>
        <p class="hotkeys-note">Tip: Hotkeys don’t work while typing in inputs.</p>
      </section>
    `;

    openModal({
      title: "About Tab Harbor",
      bodyHTML: baseHTML + bodyHTML,
      showFooter: true,
    });

    const overlay = document.querySelector(".modal-overlay:last-of-type");
    const modal = overlay?.querySelector(".modal");
    const root = modal || overlay || document;

    // scroll buttons
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-scroll]");
      if (!btn) return;
      const sel = btn.getAttribute("data-scroll");
      const target = root.querySelector(sel);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // donate button (only when enabled)
    if (DONATIONS_ENABLED) {
      root
        .querySelector('[data-act="donate"]')
        ?.addEventListener("click", () => {
          const url = (DONATE_URL || "").trim();
          if (!url) {
            eventBus.emit("ui:toast", {
              type: "info",
              message: "Donate link is not set yet.",
            });
            return;
          }
          openExternal(url);
        });
    }
  });
}

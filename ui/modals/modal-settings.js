// web/ui/modals/modal-settings.js

import { eventBus } from "../../core/event-bus.js";
import { config } from "../../core/config.js";
import { storage } from "../../core/storage.js";
import { applyTheme, getTheme } from "../../core/theme.js";
import { openModal } from "../modal-service.js";

import {
  applyDemoTemplate,
  bypassTemplateChooserOnce,
} from "./modal-template-chooser.js";

let currentModal = null;

function openSettingsModal() {
  const curTheme = getTheme();
  const restorePolicy = config.get("restorePolicy") || "ask";

  const bodyHTML = `
  <div class="settings-groups">
    <section class="settings-group modal-group" aria-label="Theme">
      <h3>Theme</h3>

      <label><input type="radio" name="theme" value="system" ${
        curTheme === "system" ? "checked" : ""
      }/> System</label>
      <label><input type="radio" name="theme" value="light"  ${
        curTheme === "light" ? "checked" : ""
      }/> Light</label>
      <label><input type="radio" name="theme" value="sea"    ${
        curTheme === "sea" ? "checked" : ""
      }/> Sea</label>
      <label><input type="radio" name="theme" value="dark"   ${
        curTheme === "dark" ? "checked" : ""
      }/> Dark</label>
    </section>

    <section class="settings-group modal-group" aria-label="Restore policy">
      <h3>Restore policy (when parent container is missing)</h3>

      <label><input type="radio" name="restorePolicy" value="ask"      ${
        restorePolicy === "ask" ? "checked" : ""
      }/> Ask every time</label>
      <label><input type="radio" name="restorePolicy" value="recreate" ${
        restorePolicy === "recreate" ? "checked" : ""
      }/> Recreate parents</label>
      <label><input type="radio" name="restorePolicy" value="restored" ${
        restorePolicy === "restored" ? "checked" : ""
      }/> Send to “Restored”</label>
    </section>
  </div>


   <div class="settings-group" style="margin-top:12px">
  <h3>Start</h3>

  <label class="settings-row" style="display:flex; align-items:center; gap:10px; margin:8px 0 10px;">
    <input id="setShowWelcome" type="checkbox">
    <span>Show Welcome window on startup</span>
  </label>

  <div class="modal-actions" style="margin-top:10px; justify-content:flex-start;">
    <button class="btn cancel" id="btnLoadDemo" type="button">
      Load demo template
    </button>
  </div>

  <div style="opacity:.75; font-size:12px; margin-top:8px;">
    Demo will replace your current workspace data.
  </div>
</div>


    <div class="modal-actions" style="margin-top:16px">
      <button class="btn save" id="settingsSaveBtn">Save</button>
      <button class="btn delete" id="settingsResetBtn" title="Reset all data to defaults">Reset data</button>
      <button class="btn cancel" id="settingsCancelBtn">Cancel</button>
    </div>
  `;

  currentModal = openModal({
    title: "Settings",
    bodyHTML,
    onClose: () => (currentModal = null),
  });

  // ВАЖНО: root нужен, чтобы не падало на root.querySelector(...)
  const root =
    document.querySelector(".modal:last-of-type") ||
    document.querySelector(".modal-overlay:last-of-type") ||
    document.body;

  // --- Start: checkbox ---
  const showWelcomeEl = root.querySelector("#setShowWelcome");
  if (showWelcomeEl) {
    // В config хранится skipTemplateChooser: true => НЕ показывать welcome
    const skip = !!config.data?.onboarding?.skipTemplateChooser;
    showWelcomeEl.checked = !skip;

    showWelcomeEl.addEventListener("change", () => {
      config.data.onboarding = config.data.onboarding || {};
      config.data.onboarding.skipTemplateChooser = !showWelcomeEl.checked;
      config.save();
    });
  }

  // --- Start: Load demo (через confirm-модалку твоей системы) ---
  const demoBtn = root.querySelector("#btnLoadDemo");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      eventBus.emit("modal:confirm:open", {
        title: "Load demo template?",
        message: "This will replace your current workspace data.",
        confirmText: "Load demo",
        cancelText: "Cancel",
        onConfirm: async () => {
          await applyDemoTemplate();
          bypassTemplateChooserOnce(); // чтобы после reload welcome не вылез сразу же
          currentModal?.close();
          location.reload();
        },
      });
    });
  }

  // --- Save (theme + restore policy) ---
  root.querySelector("#settingsSaveBtn")?.addEventListener("click", () => {
    const themeEl = /** @type {HTMLInputElement|null} */ (
      root.querySelector('input[name="theme"]:checked')
    );
    const rpEl = /** @type {HTMLInputElement|null} */ (
      root.querySelector('input[name="restorePolicy"]:checked')
    );

    const nextTheme = themeEl?.value || "system";
    applyTheme(nextTheme);

    const nextPolicy = rpEl?.value || "ask";
    config.set("restorePolicy", nextPolicy);

    eventBus.emit("ui:toast", { type: "success", message: "Settings saved" });
    currentModal?.close();
  });

  // --- Cancel ---
  root.querySelector("#settingsCancelBtn")?.addEventListener("click", () => {
    currentModal?.close();
  });

  // --- Reset data ---
  root.querySelector("#settingsResetBtn")?.addEventListener("click", () => {
    eventBus.emit("modal:confirm:open", {
      title: "Reset data?",
      message: "All pages, sections and buttons will be reset to defaults.",
      confirmText: "Reset",
      cancelText: "Cancel",
      onConfirm: () => {
        storage.reset();
        eventBus.emit("ui:toast", { type: "info", message: "Data reset" });
        currentModal?.close();
      },
    });
  });
}

export function initSettingsModal() {
  eventBus.on("ui:settings:open", openSettingsModal);
  console.log("✅ Settings Modal initialized");
}

// web/ui/modals/modal-template-chooser.view.js

export function templateChooserHTML({ lastSessionAvailable = false } = {}) {
  const lastDisabled = lastSessionAvailable
    ? ""
    : "disabled aria-disabled='true'";

  return `
    <div class="welcome-start" role="dialog" aria-label="Welcome">
      <div class="welcome-start__panel">
        <div class="welcome-start__inner">
  
        <div class="welcome-start__brand">
          <img class="welcome-start__brandIcon"
               src="./assets/brand/tab-harbor-logo-glass-wrapped.svg"
               alt="" aria-hidden="true">
          <div class="welcome-start__brandText">
            <div class="welcome-start__brandName">Tab Harbor</div>
            <div class="welcome-start__brandTag">Link &amp; Smart Tools</div>
          </div>
        </div>
  
        <div class="welcome-start__content">
          <div class="welcome-start__title">Choose how to start:</div>
  
          <div class="welcome-start__actions">
            <button class="welcome-start__btn" data-choice="demo">Use Demo Template</button>
            <button class="welcome-start__btn" data-choice="empty">Start empty</button>
            <button class="welcome-start__btn" data-choice="last" ${lastDisabled}>Open last session</button>
          </div>
        </div>
  
        <div class="welcome-start__footer">
          <label class="welcome-start__toggle">
            <input type="checkbox" id="tplSkip">
            <span>Don't show this again.</span>
          </label>
          <div class="welcome-start__hint">You can reopen this later in Settings.</div>
        </div>
            </div>
      </div>
    </div>
    `;
}

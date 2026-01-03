// ui/header.view.js
export function headerHTML() {
  return `
    <div class="header-inner">
      <div class="header-left">
        <!-- кебаб (левая панель "Study/Planner")
        <button class="icon-btn kebab-left"
                data-action="study-toggle"
                title="Calendar / Tasks"
                aria-label="Calendar / Tasks">⋮</button> -->
  
        <!-- логотип/о программе -->
        <button class="logo-btn" title="О приложении">
          <!-- light (без фона) -->
  <img class="app-logo app-logo--light"
       src="./assets/icons/icon.png"
       alt="Tab Harbor" />

  <!-- dark (с фоном) -->
  <img class="app-logo app-logo--dark"
       src="./assets/icons/icon.png"
       alt="" aria-hidden="true" />

  <!-- sea (потом перекрашенный) -->
  <img class="app-logo app-logo--sea"
       src="./assets/icons/icon.png"
       alt="" aria-hidden="true" />

        </button>
  
        <!-- основной SAVE -->
        <button class="icon-btn primary-save" title="Save (Ctrl/Cmd+S)" aria-label="Save">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 3v6h8V3" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 21v-7h10v7" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
  
      <div class="header-right">
        <!-- Save As… -->
        <button class="icon-btn save-as-btn" title="Save As…" aria-label="Save As">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 3v6h8V3" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="16.5" cy="18.5" r="5" fill="currentColor" opacity="0.9"/>
            <path d="M16.5 16v5M14 18.5h5" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
  
        <!-- Quick Add -->
        <div class="quick-add input-wrap">
          <input id="quickAddInput" type="text" placeholder='Paste URL or "Title | URL"' title="Quick Save" />
          <button type="button" class="input-suffix qa-go ui-plus-btn" title="Add" aria-label="Add">+</button>
        </div>
  
        <!-- Search (иконка-триггер) -->
        <button class="icon-btn search-trigger" title="Search" aria-label="Search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M20 20 L16.65 16.65" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
  
        <!-- Search (поле в шапке) -->
        <div class="search-box input-wrap">
          <input id="searchInput" type="text" placeholder="Search title or URL" />
          <button type="button" class="input-suffix search-clear" title="Clear" aria-label="Clear">✕</button>
        </div>
  
        <!-- Действия -->
        
  
        <button class="icon-btn workspaces-btn" title="Open" aria-label="Open">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 7h6l2 2h10v10H3z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M3 19l3-7h16" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
  
        <button class="icon-btn" data-action="open" title="Import..." aria-label="Import">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 21h14"/>
              <path d="M12 3v14"/>
              <path d="M8 15l4 4 4-4"/>
            </g>
          </svg>
        </button>
  
        <button class="icon-btn" data-action="export" title="Export..." aria-label="Export">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 21h14"/>
              <path d="M12 19V5"/>
              <path d="M8 9l4-4 4 4"/>
            </g>
          </svg>
        </button>

        <button class="icon-btn snapshot-btn" title="Archive (Snapshots)" aria-label="Snapshot">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 3l9 5-9 5-9-5 9-5z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M21 12l-9 5-9-5" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M21 16l-9 5-9-5" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
  
        <button class="icon-btn" data-action="history" title="Trash" aria-label="Trash">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 6h18M8 6v-2h8v2M6 6l1 14h10l1-14" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
  
        <button class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
              <circle cx="12" cy="12" r="8"/>
            </g>
          </svg>
        </button>
  
        <!-- бургер для узких экранов -->
        <button class="icon-btn burger-btn" aria-label="Menu" title="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </div>
  
    <!-- ВНЕ потока: поповеры (будут переноситься в <body> скриптом) -->
    <div class="header-burger-popover" hidden>
      <button type="button" data-act="save">
        <span class="label">Save</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 3v6h8V3" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 21v-7h10v7" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </span>
      </button>
  
      <button type="button" data-act="saveAs">
        <span class="label">Save As…</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 3v6h8V3" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M7 21v-7h6v7" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M16 14v4m-2-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
      </button>
  
      
  
      <button type="button" data-act="workspaces">
        <span class="label">Open</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 7h6l2 2h10v10H3z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M3 19l3-7h16" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
      </button>
  
      <hr/>
  
      <button type="button" data-act="open">
        <span class="label">Import…</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 21h14"/>
              <path d="M12 3v14"/>
              <path d="M8 15l4 4 4-4"/>
            </g>
          </svg>
        </span>
      </button>
  
      <button type="button" data-act="export">
        <span class="label">Export...</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 21h14"/>
              <path d="M12 19V5"/>
              <path d="M8 9l4-4 4 4"/>
            </g>
          </svg>
        </span>
      </button>

      <button type="button" data-act="snapshot">
        <span class="label">Archive</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 12l-9 5-9-5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 16l-9 5-9-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </span>
      </button>
  
      <button type="button" data-act="history">
        <span class="label">Trash</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6v-2h8v2M6 6l1 14h10l1-14" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </span>
      </button>
  
      <button type="button" data-act="settings">
        <span class="label">Settings</span>
        <span class="mi" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
              <circle cx="12" cy="12" r="8"/>
            </g>
          </svg>
        </span>
      </button>
    </div>
  
    <div class="header-search-popover" hidden>
    <div class="search-box input-wrap">

    <input
      id="searchInputMobile"
      type="text"
      placeholder="Search title or URL"
    />
    <button
      class="search-clear search-clear--mobile input-suffix"
      type="button"
      aria-label="Clear search"
    >
      ✕
    </button>
     </div>
  </div>
</div>

    `;
}

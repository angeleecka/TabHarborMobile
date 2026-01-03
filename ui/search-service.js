// ui/search-service.js
import { eventBus } from "../core/event-bus.js";
import { buildSearchIndex, searchInIndex } from "../core/search-index.js";

let currentIndex = [];
let lastQuery = "";
let lastResults = [];

function rebuildIndex() {
  currentIndex = buildSearchIndex();

  console.log("[service] index rebuilt:", currentIndex.length); // 👈
  window.__searchIndex = currentIndex; // 👈 удобный хук
  window.__eventBusRef = eventBus; // 👈 проверка одного bus

  // для отладки можно оставить:
  // console.log("🔍 index rebuilt:", currentIndex.length, "items");
}

function handleQuery({ q }) {
  const query = (q || "").trim();

  console.log("[service] query:", query); // 👈

  lastQuery = query;

  if (!query) {
    lastResults = [];
    eventBus.emit("search:results", { q: "", results: [] });
    return;
  }

  if (!currentIndex.length) {
    rebuildIndex();
  }

  const results = searchInIndex(currentIndex, query);

  console.log("[service] results:", results.length); // 👈

  lastResults = results;

  // ГЛОБАЛЬНЫЕ результаты — по всем страницам
  eventBus.emit("search:results", { q: query, results });
}

function handleClear() {
  lastQuery = "";
  lastResults = [];
  eventBus.emit("search:results", { q: "", results: [] });
}

export function initSearchService() {
  rebuildIndex();

  // Любое изменение данных → перестроить индекс
  eventBus.on("storage:updated", () => {
    rebuildIndex();
    if (lastQuery) {
      const results = searchInIndex(currentIndex, lastQuery);
      lastResults = results;
      eventBus.emit("search:results", { q: lastQuery, results });
    }
  });

  // Запросы из хедера
  eventBus.on("search:query", handleQuery);
  eventBus.on("search:clear", handleClear);

  console.log("✅ Search service initialized");
}

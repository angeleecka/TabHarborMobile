// core/search-index.js
import { storage } from "./storage.js";

// Нормализация
const norm = (s) => (s ?? "").toString().toLowerCase();

// Универсальные помощники для разношёрстных структур
const prefer = (...vals) => vals.find((v) => v != null && v !== "") ?? "";

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
};

const getPages = (data) => {
  if (!data) return [];
  if (Array.isArray(data.pages)) return data.pages;
  if (Array.isArray(data?.state?.pages)) return data.state.pages;
  // иногда страницы лежат объектом-словариём
  if (data.pages && typeof data.pages === "object")
    return Object.values(data.pages);
  return [];
};

const getSections = (page) => {
  // поддерживаем sections / items / children
  const c1 = page?.sections;
  const c2 = page?.items;
  const c3 = page?.children;
  return toArray(c1 ?? c2 ?? c3);
};

const getButtons = (section) => {
  // поддерживаем buttons / links / items / children
  const b1 = section?.buttons;
  const b2 = section?.links;
  const b3 = section?.items;
  const b4 = section?.children;
  return toArray(b1 ?? b2 ?? b3 ?? b4);
};

const getName = (node, fallback) =>
  prefer(node?.name, node?.title, node?.label, node?.text, fallback);

const getLink = (node) => prefer(node?.link, node?.href, node?.url, "");

/**
 * Строим плоский индекс по ВСЕМ страницам:
 * - записи "section"
 * - записи "button" (с линком)
 */
export function buildSearchIndex() {
  const data = storage.get();
  const pages = getPages(data);
  const index = [];

  let secCount = 0;
  let btnCount = 0;

  pages.forEach((page, pageIndex) => {
    const pageName = getName(page, `Page ${pageIndex + 1}`);
    const sections = getSections(page);

    sections.forEach((section, sectionIndex) => {
      const sectionName = getName(section, `Section ${sectionIndex + 1}`);
      const basePath = `${pageName} / ${sectionName}`;

      // запись для секции
      index.push({
        type: "section",
        pageIndex,
        sectionIndex,
        buttonIndex: null,
        pageId: page?.id,
        sectionId: section?.id,
        buttonId: null,
        title: sectionName,
        path: basePath,
        link: "",
        _haystack: norm(`${pageName} ${sectionName}`),
      });
      secCount++;

      const buttons = getButtons(section);
      buttons.forEach((btn, buttonIndex) => {
        const btnTitle = getName(btn, `Link ${buttonIndex + 1}`);
        const href = getLink(btn);

        index.push({
          type: "button",
          pageIndex,
          sectionIndex,
          buttonIndex,
          pageId: page?.id,
          sectionId: section?.id,
          buttonId: btn?.id,
          title: btnTitle,
          path: `${basePath} / ${btnTitle}`,
          link: href,
          _haystack: norm(`${pageName} ${sectionName} ${btnTitle} ${href}`),
        });
        btnCount++;
      });
    });
  });

  // дебаг-хуки
  if (typeof window !== "undefined") {
    window.__searchIndex = index;
    window.__searchStats = {
      pages: pages.length,
      sections: secCount,
      buttons: btnCount,
    };
  }

  return index;
}

/**
 * Поиск по индексу (substring match)
 */
export function searchInIndex(index, query, limit = 100) {
  const q = norm(query);
  if (!q) return [];

  const out = [];
  for (const item of index) {
    if (item?._haystack?.includes(q)) {
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}

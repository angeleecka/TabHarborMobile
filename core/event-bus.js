// core/event-bus.js

/**
 * EventBus — минимальная шина событий приложения
 * ------------------------------------------------
 * Роль: даёт publish/subscribe между модулями без прямых импортов.
 * Публичный API:
 *   - on(event, handler)      — подписка
 *   - off(event, handler)     — отписка
 *   - once(event, handler)    — одноразовая подписка
 *   - emit(event, payload?)   — опубликовать событие
 */
export const eventBus = (() => {
  const map = new Map(); // event => Set<handler>

  function on(event, handler) {
    if (!map.has(event)) map.set(event, new Set());
    map.get(event).add(handler);
  }

  function off(event, handler) {
    const set = map.get(event);
    if (set) set.delete(handler);
  }

  function once(event, handler) {
    const wrap = (payload) => {
      off(event, wrap);
      handler(payload);
    };
    on(event, wrap);
  }

  function emit(event, payload) {
    const set = map.get(event);
    if (set) for (const h of set) h(payload);
  }

  return { on, off, once, emit };
})();

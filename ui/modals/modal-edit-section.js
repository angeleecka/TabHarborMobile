// =============================================================================
// UI/MODALS/MODAL-EDIT-SECTION.JS — Модалка редактирования секции
// =============================================================================
// Что здесь:
// - Открытие модалки с данными секции
// - Поле: название секции
// - Кнопки: Save, Delete, Cancel
// - Проверка несохранённых изменений при закрытии
// - Сохранение по Enter
// =============================================================================

import { eventBus } from "../../core/event-bus.js";
import { openModal } from "../modal-service.js";

// Текущие данные редактируемой секции
let currentSectionData = null;

let currentModal = null;

function confirmDiscardIfDirty(onDiscard) {
  const isDirty = checkUnsavedChanges();
  if (!isDirty) {
    onDiscard();
    return;
  }

  eventBus.emit("modal:confirm:open", {
    title: "Discard changes?",
    message: "You have unsaved changes. Discard them?",
    confirmText: "Discard",
    cancelText: "Continue editing",
    onConfirm: () => {
      onDiscard();
    },
  });
}

// =============================================================================
// ОТКРЫТИЕ МОДАЛКИ РЕДАКТИРОВАНИЯ СЕКЦИИ
// =============================================================================
/**
 * Открыть модалку для редактирования секции
 * @param {Object} data - Данные секции
 * @param {string} data.sectionId - ID секции
 * @param {string} data.text - Текущее название секции
 */
function openEditSectionModal(data) {
  // Сохраняем данные секции для работы внутри модалки
  currentSectionData = data;

  // Создаём HTML-содержимое модалки
  const bodyHTML = `
    <div class="modal-field">
      <label for="editSectionText">Section name:</label>
      <input 
        type="text" 
        id="editSectionText" 
        placeholder="Enter section name" 
        value="${escapeHtml(data.text)}"
      />
    </div>
    
    <div class="modal-buttons-group">
      <button class="btn save" id="saveSectionBtn">Save</button>
      <button class="btn delete" id="deleteSectionBtn">Delete</button>
      <button class="btn cancel" id="cancelSectionBtn">Cancel</button>
    </div>
  `;

  // Открываем модалку через modal-service
  currentModal = openModal({
    title: "Edit Section",
    bodyHTML,
    onClose: () => {
      currentSectionData = null;
      currentModal = null;
    },
  });

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ ВНУТРИ МОДАЛКИ =====

  // Кнопка "Save"
  const saveBtn = document.getElementById("saveSectionBtn");
  saveBtn?.addEventListener("click", handleSave);

  // Кнопка "Delete"
  const deleteBtn = document.getElementById("deleteSectionBtn");
  deleteBtn?.addEventListener("click", handleDelete);

  // Кнопка "Cancel"
  const cancelBtn = document.getElementById("cancelSectionBtn");
  cancelBtn?.addEventListener("click", () => {
    confirmDiscardIfDirty(() => {
      currentModal?.close();
    });
  });

  // Сохранение по Enter в поле ввода
  const textInput = document.getElementById("editSectionText");
  textInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  });

  // Фокус на поле при открытии
  textInput?.focus();
  textInput?.select();

  // Сохраняем ссылку на модалку для закрытия через события
  eventBus.once("modal:edit-section:close", () => {
    currentModal?.close();
  });
}

// =============================================================================
// ОБРАБОТЧИК СОХРАНЕНИЯ
// =============================================================================
function handleSave() {
  const text = document.getElementById("editSectionText")?.value.trim() || "";

  // Проверка: название не может быть пустым
  if (!text) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Section name cannot be empty!",
    });
    return;
  }

  // Отправляем событие сохранения
  eventBus.emit("section:save", {
    sectionId: currentSectionData.sectionId,
    text,
  });
}

// =============================================================================
// ОБРАБОТЧИК УДАЛЕНИЯ
// =============================================================================
function handleDelete() {
  // вместо нативного confirm — наше кастомное окно подтверждения
  eventBus.emit("modal:confirm:open", {
    title: "Delete Section?",
    message:
      "Delete this section? All buttons inside will be moved to deletion history.",
    confirmText: "Delete",
    cancelText: "Cancel",
    onConfirm: () => {
      // Отправляем событие удаления ТОЛЬКО после подтверждения
      eventBus.emit("section:delete", {
        sectionId: currentSectionData.sectionId,
      });
    },
  });
}

// =============================================================================
// ПРОВЕРКА НЕСОХРАНЁННЫХ ИЗМЕНЕНИЙ
// =============================================================================
/**
 * Проверить, есть ли несохранённые изменения в поле
 * @returns {boolean} - true, если есть изменения
 */
function checkUnsavedChanges() {
  if (!currentSectionData) return false;

  const text = document.getElementById("editSectionText")?.value.trim() || "";

  return text !== currentSectionData.text;
}

// =============================================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ЭКРАНИРОВАНИЕ HTML
// =============================================================================
/**
 * Экранировать HTML-символы для безопасного вывода в атрибутах
 * @param {string} str - Строка для экранирования
 * @returns {string} - Экранированная строка
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// =============================================================================
/**
 * Инициализировать обработчики событий для модалки редактирования секции
 */
export function initEditSectionModal() {
  // Слушаем событие открытия модалки
  eventBus.on("modal:edit-section:open", openEditSectionModal);

  console.log("✅ Edit Section Modal initialized");
}

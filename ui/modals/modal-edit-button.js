// =============================================================================
// UI/MODALS/MODAL-EDIT-BUTTON.JS — Модалка редактирования кнопки-ссылки
// =============================================================================
// Что здесь:
// - Открытие модалки с данными кнопки
// - Поля: название кнопки, ссылка
// - Кнопки: Save, Delete, Cancel
// - Проверка несохранённых изменений при закрытии
// - Сохранение по Enter
// =============================================================================

import { eventBus } from "../../core/event-bus.js";
import { openModal } from "../modal-service.js";

// Текущие данные редактируемой кнопки
let currentButtonData = null;

let currentModal = null;

// Общий гейт: если есть несохранённые изменения — показываем confirm-модалку
function confirmDiscardIfDirty(onDiscard) {
  const isDirty = checkUnsavedChanges(); // ← считаем «грязность» тут
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
// ОТКРЫТИЕ МОДАЛКИ РЕДАКТИРОВАНИЯ КНОПКИ
// =============================================================================
/**
 * Открыть модалку для редактирования кнопки
 * @param {Object} data - Данные кнопки
 * @param {string} data.buttonId - ID кнопки
 * @param {string} data.sectionId - ID секции
 * @param {string} data.text - Текущее название кнопки
 * @param {string} data.href - Текущая ссылка
 */
function openEditButtonModal(data) {
  // Сохраняем данные кнопки для работы внутри модалки
  currentButtonData = data;

  // Создаём HTML-содержимое модалки
  const bodyHTML = `
    <div class="modal-field">
      <label for="editButtonText">Button name:</label>
      <input 
        type="text" 
        id="editButtonText" 
        placeholder="Enter button name" 
        value="${escapeHtml(data.text)}"
      />
    </div>
    
    <div class="modal-field">
      <label for="editButtonLink">Link (URL):</label>
      <input 
        type="text" 
        id="editButtonLink" 
        placeholder="https://example.com" 
        value="${escapeHtml(data.href)}"
      />
    </div>
    
    <div class="modal-buttons-group">
      <button class="btn save" id="saveButtonBtn">Save</button>
      <button class="btn delete" id="deleteButtonBtn">Delete</button>
      <button class="btn cancel" id="cancelButtonBtn">Cancel</button>
    </div>
  `;

  // Открываем модалку через modal-service
  currentModal = openModal({
    title: "Edit Button",
    bodyHTML,
    onClose: () => {
      currentButtonData = null;
      currentModal = null;
    },
  });

  // ===== ОБРАБОТЧИКИ СОБЫТИЙ ВНУТРИ МОДАЛКИ =====

  // Кнопка "Save"
  const saveBtn = document.getElementById("saveButtonBtn");
  saveBtn?.addEventListener("click", handleSave);

  // Кнопка "Delete"
  const deleteBtn = document.getElementById("deleteButtonBtn");
  deleteBtn?.addEventListener("click", handleDelete);

  // Кнопка "Cancel"
  const cancelBtn = document.getElementById("cancelButtonBtn");
  cancelBtn?.addEventListener("click", () => {
    confirmDiscardIfDirty(() => {
      currentModal?.close();
    });
  });

  // Сохранение по Enter в полях ввода
  const textInput = document.getElementById("editButtonText");
  const linkInput = document.getElementById("editButtonLink");

  [textInput, linkInput].forEach((input) => {
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    });
  });

  // Фокус на первое поле при открытии
  textInput?.focus();
  textInput?.select();

  // Сохраняем ссылку на модалку для закрытия через события
  eventBus.once("modal:edit-button:close", () => {
    currentModal?.close();
  });
}

// =============================================================================
// ОБРАБОТЧИК СОХРАНЕНИЯ
// =============================================================================
function handleSave() {
  const text = document.getElementById("editButtonText")?.value.trim() || "";
  const href = document.getElementById("editButtonLink")?.value.trim() || "";

  // Проверка: название не может быть пустым
  if (!text) {
    eventBus.emit("ui:toast", {
      type: "warning",
      message: "Button name cannot be empty!",
    });
    return;
  }

  // Отправляем событие сохранения
  eventBus.emit("button:save", {
    buttonId: currentButtonData.buttonId,
    sectionId: currentButtonData.sectionId,
    text,
    href,
  });
}

// =============================================================================
// ОБРАБОТЧИК УДАЛЕНИЯ
// =============================================================================
function handleDelete() {
  // вместо нативного confirm — наше кастомное окно подтверждения
  eventBus.emit("modal:confirm:open", {
    title: "Delete Button?",
    message: "Delete this button?", // при желании подставь имя: `Delete "${titleInput?.value || "this button"}"?`
    confirmText: "Delete",
    cancelText: "Cancel",
    onConfirm: () => {
      eventBus.emit("button:delete", {
        buttonId: currentButtonData.buttonId,
        sectionId: currentButtonData.sectionId,
      });
      // closeCurrentEditModal?.();
    },
  });
}

// =============================================================================
// ПРОВЕРКА НЕСОХРАНЁННЫХ ИЗМЕНЕНИЙ
// =============================================================================
/**
 * Проверить, есть ли несохранённые изменения в полях
 * @returns {boolean} - true, если есть изменения
 */
function checkUnsavedChanges() {
  if (!currentButtonData) return false;

  const text = document.getElementById("editButtonText")?.value.trim() || "";
  const href = document.getElementById("editButtonLink")?.value.trim() || "";

  return text !== currentButtonData.text || href !== currentButtonData.href;
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
 * Инициализировать обработчики событий для модалки редактирования кнопки
 */
export function initEditButtonModal() {
  // Слушаем событие открытия модалки
  eventBus.on("modal:edit-button:open", openEditButtonModal);

  console.log("✅ Edit Button Modal initialized");
}

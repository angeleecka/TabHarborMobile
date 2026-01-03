// core/app.js
import { eventBus } from "./event-bus.js";
import { initLayout } from "../ui/layout.js";

let inited = false;

export const app = {
  init() {
    if (inited) return; // ✅ уже инициализировались — выходим
    inited = true;

    console.log("🔹 Initializing Linkapp core...");
    initLayout();

    eventBus.on("storage:loaded", (data) => {
      console.log("✅ Storage loaded:", data);
      this.render(data);
    });

    eventBus.on("storage:updated", (data) => {
      console.log("💾 Storage updated:", data);
      this.render(data);
    });
  },

  render(data) {
    console.log("📦 app.render()", data);
  },
};

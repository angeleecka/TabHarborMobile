// core/config.js

export const config = {
  data: {
    language: "en",
    theme: "dark",
    viewMode: "tiles",
    autosave: true,
    onboarding: {
      skipTemplateChooser: false, // "don't show again"
      forceTemplateChooserOnce: false,
    },
  },
  load() {
    try {
      const s = localStorage.getItem("linkapp-config");
      if (s) Object.assign(this.data, JSON.parse(s));
    } catch (e) {
      console.warn("config load error", e);
    }
  },
  save() {
    try {
      localStorage.setItem("linkapp-config", JSON.stringify(this.data));
    } catch (e) {
      console.warn("config save error", e);
    }
  },
  set(key, value) {
    this.data[key] = value;
    this.save();
  },
  get(key) {
    return this.data[key];
  },
};

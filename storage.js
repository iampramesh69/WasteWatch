/* WasteWatch storage service. This file handles browser storage only.
   Later, replace this service with AWS API calls without rewriting the UI. */
(() => {
  "use strict";
  const STORAGE_KEY = "wastewatch.incidents.v1";

  window.WasteWatchStorage = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("WasteWatch could not read local demo storage.", error);
        return [];
      }
    },

    save(data, showMessage = () => {}) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error("WasteWatch could not save local demo data.", error);
        if (
          error &&
          (error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ) {
          showMessage(
            "Browser storage is full. Try a smaller photo or clear old demo records.",
          );
        } else {
          showMessage(
            "Could not save to this browser. Check storage/privacy settings.",
          );
        }
        return false;
      }
    },
  };
})();

import { api } from "../api.js";
import { $, setupNav, setupDemoButtons, reportCard, toast } from "../ui.js";
const currentUser = await setupNav();
setupDemoButtons();
const search = $("#search-reports"),
  status = $("#filter-status"),
  category = $("#filter-category");
let timer;
async function render() {
  try {
    const { reports, user } = await api.reports({
      search: search.value,
      status: status.value,
      category: category.value,
    });
    $("#reports-grid").innerHTML = reports
      .map((report) => reportCard(report, user || currentUser))
      .join("");
    $("#reports-empty").classList.toggle("hidden", reports.length > 0);
  } catch (error) {
    $("#reports-grid").innerHTML =
      `<p class="form-message error">${error.message}. Is the server running?</p>`;
  }
}
search.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(render, 180);
});
status.addEventListener("change", render);
category.addEventListener("change", render);
$("#reports-grid").addEventListener("click", async (event) => {
  const uploadButton = event.target.closest("[data-upload-cleanup-id]");
  if (uploadButton) {
    if (currentUser?.role !== "admin") {
      toast("Only an admin can update cleanup status.", true);
      return;
    }
    const id = uploadButton.dataset.uploadCleanupId;
    const input = $(`[data-cleanup-photo-id="${CSS.escape(id)}"]`);
    const file = input?.files?.[0];
    const card = uploadButton.closest(".report-card");
    const nextStatus = card.querySelector(
      `[data-status-id="${CSS.escape(id)}"]`,
    ).value;
    if (nextStatus === "Cleaned" && !file) {
      toast(
        "Choose an after-cleanup photo before marking this report Cleaned.",
        true,
      );
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast("Images must be 5 MB or smaller.", true);
      return;
    }
    const data = new FormData();
    data.append("status", nextStatus);
    if (file) data.append("cleanupPhoto", file);
    try {
      await api.updateReport(id, data);
      toast(
        nextStatus === "Cleaned"
          ? "Cleanup marked complete with proof."
          : "Report updated.",
      );
      await render();
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const id = button.dataset.deleteId;
  if (!confirm(`Delete report ${id}? This cannot be undone.`)) return;
  try {
    await api.deleteReport(id);
    toast("Report deleted.");
    await render();
  } catch (error) {
    toast(error.message, true);
  }
});
window.addEventListener("reports:changed", render);
render();

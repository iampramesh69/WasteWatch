import { api } from "../api.js";
import { $, setupNav, setupDemoButtons, reportRow, toast } from "../ui.js";
const currentUser = await setupNav();
setupDemoButtons();
if (currentUser?.role === "admin") {
  document.querySelector("h1").innerHTML =
    'Municipal admin dashboard<span class="green-dot">.</span>';
  document.querySelector(".subheading").textContent =
    "Review community reports, coordinate cleanup and verify completed work.";
  document.querySelector(".panel-heading h2").textContent =
    "Latest reports to review";
  const note = document.querySelector(".footer-note");
  if (note)
    note.textContent =
      "Admin actions are protected on the server. Upload an after-cleanup photo before marking a report Cleaned.";
} else {
  document.querySelector("h1").innerHTML =
    'Community overview<span class="green-dot">.</span>';
}
async function render() {
  try {
    const { reports } = await api.reports();
    $("#stat-total").textContent = reports.length;
    $("#stat-open").textContent = reports.filter(
      (r) => r.status !== "Cleaned",
    ).length;
    $("#stat-cleaned").textContent = reports.filter(
      (r) => r.status === "Cleaned",
    ).length;
    const groups = new Map();
    reports.forEach((r) => {
      const key = r.location.trim().toLowerCase().replace(/\s+/g, " ");
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    $("#stat-hotspots").textContent = [...groups.values()].filter(
      (n) => n >= 2,
    ).length;
    const recent = reports.slice(0, 5);
    $("#recent-list").innerHTML = recent.length
      ? recent.map(reportRow).join("")
      : '<div class="empty-state"><div class="empty-icon">♧</div><h3>No reports yet</h3><p>Create a report or load demo data to explore the app.</p><a class="btn btn-primary" href="/report.html">Create first report</a></div>';
  } catch (error) {
    $("#recent-list").innerHTML =
      `<p class="form-message error">${error.message}. Make sure you started the server with <code>npm start</code>.</p>`;
    toast(error.message, true);
  }
}
try {
  await api.health();
  $("#api-status").textContent = "API connected";
} catch {
  $("#api-status").textContent = "API offline";
}
window.addEventListener("reports:changed", render);
render();

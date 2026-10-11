import { api } from "../api.js";
import { $, setupNav, setupDemoButtons, escapeHTML, toast } from "../ui.js";
const currentUser = await setupNav();
setupDemoButtons();
function advice(group) {
  const categories = group.reports.map((r) => r.category.toLowerCase());
  if (categories.some((c) => c.includes("overflowing bin")))
    return [
      "Review bin capacity and collection frequency.",
      "An overflowing-bin report appears at this location. Ask the waste collection team to check the schedule and bin condition.",
    ];
  if (categories.some((c) => c.includes("plastic")))
    return [
      "Check nearby disposal options and signage.",
      "Plastic waste has been reported here. A clearly labelled bin and community signage may help; verify the cause on site.",
    ];
  if (categories.some((c) => c.includes("organic")))
    return [
      "Review food-waste collection arrangements.",
      "Organic waste can attract pests. Check collection timing and whether a covered container is available.",
    ];
  return [
    "Arrange a site inspection.",
    "Several reports use this location name. Verify the site and look for practical causes before choosing a prevention action.",
  ];
}
async function render() {
  try {
    const { reports } = await api.reports();
    const groups = new Map();
    for (const report of reports) {
      const key = report.location.trim().toLowerCase().replace(/\s+/g, " ");
      if (!groups.has(key))
        groups.set(key, { location: report.location.trim(), reports: [] });
      groups.get(key).reports.push(report);
    }
    const repeated = [...groups.values()]
      .filter((g) => g.reports.length >= 2)
      .sort((a, b) => b.reports.length - a.reports.length);
    $("#hotspot-total").textContent = repeated.length;
    $("#report-total").textContent = reports.length;
    $("#hotspots-list").innerHTML = repeated.length
      ? repeated
          .map((g) => {
            const [title, reason] = advice(g);
            const cats = [...new Set(g.reports.map((r) => r.category))].join(
              ", ",
            );
            return `<article class="hotspot-card"><div class="hotspot-head"><div><h3>⌖ ${escapeHTML(g.location)}</h3><p>${escapeHTML(cats)}</p></div><div class="hotspot-count">${g.reports.length}<small>reports</small></div></div><p>Latest report: ${escapeHTML(
              g.reports
                .map((r) => r.date)
                .sort()
                .at(-1) || "—",
            )}</p><div class="suggestion"><strong>PREVENTION SUGGESTION</strong><p><strong>${escapeHTML(title)}</strong></p><p class="reason">${escapeHTML(reason)}</p></div></article>`;
          })
          .join("")
      : `<div class="empty-state"><div class="empty-icon">⌖</div><h3>No recurring hotspots yet</h3><p>At least two reports must use the same location name. Add a report or load demo data.</p>${currentUser?.role === "admin" ? '<button class="btn btn-primary" data-load-demo>Load demo data</button>' : ""}</div>`;
  } catch (error) {
    toast(error.message, true);
    $("#hotspots-list").innerHTML =
      `<p class="form-message error">${error.message}</p>`;
  }
}
$("#hotspots-list").addEventListener("click", async (event) => {
  if (!event.target.closest("[data-load-demo]")) return;
  try {
    await api.seedDemo();
    toast("Demo reports loaded into the database.");
    await render();
  } catch (error) {
    toast(error.message, true);
  }
});
window.addEventListener("reports:changed", render);
render();

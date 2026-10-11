export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}
export function prettyDate(value) {
  if (!value) return "No date";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.valueOf())
    ? value
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
export function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}
export function statusBadge(status) {
  return `<span class="status ${statusClass(status)}">${escapeHTML(status)}</span>`;
}
export function categoryIcon(category) {
  return (
    {
      "Mixed garbage": "♧",
      "Overflowing bin": "▤",
      "Plastic waste": "♻",
      "Construction debris": "▰",
      "Organic waste": "✳",
      "Electronic waste": "⌁",
      Other: "⌖",
    }[category] || "♧"
  );
}
export function toast(message, error = false) {
  let node = $("#toast");
  if (!node) {
    node = document.createElement("div");
    node.id = "toast";
    node.className = "toast hidden";
    node.setAttribute("role", "status");
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.toggle("error", error);
  node.classList.remove("hidden");
  clearTimeout(window.__wasteToastTimer);
  window.__wasteToastTimer = setTimeout(
    () => node.classList.add("hidden"),
    3600,
  );
}
export function reportRow(report) {
  return `<article class="report-row"><div class="report-symbol">${categoryIcon(report.category)}</div><div class="report-main"><strong>${escapeHTML(report.location)}</strong><small>${escapeHTML(report.category)} · ${prettyDate(report.date)} · ${escapeHTML(report.id)}</small></div>${statusBadge(report.status)}</article>`;
}
export function reportCard(report, user = null) {
  const isAdmin = user?.role === "admin";
  const isOwner = Boolean(user && user.id === report.ownerId);
  const actions = isAdmin
    ? `<div class="card-actions"><label class="field-hint" for="status-${escapeHTML(report.id)}">Cleanup status</label><select id="status-${escapeHTML(report.id)}" data-status-id="${escapeHTML(report.id)}"><option ${report.status === "Reported" ? "selected" : ""}>Reported</option><option ${report.status === "In progress" ? "selected" : ""}>In progress</option><option ${report.status === "Cleaned" ? "selected" : ""}>Cleaned</option></select><label class="field-hint">After-cleanup photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-cleanup-photo-id="${escapeHTML(report.id)}" aria-label="Choose cleanup photo for ${escapeHTML(report.id)}"></label><button class="btn btn-primary" data-upload-cleanup-id="${escapeHTML(report.id)}">Save status / proof</button><button class="btn btn-quiet" data-delete-id="${escapeHTML(report.id)}">Delete report</button></div>`
    : isOwner
      ? `<div class="card-actions"><span class="field-hint">Your report</span><button class="btn btn-quiet" data-delete-id="${escapeHTML(report.id)}">Delete my report</button></div>`
      : "";
  return `<article class="report-card" data-id="${escapeHTML(report.id)}"><div class="report-card-head"><div class="report-symbol">${categoryIcon(report.category)}</div><div class="report-card-title"><h3>${escapeHTML(report.category)}</h3><p>${escapeHTML(report.location)} · ${prettyDate(report.date)}</p></div>${statusBadge(report.status)}</div>${report.photo ? `<img class="report-photo" src="${escapeHTML(report.photo)}" alt="Reported waste" loading="lazy">` : ""}<p class="report-description">${escapeHTML(report.description)}</p>${report.cleanupPhoto ? `<div class="cleanup-proof"><p class="field-hint">After-cleanup proof · ${escapeHTML(report.cleanupReview || "Pending")}</p><a href="${escapeHTML(report.cleanupPhoto)}" target="_blank" rel="noopener"><img class="report-photo" src="${escapeHTML(report.cleanupPhoto)}" alt="After-cleanup proof photo" loading="lazy"></a></div>` : report.status === "Cleaned" ? '<p class="field-hint">Cleanup marked complete; proof photo not available.</p>' : ""}<div class="card-meta"><span>ID ${escapeHTML(report.id)}</span><span>${report.simulated ? "SIMULATED DEMO" : "COMMUNITY REPORT"}</span></div>${actions}</article>`;
}

export async function setupNav() {
  const current = document.body.dataset.page;
  const links = [
    ["index.html", "▦", "Overview", "dashboard"],
    ["report.html", "＋", "Report waste", "report"],
    ["reports.html", "☷", "Reports", "reports"],
    ["map.html", "◎", "Map", "map"],
    ["hotspots.html", "⌖", "Hotspots", "hotspots"],
    ["about.html", "ⓘ", "About", "about"],
  ];
  const nav = $("#site-nav");
  if (!nav) return null;
  let user = null;
  try {
    const response = await fetch("/api/auth/me");
    if (response.ok) user = (await response.json()).user;
  } catch {}
  nav.innerHTML = `<aside class="sidebar"><a class="brand" href="index.html"><span class="brand-mark">W<span>W</span></span><span><strong>WasteWatch</strong><small>COMMUNITY CLEANUP</small></span></a><div class="nav-label">WORKSPACE</div><nav class="nav-list" aria-label="Main navigation">${links.map(([href, icon, label, key]) => `<a class="nav-link ${current === key ? "active" : ""}" href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`).join("")}</nav><div class="sidebar-account">${user ? `<div class="account-chip"><span class="account-avatar">${escapeHTML(user.name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(user.name)}</strong><small>${user.role === "admin" ? "ADMINISTRATOR" : "CITIZEN ACCOUNT"}</small></div></div><button class="btn btn-quiet btn-full" id="logout-button">Log out</button>` : `<a class="btn btn-primary btn-full" href="/login.html">Log in / Sign up</a><p class="field-hint">Sign in to submit reports. Admin tools require an admin account.</p>`}</div><div class="sidebar-bottom"><div class="storage-note"><span class="status-dot"></span><div><strong>SQLite database</strong><small>Saved on this server</small></div></div><p>Track reports, cleanup progress and recurring waste locations.</p><span class="version">WasteWatch · v1.1</span></div></aside>`;
  const crumb = $("#page-crumb");
  if (crumb)
    crumb.textContent = links.find((x) => x[3] === current)?.[2] || "Workspace";
  $("#logout-button")?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/index.html";
    } catch {
      toast("Could not log out. Try again.", true);
    }
  });
  document.body.dataset.role = user?.role || "guest";
  document.body.dataset.userId = user?.id || "";
  window.wasteWatchUser = user;
  return user;
}

export function setupDemoButtons() {
  if (document.body.dataset.role !== "admin") {
    $$("[data-load-demo],[data-clear-demo]").forEach((el) =>
      el.classList.add("hidden"),
    );
  }
  $$("[data-load-demo]").forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        const { api } = await import("./api.js");
        await api.seedDemo();
        toast("Demo reports loaded into the database.");
        window.dispatchEvent(new CustomEvent("reports:changed"));
      } catch (e) {
        toast(e.message, true);
      }
    }),
  );
  $$("[data-clear-demo]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!confirm("Delete only the simulated demo reports?")) return;
      try {
        const { api } = await import("./api.js");
        await api.clearDemo();
        toast("Demo reports removed.");
        window.dispatchEvent(new CustomEvent("reports:changed"));
      } catch (e) {
        toast(e.message, true);
      }
    }),
  );
}

(() => {
  "use strict";
  const STORAGE_KEY = "wastewatch.incidents.v1";
  const MAX_IMAGE_EDGE = 1000;
  const IMAGE_QUALITY = 0.72;
  let incidents = [];
  let toastTimer;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const today = () => new Date().toISOString().slice(0, 10);
  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const prettyDate = (value) => {
    if (!value) return "Date not set";
    const d = new Date(value + "T12:00:00");
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const statusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");
  const statusHTML = (status) =>
    `<span class="status status-${statusClass(status)}">${escapeHTML(status)}</span>`;
  const normalizeLocation = (location) =>
    location.trim().toLowerCase().replace(/\s+/g, " ");

  // Storage is implemented separately in storage.js so it can later be replaced with AWS API calls.
  const storageService = window.WasteWatchStorage;

  function persistAndRender(successMessage) {
    if (!storageService.save(incidents, showToast)) return false;
    renderAll();
    if (successMessage) showToast(successMessage);
    return true;
  }
  function showToast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function navigate(page) {
    $$(".page").forEach((el) =>
      el.classList.toggle("active", el.id === `page-${page}`),
    );
    $$(".nav-item").forEach((el) =>
      el.classList.toggle("active", el.dataset.page === page),
    );
    const labels = {
      dashboard: "Dashboard",
      report: "Report garbage",
      reports: "All reports",
      hotspots: "Hotspots & prevention",
    };
    $("#page-crumb").textContent = labels[page] || "Dashboard";
    if (page === "reports") renderReports();
    if (page === "hotspots") renderHotspots();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function newId() {
    const date = new Date();
    const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    return `WW-${datePart}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  function imageToDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (!file.type.startsWith("image/"))
        return reject(new Error("Please choose an image file."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The image could not be read."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () =>
          reject(
            new Error("This image format could not be opened by the browser."),
          );
        img.onload = () => {
          const scale = Math.min(
            1,
            MAX_IMAGE_EDGE / Math.max(img.width, img.height),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function photoMarkup(src, alt, placeholder = "No photo uploaded") {
    return src
      ? `<img src="${src}" alt="${escapeHTML(alt)}">`
      : `<div class="photo-placeholder">♧<span>${escapeHTML(placeholder)}</span></div>`;
  }
  function renderAll() {
    $("#nav-count").textContent = incidents.length;
    $("#stat-total").textContent = incidents.length;
    $("#stat-open").textContent = incidents.filter(
      (i) => i.status !== "Cleaned",
    ).length;
    $("#stat-verified").textContent = incidents.filter(
      (i) => i.cleanupReview === "Verified",
    ).length;
    const hotspots = getHotspots();
    $("#stat-hotspots").textContent = hotspots.filter(
      (h) => h.reports.length >= 2,
    ).length;
    renderRecent();
    renderReports();
    renderHotspots();
  }
  function renderRecent() {
    const latest = [...incidents]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    const el = $("#recent-list");
    if (!latest.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">♧</div><h3>No reports yet</h3><p>Create a report or load simulated incidents to explore the dashboard.</p><button class="btn btn-primary" data-go="report">＋ Create first report</button></div>`;
      return;
    }
    el.innerHTML = latest
      .map(
        (
          i,
        ) => `<div class="mini-report" data-open="${escapeHTML(i.id)}" tabindex="0" role="button" aria-label="Open ${escapeHTML(i.id)}">
      <div class="mini-thumb">${i.photo ? `<img src="${i.photo}" alt="">` : "♧"}</div>
      <div><div class="mini-title">${escapeHTML(i.category)}</div><div class="mini-meta">${escapeHTML(i.location)} · ${escapeHTML(i.id)}</div></div>
      ${statusHTML(i.status)}
    </div>`,
      )
      .join("");
  }
  function renderReports() {
    const search = ($("#search-reports")?.value || "").trim().toLowerCase();
    const status = $("#filter-status")?.value || "all";
    const category = $("#filter-category")?.value || "all";
    const filtered = [...incidents]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((i) => {
        const text =
          `${i.id} ${i.location} ${i.category} ${i.description}`.toLowerCase();
        return (
          text.includes(search) &&
          (status === "all" || i.status === status) &&
          (category === "all" || i.category === category)
        );
      });
    $("#reports-grid").innerHTML = filtered
      .map(
        (i) => `<article class="report-card">
      <div class="card-photo">${photoMarkup(i.photo, "Original garbage report photo")}<div class="card-status">${statusHTML(i.status)}</div></div>
      <div class="card-body"><div class="card-id">${escapeHTML(i.id)}${i.simulated ? ' <span class="simulated-tag">SIMULATED DEMO</span>' : ""}</div><h3>${escapeHTML(i.category)}</h3><div class="card-location">⌖ ${escapeHTML(i.location)}</div>
      <p class="card-desc">${escapeHTML(i.description)}</p><div class="card-bottom"><span class="card-date">${prettyDate(i.date)}</span><button class="small-btn" data-open="${escapeHTML(i.id)}">View & update →</button></div></div>
    </article>`,
      )
      .join("");
    $("#reports-empty").classList.toggle("hidden", filtered.length !== 0);
    $("#reports-grid").style.display = filtered.length ? "grid" : "none";
  }

  // Recurrence uses the manually typed location as its grouping key.
  // Names are trimmed, lowercased, and repeated spaces are collapsed; this is
  // intentionally simple and does not attempt GPS/map matching.
  function getHotspots() {
    const groups = new Map();
    incidents.forEach((report) => {
      const key = normalizeLocation(report.location);
      if (!key) return;
      if (!groups.has(key))
        groups.set(key, { key, location: report.location.trim(), reports: [] });
      groups.get(key).reports.push(report);
    });
    return [...groups.values()]
      .map((group) => {
        group.reports.sort((a, b) => new Date(a.date) - new Date(b.date));
        // A return is flagged when any report dated after a verified cleanup
        // exists at the same normalized location.
        const verifiedCleanups = group.reports.filter(
          (r) =>
            r.cleanupReview === "Verified" && r.cleanupPhoto && r.cleanedAt,
        );
        const returned = verifiedCleanups.some((cleanup) =>
          group.reports.some(
            (r) => r.id !== cleanup.id && r.date > cleanup.cleanedAt,
          ),
        );
        return { ...group, returned, verifiedCleanups };
      })
      .sort((a, b) => b.reports.length - a.reports.length);
  }
  function recommendationFor(group) {
    const reports = group.reports;
    const bins = reports.filter((r) => r.category === "Overflowing bin");
    if (group.returned)
      return {
        action: "Check bin availability and possible dumping activity",
        reason:
          "A report at this location is dated after a cleanup marked Verified. Confirm the site conditions and collection arrangements in person.",
      };
    if (reports.length >= 2 && bins.length >= 2)
      return {
        action: "Review waste collection frequency",
        reason: `${bins.length} of ${reports.length} reports here concern overflowing bins. Check collection timing and bin capacity.`,
      };
    if (reports.length >= 2)
      return {
        action: "Arrange a site inspection",
        reason: `There are ${reports.length} reports with the same location name. Inspect the area to understand why waste may be accumulating.`,
      };
    return {
      action: "Request a human inspection",
      reason:
        "There is not enough repeated information to infer a pattern. Ask a local reviewer to verify the location and conditions.",
    };
  }
  function renderHotspots() {
    const groups = getHotspots();
    const repeated = groups.filter((g) => g.reports.length >= 2);
    const returned = repeated.filter((g) => g.returned);
    $("#hotspot-total").textContent = repeated.length;
    $("#return-total").textContent = returned.length;
    $("#hotspot-count-label").textContent =
      `${repeated.length} location${repeated.length === 1 ? "" : "s"}`;
    const displayGroups = groups.filter((g) => g.reports.length >= 2);
    if (!displayGroups.length) {
      $("#hotspots-list").innerHTML =
        `<div class="empty-state"><div class="empty-icon">⌖</div><h3>No recurring hotspots yet</h3><p>At least two reports must use the same location name. Load simulated incidents to see how detection works.</p><button class="btn btn-primary" id="load-demo-hotspots">Load demo incidents</button></div>`;
      return;
    }
    $("#hotspots-list").innerHTML = displayGroups
      .map((g) => {
        const suggestion = recommendationFor(g);
        const categories = [...new Set(g.reports.map((r) => r.category))].join(
          ", ",
        );
        return `<article class="hotspot-card"><div class="hotspot-head"><div class="hotspot-name"><div class="hotspot-pin">⌖</div><div><h3>${escapeHTML(g.location)}</h3><p>${escapeHTML(categories)}</p></div></div><div class="hotspot-count">${g.reports.length}<small>reports</small></div></div>
      <div class="hotspot-card-body"><div class="mini-fact"><strong>RECURRENCE SIGNAL</strong>${g.returned ? `<span style="color:var(--red)">New report after verified cleanup</span>` : g.verifiedCleanups.length ? "Verified cleanup recorded; no later report date detected." : "Repeated location reports; cleanup return not confirmed."}<br><br><strong>INCIDENT IDS</strong>${g.reports.map((r) => escapeHTML(r.id)).join(" · ")}</div>
      <div class="suggestion"><div class="suggestion-head">✳ PREVENTION SUGGESTION</div><p><strong>${escapeHTML(suggestion.action)}</strong></p><p class="reason">${escapeHTML(suggestion.reason)}</p></div></div></article>`;
      })
      .join("");
  }
  function openReport(id) {
    const report = incidents.find((i) => i.id === id);
    if (!report) return;
    $("#modal-title").textContent = report.category;
    $("#modal-id").textContent =
      report.id + (report.simulated ? " · SIMULATED DEMO INCIDENT" : "");
    $("#modal-content").innerHTML = `
      <div class="detail-grid">
        <div class="detail-box"><label>LOCATION</label><p>${escapeHTML(report.location)}</p></div>
        <div class="detail-box"><label>REPORT DATE</label><p>${prettyDate(report.date)}</p></div>
        <div class="detail-box"><label>CURRENT STATUS</label><p>${statusHTML(report.status)}</p></div>
        <div class="detail-box"><label>CATEGORY</label><p>${escapeHTML(report.category)}</p></div>
        <div class="detail-box" style="grid-column:1/-1"><label>DESCRIPTION</label><p>${escapeHTML(report.description)}</p></div>
      </div>
      <h3>Before & after evidence</h3>
      <div class="photo-compare"><div><div class="compare-label">ORIGINAL REPORT PHOTO</div><div class="compare-frame">${report.photo ? `<img src="${report.photo}" alt="Original garbage photo">` : `<div class="no-photo"><span>♧</span><small>No original photo</small></div>`}</div></div>
      <div><div class="compare-label">CLEANUP PHOTO</div><div class="compare-frame">${report.cleanupPhoto ? `<img src="${report.cleanupPhoto}" alt="Cleanup photo">` : `<div class="no-photo"><span>＋</span><small>Not attached yet</small></div>`}</div></div></div>
      <label class="form-label">Update incident status
        <select id="edit-status"><option ${report.status === "Reported" ? "selected" : ""}>Reported</option><option ${report.status === "In progress" ? "selected" : ""}>In progress</option><option ${report.status === "Cleaned" ? "selected" : ""}>Cleaned</option></select>
      </label>
      <label class="form-label">Attach cleanup photograph <input id="cleanup-photo" type="file" accept="image/*"></label>
      <div class="form-message" id="modal-message" role="status"></div>
      <div class="modal-actions"><button class="btn btn-primary" id="save-report">Save changes</button><button class="btn btn-quiet" id="close-detail">Close</button></div>
      <h3>Demo reviewer workflow</h3>
      <div class="review-row"><span>Cleanup evidence review: <strong>${escapeHTML(report.cleanupReview || "Pending")}</strong><br><small>This is a demo feature; there is no real authentication.</small></span>
      ${report.cleanupPhoto ? `<div class="review-actions"><button class="review-btn verified" id="verify-cleanup">✓ Verify</button><button class="review-btn disputed" id="dispute-cleanup">× Dispute</button></div>` : `<span class="review-tag pending">Photo required first</span>`}</div>
      ${report.cleanupReview === "Disputed" ? `<p class="field-hint">Reason/status: cleanup evidence was disputed in the demo. A real system should record reviewer identity and notes.</p>` : ""}
    `;
    $("#modal-backdrop").classList.remove("hidden");
    $("#save-report").addEventListener("click", async () => {
      const nextStatus = $("#edit-status").value;
      const file = $("#cleanup-photo").files[0];
      let cleanupPhoto = report.cleanupPhoto;
      if (file) {
        try {
          cleanupPhoto = await imageToDataURL(file);
        } catch (e) {
          $("#modal-message").textContent = e.message;
          $("#modal-message").className = "form-message error";
          return;
        }
      }
      const changedPhoto = !!file && cleanupPhoto !== report.cleanupPhoto;
      const next = incidents.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              cleanupPhoto,
              cleanupReview: changedPhoto ? "Pending" : item.cleanupReview,
              cleanedAt:
                nextStatus === "Cleaned"
                  ? item.cleanedAt || today()
                  : item.cleanedAt,
              updatedAt: Date.now(),
            }
          : item,
      );
      incidents = next;
      if (persistAndRender("Report changes saved.")) openReport(id);
    });
    $("#close-detail").addEventListener("click", closeModal);
    const review = (value) => {
      incidents = incidents.map((item) =>
        item.id === id
          ? {
              ...item,
              cleanupReview: value,
              status: value === "Verified" ? "Cleaned" : item.status,
              cleanedAt:
                value === "Verified"
                  ? item.cleanedAt || today()
                  : item.cleanedAt,
              updatedAt: Date.now(),
            }
          : item,
      );
      if (
        persistAndRender(`Cleanup marked ${value.toLowerCase()} in this demo.`)
      )
        openReport(id);
    };
    $("#verify-cleanup")?.addEventListener("click", () => review("Verified"));
    $("#dispute-cleanup")?.addEventListener("click", () => review("Disputed"));
  }
  function closeModal() {
    $("#modal-backdrop").classList.add("hidden");
  }
  async function submitReport(event) {
    event.preventDefault();
    const formMessage = $("#form-message");
    formMessage.textContent = "";
    formMessage.className = "form-message";
    const category = $("#category").value;
    const location = $("#location").value.trim();
    const description = $("#description").value.trim();
    const date = $("#report-date").value;
    if (!category || !location || !description || !date) {
      formMessage.textContent = "Please complete all required fields.";
      formMessage.classList.add("error");
      return;
    }
    if (date > today()) {
      formMessage.textContent = "Report date cannot be in the future.";
      formMessage.classList.add("error");
      return;
    }
    let photo = "";
    try {
      photo = await imageToDataURL($("#report-photo").files[0]);
    } catch (error) {
      formMessage.textContent = error.message;
      formMessage.classList.add("error");
      return;
    }
    const record = {
      id: newId(),
      category,
      location,
      description,
      date,
      photo,
      cleanupPhoto: "",
      status: "Reported",
      cleanupReview: "Pending",
      cleanedAt: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      simulated: false,
    };
    incidents.unshift(record);
    if (persistAndRender(`${record.id} created successfully.`)) {
      formMessage.textContent = `Report created! Your incident ID is ${record.id}.`;
      formMessage.classList.remove("error");
      $("#report-form").reset();
      $("#report-date").value = today();
      $("#upload-preview").textContent = "";
      $("#char-count").textContent = "0 / 500";
      navigate("reports");
    } else {
      incidents = incidents.filter((i) => i.id !== record.id);
    }
  }
  function loadDemo() {
    const demo = [
      {
        id: "WW-DEMO-001",
        category: "Mixed garbage",
        location: "City Park, Gate 2",
        description:
          "Simulated report: mixed waste piled beside the park entrance.",
        date: "2026-10-02",
        status: "Reported",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Pending",
        cleanedAt: "",
        simulated: true,
        createdAt: Date.now() - 600000,
        updatedAt: Date.now() - 600000,
      },
      {
        id: "WW-DEMO-002",
        category: "Overflowing bin",
        location: "City Park, Gate 2",
        description: "Simulated report: public bin appears to be overflowing.",
        date: "2026-10-05",
        status: "In progress",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Pending",
        cleanedAt: "",
        simulated: true,
        createdAt: Date.now() - 500000,
        updatedAt: Date.now() - 500000,
      },
      {
        id: "WW-DEMO-003",
        category: "Plastic waste",
        location: "Riverside Footpath",
        description:
          "Simulated report: plastic packaging near the walking path.",
        date: "2026-10-03",
        status: "Cleaned",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Verified",
        cleanedAt: "2026-10-04",
        simulated: true,
        createdAt: Date.now() - 400000,
        updatedAt: Date.now() - 400000,
      },
      {
        id: "WW-DEMO-004",
        category: "Mixed garbage",
        location: "Riverside Footpath",
        description:
          "Simulated report: waste has been reported again after a verified cleanup.",
        date: "2026-10-07",
        status: "Reported",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Pending",
        cleanedAt: "",
        simulated: true,
        createdAt: Date.now() - 300000,
        updatedAt: Date.now() - 300000,
      },
      {
        id: "WW-DEMO-005",
        category: "Overflowing bin",
        location: "Market Bus Stop",
        description: "Simulated report: bin near the bus stop is full.",
        date: "2026-10-01",
        status: "Reported",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Pending",
        cleanedAt: "",
        simulated: true,
        createdAt: Date.now() - 200000,
        updatedAt: Date.now() - 200000,
      },
      {
        id: "WW-DEMO-006",
        category: "Overflowing bin",
        location: "Market Bus Stop",
        description:
          "Simulated report: another overflowing-bin report at the same stop.",
        date: "2026-10-06",
        status: "In progress",
        photo: "",
        cleanupPhoto: "",
        cleanupReview: "Pending",
        cleanedAt: "",
        simulated: true,
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
      },
    ];
    const existing = new Set(incidents.map((i) => i.id));
    const additions = demo.filter((i) => !existing.has(i.id));
    if (!additions.length) {
      showToast("Demo incidents are already loaded.");
      return;
    }
    incidents = [...additions, ...incidents];
    if (
      !persistAndRender(
        `${additions.length} simulated incidents added. Clearly labelled demo records.`,
      )
    ) {
      incidents = incidents.filter(
        (i) => !additions.some((a) => a.id === i.id),
      );
    }
  }
  function clearDemo() {
    const demoCount = incidents.filter((i) => i.simulated).length;
    if (!demoCount) {
      showToast("No simulated incidents to clear.");
      return;
    }
    if (
      !confirm(
        `Remove ${demoCount} simulated incident(s)? Your own reports will stay.`,
      )
    )
      return;
    incidents = incidents.filter((i) => !i.simulated);
    persistAndRender(
      "Simulated incidents cleared. Your own reports were kept.",
    );
  }
  function bindEvents() {
    $("#main-nav").addEventListener("click", (e) => {
      const button = e.target.closest("[data-page]");
      if (button) navigate(button.dataset.page);
    });
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) navigate(go.dataset.go);
      const open = e.target.closest("[data-open]");
      if (open) openReport(open.dataset.open);
      if (e.target.closest("#load-demo-hotspots")) loadDemo();
    });
    document.addEventListener("keydown", (e) => {
      if (
        (e.key === "Enter" || e.key === " ") &&
        e.target.matches(".mini-report[data-open]")
      ) {
        e.preventDefault();
        openReport(e.target.dataset.open);
      }
      if (e.key === "Escape") closeModal();
    });
    $("#report-form").addEventListener("submit", submitReport);
    $("#report-form").addEventListener("reset", () =>
      setTimeout(() => {
        $("#report-date").value = today();
        $("#upload-preview").textContent = "";
        $("#char-count").textContent = "0 / 500";
        $("#form-message").textContent = "";
      }, 0),
    );
    $("#report-photo").addEventListener("change", () => {
      const file = $("#report-photo").files[0];
      $("#upload-preview").textContent = file ? `Selected: ${file.name}` : "";
    });
    $("#description").addEventListener(
      "input",
      (e) => ($("#char-count").textContent = `${e.target.value.length} / 500`),
    );
    $("#search-reports").addEventListener("input", renderReports);
    $("#filter-status").addEventListener("change", renderReports);
    $("#filter-category").addEventListener("change", renderReports);
    $("#load-demo-top").addEventListener("click", loadDemo);
    $("#modal-backdrop").addEventListener("click", (e) => {
      if (e.target === $("#modal-backdrop")) closeModal();
    });
    // A small data-management menu via right-click is not needed; this button is
    // intentionally visible from the dashboard and report list for demo resets.
    const clear = document.createElement("button");
    clear.className = "btn btn-quiet";
    clear.textContent = "Clear demo data";
    clear.id = "clear-demo";
    clear.style.cssText =
      "position:fixed;right:24px;bottom:24px;z-index:8;background:#171b17;box-shadow:0 3px 20px #0006;font-size:10px";
    clear.addEventListener("click", clearDemo);
    document.body.appendChild(clear);
  }
  function init() {
    incidents = storageService.load();
    $("#report-date").value = today();
    bindEvents();
    renderAll();
  }
  init();
})();

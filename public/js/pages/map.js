import { api } from "../api.js";
import {
  $,
  setupNav,
  escapeHTML,
  prettyDate,
  statusBadge,
  toast,
} from "../ui.js";

await setupNav();
const message = $("#map-page-message");
const count = $("#mapped-count");
// Default view for the current demo area; report markers take priority when present.
const DEFAULT_MAP_CENTER = [29.074, 80.107]; // Tanakpur, Uttarakhand
let map;
let markersLayer;

function initMap() {
  if (!window.L) {
    $("#all-reports-map").innerHTML =
      '<p class="map-fallback">The map library could not load. Check your internet connection and refresh this page.</p>';
    message.textContent = "Map unavailable because Leaflet did not load.";
    return false;
  }
  map = window.L.map("all-reports-map").setView(DEFAULT_MAP_CENTER, 12);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
  }).addTo(map);
  markersLayer = window.L.featureGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 0);
  return true;
}

function popupHTML(report) {
  const photo = report.photo
    ? `<img class="map-popup-photo" src="${escapeHTML(report.photo)}" alt="Waste reported at this location">`
    : "";
  return `<div class="map-popup"><strong>${escapeHTML(report.category)}</strong><p>${escapeHTML(report.location)}</p><p>${escapeHTML(report.description)}</p><small>${escapeHTML(prettyDate(report.date))} · ${escapeHTML(report.status)}</small>${photo}<p><a href="/reports.html">Open reports page</a></p></div>`;
}

async function renderMap() {
  if (!map && !initMap()) return;
  try {
    const { reports } = await api.reports();
    const mapped = reports.filter(
      (report) =>
        Number.isFinite(Number(report.latitude)) &&
        Number.isFinite(Number(report.longitude)) &&
        report.latitude !== null &&
        report.longitude !== null,
    );
    markersLayer.clearLayers();
    for (const report of mapped) {
      const marker = window.L.marker([
        Number(report.latitude),
        Number(report.longitude),
      ]).bindPopup(popupHTML(report));
      marker.addTo(markersLayer);
    }
    count.textContent = `${mapped.length} mapped report${mapped.length === 1 ? "" : "s"} · ${reports.length} total`;
    if (mapped.length) {
      map.fitBounds(markersLayer.getBounds().pad(0.18), { maxZoom: 15 });
      message.textContent = "Map updated. Select a marker to see its report.";
    } else {
      map.setView(DEFAULT_MAP_CENTER, 12);
      message.textContent =
        "No reports have map coordinates yet. Add a report and click the map or use device location.";
    }
    setTimeout(() => map.invalidateSize(), 0);
  } catch (error) {
    count.textContent = "Could not load reports";
    message.textContent = error.message;
    toast(error.message, true);
  }
}

$("#refresh-map").addEventListener("click", renderMap);
window.addEventListener("reports:changed", renderMap);
renderMap();

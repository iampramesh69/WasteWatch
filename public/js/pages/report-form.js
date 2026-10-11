import { api } from "../api.js";
import { $, setupNav, toast } from "../ui.js";

const currentUser = await setupNav();
if (!currentUser) {
  window.location.replace("/login.html?next=/report.html");
}
const form = $("#report-form");
const date = $("#report-date");
const desc = form.elements.description;
const latitudeInput = $("#report-latitude");
const longitudeInput = $("#report-longitude");
const mapStatus = $("#map-status");
// Change this default center to your project's main town if needed (Tanakpur, Uttarakhand).
const DEFAULT_MAP_CENTER = [29.074, 80.107];
let map;
let selectedMarker;

// Date is formatted locally rather than relying on a locale-specific date string.
const now = new Date();
const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
date.value = localDate;
desc.addEventListener("input", () => {
  $("#char-count").textContent = `${desc.value.length} / 500`;
});
$("#photo").addEventListener("change", () => {
  $("#photo-name").textContent = $("#photo").files[0]?.name || "";
});

function setPoint(lat, lng, source) {
  latitudeInput.value = Number(lat).toFixed(7);
  longitudeInput.value = Number(lng).toFixed(7);
  if (selectedMarker) selectedMarker.setLatLng([lat, lng]);
  else
    selectedMarker = window.L.marker([lat, lng], { draggable: true }).addTo(
      map,
    );
  selectedMarker.off("dragend").on("dragend", (event) => {
    const point = event.target.getLatLng();
    setPoint(point.lat, point.lng, "Marker moved");
  });
  map.setView([lat, lng], Math.max(map.getZoom(), 15));
  mapStatus.textContent = `${source}: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}. Drag the pin to adjust it.`;
}

function initLocationMap() {
  const mapElement = $("#report-location-map");
  if (!window.L) {
    mapElement.innerHTML =
      '<p class="map-fallback">The map library could not load. Check your internet connection and refresh; you can still submit a report without coordinates.</p>';
    mapStatus.textContent =
      "Map unavailable. Location coordinates are optional.";
    $("#use-my-location").disabled = true;
    return;
  }
  map = window.L.map(mapElement).setView(DEFAULT_MAP_CENTER, 13);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
  }).addTo(map);
  map.on("click", (event) =>
    setPoint(event.latlng.lat, event.latlng.lng, "Map point selected"),
  );
  // Leaflet needs a size refresh when the browser finishes laying out the form.
  setTimeout(() => map.invalidateSize(), 0);
}

initLocationMap();
$("#use-my-location").addEventListener("click", () => {
  if (!navigator.geolocation) {
    mapStatus.textContent =
      "This browser does not support device location. Click the map to choose a point.";
    return;
  }
  mapStatus.textContent =
    "Requesting your device location… Keep location services enabled and allow the browser permission prompt.";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setPoint(latitude, longitude, "Device location selected");
      const accuracyText = Number.isFinite(accuracy)
        ? `Estimated accuracy: ±${accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`}.`
        : "";
      if (Number.isFinite(accuracy) && accuracy > 1000) {
        mapStatus.textContent += ` ${accuracyText} This location is approximate and may be wrong on desktop computers (often based on Wi-Fi/IP). Move the pin manually to the correct place, or check your device location settings.`;
      } else {
        mapStatus.textContent += accuracyText ? ` ${accuracyText}` : "";
      }
    },
    (error) => {
      const message =
        error.code === 1
          ? "Location permission was denied."
          : error.code === 2
            ? "Your device could not determine its location."
            : "Location request timed out.";
      mapStatus.textContent = `${message} You can click the map instead.`;
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
});

form.addEventListener("reset", () =>
  setTimeout(() => {
    $("#char-count").textContent = "0 / 500";
    $("#photo-name").textContent = "";
    $("#form-message").textContent = "";
    latitudeInput.value = "";
    longitudeInput.value = "";
    if (selectedMarker && map) map.removeLayer(selectedMarker);
    selectedMarker = null;
    mapStatus.textContent =
      "No map point selected. You can still submit a report without coordinates.";
  }, 0),
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("#form-message");
  const submit = form.querySelector('[type="submit"]');
  message.classList.remove("error");
  message.textContent = "Saving report…";
  submit.disabled = true;
  try {
    const { report } = await api.createReport(new FormData(form));
    toast(`Report saved: ${report.id}`);
    message.textContent = `Report saved successfully. ID: ${report.id}`;
    form.reset();
    date.value = localDate;
    setTimeout(() => {
      window.location.href = "/reports.html";
    }, 900);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  } finally {
    submit.disabled = false;
  }
});

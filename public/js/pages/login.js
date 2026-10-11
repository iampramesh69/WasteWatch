import { api } from "../api.js";
import { $, toast, setupNav } from "../ui.js";
await setupNav();
const form = $("#auth-form");
const modeLabel = $("#auth-mode-label");
const submit = $("#auth-submit");
const nameField = $("#name-field");
const switchLink = $("#switch-mode");
const message = $("#auth-message");
let mode =
  new URLSearchParams(location.search).get("mode") === "register"
    ? "register"
    : "login";
function setMode(next) {
  mode = next;
  const registering = mode === "register";
  modeLabel.textContent = registering
    ? "Create citizen account"
    : "Welcome back";
  $("#auth-title").textContent = registering
    ? "Join WasteWatch."
    : "Log in to WasteWatch.";
  $("#auth-subtitle").textContent = registering
    ? "Create a citizen account to submit and manage your own reports."
    : "Sign in to report waste or access your authorized dashboard.";
  nameField.classList.toggle("hidden", !registering);
  $("#auth-name").required = registering;
  submit.textContent = registering ? "Create account →" : "Log in →";
  switchLink.textContent = registering
    ? "Already have an account? Log in"
    : "New here? Create a citizen account";
  message.textContent = "";
  message.classList.remove("error");
}
switchLink.addEventListener("click", (e) => {
  e.preventDefault();
  setMode(mode === "login" ? "register" : "login");
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submit.disabled = true;
  message.textContent = "Please wait…";
  message.classList.remove("error");
  const details = {
    email: $("#auth-email").value.trim(),
    password: $("#auth-password").value,
  };
  if (mode === "register") details.name = $("#auth-name").value.trim();
  try {
    const result =
      mode === "register"
        ? await api.register(details)
        : await api.login(details);
    toast(mode === "register" ? "Account created." : "Logged in successfully.");
    const requested = new URLSearchParams(location.search).get("next");
    const safeNext =
      requested && requested.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/index.html";
    window.location.href =
      result.user.role === "admin" ? "/index.html" : safeNext;
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  } finally {
    submit.disabled = false;
  }
});
setMode(mode);

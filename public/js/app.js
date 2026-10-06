import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { initAuthModal, wireAuthNav, openAuthModal, showToolError, clearToolError } from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let currentUser = null;
let selectedType = "cold-outreach";

authService.onAuthChanged(async user => {
  currentUser = user;
  const navLoginEl = document.getElementById("nav-login");
  if (navLoginEl) navLoginEl.textContent = user ? "Sign Out" : "Sign In";
  document.getElementById("nav-signup")?.classList.toggle("nav-signup-hidden", !!user);
  await initPaywall(user ? user.uid : null);
  if (user) renderUsageMeter("usage-meter-container", "analyses");
});
document.getElementById("nav-upgrade")?.addEventListener("click", () => showPricingModal("pro"));
document.getElementById("nav-manage")?.addEventListener("click", () => showPricingModal("pro"));

initAuthModal(authService);
wireAuthNav(authService, () => currentUser);

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

function setBusy(busy) {
  const btn = document.getElementById("btn-generate");
  btn.querySelector(".btn-text").classList.toggle("hidden", busy);
  btn.querySelector(".btn-loader").classList.toggle("hidden", !busy);
  btn.disabled = busy;
  const regen = document.getElementById("btn-regenerate");
  if (regen) regen.disabled = busy;
}

async function generate() {
  const recipientName = document.getElementById("recipient-name").value.trim();
  if (!recipientName) { document.getElementById("recipient-name").focus(); return toast.warning("Please enter the recipient's name."); }
  const payload = { emailType: selectedType, recipientName, recipientTitle: document.getElementById("recipient-title").value.trim(), recipientCompany: document.getElementById("recipient-company").value.trim(), connectionPoint: document.getElementById("connection-point").value.trim(), yourName: document.getElementById("your-name").value.trim(), yourRole: document.getElementById("your-role").value.trim(), yourGoal: document.getElementById("your-goal").value.trim(), context: document.getElementById("your-context").value.trim() };
  clearToolError();
  setBusy(true);
  try {
    const data = await apiFetch("/api/networking-email", payload);
    // Never substitute a canned template: an empty body is an error, not a result.
    if (!data?.body) throw new Error("The server returned an empty email.");
    document.getElementById("email-subject").textContent = data.subject || "";
    document.getElementById("email-body").innerText = data.body;
    document.getElementById("result-panel").classList.remove("hidden");
    document.getElementById("result-panel").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    document.getElementById("result-panel").classList.add("hidden");
    showToolError(e, generate);
  } finally {
    setBusy(false);
  }
}

document.getElementById("btn-generate").addEventListener("click", generate);
document.getElementById("btn-regenerate")?.addEventListener("click", generate);
document.getElementById("btn-copy")?.addEventListener("click", () => {
  const subject = document.getElementById("email-subject").textContent;
  const body = document.getElementById("email-body").innerText;
  navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body)
    .then(() => toast.success("Copied!"))
    .catch(() => toast.error("Couldn't copy. Please select the text and copy it manually."));
});
document.getElementById("btn-save")?.addEventListener("click", async () => {
  if (!currentUser) { openAuthModal("login"); return; }
  try {
    await saveDoc("networking-emails", currentUser.uid, { type: selectedType, recipientName: document.getElementById("recipient-name").value, subject: document.getElementById("email-subject").textContent, body: document.getElementById("email-body").innerText });
    toast.success("Email saved!");
  } catch (e) {
    toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
  }
});

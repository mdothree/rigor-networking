import { initPaywall, gate, showPricingModal, renderUsageMeter } from "./services/paywallUI.js";
import { validators, guardSubmit } from "./utils/validate.js";
import { saveDoc, getUserDocs, tsToString } from "./services/firestoreService.js";
import { apiFetch } from "./config/env.js";
import { toast } from "./utils/toast.js";
import { initAuthModal } from "./utils/helpers.js";
import { authService } from "./services/authService.js";

let currentUser = null;
let selectedType = "cold-outreach";

authService.onAuthChanged(async user => {
  currentUser = user;
  const navLoginEl = document.getElementById("nav-login");
  if (navLoginEl) navLoginEl.textContent = user ? "Sign Out" : "Sign In";
  document.getElementById("nav-signup")?.classList.toggle("nav-signup-hidden", !!user);
  await initPaywall(user ? user.uid : null);
  if (user) renderUsageMeter("usage-meter-container", "uses");
});
document.getElementById("nav-upgrade")?.addEventListener("click", () => showPricingModal("pro"));
document.getElementById("nav-manage")?.addEventListener("click", () => showPricingModal("pro"));

initAuthModal(authService);

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

async function generate() {
  const recipientName = document.getElementById("recipient-name").value.trim();
  if (!recipientName) return toast.warning("Please enter the recipient's name.");
  document.querySelector(".btn-text").classList.add("hidden"); document.querySelector(".btn-loader").classList.remove("hidden"); document.getElementById("btn-generate").disabled = true;
  const payload = { emailType: selectedType, recipientName, recipientTitle: document.getElementById("recipient-title").value, recipientCompany: document.getElementById("recipient-company").value, connectionPoint: document.getElementById("connection-point").value, yourName: document.getElementById("your-name").value, yourRole: document.getElementById("your-role").value, yourGoal: document.getElementById("your-goal").value, context: document.getElementById("your-context").value };
  try {
    const res = await apiFetch("/api/networking-email", payload);
    const data = await res.json();
    document.getElementById("email-subject").textContent = data.subject || `Quick introduction — ${payload.yourName || "connecting"}`;
    document.getElementById("email-body").innerText = data.body || getFallback(payload);
    document.getElementById("result-panel").classList.remove("hidden");
    document.getElementById("result-panel").scrollIntoView({behavior:"smooth"});
  } catch(e) {
    document.getElementById("email-subject").textContent = `Quick introduction`;
    document.getElementById("email-body").innerText = getFallback(payload);
    document.getElementById("result-panel").classList.remove("hidden");
  } finally {
    document.querySelector(".btn-text").classList.remove("hidden"); document.querySelector(".btn-loader").classList.add("hidden"); document.getElementById("btn-generate").disabled = false;
  }
}

function getFallback(p) {
  return `Hi ${p.recipientName},\n\nI hope this message finds you well. My name is ${p.yourName||'[Your Name]'} and I'm a ${p.yourRole||'professional'} with a strong interest in ${p.recipientCompany||'your company'}.\n\n${p.connectionPoint ? `I came across your profile through ${p.connectionPoint}, and ` : ''}I've been impressed by your work and would love to connect.\n\n${p.yourGoal||'I\'d love to learn more about your experience and any advice you might have.'}\n\nWould you be open to a 15-minute virtual coffee chat sometime in the next few weeks? I\'m happy to work around your schedule.\n\nThank you for your time,\n${p.yourName||'[Your Name]'}`;
}

document.getElementById("btn-generate").addEventListener("click", generate);
document.getElementById("btn-regenerate")?.addEventListener("click", generate);
document.getElementById("btn-copy")?.addEventListener("click", () => {
  const subject = document.getElementById("email-subject").textContent;
  const body = document.getElementById("email-body").innerText;
  navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => toast.success("Copied!"));
});
document.getElementById("btn-save")?.addEventListener("click", async () => {
  if(!currentUser) { authModal.classList.remove("hidden"); return; }
  
  await saveDoc("networking-emails", currentUser?.uid || '', { userId: currentUser.uid, type: selectedType, recipientName: document.getElementById("recipient-name").value, subject: document.getElementById("email-subject").textContent, body: document.getElementById("email-body").innerText, createdAt: serverTimestamp() });
  toast.success("Email saved!");
});

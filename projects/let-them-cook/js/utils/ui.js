function showToast(message, kind) {
  const el = document.getElementById("toast");
  if (!el) { alert(message); return; }
  el.textContent = message;
  el.className = "toast show " + (kind === "err" ? "err" : "ok");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 5200);
}

function toggleMoreActions() {
  const row = document.getElementById("more-actions");
  if (row) row.hidden = !row.hidden;
}

export { showToast, toggleMoreActions };
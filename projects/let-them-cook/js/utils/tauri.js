function getTauriInvoke() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Tauri invoke API is unavailable.");
  }
  return invoke;
}

function isTauri() {
  return typeof window.__TAURI__?.core?.invoke === "function";
}

async function invokeCommand(name, args = {}) {
  const invoke = getTauriInvoke();
  try {
    return await invoke(name, args);
  } catch (error) {
    console.error(`Tauri command failed: ${name}`, error);
    throw error;
  }
}

export { getTauriInvoke, isTauri, invokeCommand };
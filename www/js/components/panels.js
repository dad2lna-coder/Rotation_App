// js/components/panels.js — aux panel renderer: problems, shared notes, analytics
import { applyProblems } from "../data/store.js";
import { renderAnalytics } from "./analytics.js";

export function renderAuxSections(payload) {
  applyProblems(Array.isArray(payload?.problems) ? payload.problems : []);
  const notes = document.getElementById("sharedNotes");
  if (notes && document.activeElement !== notes) {
    notes.value = payload?.sharedNotes || "";
  }
  renderAnalytics(payload);
}
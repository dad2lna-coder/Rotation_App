// js/components/analytics.js — UI v2 analytics tab (computed from payload)
import { escapeHtml } from "../utils/strings.js";

function sectionStats(section) {
  const ideas = Array.isArray(section.ideas) ? section.ideas.filter(i => !i.deleted) : [];
  const actions = Array.isArray(section.actions) ? section.actions : [];
  const complete = actions.filter(a => a.complete).length;
  return {
    ideas: ideas.length,
    questions: Array.isArray(section.questions) ? section.questions.filter(Boolean).length : 0,
    actions: actions.length,
    complete,
    percent: actions.length === 0 ? 0 : Math.round((complete / actions.length) * 100)
  };
}

export function computeAnalytics(payload) {
  const initiatives = (payload?.initiatives || []).map(init => {
    const sections = Array.isArray(init.sections) ? init.sections : [];
    const stats = sections.map(sectionStats);
    const actions = stats.reduce((sum, s) => sum + s.actions, 0);
    const complete = stats.reduce((sum, s) => sum + s.complete, 0);
    return {
      id: init.id,
      name: init.name || "Unnamed",
      status: init.status || "active",
      sections: sections.length,
      ideas: stats.reduce((sum, s) => sum + s.ideas, 0),
      questions: stats.reduce((sum, s) => sum + s.questions, 0),
      actions,
      complete,
      percent: actions === 0 ? 0 : Math.round((complete / actions) * 100)
    };
  });
  const totals = initiatives.reduce((acc, i) => ({
    initiatives: acc.initiatives + 1,
    ideas: acc.ideas + i.ideas,
    questions: acc.questions + i.questions,
    actions: acc.actions + i.actions,
    complete: acc.complete + i.complete
  }), { initiatives: 0, ideas: 0, questions: 0, actions: 0, complete: 0 });
  const problems = Array.isArray(payload?.problems) ? payload.problems.length : 0;
  const overall = totals.actions === 0 ? 0 : Math.round((totals.complete / totals.actions) * 100);
  return { initiatives, totals: { ...totals, problems, overall } };
}

export function renderAnalytics(payload) {
  const container = document.getElementById("analytics-container");
  if (!container) return;
  const data = computeAnalytics(payload);
  if (data.initiatives.length === 0) {
    container.innerHTML = `<p class="small-muted">No initiatives yet. Add one on the Initiatives tab to see progress here.</p>`;
    return;
  }
  const rows = data.initiatives.map(init => `
    <div class="initiative-card analytics-row">
      <div class="initiative-header">
        <h4>${escapeHtml(init.name)}</h4>
        <span class="status-badge status-${escapeHtml(init.status)}">${escapeHtml(init.status)}</span>
      </div>
      <div class="initiative-meta">
        <span>Sections: ${init.sections}</span>
        <span>Ideas: ${init.ideas}</span>
        <span>Questions: ${init.questions}</span>
        <span>Actions: ${init.complete}/${init.actions}</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width: ${init.percent}%;"></div></div>
      <div class="analytics-pct">${init.percent}% of action items complete</div>
    </div>`).join("");
  container.innerHTML = `
    <div class="dashboard-grid analytics-summary">
      <div class="metric-card">
        <h3>Overall Action Progress</h3>
        <div class="value">${data.totals.overall}%</div>
        <div class="sub">${data.totals.complete} of ${data.totals.actions} actions complete</div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${data.totals.overall}%;"></div></div>
      </div>
      <div class="metric-card">
        <h3>Core Problems Logged</h3>
        <div class="value">${data.totals.problems}</div>
        <div class="sub">Tracked on the Problems tab</div>
      </div>
      <div class="metric-card">
        <h3>Ideas Captured</h3>
        <div class="value">${data.totals.ideas}</div>
        <div class="sub">Across all initiatives</div>
      </div>
      <div class="metric-card">
        <h3>Open Questions</h3>
        <div class="value">${data.totals.questions}</div>
        <div class="sub">Awaiting discussion</div>
      </div>
    </div>
    ${rows}`;
}
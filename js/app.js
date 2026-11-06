// Project Command frontend, talking directly to Supabase (online version).
const cfg = window.PROJECT_COMMAND_CONFIG;
const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const STATUS_OPTIONS = ["Planning", "Active", "On Hold", "Completed"];
const DEFAULT_STAGES = [
  "Initial Planning", "Approval", "Design & Development",
  "Construction / Execution", "Marketing & Launch", "Completed"
];

// Send visitors who are not signed in to the sign-in page.
async function requireLogin() {
  if (window.location.pathname.endsWith("login.html")) return;
  const { data } = await db.auth.getSession();
  if (!data.session) window.location.href = "login.html";
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// Dashboard counters.
async function loadStats() {
  const { data, error } = await db.from("projects").select("status").eq("archived", false);
  if (error) return console.error(error);
  const count = (s) => data.filter((p) => p.status === s).length;
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  set("stat-total", data.length);
  set("stat-active", count("Active"));
  set("stat-planning", count("Planning"));
  set("stat-completed", count("Completed"));
  set("stat-hold", count("On Hold"));
}

// Project list.
async function loadProjects() {
  const list = document.getElementById("project-list");
  if (!list) return;
  const { data, error } = await db
    .from("projects")
    .select("id, project_code, name, status, progress_percent")
    .eq("archived", false)
    .order("project_code");
  list.replaceChildren();
  if (error) return list.append(el("p", "Could not load projects: " + error.message, "note"));
  if (data.length === 0) return list.append(el("p", "No projects yet. Add the first one below.", "note"));
  data.forEach((p) => {
    const card = el("div", null, "project-item");
    card.append(
      el("div", p.project_code, "code"),
      el("div", p.name, "name"),
      el("div", `${p.status} · ${p.progress_percent}%`, "meta")
    );
    card.addEventListener("click", () => loadDetail(p.id));
    list.append(card);
  });
}

// Project detail: stages, status change and history.
async function loadDetail(id) {
  const box = document.getElementById("project-detail");
  const [{ data: p }, { data: stages }, { data: updates }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("project_stages").select("*").eq("project_id", id).order("position"),
    db.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  if (!p) return;
  box.replaceChildren();

  box.append(el("h2", `${p.name} (${p.project_code})`));
  box.append(el("p", `Location: ${p.location || "-"} · Category: ${p.category || "-"} · Budget: ${p.budget ?? "-"}`));
  box.append(el("p", p.description || "No description yet.", "history-item"));

  box.append(el("h3", "Stages"));
  const list = el("ol");
  stages.forEach((s) => list.append(el("li", s.name, s.is_current ? "current" : "")));
  box.append(list);

  const controls = el("div", null, "controls");
  const select = el("select");
  STATUS_OPTIONS.forEach((s) => {
    const opt = el("option", s);
    if (s === p.status) opt.selected = true;
    select.append(opt);
  });
  const progress = el("input");
  progress.type = "number";
  progress.min = "0";
  progress.max = "100";
  progress.value = p.progress_percent;
  const save = el("button", "Update");
  save.addEventListener("click", async () => {
    const newStatus = select.value;
    const newProgress = Math.min(100, Math.max(0, Number(progress.value) || 0));
    const { error } = await db
      .from("projects")
      .update({ status: newStatus, progress_percent: newProgress, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return alert("Update failed: " + error.message);
    if (newStatus !== p.status) {
      await db.from("project_updates").insert({
        project_id: id, message: "Status changed", previous_status: p.status, new_status: newStatus,
      });
    }
    loadDetail(id);
    loadStats();
    loadProjects();
  });
  controls.append(el("span", "Status:"), select, el("span", "Progress %:"), progress, save);
  box.append(controls);

  box.append(el("h3", "Activity history"));
  if (updates.length === 0) box.append(el("p", "No changes recorded yet.", "history-item"));
  updates.forEach((u) => {
    box.append(el("div", `${new Date(u.created_at).toLocaleString()} · ${u.message}: ${u.previous_status} → ${u.new_status}`, "history-item"));
  });
}

// Add New Project form.
function setupForm() {
  const form = document.getElementById("project-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("form-message");
    const raw = Object.fromEntries(new FormData(form).entries());
    const row = {};
    Object.entries(raw).forEach(([k, v]) => { row[k] = v === "" ? null : v; });
    if (row.budget !== null) row.budget = Number(row.budget);
    const { data: created, error } = await db.from("projects").insert(row).select("id").single();
    if (error) {
      message.textContent = "Error: " + error.message;
      return;
    }
    await db.from("project_stages").insert(
      DEFAULT_STAGES.map((name, i) => ({ project_id: created.id, name, position: i + 1, is_current: i === 0 }))
    );
    message.textContent = "Project saved.";
    form.reset();
    loadStats();
    loadProjects();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireLogin();
  if (document.getElementById("stat-total")) {
    loadStats();
    loadProjects();
    setupForm();
  }
});

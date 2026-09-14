import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("hq-v5.js");
const office = read("hq-v5-office.js");
const css = read("hq-v5.css");

// Syntax checks for the production application and 3D office.
new Script(app);
new Script(office);

// Production entrypoint must only depend on the V5 bundle plus Three.js.
for (const asset of ["hq-v5.css", "hq-v5.js", "hq-v5-office.js", "three@0.160.1"]) {
  if (!html.includes(asset)) throw new Error(`Missing production asset reference: ${asset}`);
}

// Core product areas must remain available.
for (const view of ["dashboard", "office", "workforce", "projects", "tasks", "approvals", "reports", "settings"]) {
  if (!app.includes(`'${view}'`) && !app.includes(`\"${view}\"`)) throw new Error(`Missing product view: ${view}`);
}

// Clean-state workforce and projects required by the product brief.
for (const employee of ["سارة", "عمر", "ليان", "نورة"]) {
  if (!app.includes(employee)) throw new Error(`Missing default employee: ${employee}`);
}
for (const project of ["مُعِين", "قدّها", "ناڤ"]) {
  if (!app.includes(project)) throw new Error(`Missing default project: ${project}`);
}

// The office must expose all departments and support real interaction/focus events.
for (const department of ["الإدارة العامة", "التقنية والبحث", "المنتج والتجربة", "الجودة والمراجعة", "التحليلات", "الأنظمة والبنية", "البحث", "العمليات"]) {
  if (!app.includes(department) || !office.includes(department)) throw new Error(`Missing office department: ${department}`);
}
for (const interaction of ["hq:focus-room", "hq:overview", "hq:scene-room"]) {
  if (!office.includes(interaction)) throw new Error(`Missing office interaction: ${interaction}`);
}

// Safety/truthfulness basics: local state, explicit approvals, no fake historical activity seed.
for (const capability of ["nawaf-hq-v5", "approvals", "reports", "activity", "company-command", "global-search"]) {
  if (!app.includes(capability)) throw new Error(`Missing core capability: ${capability}`);
}
if (!app.includes("لا يتم اختلاق نشاط أو إنجازات")) throw new Error("Missing truthful-work notice");
if (!css.trim()) throw new Error("V5 stylesheet is empty");

console.log("Nawaf HQ V5 smoke checks passed");

import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("app.js");
const workflows = read("workflows.js");
const realCompany = read("real-company.js");
const githubAdapter = read("adapters/github-public.js");

new Script(app);
new Script(workflows);
new Script(realCompany);
new Script(githubAdapter);

for (const asset of ["style.css", "live.css", "workflows.css", "real-company.css", "app.js", "enhance.js", "workflows.js", "adapters/github-public.js", "real-company.js"]) {
  if (!html.includes(asset)) throw new Error(`Missing asset reference: ${asset}`);
}

for (const department of ["إدارة المشاريع", "التقنية والتطوير", "التصميم", "التسويق", "البحث والابتكار", "الأعمال والمالية", "التحليلات"]) {
  if (!app.includes(`data-dept="${department}"`)) throw new Error(`Missing office department: ${department}`);
}

for (const capability of ["addEmployeeView", "requestView", "workforceView", "projectsView", "tasksView", "reportsView", "decisionsView", "managerView"]) {
  if (!workflows.includes(`function ${capability}`)) throw new Error(`Missing workspace: ${capability}`);
}

for (const rule of ["FINANCIAL", "mueen-content", "WAITING_APPROVAL"]) {
  if (!workflows.includes(rule)) throw new Error(`Missing protected workflow rule: ${rule}`);
}

for (const principle of ["NO_WORK", "REAL_CONNECTED_ACTION", "GitHub Public API — read only", "runRepositoryTask", "discussionView", "artifactView"]) {
  const corpus = realCompany + githubAdapter;
  if (!corpus.includes(principle)) throw new Error(`Missing real-work principle: ${principle}`);
}

console.log("Nawaf HQ smoke checks passed");

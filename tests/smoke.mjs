import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("hq-v5.js");
const office = read("hq-v5-office.js");
const css = read("hq-v5.css");
const workforce = read("hq-workforce-policy.js");
const agentRuntime = read("hq-agent-runtime.js");
const appsPage = read("apps.html");
const appsScript = read("hq-apps-page.js");
const appsCss = read("hq-app-integrations.css");

new Script(app);
new Script(office);
new Script(workforce);
new Script(agentRuntime);
new Script(appsScript);

for (const asset of ["hq-v5.css", "hq-v5.js", "hq-v5-office.js", "hq-workforce-policy.js", "hq-agent-runtime.js", "three@0.160.1"]) {
  if (!html.includes(asset)) throw new Error(`Missing production asset reference: ${asset}`);
}
if (!html.includes('apps.html')) throw new Error('Missing apps control center launcher');

for (const view of ["dashboard", "office", "workforce", "projects", "tasks", "approvals", "reports", "settings"]) {
  if (!app.includes(`'${view}'`) && !app.includes(`\"${view}\"`)) throw new Error(`Missing product view: ${view}`);
}
for (const employee of ["سارة", "عمر", "ليان", "نورة"]) if (!app.includes(employee)) throw new Error(`Missing default employee: ${employee}`);
for (const project of ["مُعِين", "قدّها", "ناڤ"]) if (!app.includes(project)) throw new Error(`Missing default project: ${project}`);

for (const department of ["الإدارة العامة", "التقنية والبحث", "المنتج والتجربة", "الجودة والمراجعة", "التحليلات", "الأنظمة والبنية", "البحث", "العمليات"]) {
  if (!app.includes(department) || !office.includes(department)) throw new Error(`Missing office department: ${department}`);
}
for (const interaction of ["hq:focus-room", "hq:overview", "hq:scene-room"]) if (!office.includes(interaction)) throw new Error(`Missing office interaction: ${interaction}`);

for (const capability of ["nawaf-hq-v5", "approvals", "reports", "activity", "company-command", "global-search"]) if (!app.includes(capability)) throw new Error(`Missing core capability: ${capability}`);
if (!app.includes("لا يتم اختلاق نشاط أو إنجازات")) throw new Error("Missing truthful-work notice");

for (const rule of ["مهمة مستقلة", "دليل محفوظ", "لا يتم اختلاق نشاط أو تقدم أو نتيجة", "لا يتم إنشاء أي التزام مالي"]) if (!workforce.includes(rule)) throw new Error(`Missing workforce rule: ${rule}`);
for (const fn of ["create", "addEvidence", "canComplete", "normalize"]) if (!workforce.includes(fn)) throw new Error(`Missing workforce capability: ${fn}`);

for (const runtimeFeature of ["/api/gemini", "runTask", "runNext", "NEEDS_TOOL", "NEEDS_APPROVAL", "AI_EVIDENCE", "شغّل الموظفين"]) {
  if (!agentRuntime.includes(runtimeFeature)) throw new Error(`Missing agent runtime feature: ${runtimeFeature}`);
}
if (!agentRuntime.includes("لا تدّعي تنفيذ شيء خارجي لم تنفذه فعليا")) throw new Error('Agent truthfulness guard missing');

for (const asset of ["hq-v5.css", "hq-app-integrations.css", "hq-apps-page.js"]) if (!appsPage.includes(asset)) throw new Error(`Missing apps page asset: ${asset}`);
for (const link of ["mueen-islamic-app.vercel.app", "qaddha.vercel.app", "github.com/uauz1/mueen-islamic-app", "github.com/uauz1/game"]) if (!appsScript.includes(link)) throw new Error(`Missing linked app resource: ${link}`);
for (const feature of ["توجيه موظف", "لوحة تحكم", "تقرير سريع"]) if (!appsPage.includes(feature) && !appsScript.includes(feature)) throw new Error(`Missing apps feature: ${feature}`);

if (!css.trim() || !appsCss.trim()) throw new Error("A production stylesheet is empty");
console.log("Nawaf HQ V5 smoke checks passed");

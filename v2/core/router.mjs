const normalize = value => String(value || '').toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

const employees = {
  ساره: 'sara', sara: 'sara',
  عمر: 'omar', omar: 'omar',
  فهد: 'fahad', fahad: 'fahad',
  ليان: 'lian', lian: 'lian',
  نوره: 'noura', noura: 'noura',
  راكان: 'rakan', rakan: 'rakan'
};

const projects = [
  { id: 'mueen', words: ['معين', 'مُعين', 'mueen'] },
  { id: 'qaddha', words: ['قدها', 'قدّها', 'qaddha'] },
  { id: 'nav', words: ['ناف', 'ناڤ', 'nav'] }
];

const includesAny = (text, words) => words.some(word => text.includes(normalize(word)));

export function parseCommand(command) {
  const text = normalize(command);
  const explicitEmployee = Object.entries(employees).find(([name]) => text.includes(name))?.[1] || null;
  const projectId = projects.find(project => project.words.some(word => text.includes(normalize(word))))?.id || null;
  const isPaper = includesAny(text, ['محفظه تجريبيه', 'تجريبي', 'paper']) && includesAny(text, ['اشتر', 'بيع', 'صفقه', 'trade']);
  const isInvestment = includesAny(text, ['سهم', 'اسهم', 'استثمار', 'محفظه استثماريه', 'حلل ارامكو', 'ticker', 'بورصه']);
  const isBusiness = includesAny(text, ['نجيب فلوس', 'ربح', 'ايراد', 'دخل', 'تسعير', 'اشتراك', 'monetization', 'نمو']);
  const isQa = includesAny(text, ['راجع', 'اختبر', 'تاكد', 'تأكد', 'مشاكل مثبته', 'qa', 'جوده']);
  const isDesign = includesAny(text, ['واجهه', 'تجربه', 'تصميم', 'ux', 'ui']);
  const isCode = includesAny(text, ['اصلح', 'حل المشكله', 'بناء', 'كود', 'مستودع', 'repo', 'انشر', 'deploy', 'ci']);
  const isResearch = includesAny(text, ['ابحث', 'بحث', 'افضل طريقه', 'تحقيق', 'research']);
  const isProjectStatus = Boolean(projectId) && includesAny(text, ['موجز', 'ملخص', 'وش صار', 'ايش صار', 'اخر وضع', 'آخر وضع', 'وضع المشروع', 'حاله المشروع', 'حالة المشروع', 'وين وصل', 'وين وصلت', 'وش باقي', 'ما صار', 'تقرير عن']);
  const projectSpecificGeneral = Boolean(projectId) && !isPaper && !isInvestment && !isBusiness && !isQa && !isDesign && !isCode && !isResearch;
  const destructive = includesAny(text, ['احذف', 'امسح', 'دمر', 'drop', 'delete production']);
  const realTrade = includesAny(text, ['محفظه حقيقيه', 'حساب حقيقي', 'real money', 'live trading']);

  let route = 'GENERAL';
  if (realTrade || destructive) route = 'APPROVAL_REQUIRED';
  else if (isPaper) route = 'TRADING_PAPER';
  else if (isBusiness) route = 'BUSINESS';
  else if (isInvestment) route = 'FINANCE_ANALYSIS';
  else if (isQa) route = 'QA';
  else if (isDesign) route = 'DESIGN';
  else if (isCode) route = 'PROJECT_EXECUTION';
  else if (isResearch) route = 'RESEARCH';
  else if (isProjectStatus || projectSpecificGeneral) route = 'PROJECT_STATUS';

  const defaultEmployee = {
    GENERAL: 'sara', PROJECT_STATUS: 'sara', PROJECT_EXECUTION: 'fahad', RESEARCH: 'omar', QA: 'noura', DESIGN: 'lian',
    BUSINESS: 'rakan', FINANCE_ANALYSIS: 'rakan', TRADING_PAPER: 'rakan', APPROVAL_REQUIRED: explicitEmployee || 'sara'
  }[route];

  return {
    route,
    employeeId: explicitEmployee || defaultEmployee,
    projectId,
    requiresApproval: route === 'APPROVAL_REQUIRED',
    confidence: explicitEmployee || projectId || route !== 'GENERAL' ? 'HIGH' : 'MEDIUM',
    normalized: text
  };
}

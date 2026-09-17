// NAWAF HQ V2 — client resilience and interaction hardening
(() => {
  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const retryableStatus = status => status === 408 || status === 425 || status === 429 || status >= 500;
  let wasOffline = !navigator.onLine;

  window.fetch = async (input, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? 3 : 1;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await nativeFetch(input, init);
        if (!retryableStatus(response.status) || attempt === maxAttempts) return response;
        lastError = new Error(`HTTP_${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) throw error;
      }
      await sleep(700 * 2 ** (attempt - 1));
    }
    throw lastError || new Error('NETWORK_UNAVAILABLE');
  };

  const banner = document.createElement('div');
  banner.id = 'connectionBanner';
  banner.className = 'connection-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  document.body.appendChild(banner);

  const showBanner = (text, tone = 'warn') => {
    banner.textContent = text;
    banner.dataset.tone = tone;
    banner.classList.add('show');
  };
  const hideBanner = () => banner.classList.remove('show');
  const goRoute = route => {
    const button = [...document.querySelectorAll('[data-route]')].find(el => el.dataset.route === route);
    if (button) button.click();
    else location.hash = route;
  };
  const updateNetworkState = () => {
    if (!navigator.onLine) {
      wasOffline = true;
      showBanner('الاتصال بالإنترنت منقطع — بياناتك محفوظة، وبنرجع نتصل تلقائيًا.', 'bad');
      return;
    }
    showBanner('رجع الاتصال — جاري تحديث حالة الشركة…', 'good');
    if (wasOffline) {
      wasOffline = false;
      setTimeout(() => location.reload(), 650);
    } else setTimeout(hideBanner, 1800);
  };
  window.addEventListener('offline', updateNetworkState);
  window.addEventListener('online', updateNetworkState);

  const employeeNames = {sara:'سارة',omar:'عمر',fahad:'فهد',lian:'ليان',noura:'نورة',rakan:'راكان'};
  const employeeRoles = {
    sara:'المدير العام / السكرتير التنفيذي',
    omar:'البحث والتقنية',
    fahad:'الهندسة وتنفيذ المشاريع',
    lian:'المنتج والتجربة',
    noura:'الجودة والمراجعة',
    rakan:'التحليل المالي والنمو'
  };

  const ensureEmployeeDialog = () => {
    let dialog = document.querySelector('#employeeDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'employeeDialog';
    dialog.innerHTML = '<div class="dialog-head"><div><p class="eyebrow">ملف الموظف</p><h2 id="employeeDialogTitle"></h2></div><button class="icon-btn" data-close-employee aria-label="إغلاق">×</button></div><div id="employeeDialogBody"></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close-employee]').addEventListener('click', () => dialog.close());
    return dialog;
  };

  const openEmployee = id => {
    const dialog = ensureEmployeeDialog();
    const name = employeeNames[id] || id;
    document.querySelector('#employeeDialogTitle').textContent = name;
    document.querySelector('#employeeDialogBody').innerHTML = `
      <article class="section-card employee-profile-card">
        <p class="eyebrow">${employeeRoles[id] || 'موظف AI'}</p>
        <h3>${name}</h3>
        <p>يستخدم محرك التنفيذ المشترك للشركة، ويعرض فقط نتائج حقيقية مرتبطة بأدلة.</p>
        <div class="project-actions">
          <button class="primary" data-assign-employee="${id}">تكليفه بمهمة</button>
          <button class="link-btn" data-route-target="tasks">عرض المهام</button>
        </div>
      </article>`;
    dialog.showModal();
  };

  document.addEventListener('click', event => {
    const employee = event.target.closest('[data-employee]');
    if (employee) {
      event.preventDefault();
      event.stopPropagation();
      openEmployee(employee.dataset.employee);
      return;
    }
    const assign = event.target.closest('[data-assign-employee]');
    if (assign) {
      const id = assign.dataset.assignEmployee;
      ensureEmployeeDialog().close();
      goRoute('command');
      setTimeout(() => {
        const input = document.querySelector('#commandInput');
        if (input) {
          input.value = `${employeeNames[id] || id} `;
          input.focus();
        }
      }, 100);
      return;
    }
    const target = event.target.closest('[data-route-target]');
    if (target) {
      ensureEmployeeDialog().close();
      goRoute(target.dataset.routeTarget);
    }
  }, true);

  const mobileMenu = document.querySelector('#mobileMenu');
  if (mobileMenu) {
    mobileMenu.setAttribute('aria-label', 'فتح مركز الأوامر');
    mobileMenu.textContent = '⌘';
    mobileMenu.addEventListener('click', () => goRoute('command'));
  }

  window.addEventListener('unhandledrejection', event => {
    const message = String(event.reason?.message || event.reason || 'خطأ غير معروف');
    if (/fetch|network|HTTP_5|timeout/i.test(message)) showBanner('الاتصال بالخدمة تعثر مؤقتًا — جاري إعادة المحاولة تلقائيًا.', 'warn');
  });
})();
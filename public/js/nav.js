(function () {
  const raw = sessionStorage.getItem('kranti_user');
  if (!raw) {
    window.location.href = 'login.html';
    return;
  }
  const user = JSON.parse(raw);

  const pages = [
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'subscribers.html', label: 'Subscribers' },
    { href: 'profile.html', label: 'Profile' },
    { href: 'sauda-create.html', label: 'Sauda Create' },
    { href: 'purchase-order.html', label: 'Purchase Orders' },
    { href: 'bill-generation.html', label: 'Bill Generation' },
  ];

  const current = window.location.pathname.split('/').pop();
  const toolbar = document.getElementById('navToolbar');
  if (toolbar) {
    toolbar.innerHTML = pages.map(p =>
      `<a class="tool-btn${p.href === current ? ' current' : ''}" href="${p.href}">${p.label}</a>`
    ).join('') + `<span class="sep"></span><button class="tool-btn" id="logoutBtn">Log Off</button>`;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem('kranti_user');
      window.location.href = 'login.html';
    });
  }

  const userStatus = document.getElementById('userStatus');
  if (userStatus) userStatus.textContent = `Logged in as: ${user.name} (${user.role})`;

  const clockBox = document.getElementById('clockBox');
  if (clockBox) {
    const tick = () => {
      clockBox.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 1000 * 30);
  }

  window.KRANTI_USER = user;
})();

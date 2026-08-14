(async function () {
  const res = await fetch('/api/dashboard');
  const d = await res.json();

  const statGrid = document.getElementById('statGrid');
  const stats = [
    { num: d.totalDeals, lbl: 'Total Sauda' },
    { num: d.totalSOs, lbl: 'Sale Orders' },
    { num: d.pendingSOs, lbl: 'Pending Buyer Response' },
    { num: d.verifiedAcks, lbl: 'Verified & Stamped' },
    { num: d.disputed, lbl: 'Disputed / Concern Raised' },
  ];
  statGrid.innerHTML = stats.map(s => `
    <div class="stat-box">
      <div class="num">${s.num}</div>
      <div class="lbl">${s.lbl}</div>
    </div>
  `).join('');

  const statusLabels = {
    draft: ['Draft', 'neutral'],
    so_generated: ['SO Generated', 'warn'],
    verified: ['SO Verified', 'ok'],
    disputed: ['Disputed', 'danger'],
  };
  const statusTbody = document.querySelector('#statusTable tbody');
  statusTbody.innerHTML = d.statusBreakdown.map(s => {
    const meta = statusLabels[s.status] || [s.status, 'neutral'];
    return `<tr><td>${meta[0]}</td><td>${s.c}</td><td><span class="tag ${meta[1]}">${meta[0]}</span></td></tr>`;
  }).join('');

  const activityTbody = document.querySelector('#activityTable tbody');
  activityTbody.innerHTML = d.recentActivity.map(a => {
    const meta = statusLabels[a.status] || [a.status, 'neutral'];
    return `<tr><td>${a.order_code || '#' + String(a.id).padStart(4, '0')}</td><td>${a.buyer_name}</td><td><span class="tag ${meta[1]}">${meta[0]}</span></td></tr>`;
  }).join('');

  const buyerTbody = document.querySelector('#buyerTable tbody');
  buyerTbody.innerHTML = d.buyerVolume.map(b => `
    <tr><td>${b.name}</td><td>${b.deal_count}</td><td class="right">${Math.round(b.total_value).toLocaleString('en-IN')}</td></tr>
  `).join('');
})();

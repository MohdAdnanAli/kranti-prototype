let allSOs = [];

async function loadDrafts() {
  const res = await fetch('/api/deals/draft');
  const drafts = await res.json();
  document.getElementById('draftBody').innerHTML = drafts.map(d => `
    <tr>
      <td>${d.order_code || '—'}</td>
      <td>${d.buyer_name}</td>
      <td>${d.delivery_condition}</td>
      <td>${d.lifting_date || '—'} → ${d.last_lifting_date || '—'}</td>
      <td>${d.payment_type}</td>
      <td><button onclick="generateSO(${d.id})">Generate SO</button></td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="muted">No draft deals waiting — every deal has a SO.</td></tr>`;
}

async function generateSO(dealId) {
  const res = await fetch(`/api/deal/${dealId}/generate-so`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) { alert(data.error || 'Failed'); return; }
  loadDrafts();
  loadSOs();
}

async function loadSOs() {
  const res = await fetch('/api/sale-orders');
  allSOs = await res.json();
  render();
}

const statusMeta = {
  sent: ['Sent', 'neutral'],
  viewed: ['Viewed', 'warn'],
  verified: ['Verified', 'ok'],
  denied: ['Denied', 'danger'],
  ignored: ['Ignored', 'danger'],
  expired: ['Expired', 'danger'],
};

function countdownText(expiresAt, status) {
  if (status !== 'sent' && status !== 'viewed') return '—';
  const diffMs = new Date(expiresAt.replace(' ', 'T') + 'Z') - new Date();
  if (diffMs <= 0) return 'expiring…';
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s left`;
}

function render() {
  const search = document.getElementById('searchBox').value.toLowerCase();
  const status = document.getElementById('statusFilterSO').value;
  const delivery = document.getElementById('deliveryFilter').value;
  const payment = document.getElementById('paymentFilter').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;

  const rows = allSOs.filter(so => {
    const genDate = so.generated_at ? so.generated_at.slice(0, 10) : '';
    const inRange = (!dateFrom || genDate >= dateFrom) && (!dateTo || genDate <= dateTo);
    return inRange &&
      (!search || so.buyer_name.toLowerCase().includes(search) || so.sequential_code.includes(search) || (so.order_code || '').toLowerCase().includes(search)) &&
      (!status || so.status === status) &&
      (!delivery || so.delivery_condition === delivery) &&
      (!payment || so.payment_type === payment);
  });

  document.getElementById('soBody').innerHTML = rows.map(so => {
    const meta = statusMeta[so.status] || [so.status, 'neutral'];
    const canResend = ['denied', 'ignored', 'expired'].includes(so.status);
    const buyerLink = `${window.location.origin}/sale-order-confirm.html?so=${so.id}`;
    return `
      <tr>
        <td>${so.order_code || '—'}</td>
        <td><b>${so.sequential_code}</b></td>
        <td>${so.buyer_name}</td>
        <td>${so.agent_name || '—'}</td>
        <td>${so.transporter_name || '—'}</td>
        <td>${so.delivery_condition}</td>
        <td>${so.payment_type}</td>
        <td>${so.lifting_date || '—'} → ${so.last_lifting_date || '—'}</td>
        <td><span class="tag ${meta[1]}">${meta[0]}</span></td>
        <td class="countdown" data-expires="${so.expires_at || ''}" data-status="${so.status}">${countdownText(so.expires_at, so.status)}</td>
        <td class="hbox">
          <button onclick="navigator.clipboard.writeText('${buyerLink}'); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy Link',1200)">Copy Link</button>
          ${so.status === 'verified' ? `<a href="bill-generation.html?so=${so.id}">Open Bill</a>` : ''}
          ${canResend ? `<button onclick="resendSO(${so.id})">Resend</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('countBox').textContent = `${rows.length} of ${allSOs.length} records`;
}

async function resendSO(id) {
  await fetch(`/api/so/${id}/resend`, { method: 'POST' });
  loadSOs();
}

['searchBox', 'statusFilterSO', 'deliveryFilter', 'paymentFilter', 'dateFrom', 'dateTo'].forEach(id =>
  document.getElementById(id).addEventListener('input', render)
);

setInterval(() => {
  document.querySelectorAll('.countdown').forEach(td => {
    td.textContent = countdownText(td.dataset.expires, td.dataset.status);
  });
}, 1000);

loadDrafts();
loadSOs();

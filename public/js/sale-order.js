let allPOs = [];

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
      <td><button onclick="generatePO(${d.id})">Generate PO</button></td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="muted">No draft deals waiting — every deal has a PO.</td></tr>`;
}

async function generatePO(dealId) {
  const res = await fetch(`/api/deal/${dealId}/generate-po`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) { alert(data.error || 'Failed'); return; }
  loadDrafts();
  loadPOs();
}

async function loadPOs() {
  const res = await fetch('/api/purchase-orders');
  allPOs = await res.json();
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
  const status = document.getElementById('statusFilterPO').value;
  const delivery = document.getElementById('deliveryFilter').value;
  const payment = document.getElementById('paymentFilter').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;

  const rows = allPOs.filter(po => {
    const genDate = po.generated_at ? po.generated_at.slice(0, 10) : '';
    const inRange = (!dateFrom || genDate >= dateFrom) && (!dateTo || genDate <= dateTo);
    return inRange &&
      (!search || po.buyer_name.toLowerCase().includes(search) || po.sequential_code.includes(search) || (po.order_code || '').toLowerCase().includes(search)) &&
      (!status || po.status === status) &&
      (!delivery || po.delivery_condition === delivery) &&
      (!payment || po.payment_type === payment);
  });

  document.getElementById('poBody').innerHTML = rows.map(po => {
    const meta = statusMeta[po.status] || [po.status, 'neutral'];
    const canResend = ['denied', 'ignored', 'expired'].includes(po.status);
    const buyerLink = `${window.location.origin}/po-confirm.html?po=${po.id}`;
    return `
      <tr>
        <td>${po.order_code || '—'}</td>
        <td><b>${po.sequential_code}</b></td>
        <td>${po.buyer_name}</td>
        <td>${po.agent_name || '—'}</td>
        <td>${po.transporter_name || '—'}</td>
        <td>${po.delivery_condition}</td>
        <td>${po.payment_type}</td>
        <td>${po.lifting_date || '—'} → ${po.last_lifting_date || '—'}</td>
        <td><span class="tag ${meta[1]}">${meta[0]}</span></td>
        <td class="countdown" data-expires="${po.expires_at || ''}" data-status="${po.status}">${countdownText(po.expires_at, po.status)}</td>
        <td class="hbox">
          <button onclick="navigator.clipboard.writeText('${buyerLink}'); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy Link',1200)">Copy Link</button>
          ${po.status === 'verified' ? `<a href="bill-generation.html?po=${po.id}">Open Bill</a>` : ''}
          ${canResend ? `<button onclick="resendPO(${po.id})">Resend</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('countBox').textContent = `${rows.length} of ${allPOs.length} records`;
}

async function resendPO(id) {
  await fetch(`/api/po/${id}/resend`, { method: 'POST' });
  loadPOs();
}

['searchBox', 'statusFilterPO', 'deliveryFilter', 'paymentFilter', 'dateFrom', 'dateTo'].forEach(id =>
  document.getElementById(id).addEventListener('input', render)
);

setInterval(() => {
  document.querySelectorAll('.countdown').forEach(td => {
    td.textContent = countdownText(td.dataset.expires, td.dataset.status);
  });
}, 1000);

loadDrafts();
loadPOs();

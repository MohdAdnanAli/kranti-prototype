const params = new URLSearchParams(window.location.search);
const soId = params.get('so');
const main = document.getElementById('mainContent');

if (!soId) {
  main.innerHTML = '<p>No sale order specified.</p>';
} else {
  load();
}

async function load() {
  const res = await fetch(`/api/so/${soId}/public`);
  if (!res.ok) { main.innerHTML = '<p>This link could not be found.</p>'; return; }
  const d = await res.json();
  render(d);
  if (d.so.status === 'sent' || d.so.status === 'viewed') startCountdown(d.so.expires_at);
}

function statusBanner(status) {
  const map = {
    sent: ['neutral', 'Awaiting your response'],
    viewed: ['warn', 'Awaiting your response'],
    verified: ['ok', 'You have verified this order'],
    denied: ['danger', 'You denied this order'],
    ignored: ['danger', 'You ignored this order'],
    expired: ['danger', 'This link has expired'],
  };
  const [tag, label] = map[status] || ['neutral', status];
  return `<span class="tag ${tag}">${label}</span>`;
}

function render(d) {
  const so = d.so, deal = d.deal, items = d.items;
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  main.innerHTML = `
    <h2 class="section-title">Order ${deal.order_code} — SO ${so.sequential_code}</h2>
    <div class="hbox" style="margin-bottom:12px;">
      ${statusBanner(so.status)}
      <span id="countdownBox" class="muted"></span>
    </div>

    <fieldset>
      <legend>Buyer</legend>
      <b>${deal.buyer_name}</b><br>${deal.buyer_gstin || ''}<br>${deal.buyer_phone || ''}
    </fieldset>

    <fieldset>
      <legend>Deal Terms</legend>
      <div class="field-grid">
        <div><b>Delivery:</b> ${deal.delivery_condition}</div>
        <div><b>Lifting Window:</b> ${deal.lifting_date || '—'} → ${deal.last_lifting_date || '—'}</div>
        <div><b>Payment:</b> ${deal.payment_type}${deal.advance_pct != null ? ` (${deal.advance_pct}% / ${deal.credit_pct}%)` : ''}</div>
        ${deal.agent_name ? `<div><b>Agent:</b> ${deal.agent_name}</div>` : ''}
      </div>
    </fieldset>

    <fieldset>
      <legend>Items</legend>
      <table class="grid">
        <thead><tr><th>Sl. No.</th><th>Product Name</th><th>Description</th><th>HSN Code</th><th>Quantity</th><th>UOM</th><th>Unit Rate (included ₹)</th></tr></thead>
        <tbody>
          ${items.map((i, idx) => `<tr><td class="center">${idx + 1}</td><td>${i.product_name}</td><td>${i.description || ''}</td><td>${i.hsn}</td>
            <td class="right">${i.qty}</td><td>${i.unit}</td>
            <td class="right">${i.price.toLocaleString('en-IN')}</td></tr>`).join('')}
          <tr><td colspan="6" class="right"><b>Total</b></td><td class="right"><b>₹${total.toLocaleString('en-IN')}</b></td></tr>
        </tbody>
      </table>
    </fieldset>

    <fieldset>
      <legend>Your Response</legend>
      <div id="responseArea"></div>
    </fieldset>
  `;

  renderResponseArea(so.status);
}

function renderResponseArea(status) {
  const area = document.getElementById('responseArea');
  if (status === 'sent' || status === 'viewed') {
    area.innerHTML = `
      <div class="hbox">
        <button class="primary" id="verifyBtn">Verify — I agree to these terms</button>
        <button id="denyBtn">Deny</button>
        <button id="ignoreBtn">Ignore for now</button>
      </div>
      <p class="muted" style="margin-top:8px;">Verifying locks these terms and moves this deal forward to bill generation.</p>
    `;
    document.getElementById('verifyBtn').addEventListener('click', () => respond('verify'));
    document.getElementById('denyBtn').addEventListener('click', () => respond('deny'));
    document.getElementById('ignoreBtn').addEventListener('click', () => respond('ignore'));
  } else if (status === 'verified') {
    area.innerHTML = `<p>Thank you — this order is verified and locked. The seller will generate your invoice next.
      Once ready, you'll get a separate link to acknowledge the bill via OTP. You can also check now:</p>
      <a href="bill-ack.html?so=${soId}">Check Bill Status →</a>`;
  } else if (status === 'expired') {
    area.innerHTML = `<p>This confirmation window has closed. Please contact the seller for a new link.</p>`;
  } else {
    area.innerHTML = `<p>You already responded to this order (${status}).</p>`;
  }
}

async function respond(action) {
  const res = await fetch(`/api/so/${soId}/respond`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error); load(); return; }
  load();
}

function startCountdown(expiresAt) {
  const box = document.getElementById('countdownBox');
  const tick = () => {
    if (!box) return;
    const diff = new Date(expiresAt.replace(' ', 'T') + 'Z') - new Date();
    if (diff <= 0) { box.textContent = 'expired'; load(); return; }
    const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
    box.textContent = `expires in ${m}m ${s}s`;
    setTimeout(tick, 1000);
  };
  tick();
}

const params = new URLSearchParams(window.location.search);
const poId = params.get('po');

if (!poId) showPicker(); else loadBill(poId);

async function showPicker() {
  document.getElementById('pickerView').style.display = 'block';
  document.getElementById('billView').style.display = 'none';
  const res = await fetch('/api/purchase-orders');
  const pos = await res.json();
  const verified = pos.filter(po => po.status === 'verified');
  document.getElementById('pickerBody').innerHTML = verified.map(po => `
    <tr>
      <td>${po.order_code || '—'}</td>
      <td><b>${po.sequential_code}</b></td>
      <td>${po.buyer_name}</td>
      <td>${po.status}</td>
      <td><a href="bill-generation.html?po=${po.id}">Open</a></td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="muted">No verified purchase orders yet.</td></tr>`;
}

async function loadBill(id) {
  document.getElementById('pickerView').style.display = 'none';
  document.getElementById('billView').style.display = 'block';

  const res = await fetch(`/api/bill/${id}`);
  const d = await res.json();

  document.getElementById('orderCode').textContent = d.po.order_code || '—';
  document.getElementById('billCode').textContent = d.po.sequential_code;

  document.getElementById('buyerInfo').innerHTML =
    `<b>${d.po.buyer_name}</b><br>${d.po.buyer_gstin}<br>${d.po.buyer_phone}${d.po.buyer_email ? '<br>' + d.po.buyer_email : ''}<br><span class="muted">${d.po.buyer_address}</span>`;
  document.getElementById('agentInfo').innerHTML = d.po.agent_name
    ? `<b>${d.po.agent_name}</b><br>${d.po.agent_phone || ''}${d.po.agent_email ? '<br>' + d.po.agent_email : ''}`
    : `<span class="muted">No agent involved</span>`;
  document.getElementById('transInfo').innerHTML = d.po.transporter_name
    ? `<b>${d.po.transporter_name}</b><br>${d.po.transporter_phone || ''}${d.po.transporter_email ? '<br>' + d.po.transporter_email : ''}`
    : `<span class="muted">No transporter attached</span>`;

document.getElementById('billItems').innerHTML = d.items.map((i, idx) => `
    <tr><td class="center">${idx + 1}</td><td>${i.product_name}</td><td>${i.description || ''}</td><td>${i.hsn}</td>
      <td class="right">${i.qty}</td><td>${i.unit}</td>
      <td class="right">${i.price.toLocaleString('en-IN')}</td></tr>
  `).join('');

  if (d.ack && d.ack.invoice_number) {
    document.getElementById('invoiceNumber').value = d.ack.invoice_number;
    document.getElementById('invoiceDate').value = d.ack.invoice_date;
  } else {
    const sug = await (await fetch('/api/invoice/next')).json();
    document.getElementById('invoiceNumber').value = sug.suggested;
    document.getElementById('invoiceDate').value = new Date().toISOString().slice(0, 10);
  }

  const buyerLink = `${window.location.origin}/bill-ack.html?po=${id}`;
  document.getElementById('buyerLinkBox').value = buyerLink;

  if (d.ack && d.ack.invoice_number) {
    document.getElementById('buyerLinkFieldset').style.display = 'block';
    document.getElementById('statusFieldset').style.display = 'block';
    renderStatus(d.ack);
  }

  window._ocrVerified = false;
}

document.getElementById('ocrRunBtn').addEventListener('click', () => {
  const file = document.getElementById('ocrFile').files[0];
  const result = document.getElementById('ocrResult');
  if (!file) { result.textContent = 'Choose a file first (demo only — any image works).'; return; }
  result.textContent = 'Scanning…';
  setTimeout(() => {
    result.innerHTML = '<span style="color:#0B6B0B; font-weight:bold;">✓ Matched — scanned figures align with recorded deal.</span>';
    window._ocrVerified = true;
  }, 900);
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('buyerLinkBox').value);
  const btn = document.getElementById('copyLinkBtn');
  btn.textContent = 'Copied!';
  setTimeout(() => (btn.textContent = 'Copy Link'), 1200);
});

document.getElementById('prepareBtn').addEventListener('click', async () => {
  const invoice_number = document.getElementById('invoiceNumber').value.trim();
  const invoice_date = document.getElementById('invoiceDate').value;
  if (!invoice_number || !invoice_date) { alert('Invoice number and date are required.'); return; }

  const res = await fetch(`/api/bill/${poId}/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_number, invoice_date, ocr_verified: !!window._ocrVerified })
  });
  const data = await res.json();
  if (!res.ok) { document.getElementById('prepareMsg').textContent = data.error; return; }
  document.getElementById('prepareMsg').textContent = 'Saved. Share the buyer link below.';
  loadBill(poId);
});

function renderStatus(ack) {
  const box = document.getElementById('statusBox');
  if (ack.status === 'final') {
    box.innerHTML = `
      <div class="hbox" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <div><b>OTP Verified:</b> ${ack.otp_verified_at}</div>
          <div><b>E-Stamp Reference:</b> ${ack.estamp_ref}</div>
          <div><b>Stamped At:</b> ${ack.estamp_timestamp}</div>
          <div><b>Grace Period Ends:</b> ${ack.grace_period_ends_at}</div>
          <div><b>Distributed:</b> ${ack.distributed_at ? ack.distributed_at + ' via ' + (ack.distributed_channels || '') : 'not yet'}</div>
        </div>
        <div class="stamp">Verified ✓</div>
      </div>
    `;
  } else if (ack.otp_locked) {
    box.innerHTML = `<p style="color:#9A1414; font-weight:bold;">Buyer's OTP attempts are exhausted.</p>
      <button id="unlockBtn">Unlock OTP for Buyer</button>`;
    document.getElementById('unlockBtn').addEventListener('click', async () => {
      await fetch(`/api/bill/${poId}/unlock-otp`, { method: 'POST' });
      loadBill(poId);
    });
  } else {
    box.innerHTML = `<p class="muted">Waiting on the buyer to trigger and verify their OTP via the link above.</p>`;
  }
}

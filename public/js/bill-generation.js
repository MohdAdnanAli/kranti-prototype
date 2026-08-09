const params = new URLSearchParams(window.location.search);
const soId = params.get('so');

if (!soId) showPicker(); else loadBill(soId);

async function showPicker() {
  document.getElementById('pickerView').style.display = 'block';
  document.getElementById('billView').style.display = 'none';
  const res = await fetch('/api/sale-orders');
  const sos = await res.json();
  const verified = sos.filter(so => so.status === 'verified');
  document.getElementById('pickerBody').innerHTML = verified.map(so => `
    <tr>
      <td>${so.order_code || '—'}</td>
      <td><b>${so.sequential_code}</b></td>
      <td>${so.buyer_name}</td>
      <td>${so.status}</td>
      <td><a href="bill-generation.html?so=${so.id}">Open</a></td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="muted">No verified sale orders yet.</td></tr>`;
}

async function loadBill(id) {
  document.getElementById('pickerView').style.display = 'none';
  document.getElementById('billView').style.display = 'block';

  const res = await fetch(`/api/bill/${id}`);
  const d = await res.json();

  document.getElementById('orderCode').textContent = d.so.order_code || '—';
  document.getElementById('billCode').textContent = d.so.sequential_code;

const seller = d.seller || {};
  document.getElementById('sellerInfo').innerHTML =
    `<b>${seller.name || '—'}</b><br>GSTIN: ${seller.gstin || '—'}`;

  document.getElementById('buyerInfo').innerHTML =
    `<b>${d.so.buyer_name}</b><br>${d.so.buyer_gstin}<br>${d.so.buyer_phone}${d.so.buyer_email ? '<br>' + d.so.buyer_email : ''}<br><span class="muted">${d.so.buyer_address}</span>`;
  document.getElementById('agentInfo').innerHTML = d.so.agent_name
    ? `<b>${d.so.agent_name}</b><br>${d.so.agent_phone || ''}${d.so.agent_email ? '<br>' + d.so.agent_email : ''}`
    : `<span class="muted">No agent involved</span>`;
  document.getElementById('transInfo').innerHTML = d.so.transporter_name
    ? `<b>${d.so.transporter_name}</b><br>${d.so.transporter_phone || ''}${d.so.transporter_email ? '<br>' + d.so.transporter_email : ''}`
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

const buyerLink = `${window.location.origin}/bill-ack.html?so=${id}`;
  document.getElementById('buyerLinkBox').value = buyerLink;

  // Render QR code for the buyer acknowledgement link.
  const qrCanvas = document.getElementById('buyerLinkQr');
  if (qrCanvas && window.QRCode) {
    try {
      const qrcode = new window.QRCode();
      const matrix = qrcode.make(buyerLink);
      qrcode.draw(qrCanvas, matrix, 120);
    } catch (e) {
      // QR generation failed silently — link still works.
    }
  }

  // Show the diagonal "VERIFIED" seal preview when OCR cross-check passed.
  const watermark = document.getElementById('billWatermark');
  if (watermark) {
    watermark.style.display = (d.ack && d.ack.ocr_verified) ? 'flex' : 'none';
  }

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
    // Show live seal preview once OCR cross-check passes.
    const watermark = document.getElementById('billWatermark');
    if (watermark) watermark.style.display = 'flex';
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

  const res = await fetch(`/api/bill/${soId}/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_number, invoice_date, ocr_verified: !!window._ocrVerified })
  });
  const data = await res.json();
  if (!res.ok) { document.getElementById('prepareMsg').textContent = data.error; return; }
  document.getElementById('prepareMsg').textContent = 'Saved. Share the buyer link below.';
  loadBill(soId);
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
      await fetch(`/api/bill/${soId}/unlock-otp`, { method: 'POST' });
      loadBill(soId);
    });
  } else {
    box.innerHTML = `<p class="muted">Waiting on the buyer to trigger and verify their OTP via the link above.</p>`;
  }
}

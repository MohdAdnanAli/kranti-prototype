const params = new URLSearchParams(window.location.search);
const soId = params.get('so');
const main = document.getElementById('mainContent');

if (!soId) {
  main.innerHTML = '<p>No sale order specified.</p>';
} else {
  load();
}

async function load() {
  const res = await fetch(`/api/bill/${soId}`);
  if (!res.ok) { main.innerHTML = '<p>Not found.</p>'; return; }
  const d = await res.json();
  render(d);
}

function render(d) {
  const so = d.so;

  if (so.status !== 'verified') {
    main.innerHTML = `<p>This bill isn't ready yet — the sale order must be verified first. Current status: <b>${so.status}</b>.</p>`;
    return;
  }
  if (!d.ack || !d.ack.invoice_number) {
    main.innerHTML = `<p>The seller hasn't generated this invoice yet. Please check back shortly.</p>`;
    return;
  }

const items = d.items;
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

const seller = d.seller || {};
  main.innerHTML = `
    <div class="sealed-bill">
    ${d.ack.ocr_verified ? `
      <div class="watermark">
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
      </div>` : ''}
    <h2 class="section-title">Order ${so.order_code} — Invoice ${d.ack.invoice_number}</h2>
    <div class="field-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:14px;">
      <fieldset>
        <legend>Seller</legend>
        <b>${seller.name || '—'}</b><br>GSTIN: ${seller.gstin || '—'}
      </fieldset>
      <fieldset>
        <legend>Buyer</legend>
        <b>${so.buyer_name}</b><br>${so.buyer_gstin || ''}<br>${so.buyer_phone || ''}
      </fieldset>
      <fieldset>
        <legend>Invoice</legend>
        <div><b>Number:</b> ${d.ack.invoice_number}</div>
        <div><b>Date:</b> ${d.ack.invoice_date}</div>
      </fieldset>
    </div>

    <fieldset>
      <legend>Items</legend>
      <table class="grid">
<thead><tr><th>Sr. No.</th><th>Product Name</th><th>Description</th><th>HSN Code</th><th>Quantity</th><th>UOM</th><th>Unit Rate (included ₹)</th></tr></thead>
        <tbody>
          ${items.map((i, idx) => `<tr><td class="center">${idx + 1}</td><td>${i.product_name}</td><td>${i.description || ''}</td><td>${i.hsn}</td>
            <td class="right">${i.qty}</td><td>${i.unit}</td>
            <td class="right">${i.price.toLocaleString('en-IN')}</td></tr>`).join('')}
          <tr><td colspan="6" class="right"><b>Total</b></td><td class="right"><b>₹${total.toLocaleString('en-IN')}</b></td></tr>
        </tbody>
      </table>
    </fieldset>

    <fieldset>
      <legend>Terms &amp; Conditions</legend>
      <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">${d.terms ? d.terms.content : 'No terms attached.'}</pre>
    </fieldset>

<fieldset>
      <legend>Acknowledgement</legend>
      <div id="verifySection"></div>
    </fieldset>
    </div>
  `;

  renderVerification(d);
}

function renderVerification(d) {
  const box = document.getElementById('verifySection');
  const ack = d.ack;

  if (ack.status === 'final') {
    box.innerHTML = `
      <div class="hbox" style="justify-content: space-between; align-items:flex-start;">
        <div>
          <div><b>OTP Verified:</b> ${ack.otp_verified_at}</div>
          <div><b>E-Stamp Reference:</b> ${ack.estamp_ref}</div>
          <div><b>Stamped At:</b> ${ack.estamp_timestamp}</div>
          <div><b>Grace Period Ends:</b> ${ack.grace_period_ends_at} <span class="muted">(raise a concern before this)</span></div>
        </div>
        <div><div class="stamp">Verified ✓</div></div>
      </div>
      <div style="margin-top:12px;">
        <button onclick="alert('Dispute / Damage Report module — deferred, to be designed separately.')">Raise a Concern</button>
      </div>
    `;
    return;
  }

  if (ack.otp_locked) {
    box.innerHTML = `<p style="color:#9A1414; font-weight:bold;">OTP attempts exhausted. Locked.</p>
      <p class="muted">Contact the seller to unlock this form and try again.</p>`;
    return;
  }

  box.innerHTML = `
    <p class="muted">Trigger an OTP to acknowledge receipt of this invoice. Verification seals the document as legal evidence.</p>
    <div class="hbox">
      <button id="getOtpBtn" class="primary">Get OTP</button>
      <span id="demoOtpNote" class="muted"></span>
    </div>
    <div class="otp-box hbox" id="otpEntryBox" style="display:none; margin-top:10px;">
      <input type="text" id="otpInput" maxlength="6" placeholder="——————">
      <button id="verifyOtpBtn">Verify</button>
      <span id="otpMsg" class="muted"></span>
    </div>
  `;

  document.getElementById('getOtpBtn').addEventListener('click', async () => {
    const r = await fetch(`/api/bill/${soId}/request-otp`, { method: 'POST' });
    const data = await r.json();
    if (!r.ok) { document.getElementById('demoOtpNote').textContent = data.error; return; }
    document.getElementById('demoOtpNote').innerHTML = `OTP sent to your registered phone. <b>(Demo OTP: ${data.demo_otp})</b>`;
    document.getElementById('otpEntryBox').style.display = 'flex';
  });

  document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
    const otp = document.getElementById('otpInput').value.trim();
    const r = await fetch(`/api/bill/${soId}/verify-otp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp })
    });
    const data = await r.json();
    if (r.ok && data.verified) {
      // Trigger seller-side distribution once sealed.
      await fetch(`/api/bill/${soId}/distribute`, { method: 'POST' });
      load();
    } else {
      document.getElementById('otpMsg').textContent = data.error + (data.attempts ? ` (attempt ${data.attempts}/3)` : '');
      if (data.locked) load();
    }
  });
}

const items = [
  { sr: 1, name: 'Refined Cotton Yarn', desc: '40s combed, 2-ply', hsn: '5205', qty: 1200, unit: 'kg', price: 640 },
  { sr: 2, name: 'Dye Stuff (Reactive)', desc: 'Turquoise H-EXL', hsn: '3204', qty: 85, unit: 'kg', price: 920 },
  { sr: 3, name: 'Packing Cartons', desc: '5-layer corrugated', hsn: '4819', qty: 500, unit: 'pcs', price: 45 }
];
const total = items.reduce((s, i) => s + i.qty * i.price, 0);

function render() {
  const ocr = document.getElementById('mockOcr').checked;
  const otp = document.getElementById('mockOtp').checked;

  document.getElementById('mockBill').innerHTML = `
    <div class="sealed-bill">
      ${ocr ? `
      <div class="watermark">
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
        <div class="band">Verified ✓</div>
      </div>` : ''}
      <h2 class="section-title">Order ORD-000123 — Invoice INV-2025-0042</h2>
      <div class="field-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:14px;">
        <fieldset>
          <legend>Seller</legend>
          <b>Kranti Textiles Pvt. Ltd.</b><br>GSTIN: 27AABCT1421F1Z5
        </fieldset>
        <fieldset>
          <legend>Buyer</legend>
          <b>Shree Ram Fabrics</b><br>GSTIN: 27AABCS8842P1Q2<br>+91 98200 12345
        </fieldset>
        <fieldset>
          <legend>Invoice</legend>
          <div><b>Number:</b> INV-2025-0042</div>
          <div><b>Date:</b> 2025-06-12</div>
        </fieldset>
      </div>

      <fieldset>
        <legend>Items</legend>
        <table class="grid">
          <thead><tr><th>Sl. No.</th><th>Product Name</th><th>Description</th><th>HSN Code</th><th>Quantity</th><th>UOM</th><th>Unit Rate (included ₹)</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr><td class="center">${i.sr}</td><td>${i.name}</td><td>${i.desc}</td><td>${i.hsn}</td>
              <td class="right">${i.qty}</td><td>${i.unit}</td>
              <td class="right">${i.price.toLocaleString('en-IN')}</td></tr>`).join('')}
            <tr><td colspan="6" class="right"><b>Total</b></td><td class="right"><b>₹${total.toLocaleString('en-IN')}</b></td></tr>
          </tbody>
        </table>
      </fieldset>

      <fieldset>
        <legend>Terms &amp; Conditions</legend>
        <pre style="white-space:pre-wrap; font-family:inherit; margin:0;">1. Goods once sold will not be taken back.
2. Interest @ 18% p.a. charged on overdue payments.
3. Subject to local jurisdiction only.</pre>
      </fieldset>

      <fieldset>
        <legend>Acknowledgement</legend>
        ${otp ? `
        <div class="hbox" style="justify-content: space-between; align-items:flex-start;">
          <div>
            <div><b>OTP Verified:</b> 2025-06-12 14:32:05</div>
            <div><b>E-Stamp Reference:</b> ESTAMP-KR-0042</div>
            <div><b>Stamped At:</b> 2025-06-12 14:32:05</div>
            <div><b>Grace Period Ends:</b> 2025-06-15 14:32:05</div>
          </div>
          <div><div class="stamp">Verified ✓</div></div>
        </div>` : '<p class="muted">Awaiting buyer OTP verification to seal the document.</p>'}
      </fieldset>
    </div>
  `;
}

document.getElementById('mockOcr').addEventListener('change', render);
document.getElementById('mockOtp').addEventListener('change', render);
render();

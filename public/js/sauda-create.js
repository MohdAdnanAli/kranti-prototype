let lookups = { buyers: [], agents: [], bestBuys: [] };
let legCount = 0;
const DRAFT_KEY = 'sauda_create';
const scheduleSave = debounce(saveDraft, 400);

async function loadLookups() {
  const res = await fetch('/api/sauda/lookups');
  lookups = await res.json();
  document.getElementById('agentSelect').innerHTML =
    `<option value="">— None —</option>` + lookups.agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
}

// ---------- Draft persistence ----------
// Snapshot the whole order form into localStorage so navigating away & back
// doesn't wipe in-progress (unsaved) input.
function saveDraft() {
  const legs = Array.from(document.querySelectorAll('.leg-block')).map(block => ({
    buyer_id: block.querySelector('.buyerId').value,
    buyer_search: block.querySelector('.buyerSearch').value,
    delivery_condition: block.querySelector('.deliveryCondition').value,
    lifting_date: block.querySelector('.liftingDate').value,
    last_lifting_date: block.querySelector('.lastLiftingDate').value,
    payment_type: block.querySelector('.paymentType').value,
    advance_pct: block.querySelector('.advancePct').value,
    credit_pct: block.querySelector('.creditPct').value,
    items: Array.from(block.querySelectorAll('.itemsBody tr')).map(tr => ({
      name: tr.querySelector('.i-name').value,
      description: tr.querySelector('.i-description').value,
      hsn: tr.querySelector('.i-hsn').value,
      qty: tr.querySelector('.i-qty').value,
      unit: tr.querySelector('.i-unit').value,
      price: tr.querySelector('.i-price').value,
    })),
  }));

  FormCache.save(DRAFT_KEY, {
    agent_id: document.getElementById('agentSelect').value,
    notes: document.getElementById('orderNotes').value,
    legs,
  });
}

function restoreDraft() {
  const draft = FormCache.load(DRAFT_KEY);
  if (!draft) return false;
  if (draft.agent_id) document.getElementById('agentSelect').value = draft.agent_id;
  if (draft.notes != null) document.getElementById('orderNotes').value = draft.notes;

  document.getElementById('legsContainer').innerHTML = '';
  (draft.legs || []).forEach(leg => {
    addLeg();
    const block = document.getElementById('legsContainer').lastElementChild;
    if (leg.buyer_id) {
      block.querySelector('.buyerId').value = leg.buyer_id;
      const buyer = lookups.buyers.find(b => String(b.id) === String(leg.buyer_id));
      if (buyer) block.querySelector('.buyerSearch').value = `${buyer.name}${buyer.gstin ? ' (' + buyer.gstin + ')' : ''}`;
    } else if (leg.buyer_search) {
      block.querySelector('.buyerSearch').value = leg.buyer_search;
    }
    if (leg.delivery_condition) block.querySelector('.deliveryCondition').value = leg.delivery_condition;
    if (leg.lifting_date) block.querySelector('.liftingDate').value = leg.lifting_date;
    if (leg.last_lifting_date) block.querySelector('.lastLiftingDate').value = leg.last_lifting_date;
    if (leg.payment_type) block.querySelector('.paymentType').value = leg.payment_type;
    if (leg.advance_pct != null) block.querySelector('.advancePct').value = leg.advance_pct;
    if (leg.credit_pct != null) block.querySelector('.creditPct').value = leg.credit_pct;
    // Replace the single default empty row with the saved rows.
    block.querySelector('.itemsBody').innerHTML = '';
(leg.items || []).forEach(item => {
      addItemRow(block, {
        product_name: item.name,
        description: item.description,
        hsn: item.hsn,
        qty: item.qty,
        unit: item.unit,
        default_rate: item.price,
      });
    });
  });
  return draft.legs.length > 0;
}

// Listen to any input/change anywhere in the form to trigger an auto-save.
document.addEventListener('input', (e) => {
  if (e.target.closest('#legsContainer') || e.target.closest('.order-level')) scheduleSave();
});
document.addEventListener('change', (e) => {
  if (e.target.closest('#legsContainer')) scheduleSave();
});

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Build a search-as-you-type buyer picker inside one leg block.
function initBuyerPicker(block) {
  const picker = block.querySelector('.buyer-picker');
  const search = block.querySelector('.buyerSearch');
  const idInput = block.querySelector('.buyerId');
  const results = block.querySelector('.buyerResults');

  function renderResults(query) {
    const q = (query || '').trim().toLowerCase();
    const matches = lookups.buyers.filter(b =>
      !q ||
      (b.name || '').toLowerCase().includes(q) ||
      (b.gstin || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      results.innerHTML = `<div class="buyer-empty">No buyers match. Use “+ New” to create one.</div>`;
      picker.classList.add('open');
      return;
    }
    results.innerHTML = matches.map(b => `
      <div class="buyer-result" data-id="${b.id}">
        <div>${b.name}${b.is_favorite ? ' ★' : ''}</div>
        <div class="muted-item">${b.gstin ? 'GSTIN ' + b.gstin : 'no GSTIN'}${b.phone ? ' · ' + b.phone : ''}</div>
      </div>
    `).join('');
    picker.classList.add('open');
    results.querySelectorAll('.buyer-result').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectBuyer(el.dataset.id);
      });
    });
  }

  function selectBuyer(id) {
    const buyer = lookups.buyers.find(b => String(b.id) === String(id));
    if (!buyer) return;
    idInput.value = buyer.id;
    search.value = `${buyer.name}${buyer.gstin ? ' (' + buyer.gstin + ')' : ''}`;
    picker.classList.remove('open');
    search.dispatchEvent(new Event('change', { bubbles: true }));
  }

  search.addEventListener('input', () => {
    idInput.value = ''; // clearing the typed text invalidates the previous selection
    renderResults(search.value);
  });
  search.addEventListener('focus', () => renderResults(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { picker.classList.remove('open'); return; }
    if (e.key === 'Enter') {
      const first = results.querySelector('.buyer-result[data-id]');
      if (first) { e.preventDefault(); selectBuyer(first.dataset.id); }
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!picker.contains(e.target)) picker.classList.remove('open');
  });
}
function bestBuyOptionsHtml() {
  return lookups.bestBuys.map(b => `<option value="${b.id}">${b.product_name}</option>`).join('');
}

function addLeg() {
  legCount++;
  const tpl = document.getElementById('legTemplate');
  const node = tpl.content.cloneNode(true);
  const block = node.querySelector('.leg-block');
  block.dataset.legId = legCount;
  block.querySelector('.leg-num').textContent = '#' + legCount;
  block.querySelector('.bestBuySelect').innerHTML = bestBuyOptionsHtml();

  // Auto-fill the Lifting Date (window start) with today's date.
  block.querySelector('.liftingDate').value = todayIso();

  // Buyer search picker.
  initBuyerPicker(block);

  // Payment ratio auto-complement
  const advInput = block.querySelector('.advancePct');
  const credInput = block.querySelector('.creditPct');
  advInput.addEventListener('input', () => {
    const v = parseFloat(advInput.value);
    credInput.value = isNaN(v) ? '' : Math.max(0, Math.min(100, 100 - v));
  });

  block.querySelector('.remove-leg-btn').addEventListener('click', () => block.remove());

  // "+ New" redirects to the Buyer list create area on the Profile page.
  block.querySelector('.newBuyerBtn').addEventListener('click', () => {
    window.location.href = 'profile.html#buyers';
  });

  block.querySelector('.addItemRowBtn').addEventListener('click', () => addItemRow(block));
  block.querySelector('.addBestBuyBtn').addEventListener('click', () => {
    const id = parseInt(block.querySelector('.bestBuySelect').value);
    const item = lookups.bestBuys.find(b => b.id === id);
    if (item) addItemRow(block, item);
  });

  document.getElementById('legsContainer').appendChild(node);
  const insertedBlock = document.getElementById('legsContainer').lastElementChild;
  addItemRow(insertedBlock);
}

function renumberItems(block) {
  Array.from(block.querySelectorAll('.itemsBody tr')).forEach((tr, idx) => {
    const cell = tr.querySelector('.i-sr');
    if (cell) cell.textContent = idx + 1;
  });
}

function addItemRow(block, prefill) {
  const tbody = block.querySelector('.itemsBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="i-sr center"></td>
    <td><input type="text" class="i-name" value="${prefill?.product_name || ''}"></td>
    <td><input type="text" class="i-description" value="${prefill?.description || ''}" placeholder="Item description"></td>
    <td><input type="text" class="i-hsn" value="${prefill?.hsn || ''}" style="width:90px;"></td>
    <td><input type="number" class="i-qty" value="${prefill?.qty || ''}" style="width:80px;"></td>
    <td><input type="text" class="i-unit" value="${prefill?.unit || ''}" style="width:90px;"></td>
    <td><input type="number" class="i-price" value="${prefill?.default_rate || ''}" style="width:100px;"></td>
    <td><button type="button" class="removeItemBtn">Remove</button></td>
  `;
  tr.querySelector('.removeItemBtn').addEventListener('click', () => {
    tr.remove();
    renumberItems(block);
  });
  tbody.appendChild(tr);
  renumberItems(block);
}

document.getElementById('addLegBtn').addEventListener('click', addLeg);

document.getElementById('submitOrderBtn').addEventListener('click', async () => {
  const legBlocks = document.querySelectorAll('.leg-block');
  if (legBlocks.length === 0) { alert('Add at least one buyer.'); return; }

  const legs = [];
  for (const block of legBlocks) {
    const buyer_id = block.querySelector('.buyerId').value;
    if (!buyer_id) { alert('Every buyer leg needs a buyer selected.'); return; }
const items = Array.from(block.querySelectorAll('.itemsBody tr')).map(tr => ({
      product_name: tr.querySelector('.i-name').value,
      description: tr.querySelector('.i-description').value,
      hsn: tr.querySelector('.i-hsn').value,
      qty: parseFloat(tr.querySelector('.i-qty').value) || 0,
      unit: tr.querySelector('.i-unit').value,
      price: parseFloat(tr.querySelector('.i-price').value) || 0,
    })).filter(i => i.product_name);
    if (items.length === 0) { alert('Each buyer leg needs at least one item.'); return; }

    legs.push({
      buyer_id,
      delivery_condition: block.querySelector('.deliveryCondition').value,
      lifting_date: block.querySelector('.liftingDate').value,
      last_lifting_date: block.querySelector('.lastLiftingDate').value,
      payment_type: block.querySelector('.paymentType').value,
      advance_pct: parseFloat(block.querySelector('.advancePct').value) || null,
      credit_pct: parseFloat(block.querySelector('.creditPct').value) || null,
      items,
    });
  }

  const payload = {
    agent_id: document.getElementById('agentSelect').value || null,
    notes: document.getElementById('orderNotes').value,
    legs,
  };

  const res = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) { document.getElementById('submitMsg').textContent = data.error || 'Failed to save.'; return; }
  // Order recorded — clear the persisted draft so a fresh form starts empty.
  FormCache.clear(DRAFT_KEY);
  document.getElementById('submitMsg').innerHTML =
    `Order <b>${data.orderCode}</b> recorded with ${legs.length} buyer leg(s), each at draft state. Go to Purchase Orders to generate a PO per buyer.`;
});

loadLookups().then(() => {
  if (!restoreDraft()) addLeg();
});

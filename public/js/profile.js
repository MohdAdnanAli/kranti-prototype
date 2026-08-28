let profileData = null;

const NOTE_DRAFT_KEY = 'profile_note';

async function loadProfile() {
  const res = await fetch('/api/profile');
  profileData = await res.json();
  renderOrg();
  renderBuyers();
  renderAgents();
  renderTransporters();
  renderTerms();
  renderBestBuys();
  // Prefer a locally saved working-note draft (survives page navigation),
  // falling back to the last content saved to the server.
  const draft = FormCache.load(NOTE_DRAFT_KEY);
  document.getElementById('noteText').value =
    draft != null ? draft : (profileData.note ? profileData.note.content : '');
}

// Auto-persist the working note so back-and-forth navigation keeps unsaved text.
document.getElementById('noteText').addEventListener('input', debounce((e) => {
  FormCache.save(NOTE_DRAFT_KEY, e.target.value);
}, 400));

// ---------- 1. Seller Details ----------
function renderOrg() {
  const org = profileData.org;
  document.getElementById('orgFields').innerHTML = `
    <div class="field-row">
      <label class="f-label">Business Name</label>
      <input type="text" id="org_name" value="${org.name}">
    </div>
    <div class="field-row">
      <label class="f-label">GSTIN</label>
      <input type="text" id="org_gstin" value="${org.gstin}" style="text-transform:uppercase;">
    </div>
    <div class="field-row">
      <label class="f-label">Subscription Plan</label>
      <input type="text" value="${org.subscription_plan}" readonly>
    </div>
    <div class="field-row">
      <label class="f-label">Subscription Start</label>
      <input type="text" value="${org.subscription_start || ''}" readonly>
    </div>
    <div class="field-row">
      <label class="f-label">Subscription Valid Until</label>
      <input type="text" value="${org.subscription_end || ''}" readonly>
    </div>
    <div class="field-row">
      <label class="f-label">Member Since</label>
      <input type="text" value="${(org.created_at || '').slice(0, 10)}" readonly>
    </div>
  `;
  document.getElementById('org_gstin').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

document.getElementById('saveOrgBtn').addEventListener('click', async () => {
  const name = document.getElementById('org_name').value;
  const gstin = document.getElementById('org_gstin').value.toUpperCase();
  await fetch('/api/org', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gstin })
  });
  const msg = document.getElementById('orgSavedMsg');
  msg.style.display = 'inline';
  setTimeout(() => (msg.style.display = 'none'), 2000);
});

// ---------- Generic CRUD table builder ----------
// entity: api path segment, e.g. 'buyer'
// items: array of records
// columns: [{key, label, upper(optional), type(optional: 'text'|'number')}]
function buildCrudTable(entity, items, columns, opts = {}) {
  const favCol = opts.favorite ? `<th>★</th>` : '';
  const head = `<tr>${columns.map(c => `<th>${c.label}</th>`).join('')}${favCol}<th></th></tr>`;

  const rows = items.map(item => {
    const cells = columns.map(c => `<td data-key="${c.key}">${item[c.key] ?? ''}</td>`).join('');
    const fav = opts.favorite ? `<td class="center" data-key="is_favorite">${item.is_favorite ? '★' : '☆'}</td>` : '';
    return `<tr data-id="${item.id}">${cells}${fav}
      <td><button class="edit-btn">Edit</button> <button class="del-btn">Delete</button></td>
    </tr>`;
  }).join('');

  const addRow = `<tr class="add-row">
    ${columns.map(c => `<td><input type="${c.type || 'text'}" class="add-${c.key}" style="${c.upper ? 'text-transform:uppercase;' : ''}"></td>`).join('')}
    ${opts.favorite ? '<td></td>' : ''}
    <td><button class="add-btn">+ Add</button></td>
  </tr>`;

  return `<table class="grid"><thead>${head}</thead><tbody>${rows}${addRow}</tbody></table>`;
}

function wireCrudTable(container, entity, columns, onSaved, opts = {}) {
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      columns.forEach(c => {
        const td = tr.querySelector(`td[data-key="${c.key}"]`);
        const val = td.textContent;
        td.innerHTML = `<input type="${c.type || 'text'}" value="${val}" style="${c.upper ? 'text-transform:uppercase;' : ''}">`;
      });
      btn.textContent = 'Save';
      btn.classList.remove('edit-btn');
      btn.classList.add('save-btn');
      btn.addEventListener('click', async () => {
        const id = tr.dataset.id;
        const payload = {};
        columns.forEach(c => {
          const input = tr.querySelector(`td[data-key="${c.key}"] input`);
          payload[c.key] = c.upper ? input.value.toUpperCase() : input.value;
        });
        if (opts.favorite) {
          const favTd = tr.querySelector('td[data-key="is_favorite"]');
          payload.is_favorite = favTd.textContent.trim() === '★';
        }
        await fetch(`/api/${entity}/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        onSaved();
      }, { once: true });
    });
  });

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      if (!confirm('Delete this record?')) return;
      await fetch(`/api/${entity}/${tr.dataset.id}`, { method: 'DELETE' });
      onSaved();
    });
  });

  if (opts.favorite) {
    container.querySelectorAll('td[data-key="is_favorite"]').forEach(td => {
      td.style.cursor = 'pointer';
      td.addEventListener('click', async () => {
        const tr = td.closest('tr');
        const id = tr.dataset.id;
        const newVal = td.textContent.trim() !== '★';
        await fetch(`/api/${entity}/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ __toggleFavoriteOnly: true, is_favorite: newVal, ...currentRowValues(tr, columns) })
        });
        onSaved();
      });
    });
  }

  const addBtn = container.querySelector('.add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const payload = {};
      columns.forEach(c => {
        const input = container.querySelector(`.add-${c.key}`);
        payload[c.key] = c.upper ? input.value.toUpperCase() : input.value;
      });
      if (!payload[columns[0].key]) { alert(`${columns[0].label} is required.`); return; }
      await fetch(`/api/${entity}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      onSaved();
    });
  }
}

function currentRowValues(tr, columns) {
  const out = {};
  columns.forEach(c => {
    const td = tr.querySelector(`td[data-key="${c.key}"]`);
    out[c.key] = td ? td.textContent : '';
  });
  return out;
}

// ---------- 2a. Buyers ----------
function renderBuyers() {
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'gstin', label: 'GSTIN', upper: true },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
  ];
  const el = document.getElementById('buyerCrud');
  el.innerHTML = buildCrudTable('buyer', profileData.buyers, cols, { favorite: true });
  wireCrudTable(el, 'buyer', cols, loadProfile, { favorite: true });
}

// ---------- 2b. Agents ----------
function renderAgents() {
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'notes', label: 'Notes' },
  ];
  const el = document.getElementById('agentCrud');
  el.innerHTML = buildCrudTable('agent', profileData.agents, cols, { favorite: true });
  wireCrudTable(el, 'agent', cols, loadProfile, { favorite: true });
}

// ---------- 2c. Transporters ----------
function renderTransporters() {
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'vehicle_info', label: 'Vehicle Info' },
  ];
  const el = document.getElementById('transCrud');
  el.innerHTML = buildCrudTable('transporter', profileData.transporters, cols, { favorite: true });
  wireCrudTable(el, 'transporter', cols, loadProfile, { favorite: true });
}

// ---------- 3. Terms & Conditions ----------
function renderTerms() {
  const el = document.getElementById('tcList');
  el.innerHTML = profileData.terms.map(t => `
    <fieldset data-id="${t.id}">
      <legend><input type="text" class="tc-label" value="${t.set_label}" style="width:160px; display:inline-block;"></legend>
      <textarea class="tc-content" rows="4" style="width:100%;">${t.content}</textarea>
      <div class="hbox" style="margin-top:6px;">
        <button class="tc-save">Save</button>
        <button class="tc-del">Delete</button>
      </div>
    </fieldset>
  `).join('') || '<p class="muted">No T&C sets yet.</p>';

  el.querySelectorAll('.tc-save').forEach(btn => btn.addEventListener('click', async () => {
    const fs = btn.closest('fieldset');
    await fetch(`/api/terms/${fs.dataset.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set_label: fs.querySelector('.tc-label').value, content: fs.querySelector('.tc-content').value })
    });
    loadProfile();
  }));
  el.querySelectorAll('.tc-del').forEach(btn => btn.addEventListener('click', async () => {
    const fs = btn.closest('fieldset');
    if (!confirm('Delete this T&C set?')) return;
    await fetch(`/api/terms/${fs.dataset.id}`, { method: 'DELETE' });
    loadProfile();
  }));
}

document.getElementById('addTcBtn').addEventListener('click', async () => {
  await fetch('/api/terms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set_label: `Set ${profileData.terms.length + 1}`, content: '' })
  });
  loadProfile();
});

// ---------- 4. Best Buys ----------
function renderBestBuys() {
  const cols = [
    { key: 'product_name', label: 'Product' },
    { key: 'description', label: 'Description' },
    { key: 'hsn', label: 'HSN' },
    { key: 'unit', label: 'Unit' },
    { key: 'default_rate', label: 'Default Rate (₹)', type: 'number' },
  ];
  const el = document.getElementById('bestBuyCrud');
  el.innerHTML = buildCrudTable('best-buy', profileData.bestBuys, cols);
  wireCrudTable(el, 'best-buy', cols, loadProfile);
}

// ---------- 5. Note ----------
document.getElementById('saveNoteBtn').addEventListener('click', async () => {
  const content = document.getElementById('noteText').value;
  await fetch('/api/profile/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  // Saved to server — clear the local draft so the server value is authoritative next load.
  FormCache.clear(NOTE_DRAFT_KEY);
  const msg = document.getElementById('noteSavedMsg');
  msg.style.display = 'inline';
  setTimeout(() => (msg.style.display = 'none'), 2000);
});

// If the page was opened with #buyers (e.g. the "+ New" button on the Sauda
// Create page), expand the Buyers section, scroll to it, and focus the first
// "add" input so the user can immediately create a new buyer.
function handleBuyersHash() {
  const hash = window.location.hash;
  const targets = {
    '#buyers': { sectionId: 'buyersSection', firstInputSelector: '#buyerCrud .add-row input' },
    '#bestbuys': { sectionId: 'bestbuys', firstInputSelector: '#bestBuyCrud .add-row input' },
  };
  const target = targets[hash];
  if (!target) return;
  const el = document.getElementById(target.sectionId);
  if (!el) return;
  // Expand the section in case it was collapsed by section-collapse.js.
  el.classList.remove('collapsed');
  const body = el.nextElementSibling;
  if (body && body.classList.contains('section-body')) body.style.display = '';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Focus the first "add" input once the table is rendered.
  const focusAdd = () => {
    const input = document.querySelector(target.firstInputSelector);
    if (input) input.focus();
  };
  setTimeout(focusAdd, 150);
}

loadProfile().then(handleBuyersHash);

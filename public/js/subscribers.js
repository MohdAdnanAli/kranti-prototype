let allSubs = [];

async function loadSubs() {
  const res = await fetch('/api/subscribers');
  allSubs = await res.json();
  render();
}

function render() {
  const statusF = document.getElementById('statusFilter').value;
  const roleF = document.getElementById('roleFilter').value;
  const rows = allSubs.filter(u =>
    (!statusF || u.status === statusF) && (!roleF || u.role === roleF)
  );

  document.getElementById('subsBody').innerHTML = rows.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.phone || '—'}</td>
      <td>${u.role === 'owner' ? '<b>Owner</b>' : 'Staff'}</td>
      <td>${permTag(u.permissions)}</td>
      <td>${statusTag(u.status)}</td>
    </tr>
  `).join('');

  document.getElementById('countBox').textContent = `${rows.length} of ${allSubs.length} subscribers`;
}

function permTag(p) {
  const map = { full: 'ok', limited: 'warn', 'view-only': 'neutral' };
  return `<span class="tag ${map[p] || 'neutral'}">${p}</span>`;
}
function statusTag(s) {
  return s === 'active' ? '<span class="tag ok">active</span>' : '<span class="tag danger">suspended</span>';
}

document.getElementById('statusFilter').addEventListener('change', render);
document.getElementById('roleFilter').addEventListener('change', render);
document.getElementById('addUserBtn').addEventListener('click', () => {
  alert('Add User — wire this to a modal / new record form in the next prototype pass.');
});

loadSubs();

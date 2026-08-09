const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database(path.join(__dirname, 'db', 'kranti.db'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const EXPIRY_MINUTES = 25;
const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const addMinutes = (isoStr, m) => new Date(new Date(isoStr.replace(' ', 'T') + 'Z').getTime() + m * 60000).toISOString().slice(0, 19).replace('T', ' ');

// Resolve a PO's effective status, lazily marking it expired if past its hard-expiry window.
function effectivePOStatus(po) {
  if ((po.status === 'sent' || po.status === 'viewed') && po.expires_at && nowIso() > po.expires_at) {
    db.prepare(`UPDATE purchase_order SET status = 'expired' WHERE id = ?`).run(po.id);
    return 'expired';
  }
  return po.status;
}

// ---------- AUTH ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM kranti_user WHERE email = ?').get(email);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.status !== 'active') return res.status(403).json({ error: 'This account is suspended. Contact the owner.' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// ---------- SUBSCRIBERS ----------
app.get('/api/subscribers', (req, res) => {
  res.json(db.prepare(`SELECT id, name, email, phone, role, permissions, status FROM kranti_user WHERE org_id = 1`).all());
});

// ---------- PROFILE ----------
app.get('/api/profile', (req, res) => {
  const org = db.prepare('SELECT * FROM organization WHERE id = 1').get();
  const buyers = db.prepare('SELECT * FROM buyer WHERE org_id = 1 ORDER BY name').all();
  const agents = db.prepare('SELECT * FROM agent WHERE org_id = 1 ORDER BY name').all();
  const transporters = db.prepare('SELECT * FROM transporter WHERE org_id = 1 ORDER BY name').all();
  const terms = db.prepare('SELECT * FROM terms_condition WHERE org_id = 1 ORDER BY id').all();
  const bestBuys = db.prepare('SELECT * FROM best_buy_item WHERE org_id = 1 ORDER BY product_name').all();
  const note = db.prepare('SELECT * FROM seller_note WHERE org_id = 1 ORDER BY id DESC LIMIT 1').get();
  res.json({ org, buyers, agents, transporters, terms, bestBuys, note });
});

app.post('/api/profile/note', (req, res) => {
  db.prepare('INSERT INTO seller_note (org_id, content) VALUES (1, ?)').run(req.body.content || '');
  res.json({ ok: true });
});

app.put('/api/org', (req, res) => {
  const { name, gstin } = req.body;
  db.prepare('UPDATE organization SET name = ?, gstin = ? WHERE id = 1').run(name, (gstin || '').toUpperCase());
  res.json({ ok: true });
});

// ---------- BUYER / AGENT / TRANSPORTER CRUD ----------
app.post('/api/buyer', (req, res) => {
  const { name, gstin, phone, email, address } = req.body;
  const info = db.prepare('INSERT INTO buyer (org_id, name, gstin, phone, email, address) VALUES (1, ?, ?, ?, ?, ?)')
    .run(name, (gstin || '').toUpperCase(), phone, email, address);
  res.json(db.prepare('SELECT * FROM buyer WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/buyer/:id', (req, res) => {
  const { name, gstin, phone, email, address, is_favorite } = req.body;
  db.prepare('UPDATE buyer SET name=?, gstin=?, phone=?, email=?, address=?, is_favorite=? WHERE id=? AND org_id=1')
    .run(name, (gstin || '').toUpperCase(), phone, email, address, is_favorite ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM buyer WHERE id = ?').get(req.params.id));
});
app.delete('/api/buyer/:id', (req, res) => {
  db.prepare('DELETE FROM buyer WHERE id = ? AND org_id = 1').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/agent', (req, res) => {
  const { name, phone, email, notes } = req.body;
  const info = db.prepare('INSERT INTO agent (org_id, name, phone, email, notes) VALUES (1, ?, ?, ?, ?)').run(name, phone, email, notes);
  res.json(db.prepare('SELECT * FROM agent WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/agent/:id', (req, res) => {
  const { name, phone, email, notes, is_favorite } = req.body;
  db.prepare('UPDATE agent SET name=?, phone=?, email=?, notes=?, is_favorite=? WHERE id=? AND org_id=1')
    .run(name, phone, email, notes, is_favorite ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM agent WHERE id = ?').get(req.params.id));
});
app.delete('/api/agent/:id', (req, res) => {
  db.prepare('DELETE FROM agent WHERE id = ? AND org_id = 1').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/transporter', (req, res) => {
  const { name, phone, email, vehicle_info } = req.body;
  const info = db.prepare('INSERT INTO transporter (org_id, name, phone, email, vehicle_info) VALUES (1, ?, ?, ?, ?)').run(name, phone, email, vehicle_info);
  res.json(db.prepare('SELECT * FROM transporter WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/transporter/:id', (req, res) => {
  const { name, phone, email, vehicle_info, is_favorite } = req.body;
  db.prepare('UPDATE transporter SET name=?, phone=?, email=?, vehicle_info=?, is_favorite=? WHERE id=? AND org_id=1')
    .run(name, phone, email, vehicle_info, is_favorite ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM transporter WHERE id = ?').get(req.params.id));
});
app.delete('/api/transporter/:id', (req, res) => {
  db.prepare('DELETE FROM transporter WHERE id = ? AND org_id = 1').run(req.params.id);
  res.json({ ok: true });
});

// ---------- TERMS & BEST BUY CRUD ----------
app.post('/api/terms', (req, res) => {
  const { set_label, content } = req.body;
  const info = db.prepare('INSERT INTO terms_condition (org_id, set_label, content) VALUES (1, ?, ?)').run(set_label, content);
  res.json(db.prepare('SELECT * FROM terms_condition WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/terms/:id', (req, res) => {
  const { set_label, content } = req.body;
  db.prepare('UPDATE terms_condition SET set_label=?, content=? WHERE id=? AND org_id=1').run(set_label, content, req.params.id);
  res.json(db.prepare('SELECT * FROM terms_condition WHERE id = ?').get(req.params.id));
});
app.delete('/api/terms/:id', (req, res) => {
  db.prepare('DELETE FROM terms_condition WHERE id = ? AND org_id = 1').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/best-buy', (req, res) => {
  const { product_name, hsn, unit, default_rate } = req.body;
  const info = db.prepare('INSERT INTO best_buy_item (org_id, product_name, hsn, unit, default_rate) VALUES (1, ?, ?, ?, ?)')
    .run(product_name, hsn, unit, parseFloat(default_rate) || 0);
  res.json(db.prepare('SELECT * FROM best_buy_item WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/best-buy/:id', (req, res) => {
  const { product_name, hsn, unit, default_rate } = req.body;
  db.prepare('UPDATE best_buy_item SET product_name=?, hsn=?, unit=?, default_rate=? WHERE id=? AND org_id=1')
    .run(product_name, hsn, unit, parseFloat(default_rate) || 0, req.params.id);
  res.json(db.prepare('SELECT * FROM best_buy_item WHERE id = ?').get(req.params.id));
});
app.delete('/api/best-buy/:id', (req, res) => {
  db.prepare('DELETE FROM best_buy_item WHERE id = ? AND org_id = 1').run(req.params.id);
  res.json({ ok: true });
});

// ---------- DASHBOARD ----------
app.get('/api/dashboard', (req, res) => {
  const totalDeals = db.prepare('SELECT COUNT(*) c FROM deal WHERE org_id = 1').get().c;
  const totalPOs = db.prepare(`SELECT COUNT(*) c FROM purchase_order po JOIN deal d ON po.deal_id = d.id WHERE d.org_id = 1`).get().c;
  const verifiedAcks = db.prepare(`SELECT COUNT(*) c FROM invoice_ack_rec WHERE status = 'final'`).get().c;
  const disputed = db.prepare(`SELECT COUNT(*) c FROM deal WHERE org_id = 1 AND status = 'disputed'`).get().c;
  const pendingPOs = db.prepare(`SELECT COUNT(*) c FROM purchase_order po JOIN deal d ON po.deal_id = d.id WHERE d.org_id = 1 AND po.status IN ('sent','viewed')`).get().c;
  const statusBreakdown = db.prepare(`SELECT status, COUNT(*) c FROM deal WHERE org_id = 1 GROUP BY status`).all();
  const buyerVolume = db.prepare(`
    SELECT b.name, COUNT(*) deal_count, SUM(di.qty * di.price) total_value
    FROM deal d JOIN buyer b ON d.buyer_id = b.id
    JOIN deal_item di ON di.deal_id = d.id
    WHERE d.org_id = 1 GROUP BY b.id ORDER BY total_value DESC
  `).all();
  const recentActivity = db.prepare(`
    SELECT d.id, og.order_code, b.name as buyer_name, d.status, d.created_at
    FROM deal d JOIN buyer b ON d.buyer_id = b.id
    LEFT JOIN order_group og ON d.order_id = og.id
    WHERE d.org_id = 1 ORDER BY d.created_at DESC LIMIT 6
  `).all();
  res.json({ totalDeals, totalPOs, verifiedAcks, disputed, pendingPOs, statusBreakdown, buyerVolume, recentActivity });
});

// ---------- SAUDA CREATE (Order + N buyer legs) ----------
app.get('/api/sauda/lookups', (req, res) => {
  res.json({
    buyers: db.prepare('SELECT * FROM buyer WHERE org_id = 1 ORDER BY name').all(),
    agents: db.prepare('SELECT * FROM agent WHERE org_id = 1 ORDER BY name').all(),
    bestBuys: db.prepare('SELECT * FROM best_buy_item WHERE org_id = 1 ORDER BY product_name').all(),
  });
});

app.post('/api/order', (req, res) => {
  const { agent_id, notes, legs } = req.body;
  if (!legs || !legs.length) return res.status(400).json({ error: 'At least one buyer leg is required.' });

  const orderInfo = db.prepare(`INSERT INTO order_group (org_id, order_code, agent_id, created_by, notes) VALUES (1, 'PENDING', ?, 1, ?)`)
    .run(agent_id || null, notes || '');
  const orderId = orderInfo.lastInsertRowid;
  const orderCode = 'ORD-' + String(orderId).padStart(6, '0');
  db.prepare('UPDATE order_group SET order_code = ? WHERE id = ?').run(orderCode, orderId);

  const insDeal = db.prepare(`INSERT INTO deal
    (order_id, org_id, buyer_id, created_by, delivery_condition, lifting_date, last_lifting_date, payment_type, advance_pct, credit_pct, status)
    VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, 'draft')`);
  const insItem = db.prepare(`INSERT INTO deal_item (deal_id, product_name, description, hsn, qty, unit, price) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const dealIds = [];
  legs.forEach(leg => {
    const info = insDeal.run(
      orderId, leg.buyer_id, leg.delivery_condition, leg.lifting_date, leg.last_lifting_date,
      leg.payment_type, leg.advance_pct || null, leg.credit_pct || null
    );
    const dealId = info.lastInsertRowid;
    dealIds.push(dealId);
    (leg.items || []).forEach(i => insItem.run(dealId, i.product_name, i.description, i.hsn, i.qty, i.unit, i.price));
  });

  res.json({ ok: true, orderId, orderCode, dealIds });
});

// ---------- PURCHASE ORDERS ----------
app.get('/api/deals/draft', (req, res) => {
  const rows = db.prepare(`
    SELECT d.id, d.delivery_condition, d.lifting_date, d.last_lifting_date, d.payment_type, d.created_at,
           og.order_code, b.name as buyer_name
    FROM deal d
    JOIN buyer b ON d.buyer_id = b.id
    LEFT JOIN order_group og ON d.order_id = og.id
    WHERE d.org_id = 1 AND d.status = 'draft'
    ORDER BY d.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/purchase-orders', (req, res) => {
  const rows = db.prepare(`
    SELECT po.id, po.sequential_code, po.status, po.resend_count, po.frozen_at, po.generated_at, po.expires_at, po.responded_at,
           d.id as deal_id, d.delivery_condition, d.payment_type, d.lifting_date, d.last_lifting_date, d.status as deal_status,
           og.order_code,
           b.name as buyer_name, b.gstin as buyer_gstin,
           a.name as agent_name, t.name as transporter_name
    FROM purchase_order po
    JOIN deal d ON po.deal_id = d.id
    JOIN buyer b ON d.buyer_id = b.id
    LEFT JOIN order_group og ON d.order_id = og.id
    LEFT JOIN agent a ON og.agent_id = a.id
    LEFT JOIN transporter t ON po.transporter_id = t.id
    WHERE d.org_id = 1
    ORDER BY po.generated_at DESC
  `).all();
  rows.forEach(r => { r.status = effectivePOStatus(r); });
  res.json(rows);
});

// PO not yet created — generate one for a draft deal
app.post('/api/deal/:dealId/generate-po', (req, res) => {
  const deal = db.prepare('SELECT * FROM deal WHERE id = ?').get(req.params.dealId);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const code = String(1000000 + Math.floor(Math.random() * 9000000)).slice(0, 7);
  const hash = Math.random().toString(16).slice(2, 8);
  const gen = nowIso();
  const info = db.prepare(`INSERT INTO purchase_order (deal_id, sequential_code, link_hash, status, generated_at, expires_at)
    VALUES (?, ?, ?, 'sent', ?, ?)`).run(deal.id, code, hash, gen, addMinutes(gen, EXPIRY_MINUTES));
  db.prepare(`UPDATE deal SET status = 'po_generated' WHERE id = ?`).run(deal.id);
  res.json({ ok: true, poId: info.lastInsertRowid });
});

app.post('/api/po/:id/resend', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (po.status === 'verified') return res.status(400).json({ error: 'Already verified — cannot resend.' });
  const gen = nowIso();
  db.prepare(`UPDATE purchase_order SET status='sent', generated_at=?, expires_at=?, responded_at=NULL, resend_count=resend_count+1 WHERE id=?`)
    .run(gen, addMinutes(gen, EXPIRY_MINUTES), po.id);
  res.json({ ok: true });
});

// ---------- PUBLIC: buyer confirmation link (no login, hard 25-min expiry) ----------
app.get('/api/po/:id/public', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Not found' });
  po.status = effectivePOStatus(po);
  const deal = db.prepare(`
    SELECT d.*, og.order_code, b.name as buyer_name, b.gstin as buyer_gstin, b.phone as buyer_phone,
           a.name as agent_name
    FROM deal d
    LEFT JOIN order_group og ON d.order_id = og.id
    LEFT JOIN agent a ON og.agent_id = a.id
    JOIN buyer b ON d.buyer_id = b.id
    WHERE d.id = ?`).get(po.deal_id);
  const items = db.prepare('SELECT * FROM deal_item WHERE deal_id = ?').all(po.deal_id);

  if (po.status === 'sent' || po.status === 'viewed') {
    db.prepare(`UPDATE purchase_order SET status = 'viewed' WHERE id = ? AND status = 'sent'`).run(po.id);
  }
  res.json({ po, deal, items });
});

app.post('/api/po/:id/respond', (req, res) => {
  const { action } = req.body; // verify | deny | ignore
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Not found' });
  const status = effectivePOStatus(po);
  if (status === 'expired') return res.status(410).json({ error: 'This link has expired (25-minute window passed). Ask the seller to resend.' });
  if (status === 'verified') return res.status(400).json({ error: 'Already verified.' });
  if (!['verify', 'deny', 'ignore'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

  const now = nowIso();
  if (action === 'verify') {
    db.prepare(`UPDATE purchase_order SET status='verified', frozen_at=?, responded_at=? WHERE id=?`).run(now, now, po.id);
    db.prepare(`UPDATE deal SET status='verified' WHERE id=?`).run(po.deal_id);
  } else {
    db.prepare(`UPDATE purchase_order SET status=?, responded_at=? WHERE id=?`).run(action === 'deny' ? 'denied' : 'ignored', now, po.id);
  }
  res.json({ ok: true, status: action === 'verify' ? 'verified' : action });
});

// ---------- INVOICE NUMBER SUGGESTION ----------
app.get('/api/invoice/next', (req, res) => {
  const org = db.prepare('SELECT invoice_seq FROM organization WHERE id = 1').get();
  const year = new Date().getFullYear();
  const next = (org.invoice_seq || 0) + 1;
  res.json({ suggested: `INV-${year}-${String(next).padStart(4, '0')}` });
});

// ---------- BILL (Invoice Ack Rec) ----------
app.get('/api/bill/:poId', (req, res) => {
const po = db.prepare(`
    SELECT po.*, d.delivery_condition, d.payment_type, d.advance_pct, d.credit_pct,
           d.lifting_date, d.last_lifting_date,
           og.order_code,
           b.name as buyer_name, b.gstin as buyer_gstin, b.phone as buyer_phone, b.email as buyer_email, b.address as buyer_address,
           a.name as agent_name, a.phone as agent_phone, a.email as agent_email,
           t.name as transporter_name, t.phone as transporter_phone, t.email as transporter_email
    FROM purchase_order po
    JOIN deal d ON po.deal_id = d.id
    LEFT JOIN order_group og ON d.order_id = og.id
    JOIN buyer b ON d.buyer_id = b.id
    LEFT JOIN agent a ON og.agent_id = a.id
    LEFT JOIN transporter t ON po.transporter_id = t.id
    WHERE po.id = ?
  `).get(req.params.poId);
  if (!po) return res.status(404).json({ error: 'Not found' });
  po.status = effectivePOStatus(po);
  const items = db.prepare('SELECT * FROM deal_item WHERE deal_id = ?').all(po.deal_id);
  const terms = db.prepare('SELECT * FROM terms_condition WHERE org_id = 1 LIMIT 1').get();
  const ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(po.id);
  res.json({ po, items, terms, ack });
});

// Seller sets invoice number + date, runs OCR-adapter cross-check, flushes the draft ack rec.
// This must happen before a buyer can trigger OTP.
app.post('/api/bill/:poId/prepare', (req, res) => {
  const { invoice_number, invoice_date, ocr_verified } = req.body;
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.poId);
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (po.status !== 'verified') return res.status(400).json({ error: 'PO must be buyer-verified before bill preparation.' });
  if (!invoice_number || !invoice_date) return res.status(400).json({ error: 'Invoice number and date are required.' });

  let ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(po.id);
  if (ack) {
    db.prepare(`UPDATE invoice_ack_rec SET invoice_number=?, invoice_date=?, ocr_verified=? WHERE id=?`)
      .run(invoice_number, invoice_date, ocr_verified ? 1 : 0, ack.id);
  } else {
    const info = db.prepare(`INSERT INTO invoice_ack_rec (po_id, invoice_number, invoice_date, ocr_verified, status) VALUES (?, ?, ?, ?, 'draft')`)
      .run(po.id, invoice_number, invoice_date, ocr_verified ? 1 : 0);
    ack = { id: info.lastInsertRowid };
  }
  // Bump the org's running invoice sequence so the next suggestion moves forward.
  db.prepare('UPDATE organization SET invoice_seq = invoice_seq + 1 WHERE id = 1').run();
  res.json({ ok: true, ackId: ack.id });
});

// ---------- PUBLIC: buyer OTP / e-stamp verification (no login) ----------
app.post('/api/bill/:poId/request-otp', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.poId);
  if (!po) return res.status(404).json({ error: 'Not found' });
  let ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(po.id);
  if (!ack || !ack.invoice_number) return res.status(400).json({ error: 'Seller has not generated the invoice yet.' });
  if (ack.otp_locked) return res.status(403).json({ error: 'OTP locked. Ask seller to unlock.' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare('UPDATE invoice_ack_rec SET otp_code = ?, status = ? WHERE id = ?').run(otp, 'otp_sent', ack.id);
  res.json({ ok: true, demo_otp: otp });
});

app.post('/api/bill/:poId/verify-otp', (req, res) => {
  const { otp } = req.body;
  const ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(req.params.poId);
  if (!ack) return res.status(404).json({ error: 'No OTP requested yet.' });
  if (ack.otp_locked) return res.status(403).json({ error: 'OTP locked. Ask seller to unlock.' });

  if (ack.otp_code === otp) {
    const now = nowIso();
    const grace = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const estampRef = 'ESTAMP-KR-' + String(100000 + ack.id).slice(-6);
    db.prepare(`UPDATE invoice_ack_rec SET status='final', otp_verified_at=?, estamp_ref=?, estamp_timestamp=?, grace_period_ends_at=? WHERE id=?`)
      .run(now, estampRef, now, grace, ack.id);
    return res.json({ ok: true, verified: true, estampRef, timestamp: now, grace });
  } else {
    const attempts = ack.otp_attempts + 1;
    const locked = attempts >= 3 ? 1 : 0;
    db.prepare('UPDATE invoice_ack_rec SET otp_attempts = ?, otp_locked = ? WHERE id = ?').run(attempts, locked, ack.id);
    return res.status(400).json({ ok: false, error: locked ? 'Incorrect OTP. Attempts exhausted — locked.' : 'Incorrect OTP.', attempts, locked });
  }
});

app.post('/api/bill/:poId/unlock-otp', (req, res) => {
  const ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(req.params.poId);
  if (!ack) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE invoice_ack_rec SET otp_attempts = 0, otp_locked = 0 WHERE id = ?').run(ack.id);
  res.json({ ok: true });
});

// Distribution stub — figures out email vs SMS fallback per recipient, doesn't actually send.
app.post('/api/bill/:poId/distribute', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_order WHERE id = ?').get(req.params.poId);
  const deal = db.prepare(`
    SELECT og.agent_id, b.email as buyer_email, b.phone as buyer_phone
    FROM deal d LEFT JOIN order_group og ON d.order_id = og.id JOIN buyer b ON d.buyer_id = b.id
    WHERE d.id = ?`).get(po.deal_id);
  const agent = deal.agent_id ? db.prepare('SELECT email, phone FROM agent WHERE id = ?').get(deal.agent_id) : null;
  const transporter = po.transporter_id ? db.prepare('SELECT email, phone FROM transporter WHERE id = ?').get(po.transporter_id) : null;

  const channels = [];
  channels.push(`buyer:${deal.buyer_email ? 'email' : 'sms'}`);
  if (agent) channels.push(`agent:${agent.email ? 'email' : 'sms'}`);
  if (transporter) channels.push(`transporter:${transporter.email ? 'email' : 'sms'}`);

  const ack = db.prepare('SELECT * FROM invoice_ack_rec WHERE po_id = ? ORDER BY id DESC LIMIT 1').get(po.id);
  const now = nowIso();
  db.prepare('UPDATE invoice_ack_rec SET distributed_at=?, distributed_channels=? WHERE id=?').run(now, channels.join(','), ack.id);
  res.json({ ok: true, distributed_at: now, channels });
});

const PORT = 4173;
app.listen(PORT, () => console.log(`Kranti prototype running on http://localhost:${PORT}`));

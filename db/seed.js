const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'kranti.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const now = new Date();
const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const minutesFromNow = (m) => iso(new Date(now.getTime() + m * 60000));
const daysAgo = (d) => iso(new Date(now.getTime() - d * 86400000));
const daysAgoPlusMin = (d, m) => iso(new Date(now.getTime() - d * 86400000 + m * 60000));

// --- Organization ---
db.prepare(`INSERT INTO organization (name, gstin, subscription_plan, subscription_start, subscription_end, invoice_seq)
  VALUES (?, ?, ?, ?, ?, ?)`).run('Adnan Traders & Co.', '09ABCDE1234F1Z5', 'Standard Annual', '2026-01-15', '2027-01-15', 4);

// --- Kranti Users (Subscribers) ---
const users = [
  ['Adnan Khan', 'adnan@xyz.com', 'Password@123', '+91 98765 43210', 'owner', 'full', 'active'],
  ['Rizwan Sheikh', 'rizwan@xyz.com', 'Password@123', '+91 98765 43211', 'staff', 'limited', 'active'],
  ['Fahad Ali', 'fahad@xyz.com', 'Password@123', '+91 98765 43212', 'staff', 'view-only', 'active'],
  ['Sana Mirza', 'sana@xyz.com', 'Password@123', '+91 98765 43213', 'staff', 'limited', 'suspended'],
];
const insUser = db.prepare(`INSERT INTO kranti_user (org_id, name, email, password, phone, role, permissions, status)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?)`);
users.forEach(u => insUser.run(...u));

// --- Buyers (with email) ---
const buyers = [
  ['Om Traders', '27AAAAA0000A1Z5', '+91 90000 11111', 'accounts@omtraders.in', 'Shed 4, APMC Market, Vashi, Navi Mumbai', 1],
  ['Shree Balaji Enterprises', '24BBBBB1111B2Z6', '+91 90000 22222', 'billing@balajient.in', 'Ring Road, Rajkot, Gujarat', 1],
  ['Krishna Wholesale Mart', '09CCCCC2222C3Z7', '+91 90000 33333', '', 'Naya Bazar, Kanpur, UP', 0],
  ['Ganesh Agro Traders', '23DDDDD3333D4Z8', '+91 90000 44444', 'ganesh.agro@gmail.com', 'Grain Market, Indore, MP', 1],
  ['Rasoi Basics Pvt Ltd', '19EEEEE4444E5Z9', '+91 90000 55555', '', 'Burrabazar, Kolkata, WB', 0],
];
const insBuyer = db.prepare(`INSERT INTO buyer (org_id, name, gstin, phone, email, address, is_favorite) VALUES (1, ?, ?, ?, ?, ?, ?)`);
buyers.forEach(b => insBuyer.run(...b));

// --- Agents (with email) ---
const agents = [
  ['Mahesh Bhai', '+91 91111 00001', '', 'Handles Mumbai-Rajkot corridor', 1],
  ['Iqbal Sons Agency', '+91 91111 00002', 'iqbalsons@gmail.com', 'Regular for grain deals', 1],
  ['Deepak Commission', '+91 91111 00003', '', 'New contact, verify before use', 0],
];
const insAgent = db.prepare(`INSERT INTO agent (org_id, name, phone, email, notes, is_favorite) VALUES (1, ?, ?, ?, ?, ?)`);
agents.forEach(a => insAgent.run(...a));

// --- Transporters (with email) ---
const transporters = [
  ['Bharat Roadlines', '+91 92222 00001', 'dispatch@bharatroadlines.in', '10-wheeler fleet, Mumbai-Gujarat', 1],
  ['Singh Transport Co.', '+91 92222 00002', '', 'Container trucks, PAN India', 1],
  ['Local Tempo Service', '+91 92222 00003', '', 'Small loads, city delivery', 0],
];
const insTrans = db.prepare(`INSERT INTO transporter (org_id, name, phone, email, vehicle_info, is_favorite) VALUES (1, ?, ?, ?, ?, ?)`);
transporters.forEach(t => insTrans.run(...t));

// --- Best Buys ---
const bestBuys = [
  ['Basmati Rice 1121 Steam', '10063020', 'Quintal', 8200],
  ['Toor Dal (Arhar)', '07131000', 'Quintal', 11500],
  ['Refined Soybean Oil', '15071000', 'Tin (15kg)', 2150],
  ['Wheat Sharbati', '10019900', 'Quintal', 2850],
  ['Sugar S-30', '17019910', 'Quintal', 4100],
];
const insBB = db.prepare(`INSERT INTO best_buy_item (org_id, product_name, hsn, unit, default_rate) VALUES (1, ?, ?, ?, ?)`);
bestBuys.forEach(b => insBB.run(...b));

// --- Terms & Conditions ---
const tcSets = [
  ['Set 1', 'The quick brown fox jumps over the lazy dog.\nLazy dog watches the quick brown fox.\nBrown fox runs past the lazy dog quickly.'],
  ['Set 2', 'Over the lazy dog the quick brown fox jumps.\nQuick brown fox leaps above lazy dog.\nThe lazy dog sees quick brown fox.\nBrown fox quick jumps the dog.'],
  ['Set 3', 'Jumps the quick brown fox over lazy dog.\nLazy dog under the quick brown fox.\nQuick fox brown leaps dog lazy.'],
  ['Set 4', 'The brown quick fox jumps lazy dog over.\nDog lazy the fox brown quick jumps.\nQuick jumps brown fox over dog.\nOver dog jumps the quick brown fox.'],
  ['Set 5', 'Brown fox quick over the lazy dog jumps.\nThe lazy dog the quick brown fox.\nJumps over lazy dog quick brown fox.'],
];
const insTC = db.prepare(`INSERT INTO terms_condition (org_id, set_label, content) VALUES (1, ?, ?)`);
tcSets.forEach(t => insTC.run(...t));

// --- Note ---
db.prepare(`INSERT INTO seller_note (org_id, content) VALUES (1, ?)`).run(
  'Follow up with Krishna Wholesale Mart on pending payment for last month.\nCheck new HSN code for refined oil before next Sauda.\nMahesh Bhai to confirm rate for next week delivery.'
);

// --- Orders (order_group) ---
// 1: single buyer, PO still open (live 25-min countdown demo)
// 2: single buyer, fully verified & stamped
// 3: single buyer, still draft (no PO yet)
// 4: MULTI-BUYER order — two independent buyer legs sharing one order_code
// 5: single buyer, verified then disputed
const insOrder = db.prepare(`INSERT INTO order_group (org_id, order_code, agent_id, created_by, notes) VALUES (1, ?, ?, 1, ?)`);
insOrder.run('ORD-000001', 1, 'Rice + Dal — Mumbai corridor');
insOrder.run('ORD-000002', 2, 'Oil — Rajkot');
insOrder.run('ORD-000003', null, 'Wheat — walk-in, no agent');
insOrder.run('ORD-000004', 1, 'Combined Sugar + Rice dispatch — two buyers, one truck');
insOrder.run('ORD-000005', 3, 'Dal — Kolkata, flagged post-verification');

// --- Deals (buyer legs) ---
const insDeal = db.prepare(`INSERT INTO deal (order_id, org_id, buyer_id, created_by, delivery_condition, lifting_date, last_lifting_date, payment_type, advance_pct, credit_pct, payment_detail, status)
  VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`);

insDeal.run(1, 1, 'EX', '2026-08-10', '2026-08-14', 'advance', 70, 30, '', 'po_generated');       // deal 1 -> order1, Om Traders
insDeal.run(2, 2, 'FOR', '2026-08-12', '2026-08-16', 'credit', 0, 100, '15 days credit', 'verified'); // deal 2 -> order2, Shree Balaji
insDeal.run(3, 3, 'EX', '2026-08-15', '2026-08-18', 'ratio', 50, 50, '', 'draft');                 // deal 3 -> order3, Krishna
insDeal.run(4, 4, 'FOR', '2026-08-08', '2026-08-10', 'advance', 100, 0, '', 'verified');           // deal 4 -> order4 leg A, Ganesh Agro
insDeal.run(4, 1, 'EX', '2026-08-09', '2026-08-11', 'advance', 30, 70, '', 'po_generated');        // deal 5 -> order4 leg B, Om Traders (same order, different buyer)
insDeal.run(5, 5, 'EX', '2026-08-20', '2026-08-23', 'credit', 0, 100, '30 days credit', 'disputed');// deal 6 -> order5, Rasoi Basics

// --- Deal Items ---
// Columns: deal_id, product_name, description, hsn, qty, unit, price
const items = [
  [1, 'Basmati Rice 1121 Steam', 'Premium long-grain 1121 steam basmati, sorted & cleaned', '10063020', 50, 'Quintal', 8200],
  [1, 'Toor Dal (Arhar)', 'Split pigeon pea, double-polished, machine-cleaned', '07131000', 20, 'Quintal', 11500],
  [2, 'Refined Soybean Oil', 'RBD refined soybean oil, 15 kg tin pack', '15071000', 200, 'Tin (15kg)', 2150],
  [3, 'Wheat Sharbati', 'A1-grade sharbati wheat, moisture <10%, free of stones', '10019900', 100, 'Quintal', 2850],
  [4, 'Sugar S-30', 'S-30 grade refined white crystal sugar', '17019910', 80, 'Quintal', 4100],
  [5, 'Basmati Rice 1121 Steam', 'Premium long-grain 1121 steam basmati, sorted & cleaned', '10063020', 30, 'Quintal', 8250],
  [6, 'Toor Dal (Arhar)', 'Split pigeon pea, double-polished, machine-cleaned', '07131000', 40, 'Quintal', 11450],
];
const insItem = db.prepare(`INSERT INTO deal_item (deal_id, product_name, description, hsn, qty, unit, price) VALUES (?, ?, ?, ?, ?, ?, ?)`);
items.forEach(i => insItem.run(...i));

// --- Purchase Orders ---
// po1 -> deal1: freshly generated, live 25-min countdown (demo of hard expiry)
// po2 -> deal2: verified long ago
// po3 -> deal4: verified long ago
// po4 -> deal5: generated long ago, past its 25-min window, never responded -> EXPIRED
// po5 -> deal6: verified, later disputed
const insPO = db.prepare(`INSERT INTO purchase_order (deal_id, transporter_id, sequential_code, link_hash, status, resend_count, generated_at, expires_at, responded_at, frozen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

insPO.run(1, null, '1000234', 'a1f5c9', 'sent', 0, iso(now), minutesFromNow(25), null, null);
insPO.run(2, 1, '1000235', 'b2e6d0', 'verified', 0, daysAgo(6), daysAgoPlusMin(6, 25), daysAgoPlusMin(6, 12), daysAgoPlusMin(6, 12));
insPO.run(4, 1, '1000236', 'c3d7e1', 'verified', 1, daysAgo(8), daysAgoPlusMin(8, 25), daysAgoPlusMin(8, 20), daysAgoPlusMin(8, 20));
insPO.run(5, null, '1000238', 'e5b9a3', 'expired', 0, daysAgo(3), daysAgoPlusMin(3, 25), null, null);
insPO.run(6, 3, '1000237', 'd4c8f2', 'verified', 0, daysAgo(18), daysAgoPlusMin(18, 25), daysAgoPlusMin(18, 15), daysAgoPlusMin(18, 15));

// --- Invoice Ack Recs (only for verified POs: po2, po3, po5) ---
const insAck = db.prepare(`INSERT INTO invoice_ack_rec
  (po_id, parent_id, invoice_number, invoice_date, ocr_verified, status, otp_code, otp_attempts, otp_locked, otp_verified_at, estamp_ref, estamp_timestamp, grace_period_ends_at, distributed_at, distributed_channels)
  VALUES (?, NULL, ?, ?, 1, 'final', ?, 1, 0, ?, ?, ?, ?, ?, ?)`);

insAck.run(2, 'INV-2026-0001', '2026-08-01', '482913', daysAgoPlusMin(6, 30), 'ESTAMP-KR-000112', daysAgoPlusMin(6, 31), daysAgoPlusMin(6 - 3, 31), daysAgoPlusMin(6, 35), 'buyer:email,agent:sms');
insAck.run(3, 'INV-2026-0002', '2026-07-30', '119284', daysAgoPlusMin(8, 45), 'ESTAMP-KR-000113', daysAgoPlusMin(8, 46), daysAgoPlusMin(8 - 3, 46), daysAgoPlusMin(8, 50), 'buyer:email,agent:email,transporter:email');
insAck.run(5, 'INV-2026-0003', '2026-07-20', '774213', daysAgoPlusMin(18, 40), 'ESTAMP-KR-000114', daysAgoPlusMin(18, 41), daysAgoPlusMin(18 - 3, 41), daysAgoPlusMin(18, 45), 'buyer:sms,transporter:sms');

console.log('Database seeded successfully at', dbPath);
console.log('Live demo row: PO #1 (order ORD-000001, Om Traders) expires 25 min from seed time — good for testing the hard-expiry countdown.');
db.close();

-- KRANTI PROTOTYPE v0.2 — SCHEMA
-- Adds: Order/multi-buyer split, 4-ID system, hard-expiry SO links,
--       invoice numbering, email capture, lifting window, payment ratio

CREATE TABLE organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    subscription_plan TEXT DEFAULT 'Standard Annual',
    subscription_start TEXT,
    subscription_end TEXT,
    invoice_seq INTEGER DEFAULT 0,  -- running counter for sequential invoice numbers
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kranti_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'owner',
    permissions TEXT DEFAULT 'full',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE buyer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    name TEXT NOT NULL,
    gstin TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_favorite INTEGER DEFAULT 0
);

CREATE TABLE agent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    is_favorite INTEGER DEFAULT 0
);

CREATE TABLE transporter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    vehicle_info TEXT,
    is_favorite INTEGER DEFAULT 0
);

CREATE TABLE best_buy_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    product_name TEXT NOT NULL,
    description TEXT,
    hsn TEXT,
    unit TEXT,
    default_rate REAL
);

-- ORDER: parent container. Shares context (agent, org) across N independent buyer legs.
-- This is ID #1 of the 4-ID system: order_id
CREATE TABLE order_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    order_code TEXT,              -- ORD-000001 style, human-facing
    agent_id INTEGER REFERENCES agent(id),  -- informal channel that originated the order (nullable)
    created_by INTEGER REFERENCES kranti_user(id),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- DEAL (buyer leg): one per buyer under an Order. Fully independent pipeline from here down.
CREATE TABLE deal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES order_group(id),
    org_id INTEGER REFERENCES organization(id),
    buyer_id INTEGER REFERENCES buyer(id),
    created_by INTEGER REFERENCES kranti_user(id),
    delivery_condition TEXT,       -- EX / FOR
    lifting_date TEXT,             -- window start
    last_lifting_date TEXT,        -- window end
    payment_type TEXT,             -- advance / credit / ratio
    advance_pct REAL,              -- ratio fields, auto-complementary
    credit_pct REAL,
    payment_detail TEXT,           -- free-text notes, optional
    status TEXT DEFAULT 'draft',   -- draft / so_generated / verified / disputed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deal_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER REFERENCES deal(id),
    best_buy_id INTEGER REFERENCES best_buy_item(id),  -- required: item must come from the Best Buy catalog
    product_name TEXT NOT NULL,   -- snapshotted from best_buy_item at time of order (catalog may change later)
    description TEXT,             -- snapshotted from best_buy_item
    hsn TEXT,
    qty REAL,
    unit TEXT,                    -- UOM (Unit of Measure)
    price REAL                    -- unit rate (editable per deal, defaults from best_buy_item.default_rate)
);

-- SALE ORDER: ID #2 of the 4-ID system: so_id
CREATE TABLE sale_order (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER REFERENCES deal(id),
    transporter_id INTEGER REFERENCES transporter(id),
    sequential_code TEXT,          -- 7-digit, shown on SO
    link_hash TEXT,                -- hash(code + seller_gstin)
    status TEXT DEFAULT 'sent',    -- sent / viewed / verified / denied / ignored / expired
    resend_count INTEGER DEFAULT 0,
    generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,               -- hard expiry — generated_at + 25 min
    responded_at TEXT,
    frozen_at TEXT                 -- FREEZE #1 — set only on verified
);

-- INVOICE ACK REC: ID #3 of the 4-ID system: bill_id
-- parent_id / branch handling = ID #4 (branch_id), deferred module, field reserved here.
CREATE TABLE invoice_ack_rec (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    so_id INTEGER REFERENCES sale_order(id),
    parent_id INTEGER REFERENCES invoice_ack_rec(id),  -- branch_id target, deferred
    invoice_number TEXT,           -- seller-entered, sequential-suggested
    invoice_date TEXT,             -- seller-entered
    ocr_verified INTEGER DEFAULT 0,-- stub: OCR cross-check pass/fail before flush
    status TEXT DEFAULT 'draft',   -- draft / otp_sent / verified / final
    otp_code TEXT,
    otp_attempts INTEGER DEFAULT 0,
    otp_locked INTEGER DEFAULT 0,
    otp_verified_at TEXT,
    estamp_ref TEXT,
    estamp_timestamp TEXT,
    grace_period_ends_at TEXT,
    distributed_at TEXT,
    distributed_channels TEXT      -- comma list, e.g. "buyer:email,agent:sms,transporter:email"
);

CREATE TABLE terms_condition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    set_label TEXT,
    content TEXT
);

CREATE TABLE seller_note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organization(id),
    content TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

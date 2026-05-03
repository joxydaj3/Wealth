const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Configuração do Banco de Dados (Supabase Pooler)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Configuração de Uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'wealth_pro_max_v6_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));

// --- INICIALIZAÇÃO DO BANCO DE DADOS ---
async function initDB() {
  const client = await pool.connect();
  try {
    // 1. Criar tabelas básicas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, phone TEXT UNIQUE, name TEXT, password TEXT, password_plain TEXT, 
        balance REAL DEFAULT 0, ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000',
        role TEXT DEFAULT 'user', status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_checkin DATE
      );
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY, name TEXT UNIQUE, price REAL, daily_profit REAL, duration INTEGER, 
        total_return REAL, image_url TEXT, category TEXT DEFAULT 'Normal', active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS user_plans (
        id SERIAL PRIMARY KEY, user_id INTEGER, plan_id INTEGER, buy_date DATE DEFAULT CURRENT_DATE, 
        last_claim DATE, expires_at DATE, status TEXT DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY, user_id INTEGER, type TEXT, amount REAL, method TEXT, 
        status TEXT DEFAULT 'pending', proof_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. CORREÇÃO: Garantir colunas extras e restrição UNIQUE no nome do plano
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plans' AND column_name='category') THEN
          ALTER TABLE plans ADD COLUMN category TEXT DEFAULT 'Normal';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_checkin') THEN
          ALTER TABLE users ADD COLUMN last_checkin DATE;
        END IF;
        -- Garante que o nome do plano seja único para o ON CONFLICT funcionar
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_name_unique') THEN
          ALTER TABLE plans ADD CONSTRAINT plans_name_unique UNIQUE (name);
        END IF;
      END $$;
    `);
    
    // 3. Cadastrar/Atualizar os 15 Planos
    const allPlans = [
        { n: 'Wealth Vanguard Core', p: 500, d: 35, dur: 30, t: 1550, c: 'Normal', i: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400' },
        { n: 'Wealth BlackRock Flow', p: 1000, d: 75, dur: 30, t: 3250, c: 'Normal', i: 'https://images.unsplash.com/photo-1611974714024-4607a5146b91?w=400' },
        { n: 'Wealth Berkshire Growth', p: 2500, d: 200, dur: 30, t: 8500, c: 'Normal', i: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400' },
        { n: 'Wealth Goldman Edge', p: 5000, d: 425, dur: 30, t: 17750, c: 'Normal', i: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400' },
        { n: 'Wealth Morgan Prime', p: 10000, d: 900, dur: 30, t: 37000, c: 'Normal', i: 'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=400' },
        { n: 'Wealth Fidelity Boost', p: 25000, d: 2375, dur: 30, t: 96250, c: 'Normal', i: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400' },
        { n: 'Wealth Citadel Power', p: 50000, d: 5000, dur: 30, t: 200000, c: 'Normal', i: 'https://images.unsplash.com/photo-1639754390267-dc26d370126a?w=400' },
        { n: 'Wealth Bridgewater Max', p: 100000, d: 11000, dur: 30, t: 430000, c: 'Normal', i: 'https://images.unsplash.com/photo-1642104704074-907c0698bcd9?w=400' },
        { n: 'Wealth Renaissance Ultra', p: 150000, d: 17250, dur: 30, t: 667500, c: 'Normal', i: 'https://images.unsplash.com/photo-1621905252507-b354bcadc08e?w=400' },
        { n: 'Wealth Rothschild Apex', p: 250000, d: 30000, dur: 30, t: 1150000, c: 'Normal', i: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=400' },
        { n: 'VIP 1 – Wealth Starter Surge', p: 300, d: 93, dur: 5, t: 465, c: 'VIP', i: 'https://images.unsplash.com/photo-1633151209829-3070446c1418?w=400' },
        { n: 'VIP 2 – Wealth Silver Boost', p: 1000, d: 250, dur: 7, t: 1750, c: 'VIP', i: 'https://images.unsplash.com/photo-1502920514313-52581002a659?w=400' },
        { n: 'VIP 3 – Wealth Gold Multiplier', p: 5000, d: 1250, dur: 10, t: 12500, c: 'VIP', i: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=400' },
        { n: 'VIP 4 – Wealth Platinum Hyper', p: 15000, d: 4050, dur: 12, t: 48600, c: 'VIP', i: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400' },
        { n: 'VIP 5 – Wealth Diamond Prime', p: 50000, d: 11850, dur: 15, t: 177750, c: 'VIP', i: 'https://images.unsplash.com/photo-1599056377704-5853406399a0?w=400' }
    ];

    for (let p of allPlans) {
        await client.query(`
            INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url, category) 
            VALUES ($1,$2,$3,$4,$5,$6,$7) 
            ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, daily_profit = EXCLUDED.daily_profit, category = EXCLUDED.category`, 
            [p.n, p.p, p.d, p.dur, p.t, p.i, p.c]);
    }
    console.log("Sistema pronto e planos atualizados.");
  } finally { client.release(); }
}
initDB();

// --- LÓGICA DE COMISSÃO ---
async function payCommissions(userId, amount) {
    const user = (await pool.query("SELECT invited_by FROM users WHERE id = $1", [userId])).rows[0];
    if (!user || !user.invited_by) return;
    const levels = [0.06, 0.03, 0.01];
    let currentCode = user.invited_by;
    for (let i = 0; i < levels.length; i++) {
        const upline = (await pool.query("SELECT id, invited_by FROM users WHERE ref_code = $1", [currentCode])).rows[0];
        if (upline) {
            const bonus = amount * levels[i];
            await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [bonus, upline.id]);
            await pool.query("INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, 'referral', $2, 'approved')", [upline.id, bonus]);
            if (!upline.invited_by) break;
            currentCode = upline.invited_by;
        } else break;
    }
}

// --- ROTAS AUTH ---
app.post('/api/register', async (req, res) => {
    const { phone, name, password, invite } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const myRef = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await pool.query('INSERT INTO users (phone, name, password, password_plain, ref_code, invited_by) VALUES ($1,$2,$3,$4,$5,$6)', [phone, name, hash, password, myRef, invite || null]);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Telefone já registrado.' }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    if (phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 99999; req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = (await pool.query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
        if (user.status === 'banned') return res.status(403).json({ error: 'Conta Banida.' });
        req.session.userId = user.id; req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else res.status(401).json({ error: 'Dados incorretos' });
});

// --- ROTAS USUÁRIO ---
app.get('/api/user/data', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const user = (await pool.query(`
        SELECT u.*, 
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'withdraw' AND status = 'approved') as total_with,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'profit') as total_earned,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'referral') as total_earned_referral,
        (SELECT count(*) FROM user_plans WHERE user_id = u.id AND status = 'active') as plans_count
        FROM users u WHERE u.id = $1
    `, [req.session.userId])).rows[0];
    res.json(user);
});

app.get('/api/plans', async (req, res) => {
    const plans = await pool.query("SELECT * FROM plans WHERE active = 1 ORDER BY price ASC");
    res.json(plans.rows);
});

app.post('/api/user/checkin', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const today = new Date().toISOString().split('T')[0];
    const user = (await pool.query("SELECT last_checkin FROM users WHERE id = $1", [req.session.userId])).rows[0];
    if (user.last_checkin && user.last_checkin.toISOString().split('T')[0] === today) return res.status(400).json({ error: "Check-in já realizado hoje!" });
    const bonus = (Math.random() * (5.00 - 0.50) + 0.50).toFixed(2);
    await pool.query("UPDATE users SET balance = balance + $1, last_checkin = $2 WHERE id = $3", [bonus, today, req.session.userId]);
    await pool.query("INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, 'bonus', $2, 'approved')", [req.session.userId, bonus]);
    res.json({ success: true, amount: bonus });
});

app.get('/api/user/available-profits', async (req, res) => {
    const profits = await pool.query(`SELECT up.id, p.name, p.daily_profit FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.user_id = $1 AND up.status = 'active' AND (up.last_claim IS NULL OR up.last_claim < CURRENT_DATE)`, [req.session.userId]);
    res.json(profits.rows);
});

app.post('/api/user/claim-profit', async (req, res) => {
    const { userPlanId } = req.body;
    const up = (await pool.query(`SELECT p.daily_profit FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.id = $1 AND up.user_id = $2`, [userPlanId, req.session.userId])).rows[0];
    if (up) {
        await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [up.daily_profit, req.session.userId]);
        await pool.query("UPDATE user_plans SET last_claim = CURRENT_DATE WHERE id = $1", [userPlanId]);
        await pool.query("INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, 'profit', $2, 'approved')", [req.session.userId, up.daily_profit]);
        res.json({ success: true });
    } else res.status(400).send();
});

// --- ROTAS ADMIN ---
app.get('/api/admin/full-stats', async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send();
    try {
        const uCount = (await pool.query("SELECT count(*) FROM users")).rows[0].count;
        const bSum = (await pool.query("SELECT sum(balance) FROM users")).rows[0].sum || 0;
        const depP = (await pool.query("SELECT count(*) as c, sum(amount) as s FROM transactions WHERE type='deposit' AND status='pending'")).rows[0];
        const withP = (await pool.query("SELECT count(*) as c, sum(amount) as s FROM transactions WHERE type='withdraw' AND status='pending'")).rows[0];
        const depA = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='deposit' AND status='approved'")).rows[0];
        const withA = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='withdraw' AND status='approved'")).rows[0];
        const refG = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='referral'")).rows[0];

        res.json({
            totalUsers: uCount, totalBalance: bSum,
            depPending: depP, withPending: withP,
            depApproved: depA, withApproved: withA,
            referralGains: refG.s || 0
        });
    } catch (e) { res.json({error: true}); }
});

app.get('/api/admin/user-details', async (req, res) => {
    const users = (await pool.query(`SELECT u.*, (SELECT count(*) FROM users WHERE invited_by = u.ref_code) as total_invites, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'approved') as total_dep, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'withdraw' AND status = 'approved') as total_with, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'profit') as total_earned FROM users u ORDER BY u.id DESC`)).rows;
    for (let u of users) {
        u.active_plans = (await pool.query(`SELECT up.id, p.name, up.expires_at FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.user_id = $1 AND up.status = 'active'`, [u.id])).rows;
    }
    res.json(users);
});

app.post('/api/admin/create-plan', upload.single('image'), async (req, res) => {
    const { name, price, daily, duration } = req.body;
    const imgUrl = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400';
    await pool.query("INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (name) DO NOTHING", [name, price, daily, duration, daily * duration, imgUrl]);
    res.json({ success: true });
});

app.post('/api/admin/transaction-action', async (req, res) => {
    const { id, action } = req.body;
    const t = (await pool.query("SELECT * FROM transactions WHERE id = $1", [id])).rows[0];
    if (action === 'approve') {
        await pool.query("UPDATE transactions SET status = 'approved' WHERE id = $1", [id]);
        if (t.type === 'deposit') {
            await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [t.amount, t.user_id]);
            await payCommissions(t.user_id, t.amount);
        }
    } else {
        if (t.status === 'approved' && t.type === 'deposit') await pool.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [t.amount, t.user_id]);
        await pool.query("UPDATE transactions SET status = 'rejected' WHERE id = $1", [id]);
    }
    res.json({ success: true });
});

app.get('/api/admin/transactions', async (req, res) => {
    const { type } = req.query;
    const list = await pool.query(`SELECT t.*, u.phone, u.name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.type = $1 ORDER BY t.id DESC`, [type]);
    res.json(list.rows);
});

app.post('/api/admin/user/update-phone', async (req, res) => {
    await pool.query("UPDATE users SET phone = $1 WHERE id = $2", [req.body.newPhone, req.body.userId]);
    res.json({ success: true });
});

app.post('/api/admin/user/status', async (req, res) => {
    await pool.query("UPDATE users SET status = $1 WHERE id = $2", [req.body.status, req.body.userId]);
    res.json({ success: true });
});

app.get('/api/admin/list-ads', async (req, res) => {
    const ads = await pool.query("SELECT * FROM ads ORDER BY id DESC");
    res.json(ads.rows);
});

app.post('/api/admin/send-ad', async (req, res) => {
    await pool.query("INSERT INTO ads (message) VALUES ($1)", [req.body.message]);
    res.json({ success: true });
});

app.post('/api/admin/delete-ad', async (req, res) => {
    await pool.query("DELETE FROM ads WHERE id = $1", [req.body.id]);
    res.json({ success: true });
});

app.post('/api/admin/update-balance', async (req, res) => {
    await pool.query("UPDATE users SET balance = $1 WHERE id = $2", [req.body.newBalance, req.body.userId]);
    res.json({ success: true });
});

app.get('/api/admin/list-plans', async (req, res) => {
    const plans = await pool.query("SELECT * FROM plans");
    res.json(plans.rows);
});

app.post('/api/admin/delete-plan', async (req, res) => {
    await pool.query("DELETE FROM plans WHERE id = $1", [req.body.id]);
    res.json({ success: true });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Wealth Pro Max Online na porta ${PORT}`));

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Configuração Blindada para Supabase no Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Isso permite a conexão mesmo com certificados auto-assinados
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// --- CONFIGURAÇÃO DE UPLOADS ---
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
    secret: 'wealth_pro_2026_everlasting_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));

// --- INICIALIZAÇÃO DO BANCO PERSISTENTE ---
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT UNIQUE, name TEXT, password TEXT, password_plain TEXT, balance REAL DEFAULT 0,
        ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000',
        role TEXT DEFAULT 'user', status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name TEXT, price REAL, daily_profit REAL, duration INTEGER, 
        total_return REAL, image_url TEXT, active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS user_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, plan_id INTEGER, buy_date DATE DEFAULT CURRENT_DATE, 
        last_claim DATE, expires_at DATE, status TEXT DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, type TEXT, amount REAL, method TEXT, 
        status TEXT DEFAULT 'pending', proof_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      async function seedPlans() {
  const plans = [
    // PLANOS NORMAS (Retorno de capital no fim)
    { name: 'Wealth Vanguard Core', price: 500, daily: 35, duration: 30, total: 1550, cat: 'Normal', img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400' },
    { name: 'Wealth BlackRock Flow', price: 1000, daily: 75, duration: 30, total: 3250, cat: 'Normal', img: 'https://images.unsplash.com/photo-1611974714024-4607a5146b91?w=400' },
    { name: 'Wealth Berkshire Growth', price: 2500, daily: 200, duration: 30, total: 8500, cat: 'Normal', img: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400' },
    { name: 'Wealth Goldman Edge', price: 5000, daily: 425, duration: 30, total: 17750, cat: 'Normal', img: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400' },
    { name: 'Wealth Morgan Prime', price: 10000, daily: 900, duration: 30, total: 37000, cat: 'Normal', img: 'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=400' },
    { name: 'Wealth Fidelity Boost', price: 25000, daily: 2375, duration: 30, total: 96250, cat: 'Normal', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400' },
    { name: 'Wealth Citadel Power', price: 50000, daily: 5000, duration: 30, total: 200000, cat: 'Normal', img: 'https://images.unsplash.com/photo-1639754390267-dc26d370126a?w=400' },
    { name: 'Wealth Bridgewater Max', price: 100000, daily: 11000, duration: 30, total: 430000, cat: 'Normal', img: 'https://images.unsplash.com/photo-1642104704074-907c0698bcd9?w=400' },
    { name: 'Wealth Renaissance Ultra', price: 150000, daily: 17250, duration: 30, total: 667500, cat: 'Normal', img: 'https://images.unsplash.com/photo-1621905252507-b354bcadc08e?w=400' },
    { name: 'Wealth Rothschild Apex', price: 250000, daily: 30000, duration: 30, total: 1150000, cat: 'Normal', img: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=400' },
    
    // PLANOS VIP (Pagamento único no fim)
    { name: 'VIP 1 – Wealth Starter Surge', price: 300, daily: 93, duration: 5, total: 465, cat: 'VIP', img: 'https://images.unsplash.com/photo-1633151209829-3070446c1418?w=400' },
    { name: 'VIP 2 – Wealth Silver Boost', price: 1000, daily: 250, duration: 7, total: 1750, cat: 'VIP', img: 'https://images.unsplash.com/photo-1502920514313-52581002a659?w=400' },
    { name: 'VIP 3 – Wealth Gold Multiplier', price: 5000, daily: 1250, duration: 10, total: 12500, cat: 'VIP', img: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=400' },
    { name: 'VIP 4 – Wealth Platinum Hyper', price: 15000, daily: 4050, duration: 12, total: 48600, cat: 'VIP', img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400' },
    { name: 'VIP 5 – Wealth Diamond Prime', price: 50000, daily: 11850, duration: 15, total: 177750, cat: 'VIP', img: 'https://images.unsplash.com/photo-1599056377704-5853406399a0?w=400' }
  ];

  for (let p of plans) {
    await pool.query(`INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url, category) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, 
    [p.name, p.price, p.daily, p.duration, p.total, p.img, p.cat]);
  }
}
    `);
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
        await pool.query('INSERT INTO users (phone, name, password, password_plain, ref_code, invited_by) VALUES ($1,$2,$3,$4,$5,$6)', 
        [phone, name, hash, password, myRef, invite || null]);
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
    } else res.status(401).json({ error: 'Falha no login' });
});

// --- ROTAS DE USUÁRIO (LUCROS) ---
app.get('/api/user/available-profits', async (req, res) => {
    const profits = await pool.query(`
        SELECT up.id, p.name, p.daily_profit FROM user_plans up 
        JOIN plans p ON up.plan_id = p.id 
        WHERE up.user_id = $1 AND up.status = 'active' AND (up.last_claim IS NULL OR up.last_claim < CURRENT_DATE)`, 
        [req.session.userId]);
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

// --- DEPÓSITO E SAQUE ---
app.post('/api/user/deposit', upload.single('proof'), async (req, res) => {
    const { amount, method } = req.body;
    const result = await pool.query("INSERT INTO transactions (user_id, type, amount, method, proof_url, status) VALUES ($1, 'deposit', $2, $3, $4, 'pending') RETURNING id", 
    [req.session.userId, amount, method, req.file ? `/uploads/${req.file.filename}` : null]);
    
    const transId = result.rows[0].id;
    const delay = (Math.floor(Math.random() * 15) + 5) * 60000;
    setTimeout(async () => {
        const t = (await pool.query("SELECT status FROM transactions WHERE id = $1", [transId])).rows[0];
        if (t && t.status === 'pending') {
            await pool.query("UPDATE transactions SET status = 'approved' WHERE id = $1", [transId]);
            await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, req.session.userId]);
            payCommissions(req.session.userId, amount);
        }
    }, delay);
    res.json({ success: true });
});

// --- ADMIN API ---
app.get('/api/admin/full-stats', async (req, res) => {
    const uCount = (await pool.query("SELECT count(*) FROM users")).rows[0].count;
    const bSum = (await pool.query("SELECT sum(balance) FROM users")).rows[0].sum || 0;
    const getS = async (t, s) => (await pool.query("SELECT count(*), sum(amount) FROM transactions WHERE type=$1 AND status=$2", [t, s])).rows[0];
    
    res.json({
        totalUsers: uCount, totalBalance: bSum,
        depPending: await getS('deposit', 'pending'),
        withPending: await getS('withdraw', 'pending')
    });
});

app.get('/api/admin/user-details', async (req, res) => {
    const users = (await pool.query(`
        SELECT u.*, (SELECT count(*) FROM users WHERE invited_by = u.ref_code) as total_invites,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'approved') as total_dep,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'withdraw' AND status = 'approved') as total_with,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'profit') as total_earned
        FROM users u ORDER BY u.id DESC`)).rows;

    for (let u of users) {
        u.active_plans = (await pool.query(`SELECT up.id, p.name FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.user_id = $1 AND up.status = 'active'`, [u.id])).rows;
    }
    res.json(users);
});

app.post('/api/admin/create-plan', upload.single('image'), async (req, res) => {
    const { name, price, daily, duration } = req.body;
    const imgUrl = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.query("INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url) VALUES ($1,$2,$3,$4,$5,$6)", 
    [name, price, daily, duration, daily * duration, imgUrl]);
    res.json({ success: true });
});

app.get('/api/user/data', async (req, res) => {
    const user = (await pool.query("SELECT * FROM users WHERE id = $1", [req.session.userId])).rows[0];
    res.json(user);
});

// Outras rotas como delete-ad, list-ads, transaction-action seguem o mesmo padrão de client.query...

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Wealth Pro Max na porta ${PORT}`));

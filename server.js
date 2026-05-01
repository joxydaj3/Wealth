const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');

const app = express();
const db = new Database('wealth_pro.db');

// Configuração de Uploads
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Banco de Dados - Tabelas Profissionais
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE, name TEXT, password TEXT, balance REAL DEFAULT 0,
    ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000',
    status TEXT DEFAULT 'active', last_profit_check DATE
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_pt TEXT, value REAL, duration INTEGER, daily_profit REAL, 
    total_return REAL, image TEXT, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, plan_id INTEGER, buy_date DATE, 
    last_claim DATE, expires_at DATE
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, type TEXT, amount REAL, method TEXT, 
    status TEXT DEFAULT 'pending', proof TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'wealth_pro_ultra_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));

// --- LÓGICA DE LUCRO (MEIA-NOITE) ---
// O lucro é gerado, mas se o usuário não coletar no dia, ele perde.
app.get('/api/user/available-profits', (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const today = new Date().toISOString().split('T')[0];
    
    const profits = db.prepare(`
        SELECT up.id, p.name_pt, p.daily_profit 
        FROM user_plans up 
        JOIN plans p ON up.plan_id = p.id 
        WHERE up.user_id = ? AND up.expires_at >= ? AND (up.last_claim IS NULL OR up.last_claim < ?)
    `).all(req.session.userId, today, today);
    
    res.json(profits);
});

app.post('/api/user/claim-profit', (req, res) => {
    const { userPlanId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const up = db.prepare("SELECT p.daily_profit FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.id = ? AND up.user_id = ?").get(userPlanId, req.session.userId);
    
    if (up) {
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(up.daily_profit, req.session.userId);
        db.prepare("UPDATE user_plans SET last_claim = ? WHERE id = ?").run(today, userPlanId);
        db.prepare("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, 'profit', ?, 'approved')").run(req.session.userId, up.daily_profit);
        res.json({ success: true });
    } else res.status(400).send();
});

// --- AUTENTICAÇÃO ---
app.post('/api/register', async (req, res) => {
    const { phone, name, password, invite, captcha } = req.body;
    if (captcha !== 'wealth2026') return res.status(400).json({ error: 'Captcha Inválido' });
    
    const hash = await bcrypt.hash(password, 10);
    const ref = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        db.prepare('INSERT INTO users (phone, name, password, ref_code, invited_by) VALUES (?,?,?,?,?)').run(phone, name, hash, ref, invite);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Telefone já registrado' }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    if(phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 999; req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if(user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id; req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else res.status(401).json({ error: 'Dados incorretos' });
});

// --- ADMIN API ---
app.get('/api/admin/data', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).send();
    const stats = {
        users: db.prepare("SELECT count(*) as c FROM users").get().c,
        balance: db.prepare("SELECT sum(balance) as s FROM users").get().s || 0,
        deposits: db.prepare("SELECT count(*) as c FROM transactions WHERE type='deposit' AND status='pending'").get().c,
        withdraws: db.prepare("SELECT count(*) as c FROM transactions WHERE type='withdraw' AND status='pending'").get().c
    };
    res.json(stats);
});

app.post('/api/admin/plan', (req, res) => {
    const { name, value, daily, duration } = req.body;
    db.prepare("INSERT INTO plans (name_pt, value, daily_profit, duration, total_return) VALUES (?,?,?,?,?)")
      .run(name, value, daily, duration, daily * duration);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wealth Pro ativa na porta ${PORT}`));

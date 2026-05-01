const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const db = new Database('wealth.db');

// --- CONFIGURAÇÃO DE UPLOADS ---
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- INICIALIZAÇÃO DO BANCO DE DADOS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    password TEXT,
    name TEXT,
    balance REAL DEFAULT 0,
    referral_code TEXT UNIQUE,
    invited_by TEXT,
    pin TEXT DEFAULT '0000',
    role TEXT DEFAULT 'user',
    profession TEXT DEFAULT 'Cp',
    location TEXT DEFAULT 'Maputo, Moçambique',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_pt TEXT,
    name_en TEXT,
    price REAL,
    daily_profit REAL,
    duration_days INTEGER,
    max_purchases INTEGER DEFAULT 1,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    plan_id INTEGER,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    last_collection DATETIME,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 'deposit', 'withdraw', 'referral', 'profit'
    amount REAL,
    net_amount REAL,
    method TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    proof_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'wealth-super-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

const isAdmin = (req, res, next) => {
    if (req.session.role === 'admin') next();
    else res.status(403).json({ error: 'Acesso negado' });
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/register', async (req, res) => {
    const { phone, password, name, invite_code } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
        db.prepare('INSERT INTO users (phone, password, name, referral_code, invited_by) VALUES (?, ?, ?, ?, ?)')
          .run(phone, hash, name, myRefCode, invite_code || null);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: 'Telefone já cadastrado ou erro no sistema.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;

    // Admin Fixo conforme solicitado
    if (phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 999999;
        req.session.role = 'admin';
        req.session.userName = 'Joaquim Jorge';
        return res.json({ success: true, role: 'admin' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id;
        req.session.role = 'user';
        req.session.userName = user.name;
        res.json({ success: true, role: 'user' });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ROTAS DE USUÁRIO ---

app.get('/api/user/data', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Não logado' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const plans = db.prepare('SELECT count(*) as count FROM user_plans WHERE user_id = ? AND status="active"').get(req.session.userId);
    res.json({ ...user, active_plans: plans.count });
});

// Criar depósito
app.post('/api/user/deposit', upload.single('proof'), (req, res) => {
    const { amount, method } = req.body;
    const userId = req.session.userId;

    const stmt = db.prepare('INSERT INTO transactions (user_id, type, amount, method, proof_url, status) VALUES (?, "deposit", ?, ?, ?, "pending")');
    const info = stmt.run(userId, amount, method, req.file ? req.file.filename : null);

    // Simulação de aprovação automática entre 5 e 20 min
    const delay = (Math.floor(Math.random() * (20 - 5 + 1)) + 5) * 60 * 1000;
    setTimeout(() => {
        const trans = db.prepare('SELECT status FROM transactions WHERE id = ?').get(info.lastInsertRowid);
        if (trans.status === 'pending') {
            db.prepare('UPDATE transactions SET status = "approved" WHERE id = ?').run(info.lastInsertRowid);
            db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
            
            // Lógica de Comissão de Indicação (3 Níveis: 6%, 3%, 1%)
            payReferralCommissions(userId, amount);
        }
    }, delay);

    res.json({ success: true, message: 'Depósito enviado. Aguardando aprovação.' });
});

// Saque (Simulado com Taxa de 13%)
app.post('/api/user/withdraw', (req, res) => {
    const { amount, pin, method } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

    if (amount < 130) return res.status(400).json({ error: 'Mínimo de 130 MZN' });
    if (user.pin !== pin) return res.status(400).json({ error: 'PIN de segurança incorreto' });
    if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });

    const tax = amount * 0.13;
    const net = amount - tax;

    db.prepare('INSERT INTO transactions (user_id, type, amount, net_amount, method, status) VALUES (?, "withdraw", ?, ?, ?, "pending")')
      .run(req.session.userId, amount, net, method);
    
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, req.session.userId);
    
    res.json({ success: true });
});

// --- SISTEMA DE INDICAÇÃO (3 NÍVEIS) ---
function payReferralCommissions(userId, depositAmount) {
    const user = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(userId);
    if (!user || !user.invited_by) return;

    // Nível 1 - 6%
    const upline1 = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user.invited_by);
    if (upline1) {
        const bonus1 = depositAmount * 0.06;
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bonus1, upline1.id);
        db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "referral", ?, "approved")').run(upline1.id, bonus1);

        // Nível 2 - 3%
        const user2 = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(upline1.id);
        if (user2 && user2.invited_by) {
            const upline2 = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user2.invited_by);
            if (upline2) {
                const bonus2 = depositAmount * 0.03;
                db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bonus2, upline2.id);
                db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "referral", ?, "approved")').run(upline2.id, bonus2);

                // Nível 3 - 1%
                const user3 = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(upline2.id);
                if (user3 && user3.invited_by) {
                    const upline3 = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user3.invited_by);
                    if (upline3) {
                        const bonus3 = depositAmount * 0.01;
                        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bonus3, upline3.id);
                        db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "referral", ?, "approved")').run(upline3.id, bonus3);
                    }
                }
            }
        }
    }
}

// --- ROTAS ADMINISTRATIVAS ---

app.get('/api/admin/dashboard', isAdmin, (req, res) => {
    const stats = {
        totalUsers: db.prepare('SELECT count(*) as c FROM users').get
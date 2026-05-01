const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('wealth.db');
const upload = multer({ dest: 'public/uploads/' });

// Configuração de Tabelas (Baseada nas Imagens)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    password TEXT,
    name TEXT,
    balance REAL DEFAULT 0,
    referral_code TEXT UNIQUE,
    invited_by TEXT,
    pin TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    daily_profit REAL,
    duration INTEGER,
    type TEXT DEFAULT 'Automatic'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- deposit, withdraw, profit
    amount REAL,
    status TEXT DEFAULT 'pending',
    proof_url TEXT,
    method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'wealth_secret_2026',
    resave: false,
    saveUninitialized: true
}));

// --- LÓGICA DE INVESTIMENTO AUTOMÁTICO ---
setInterval(() => {
    // Simula lucros diários para usuários com planos (baseado na imagem "Lucros Diários")
    const activeInvestments = db.prepare('SELECT user_id, amount, daily_profit FROM transactions WHERE type="plan_buy" AND status="active"').all();
    activeInvestments.forEach(inv => {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(inv.daily_profit, inv.user_id);
        db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "profit", ?, "collected")').run(inv.user_id, inv.daily_profit);
    });
}, 86400000); // 24 horas

// --- ROTAS AUTH ---
app.post('/api/register', async (req, res) => {
    const { phone, password, invited_by, name } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const ref = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        db.prepare('INSERT INTO users (phone, password, name, referral_code, invited_by) VALUES (?,?,?,?,?)').run(phone, hash, name, ref, invited_by);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Telefone já existe' }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    if(phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 0; req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if(user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id; req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else { res.status(401).json({ error: 'Dados incorretos' }); }
});

// --- DEPÓSITO COM REGRA DE 5 MINUTOS ---
app.post('/api/deposit', upload.single('proof'), (req, res) => {
    const { amount, method } = req.body;
    const info = db.prepare('INSERT INTO transactions (user_id, type, amount, status, method, proof_url) VALUES (?, "deposit", ?, "pending", ?, ?)')
        .run(req.session.userId, amount, method, req.file ? req.file.filename : '');
    
    // O frontend gerencia o timer de 5min. Se o admin não aprovar, o saldo não cai.
    res.json({ success: true, id: info.lastInsertRowid });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wealth rodando na porta ${PORT}`));
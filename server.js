const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const db = new Database('wealth.db');

// Pastas
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'wealth_2026_pro',
    resave: false,
    saveUninitialized: false
}));

// BANCO DE DADOS COMPLETO
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE, password TEXT, name TEXT, balance REAL DEFAULT 0,
    referral_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000', role TEXT DEFAULT 'user'
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, price REAL, daily_profit REAL, duration INTEGER, total_profit REAL
  );
  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, plan_id INTEGER, date_bought DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_claim DATE -- Guarda a data do último lucro recebido
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount REAL, status TEXT DEFAULT 'pending', method TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, app_link TEXT, about_text TEXT);
`);

// Inserir configuração inicial se não existir
db.prepare("INSERT OR IGNORE INTO settings (id, app_link, about_text) VALUES (1, '#', 'Wealth é sua plataforma de investimentos.')").run();

// --- LÓGICA DE LUCRO DIÁRIO ---
// Esta rota verifica se o usuário tem lucros para "Receber" hoje
app.get('/api/user/check-profits', (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const today = new Date().toISOString().split('T')[0];
    
    // Busca planos ativos onde o lucro de hoje ainda não foi coletado
    const pending = db.prepare(`
        SELECT up.id, p.daily_profit, p.name 
        FROM user_plans up 
        JOIN plans p ON up.plan_id = p.id 
        WHERE up.user_id = ? AND (up.last_claim IS NULL OR up.last_claim < ?)
    `).all(req.session.userId, today);
    
    res.json(pending);
});

// Coletar Lucro (O usuário clica e ganha, se não clicar, o dia passa e ele perde)
app.post('/api/user/claim-profit', (req, res) => {
    const { userPlanId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const up = db.prepare("SELECT p.daily_profit FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.id = ? AND up.user_id = ?").get(userPlanId, req.session.userId);
    
    if (up) {
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(up.daily_profit, req.session.userId);
        db.prepare("UPDATE user_plans SET last_claim = ? WHERE id = ?").run(today, userPlanId);
        db.prepare("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, 'profit', ?, 'approved')").run(req.session.userId, up.daily_profit);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Lucro já coletado ou plano inválido" });
    }
});

// --- API ADMIN ---
app.post('/api/admin/create-plan', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send();
    const { name, price, daily, duration, total } = req.body;
    db.prepare("INSERT INTO plans (name, price, daily_profit, duration, total_profit) VALUES (?,?,?,?,?)").run(name, price, daily, duration, total);
    res.json({ success: true });
});

app.get('/api/admin/dashboard', (req, res) => {
    const users = db.prepare("SELECT count(*) as c FROM users").get().c;
    const balance = db.prepare("SELECT sum(balance) as s FROM users").get().s || 0;
    const transactions = db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT 10").all();
    res.json({ users, balance, transactions });
});

// --- AUTH E OUTROS (MANTÉM O ANTERIOR) ---
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    if (phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 999; req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id; req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else { res.status(401).json({ error: 'Credenciais inválidas' }); }
});

app.get('/api/user/data', (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
});

app.listen(process.env.PORT || 3000, () => console.log("Wealth ON"));

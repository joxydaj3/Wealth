const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');

const app = express();
const db = new Database('wealth_pro.db');

// --- CONFIGURAÇÃO DE ARQUIVOS (MULTER) ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'wealth_pro_2026_secure_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 24 horas de sessão
}));

// --- INICIALIZAÇÃO DO BANCO DE DADOS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE, name TEXT, password TEXT, balance REAL DEFAULT 0,
    ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000',
    role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, price REAL, daily_profit REAL, duration INTEGER, 
    total_return REAL, image_url TEXT, active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, plan_id INTEGER, buy_date DATE, 
    last_claim DATE, expires_at DATE, status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, type TEXT, amount REAL, method TEXT, 
    status TEXT DEFAULT 'pending', proof_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- FUNÇÃO AUXILIAR: COMISSÃO DE 3 NÍVEIS (6%, 3%, 1%) ---
function payCommissions(userId, amount) {
    const user = db.prepare("SELECT invited_by FROM users WHERE id = ?").get(userId);
    if (!user || !user.invited_by) return;

    const levels = [0.06, 0.03, 0.01];
    let currentInviterCode = user.invited_by;

    for (let i = 0; i < levels.length; i++) {
        const upline = db.prepare("SELECT id, invited_by FROM users WHERE ref_code = ?").get(currentInviterCode);
        if (upline) {
            const bonus = amount * levels[i];
            db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(bonus, upline.id);
            db.prepare("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, 'referral', ?, 'approved')").run(upline.id, bonus);
            if (!upline.invited_by) break;
            currentInviterCode = upline.invited_by;
        } else break;
    }
}

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/api/register', async (req, res) => {
    const { phone, name, password, invite } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const myRef = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        db.prepare('INSERT INTO users (phone, name, password, ref_code, invited_by) VALUES (?,?,?,?,?)')
          .run(phone, name, hash, myRef, invite || null);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Telefone já registrado.' }); }
});

 app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    if (phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 999; req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    
    if (user && await bcrypt.compare(password, user.password)) {
        if (user.status === 'banned') {
            return res.status(403).json({ error: 'Sua conta foi banida. Fale com o suporte para assistência.' });
        }
        req.session.userId = user.id; req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else {
        res.status(401).json({ error: 'Telefone ou senha incorretos.' });
    }
});

// --- ROTAS DE USUÁRIO ---
app.get('/api/user/data', (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const user = db.prepare("SELECT id, phone, name, balance, ref_code, pin, role FROM users WHERE id = ?").get(req.session.userId);
    res.json(user);
});

app.get('/api/user/available-profits', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const profits = db.prepare(`
        SELECT up.id, p.name, p.daily_profit 
        FROM user_plans up 
        JOIN plans p ON up.plan_id = p.id 
        WHERE up.user_id = ? AND up.status = 'active' AND (up.last_claim IS NULL OR up.last_claim < ?)
    `).all(req.session.userId, today);
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

// --- DEPÓSITO E SAQUE ---
app.post('/api/user/deposit', upload.single('proof'), (req, res) => {
    const { amount, method } = req.body;
    const info = db.prepare("INSERT INTO transactions (user_id, type, amount, method, proof_url, status) VALUES (?, 'deposit', ?, ?, ?, 'pending')")
                  .run(req.session.userId, amount, method, req.file ? `/uploads/${req.file.filename}` : null);
    
    const delay = (Math.floor(Math.random() * 15) + 5) * 60 * 1000;
    setTimeout(() => {
        const trans = db.prepare("SELECT status FROM transactions WHERE id = ?").get(info.lastInsertRowid);
        if (trans && trans.status === 'pending') {
            db.prepare("UPDATE transactions SET status = 'approved' WHERE id = ?").run(info.lastInsertRowid);
            db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, req.session.userId);
            payCommissions(req.session.userId, amount);
        }
    }, delay);
    res.json({ success: true });
});

app.post('/api/user/withdraw', (req, res) => {
    const { amount, pin, method } = req.body;
    const user = db.prepare("SELECT balance, pin FROM users WHERE id = ?").get(req.session.userId);
    if (amount < 130) return res.status(400).json({ error: 'Mínimo 130 MZN' });
    if (user.pin !== pin) return res.status(400).json({ error: 'PIN incorreto' });
    if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });

    db.prepare("INSERT INTO transactions (user_id, type, amount, method, status) VALUES (?, 'withdraw', ?, ?, 'pending')").run(req.session.userId, amount, method);
    db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(amount, req.session.userId);
    res.json({ success: true });
});

// --- NOVO ANALYTICS COMPLETO PARA O ADMIN ---
app.get('/api/admin/full-stats', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send();
    
    const getStats = (type, status) => {
        return db.prepare(`SELECT count(*) as c, sum(amount) as s FROM transactions WHERE type = ? AND status = ?`).get(type, status);
    };

    const stats = {
        totalUsers: db.prepare("SELECT count(*) as c FROM users").get().c,
        totalBalance: db.prepare("SELECT sum(balance) as s FROM users").get().s || 0,
        depPending: getStats('deposit', 'pending'),
        depApproved: getStats('deposit', 'approved'),
        depRejected: getStats('deposit', 'rejected'),
        withPending: getStats('withdraw', 'pending'),
        withApproved: getStats('withdraw', 'approved'),
        withRejected: getStats('withdraw', 'rejected'),
        totalPlansActive: db.prepare("SELECT count(*) as c FROM user_plans WHERE status = 'active'").get().c
    };
    res.json(stats);
});

// Banir/Desbanir
app.post('/api/admin/user/status', (req, res) => {
    const { userId, status } = req.body; // status: 'active' ou 'banned'
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
    res.json({ success: true });
});

// Detalhes extras dos usuários (Substitua a rota /api/admin/user-details)
app.get('/api/admin/user-details', (req, res) => {
    const users = db.prepare(`
        SELECT u.id, u.name, u.phone, u.balance, u.ref_code, u.status, u.password as pass_hash,
        (SELECT count(*) FROM users WHERE invited_by = u.ref_code) as total_invites,
        (SELECT count(DISTINCT user_id) FROM transactions WHERE type='deposit' AND status='approved' AND user_id IN (SELECT id FROM users WHERE invited_by = u.ref_code)) as total_depositors,
        (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type='profit') as total_earned
        FROM users u ORDER BY u.id DESC
    `).all();

    users.forEach(user => {
        user.active_plans = db.prepare(`SELECT up.id, p.name, up.expires_at FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.user_id = ? AND up.status = 'active'`).all(user.id);
    });
    res.json(users);
});

// Adicionar Plano Manualmente a um Usuário
app.post('/api/admin/user/add-plan', (req, res) => {
    const { userId, planId } = req.body;
    const plan = db.prepare("SELECT duration FROM plans WHERE id = ?").get(planId);
    if (!plan) return res.status(404).send();

    const expires = new Date();
    expires.setDate(expires.getDate() + plan.duration);
    
    db.prepare("INSERT INTO user_plans (user_id, plan_id, buy_date, expires_at, status) VALUES (?, ?, date('now'), ?, 'active')")
      .run(userId, planId, expires.toISOString().split('T')[0]);
    res.json({ success: true });
});

// Remover Plano Ativo de um Usuário
app.post('/api/admin/user/remove-plan', (req, res) => {
    const { userPlanId } = req.body;
    db.prepare("UPDATE user_plans SET status = 'removed' WHERE id = ?").run(userPlanId);
    res.json({ success: true });
});

// --- GESTÃO DE ANÚNCIOS ---
app.post('/api/admin/send-ad', (req, res) => {
    db.prepare("INSERT INTO ads (message) VALUES (?)").run(req.body.message);
    res.json({ success: true });
});

app.get('/api/admin/list-ads', (req, res) => res.json(db.prepare("SELECT * FROM ads ORDER BY id DESC").all()));

app.post('/api/admin/delete-ad', (req, res) => {
    db.prepare("DELETE FROM ads WHERE id = ?").run(req.body.id);
    res.json({ success: true });
});

// --- TRANSAÇÕES (APROVAR/REJEITAR) ---
app.post('/api/admin/transaction-action', (req, res) => {
    const { id, action } = req.body;
    const t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
    if (!t) return res.status(404).send();

    if (action === 'approve' && t.status === 'pending') {
        db.prepare("UPDATE transactions SET status = 'approved' WHERE id = ?").run(id);
        if (t.type === 'deposit') {
            db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(t.amount, t.user_id);
            payCommissions(t.user_id, t.amount);
        }
    } else if (action === 'reject') {
        if (t.status === 'approved' && t.type === 'deposit') {
            db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(t.amount, t.user_id);
        }
        db.prepare("UPDATE transactions SET status = 'rejected' WHERE id = ?").run(id);
    }
    res.json({ success: true });
});

// Listar transações gerais para o Admin
app.get('/api/admin/transactions', (req, res) => {
    const { type } = req.query;
    const list = db.prepare(`
        SELECT t.*, u.phone, u.name FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.type = ? ORDER BY t.id DESC
    `).all(type);
    res.json(list);
});

// Listar Planos, Criar, Deletar e Editar
app.get('/api/admin/list-plans', (req, res) => res.json(db.prepare("SELECT * FROM plans").all()));

app.post('/api/admin/create-plan', upload.single('image'), (req, res) => {
    const { name, price, daily, duration } = req.body;
    const imgUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const total = daily * duration;
    db.prepare("INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url) VALUES (?,?,?,?,?,?)")
      .run(name, price, daily, duration, total, imgUrl);
    res.json({ success: true });
});

app.post('/api/admin/delete-plan', (req, res) => {
    db.prepare("DELETE FROM plans WHERE id = ?").run(req.body.id);
    res.json({ success: true });
});

app.post('/api/admin/update-balance', (req, res) => {
    const { userId, newBalance } = req.body;
    db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, userId);
    res.json({ success: true });
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Wealth Pro ativa na porta ${PORT}`);
});

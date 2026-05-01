const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const db = new Database('wealth.db');

// Configuração de Pastas
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Banco de Dados
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    password TEXT,
    name TEXT,
    balance REAL DEFAULT 0,
    referral_code TEXT UNIQUE,
    invited_by TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount REAL,
    method TEXT,
    status TEXT DEFAULT 'pending',
    proof_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'wealth_2026_secure',
    resave: false,
    saveUninitialized: false
}));

// Middlewares
const auth = (req, res, next) => req.session.userId ? next() : res.status(401).send('Unauthorized');
const adminAuth = (req, res, next) => req.session.role === 'admin' ? next() : res.status(403).send('Forbidden');

// Rotas de Auth
app.post('/api/register', async (req, res) => {
    const { phone, password, name, invite_code } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const ref = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        db.prepare('INSERT INTO users (phone, password, name, referral_code, invited_by) VALUES (?,?,?,?,?)')
          .run(phone, hash, name, ref, invite_code || null);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Erro no registro' }); }
});

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
    } else { res.status(401).json({ error: 'Falha no login' }); }
});

// Rotas de Usuário
app.get('/api/user/data', auth, (req, res) => {
    const user = db.prepare('SELECT id, phone, name, balance, referral_code FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
});

app.post('/api/user/deposit', auth, upload.single('proof'), (req, res) => {
    const { amount, method } = req.body;
    db.prepare('INSERT INTO transactions (user_id, type, amount, method, proof_url) VALUES (?, "deposit", ?, ?, ?)')
      .run(req.session.userId, amount, method, req.file ? req.file.filename : null);
    res.json({ success: true });
});

// Rotas de Admin (CORRIGIDAS)
app.get('/api/admin/stats', adminAuth, (req, res) => {
    const uCount = db.prepare('SELECT count(*) as c FROM users').get();
    const bSum = db.prepare('SELECT sum(balance) as s FROM users').get();
    res.json({ totalUsers: uCount.c, totalBalance: bSum.s || 0 });
});

app.get('/api/admin/transactions', adminAuth, (req, res) => {
    const data = db.prepare('SELECT t.*, u.phone FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.id DESC').all();
    res.json(data);
});

app.post('/api/admin/action', adminAuth, (req, res) => {
    const { id, action } = req.body;
    const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (action === 'approve' && t.status === 'pending') {
        db.prepare('UPDATE transactions SET status = "approved" WHERE id = ?').run(id);
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(t.amount, t.user_id);
    } else {
        db.prepare('UPDATE transactions SET status = "rejected" WHERE id = ?').run(id);
    }
    res.json({ success: true });
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

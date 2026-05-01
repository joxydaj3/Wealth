const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');

const app = express();
const db = new Database('wealth.db');

// Configuração de Pastas
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'wealth_ultra_secret_2026',
    resave: false,
    saveUninitialized: false
}));

// BANCO DE DADOS
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE, name TEXT, password TEXT, balance REAL DEFAULT 0, ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000', role TEXT DEFAULT 'user'
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, daily REAL, duration INTEGER, total REAL, image_url TEXT, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, plan_id INTEGER, buy_date DATE, last_claim DATE, expires_at DATE
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount REAL, status TEXT DEFAULT 'pending', method TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- ROTAS AUTH ---
app.post('/api/register', async (req, res) => {
    const { phone, name, password, invite } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const ref = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        db.prepare('INSERT INTO users (phone, name, password, ref_code, invited_by) VALUES (?,?,?,?,?)').run(phone, name, hash, ref, invite);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Erro: Telefone já existe.' }); }
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
    } else res.status(401).json({ error: 'Falha no login' });
});

// --- ROTAS USUÁRIO ---
app.get('/api/user/data', (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const userPlans = db.prepare('SELECT count(*) as c FROM user_plans WHERE user_id = ?').get(req.session.userId);
    res.json({ ...user, plans_count: userPlans.c });
});

app.get('/api/plans', (req, res) => {
    const plans = db.prepare('SELECT * FROM plans WHERE active = 1').all();
    res.json(plans);
});

// --- ROTAS ADMIN ---
app.post('/api/admin/create-plan', upload.single('image'), (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send();
    const { name, price, daily, duration } = req.body;
    const imgUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const total = daily * duration;
    db.prepare('INSERT INTO plans (name, price, daily, duration, total, image_url) VALUES (?,?,?,?,?,?)')
      .run(name, price, daily, duration, total, imgUrl);
    res.json({ success: true });
});

app.get('/api/admin/stats', (req, res) => {
    const u = db.prepare('SELECT count(*) as c FROM users').get().c;
    const b = db.prepare('SELECT sum(balance) as s FROM users').get().s || 0;
    res.json({ totalUsers: u, totalBalance: b });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wealth Pro rodando na porta ${PORT}`));

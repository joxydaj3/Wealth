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
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- INICIALIZAÇÃO DO BANCO DE DADOS (Exatamente como nas imagens) ---
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
    price REAL,
    daily_profit REAL,
    duration_days INTEGER,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, 
    amount REAL,
    net_amount REAL,
    method TEXT,
    status TEXT DEFAULT 'pending', 
    proof_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'wealth-railway-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Middleware de Proteção Admin
const isAdmin = (req, res, next) => {
    if (req.session.role === 'admin') next();
    else res.status(403).send('Acesso Negado');
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
        res.status(400).json({ error: 'Erro ao registrar. Telefone pode já existir.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    // Login Admin solicitado
    if (phone === '862217807' && password === 'Joaquim10') {
        req.session.userId = 9999;
        req.session.role = 'admin';
        return res.json({ success: true, role: 'admin' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id;
        req.session.role = 'user';
        res.json({ success: true, role: 'user' });
    } else {
        res.status(401).json({ error: 'Dados inválidos' });
    }
});

// --- ROTAS DE USUÁRIO ---

app.get('/api/user/data', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Sessão expirada' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
});

app.post('/api/user/deposit', upload.single('proof'), (req, res) => {
    const { amount, method } = req.body;
    const info = db.prepare('INSERT INTO transactions (user_id, type, amount, method, proof_url, status) VALUES (?, "deposit", ?, ?, ?, "pending")')
                  .run(req.session.userId, amount, method, req.file ? req.file.filename : null);
    
    // Regra: Aprovação automática simulada em 5-20 min
    const delay = (Math.floor(Math.random() * 15) + 5) * 60 * 1000;
    setTimeout(() => {
        const t = db.prepare('SELECT status FROM transactions WHERE id = ?').get(info.lastInsertRowid);
        if(t && t.status === 'pending') {
            db.prepare('UPDATE transactions SET status = "approved" WHERE id = ?').run(info.lastInsertRowid);
            db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.session.userId);
            // Inicia pagamento de comissões (Níveis: 6%, 3%, 1%)
            payCommissions(req.session.userId, amount);
        }
    }, delay);
    res.json({ success: true });
});

// --- LÓGICA DE COMISSÃO 3 NÍVEIS ---
function payCommissions(userId, amount) {
    const user = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(userId);
    if (!user || !user.invited_by) return;

    const rates = [0.06, 0.03, 0.01];
    let currentRef = user.invited_by;

    for (let i = 0; i < rates.length; i++) {
        const upline = db.prepare('SELECT id, invited_by FROM users WHERE referral_code = ?').get(currentRef);
        if (upline) {
            const bonus = amount * rates[i];
            db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bonus, upline.id);
            db.prepare('INSERT INTO transactions (user_id, type, amount, status) VALUES (?, "referral", ?, "approved")').run(upline.id, bonus);
            if (!upline.invited_by) break;
            currentRef = upline.invited_by;
        } else break;
    }
}

// --- PAINEL ADMIN (Correção do Erro de Input) ---

app.get('/api/admin/dashboard', isAdmin, (req, res) => {
    const stats = {
        totalUsers: db.prepare('SELECT count(*) as c FROM users').get().c,
        totalBalance: db.prepare('SELECT sum(balance) as s FROM users').get().s || 0,
        deposits: db.prepare('SELECT count(*) as c FROM transactions WHERE type="deposit"').get().c,
        withdraws: db.prepare('SELECT count(*) as c FROM transactions WHERE type="withdraw"').get().c
    };
    res.json(stats);
});

app.get('/api/admin/transactions', isAdmin, (req, res) => {
    const list = db.prepare('SELECT t.*, u.phone, u.name FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC').all();
    res.json(list);
});

app.post('/api/admin/action', isAdmin, (req, res) => {
    const { id, action } = req.body; // action: 'approve' ou 'reject'
    const trans = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!trans) return res.status(404).json({ error: 'Não encontrado' });

    if (action === 'reject') {
        // Se já foi aprovado automático e o admin rejeitar, remove o saldo do usuário
        if (trans.status === 'approved' && trans.type === 'deposit') {
            db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(trans.amount, trans.user_id);
        }
        db.prepare('UPDATE transactions SET status = "rejected" WHERE id = ?').run(id);
    } else if (action === 'approve' && trans.status === 'pending') {
        db.prepare('UPDATE transactions SET status = "approved" WHERE id = ?').run(id);
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(trans.amount, trans.user_id);
    }
    res.json({ success: true });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Wealth Online na porta ${PORT}`);
});

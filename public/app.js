let currentCaptcha = "";

// Gerador de Captcha Dinâmico (Letras + Números)
window.generateCaptcha = function() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = code;
    if(document.getElementById('l_cap_val')) document.getElementById('l_cap_val').innerText = code;
    if(document.getElementById('r_cap_val')) document.getElementById('r_cap_val').innerText = code;
}

window.loadHome = async function() {
    const res = await fetch('/api/plans');
    const plans = await res.json();
    const container = document.getElementById('plans_container');
    
    // Div de abas para o usuário escolher
    let html = `
        <div class="btn-group" style="margin-bottom:20px">
            <button class="btn-sm active" id="btn-normal" onclick="renderPlans('Normal')">Planos Normais</button>
            <button class="btn-sm" id="btn-vip" onclick="renderPlans('VIP')">👑 Planos VIP</button>
        </div>
        <div id="plan-list-render"></div>
    `;
    container.innerHTML = html;
    window.allPlans = plans; // Guarda na memória
    renderPlans('Normal');
    // Adicionar ao final da função loadHome:
const adsRes = await fetch('/api/admin/list-ads');
const ads = await adsRes.json();
if(ads.length > 0) {
    const adBox = document.createElement('div');
    adBox.className = "wealth-card";
    adBox.style.background = "rgba(0,123,255,0.1)";
    adBox.innerHTML = `📢 <b>AVISO:</b> ${ads[0].message}`;
    document.getElementById('plans_container').prepend(adBox); // Coloca o aviso no topo
        }
}

window.renderPlans = function(category) {
    const list = document.getElementById('plan-list-render');
    const filtered = window.allPlans.filter(p => p.category === category);
    
    // Atualiza botões
    document.getElementById('btn-normal').classList.toggle('active', category === 'Normal');
    document.getElementById('btn-vip').classList.toggle('active', category === 'VIP');

    let html = "";
    filtered.forEach(p => {
        html += `
        <div class="wealth-card">
            <img src="${p.image_url}" class="plan-img">
            <div class="plan-header">
                <strong>${p.name}</strong>
                <span class="badge-mzn">${category}</span>
            </div>
            <p>💰 Valor: <b>MT ${p.price}</b></p>
            <p>📈 Lucro Diário: <b>MT ${p.daily_profit}</b></p>
            <p>⏳ Duração: <b>${p.duration} Dias</b></p>
            <button class="btn btn-blue" style="margin-top:10px" onclick="buyPlan(${p.id})">Investir Agora</button>
        </div>`;
    });
    list.innerHTML = html;
}

// Troca de Páginas
window.goTo = function(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    const nav = document.getElementById('main-nav');
    nav.style.display = (pageId === 'page-login' || pageId === 'page-register') ? 'none' : 'flex';

    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if(pageId === 'page-home') loadUserData();
    if(pageId === 'page-login' || pageId === 'page-register') window.generateCaptcha();
}

// Lógica de Login
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const captchaInput = document.getElementById('l_cap_in').value.toUpperCase();

    if(!phone || !pass) return alert("Por favor, preencha todos os campos.");
    if(captchaInput !== currentCaptcha) {
        alert("Captcha incorreto!");
        return window.generateCaptcha();
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone, password: pass })
        });
        const data = await res.json();
        if(data.success) {
            if(data.role === 'admin') window.location.href = '/admin.html';
            else window.goTo('page-home');
        } else {
            alert("Credenciais inválidas!");
            window.generateCaptcha();
        }
    } catch(e) { alert("Erro de conexão com o servidor."); }
}

// Lógica de Registro
window.handleRegister = async function() {
    const phone = document.getElementById('r_phone').value;
    const name = document.getElementById('r_name').value;
    const pass = document.getElementById('r_pass').value;
    const conf = document.getElementById('r_conf').value;
    const capIn = document.getElementById('r_cap_in').value.toUpperCase();

    if(!phone || !name || !pass) return alert("Preencha todos os campos obrigatórios.");
    if(pass !== conf) return alert("As senhas não coincidem!");
    if(capIn !== currentCaptcha) {
        alert("Captcha incorreto!");
        return window.generateCaptcha();
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                phone, name, password: pass, 
                invite: document.getElementById('r_invite').value 
            })
        });
        if(res.ok) {
            alert("Conta criada com sucesso! Faça login.");
            window.goTo('page-login');
        } else {
            alert("Erro ao registrar. O telefone já pode estar em uso.");
        }
    } catch(e) { alert("Erro ao processar registro."); }
}

// Carregar Dados Reais do Banco
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return window.goTo('page-login');
        const user = await res.json();
        document.getElementById('user_display_name').innerText = user.name;
        document.getElementById('user_balance').innerText = user.balance.toFixed(2);
    } catch(e) { console.log("Sessão expirada."); }
}

// Ao carregar a página
window.onload = () => {
    window.generateCaptcha();
    const date = new Date();
    document.getElementById('display_date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

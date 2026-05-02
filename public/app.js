let currentCaptcha = "";
window.allPlans = [];

// 1. Gerador de Captcha
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

// 2. Troca de Páginas (SPA)
window.goTo = function(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if(target) target.classList.add('active');

    const nav = document.getElementById('main-nav');
    nav.style.display = (pageId === 'page-login' || pageId === 'page-register') ? 'none' : 'flex';

    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if(pageId === 'page-home') {
        loadUserData();
        loadHome();
    }
    if(pageId === 'page-login' || pageId === 'page-register') window.generateCaptcha();
}

// 3. Carregar Dados do Usuário (NOME E SALDO)
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return;
        const user = await res.json();
        
        // Atualiza Nome e Saldo na Home
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;
        if(document.getElementById('u-balance')) document.getElementById('u-balance').innerText = user.balance.toFixed(2);
        
        // Atualiza Estatísticas do Bloco
        if(document.getElementById('stat-with')) document.getElementById('stat-with').innerText = (user.total_with || "0.00");
        if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = (user.total_earned || "0.00");
        if(document.getElementById('stat-ref')) document.getElementById('stat-ref').innerText = (user.total_earned_referral || "0.00");
        
        // Atualiza Página de Conta
        if(document.getElementById('acc-name')) document.getElementById('acc-name').innerText = user.name;
        if(document.getElementById('acc-phone')) document.getElementById('acc-phone').innerText = user.phone;
        if(document.getElementById('ref-link')) document.getElementById('ref-link').value = window.location.origin + "/?ref=" + user.ref_code;

    } catch(e) { console.error("Erro ao carregar dados:", e); }
}

// 4. Carregar Planos e Anúncios na Home
window.loadHome = async function() {
    const res = await fetch('/api/plans');
    const plans = await res.json();
    window.allPlans = plans;
    
    const container = document.getElementById('beginner-plans'); // Container de planos iniciantes
    renderPlans('Normal'); // Começa mostrando os Normais
    
    // Carregar Anúncio
    const adsRes = await fetch('/api/admin/list-ads');
    const ads = await adsRes.json();
    const plansContainer = document.getElementById('plans_container');
    if(ads.length > 0 && plansContainer) {
        const adBox = document.createElement('div');
        adBox.className = "wealth-card";
        adBox.style.background = "rgba(0,123,255,0.1)";
        adBox.innerHTML = `📢 <b>AVISO:</b> ${ads[0].message}`;
        plansContainer.prepend(adBox);
    }
}

// 5. Renderizar Planos (Abas Normal / VIP)
window.renderPlans = function(category) {
    const list = document.getElementById('beginner-plans');
    if(!list) return;
    const filtered = window.allPlans.filter(p => p.category === category).slice(0, 2); // Pega apenas 2 como pediu
    
    let html = "";
    filtered.forEach(p => {
        html += `
        <div class="wealth-card" style="margin-bottom:10px; border-left: 4px solid ${category === 'VIP' ? 'gold' : 'var(--blue)'}">
            <div style="display:flex; justify-content:space-between">
                <strong>${p.name}</strong>
                <span class="badge-mzn">${category}</span>
            </div>
            <p style="font-size:12px; color:#8899ac">Lucro: MT ${p.daily_profit} / dia</p>
            <button class="btn btn-blue" style="height:35px; font-size:12px; margin-top:5px" onclick="alert('Funcionalidade de compra em breve')">Investir MT ${p.price}</button>
        </div>`;
    });
    list.innerHTML = html;
}

// 6. Lógica de Login
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capIn = document.getElementById('l_cap_in').value.toUpperCase();

    if(!phone || !pass) return alert("Preencha os campos!");
    if(capIn !== currentCaptcha) {
        alert("Captcha incorreto!");
        return window.generateCaptcha();
    }

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, password: pass })
    });

    const data = await res.json();
    if(data.success) {
        if(data.role === 'admin') window.location.href = '/admin.html';
        else {
            await loadUserData();
            goTo('page-home');
        }
    } else {
        alert("Dados incorretos!");
        window.generateCaptcha();
    }
}

// 7. Lógica de Registro
window.handleRegister = async function() {
    const phone = document.getElementById('r_phone').value;
    const name = document.getElementById('r_name').value;
    const pass = document.getElementById('r_pass').value;
    const conf = document.getElementById('r_conf').value;
    const capIn = document.getElementById('r_cap_in').value.toUpperCase();

    if(pass !== conf) return alert("As senhas não coincidem!");
    if(capIn !== currentCaptcha) return alert("Captcha incorreto!");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, name, password: pass, invite: document.getElementById('r_invite').value })
    });

    if(res.ok) {
        alert("Conta criada!");
        goTo('page-login');
    } else {
        alert("Erro ao registrar.");
    }
}

// 8. Check-in Diário
window.doCheckin = async function() {
    try {
        const res = await fetch('/api/user/checkin', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(`🎉 Ganhou MT ${data.amount} no check-in!`);
            loadUserData();
        } else {
            alert(data.error);
        }
    } catch (e) { alert("Erro no check-in."); }
}

// 9. Suporte
window.toggleSupport = function() {
    const modal = document.getElementById('support-modal');
    if(modal) modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// Inicialização
window.onload = () => {
    window.generateCaptcha();
    const date = new Date();
    if(document.getElementById('display_date')) {
        document.getElementById('display_date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }
};

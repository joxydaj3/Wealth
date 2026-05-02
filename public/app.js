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
// Chame esta função dentro do loadUserData ou no goTo('page-projects')
window.loadAllPlans = async function() {
    const res = await fetch('/api/plans');
    const plans = await res.json();
    
    const normalContainer = document.getElementById('plans_normal_list');
    const vipContainer = document.getElementById('plans_vip_list');
    
    if(!normalContainer || !vipContainer) return;

    let normalHtml = "";
    let vipHtml = "";

    plans.forEach(p => {
        const totalProfit = (p.daily_profit * p.duration).toFixed(2);
        const totalGain = (parseFloat(p.price) + parseFloat(totalProfit)).toFixed(2);

        const cardHtml = `
        <div class="plan-mini-card ${p.category === 'VIP' ? 'vip-card' : ''}">
            <div class="plan-info-left">
                <h5>${p.name}</h5>
                <p>Compra: <b>MT ${p.price}</b> | Dias: <b>${p.duration}</b></p>
                <p>Diário: <b>MT ${p.daily_profit}</b> | Lucro: <b>MT ${totalProfit}</b></p>
                <p>Ganho Total: <b>MT ${totalGain}</b></p>
                <button class="btn-buy-mini" onclick="handleBuyPlan(${p.id}, '${p.category}')">INVESTIR AGORA</button>
            </div>
            <img src="${p.image_url || 'https://via.placeholder.com/80'}" class="plan-img-right">
        </div>`;

        if(p.category === 'VIP') {
            vipHtml += cardHtml;
        } else {
            normalHtml += cardHtml;
        }
    });

    normalContainer.innerHTML = normalHtml;
    vipContainer.innerHTML = vipHtml;
}

// Lógica de Compra com Trava
window.handleBuyPlan = async function(planId, category) {
    if(category === 'VIP') {
        const res = await fetch('/api/user/data');
        const user = await res.json();
        // Se o usuário não tiver planos ativos, bloqueia
        if(!user.plans_count || user.plans_count === 0) {
            return alert("🚫 Bloqueado! Você precisa ter pelo menos um Plano Normal ativo para investir em planos VIP.");
        }
    }
    
    if(confirm("Deseja confirmar este investimento?")) {
        // Enviar para a API de compra que você tem no server.js
        const res = await fetch('/api/user/buy-plan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ planId })
        });
        if(res.ok) {
            alert("✅ Sucesso! Plano ativado.");
            goTo('page-home');
        } else {
            alert("Erro: Verifique seu saldo.");
        }
    }
}

// Atualize a função goTo para carregar os planos sempre que entrar em projetos
const originalGoTo = window.goTo;
window.goTo = function(pageId, btn) {
    if(pageId === 'page-projects' || pageId === 'page-vip-list') {
        loadAllPlans();
    }
    originalGoTo(pageId, btn);
}

// 5. Renderizar Planos (Abas Normal / VIP)
window.renderPlans = function(category) {
    const list = document.getElementById('plans_container_all');
    if(!list) return;

    // Alternar descrições e botões
    document.getElementById('desc-normal').style.display = (category === 'Normal') ? 'block' : 'none';
    document.getElementById('desc-vip').style.display = (category === 'VIP') ? 'block' : 'none';
    document.getElementById('btn-cat-normal').classList.toggle('active', category === 'Normal');
    document.getElementById('btn-cat-vip').classList.toggle('active', category === 'VIP');

    // Filtrar planos da memória (carregada no loadHome)
    const filtered = window.allPlans.filter(p => p.category === category);
    
    let html = "";
    filtered.forEach(p => {
        const totalProfit = (p.daily_profit * p.duration).toFixed(2);
        const totalGain = (p.price + parseFloat(totalProfit)).toFixed(2);

        html += `
        <div class="plan-mini-card ${category === 'VIP' ? 'vip-border' : ''}">
            <div class="plan-details-left">
                <h5>${p.name}</h5>
                <p>Compra: <b>MT ${p.price}</b> | Dias: <b>${p.duration}</b></p>
                <p>Diário: <b>MT ${p.daily_profit}</b> | Ganho: <b>MT ${totalProfit}</b></p>
                <p>Total + Capital: <b>MT ${totalGain}</b></p>
                <button class="btn-invest-mini" onclick="buyPlan(${p.id}, '${category}')">INVESTIR AGORA</button>
            </div>
            <img src="${p.image_url}" class="plan-img-right">
        </div>`;
    });
    list.innerHTML = html;
}

window.buyPlan = async function(planId, category) {
    // 1. Verificar se é VIP e se o usuário tem plano normal
    if (category === 'VIP') {
        const res = await fetch('/api/user/data');
        const user = await res.json();
        
        // No server.js garantimos que 'plans_count' seja enviado
        if (!user.plans_count || user.plans_count === 0) {
            alert("🚫 Acesso Negado! Você precisa ter pelo menos 1 Plano Normal ativo para comprar planos VIP.");
            return;
        }
    }

    // 2. Lógica de Compra (Chamar API)
    if(confirm("Deseja confirmar o investimento neste plano?")) {
        const buyRes = await fetch('/api/user/buy-plan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ planId })
        });
        const data = await buyRes.json();
        if(data.success) {
            alert("✅ Investimento realizado com sucesso!");
            loadUserData();
            goTo('page-home');
        } else {
            alert(data.error || "Erro ao processar compra.");
        }
    }
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

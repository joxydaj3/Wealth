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

    // Carregamento automático ao entrar nas telas
    if(pageId === 'page-home') {
        loadUserData();
        loadHomeData(); 
    }
    if(pageId === 'page-projects' || pageId === 'page-vip-list') {
        loadAllPlans();
    }
    if(pageId === 'page-login' || pageId === 'page-register') window.generateCaptcha();
}

// 3. Carregar Dados do Usuário (NOME, SALDO E ESTATÍSTICAS)
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return;
        const user = await res.json();
        window.currentUser = user; // Guarda para verificações (como a trava VIP)
        
        // Nome e Saldo
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;
        if(document.getElementById('u-balance')) document.getElementById('u-balance').innerText = user.balance.toFixed(2);
        
        // Estatísticas do Card Principal
        if(document.getElementById('stat-with')) document.getElementById('stat-with').innerText = (user.total_with || "0.00");
        if(document.getElementById('stat-week')) document.getElementById('stat-week').innerText = (user.week_earned || "0.00");
        if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = (user.total_earned || "0.00");
        if(document.getElementById('stat-ref')) document.getElementById('stat-ref').innerText = (user.total_earned_referral || "0.00");
        
        // Página de Conta
        if(document.getElementById('acc-name')) document.getElementById('acc-name').innerText = user.name;
        if(document.getElementById('acc-phone')) document.getElementById('acc-phone').innerText = user.phone;
        if(document.getElementById('ref-link')) document.getElementById('ref-link').value = window.location.origin + "/?ref=" + user.ref_code;

    } catch(e) { console.error("Erro ao carregar dados:", e); }
}

// 4. Carregar Dados da Home (Planos Iniciais e Anúncios)
window.loadHomeData = async function() {
    try {
        const res = await fetch('/api/plans');
        window.allPlans = await res.json();
        
        // Renderiza apenas 2 Normal e 2 VIP para a seção "Plano Iniciante" da Home
        const container = document.getElementById('beginner-plans');
        if(container) {
            let html = "";
            const homePlans = [
                ...window.allPlans.filter(p => p.category === 'Normal').slice(0, 2),
                ...window.allPlans.filter(p => p.category === 'VIP').slice(0, 2)
            ];
            homePlans.forEach(p => html += createPlanCard(p));
            container.innerHTML = html;
        }

        // Carregar Anúncio no topo se houver
        const adsRes = await fetch('/api/admin/list-ads');
        const ads = await adsRes.json();
        const adsContainer = document.getElementById('mini-history'); // Pode por aqui ou criar um id p/ anuncios
        if(ads.length > 0 && adsContainer) {
            const adHtml = `<div class="wealth-card" style="background:rgba(0,123,255,0.1); font-size:12px; border-left:4px solid var(--blue)">📢 <b>AVISO:</b> ${ads[0].message}</div>`;
            adsContainer.innerHTML = adHtml + adsContainer.innerHTML;
        }
    } catch(e) { console.error("Erro na Home:", e); }
}

// 5. Carregar TODOS os Planos (Página de Projetos)
window.loadAllPlans = async function() {
    try {
        if(window.allPlans.length === 0) {
            const res = await fetch('/api/plans');
            window.allPlans = await res.json();
        }

        const normalList = document.getElementById('plans_normal_list');
        const vipList = document.getElementById('plans_vip_list');

        if(normalList) {
            let html = "";
            window.allPlans.filter(p => p.category === 'Normal').forEach(p => html += createPlanCard(p));
            normalList.innerHTML = html || "<p style='text-align:center; color:grey'>Nenhum plano disponível.</p>";
        }

        if(vipList) {
            let html = "";
            window.allPlans.filter(p => p.category === 'VIP').forEach(p => html += createPlanCard(p));
            vipList.innerHTML = html || "<p style='text-align:center; color:grey'>Nenhum plano VIP disponível.</p>";
        }
    } catch(e) { console.error("Erro nos Projetos:", e); }
}

// Função Auxiliar para Criar o HTML do Card (Imagem na Direita, Texto na Esquerda)
function createPlanCard(p) {
    const totalProfit = (parseFloat(p.daily_profit) * parseInt(p.duration)).toFixed(2);
    const totalGain = (parseFloat(p.price) + parseFloat(totalProfit)).toFixed(2);
    const isVip = p.category === 'VIP';

    return `
    <div class="plan-mini-card ${isVip ? 'vip-card' : ''}">
        <div class="plan-info-left">
            <h5>${p.name}</h5>
            <p>Compra: <b>MT ${p.price}</b> | Dias: <b>${p.duration}</b></p>
            <p>Diário: <b>MT ${p.daily_profit}</b> | Lucro: <b>MT ${totalProfit}</b></p>
            <p>Total + Capital: <b>MT ${totalGain}</b></p>
            <button class="btn-buy-mini" onclick="handleBuyPlan(${p.id}, '${p.category}')">INVESTIR AGORA</button>
        </div>
        <img src="${p.image_url || 'https://via.placeholder.com/80'}" class="plan-img-right">
    </div>`;
}

// 6. Lógica de Compra com Trava VIP
window.handleBuyPlan = async function(planId, category) {
    if(category === 'VIP') {
        if(!window.currentUser || !window.currentUser.plans_count || window.currentUser.plans_count === 0) {
            return alert("🚫 Acesso Negado! Você precisa ter pelo menos um Plano Normal ativo para comprar planos VIP.");
        }
    }
    
    if(confirm("Confirmar investimento?")) {
        const res = await fetch('/api/user/buy-plan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ planId })
        });
        const data = await res.json();
        if(data.success) {
            alert("✅ Sucesso! Plano ativado.");
            window.loadUserData();
            window.goTo('page-home');
        } else {
            alert(data.error || "Erro: Saldo insuficiente.");
        }
    }
}

// 7. Lógica de Login
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
            await window.loadUserData();
            window.goTo('page-home');
        }
    } else {
        alert("Dados incorretos!");
        window.generateCaptcha();
    }
}

// 8. Lógica de Registro
window.handleRegister = async function() {
    const phone = document.getElementById('r_phone').value;
    const name = document.getElementById('r_name').value;
    const pass = document.getElementById('r_pass').value;
    const conf = document.getElementById('r_conf').value;
    const capIn = document.getElementById('r_cap_in').value.toUpperCase();

    if(!phone || !name || !pass) return alert("Preencha tudo!");
    if(pass !== conf) return alert("As senhas não coincidem!");
    if(capIn !== currentCaptcha) return alert("Captcha incorreto!");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            phone, name, password: pass, 
            invite: document.getElementById('r_invite').value 
        })
    });

    if(res.ok) {
        alert("Conta criada! Faça login.");
        window.goTo('page-login');
    } else {
        alert("Erro ao registrar. Verifique os dados.");
    }
}

// 9. Check-in Diário
window.doCheckin = async function() {
    try {
        const res = await fetch('/api/user/checkin', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(`🎉 Ganhou MT ${data.amount} no check-in!`);
            window.loadUserData();
        } else {
            alert(data.error);
        }
    } catch (e) { alert("Erro no check-in."); }
}

// 10. Suporte
window.toggleSupport = function() {
    const modal = document.getElementById('support-modal');
    if(modal) modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// Inicialização
window.onload = () => {
    window.generateCaptcha();
    const date = new Date();
    if(document.getElementById('cur-date')) {
        document.getElementById('cur-date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }
};

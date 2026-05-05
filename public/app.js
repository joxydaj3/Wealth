let currentCaptcha = "";
window.allPlans = [];
window.currentUser = null;

// 1. Gerador de Captcha Dinâmico
window.generateCaptcha = function() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = code;
    const lVal = document.getElementById('l_cap_val');
    const rVal = document.getElementById('r_cap_val');
    if(lVal) lVal.innerText = code;
    if(rVal) rVal.innerText = code;
}

// 2. Navegação entre Páginas (SPA)
window.goTo = function(pageId, btn) {
    // Esconde todas as telas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Mostra a tela selecionada
    const target = document.getElementById(pageId);
    if(target) target.classList.add('active');

    // Gerencia o Menu Inferior
    const nav = document.getElementById('main-nav');
    const isAuthPage = (pageId === 'page-login' || pageId === 'page-register');
    if(nav) nav.style.display = isAuthPage ? 'none' : 'flex';

    // Estilo do botão ativo no menu
    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Carregamento automático de dados dependendo da aba
    if(pageId === 'page-home') {
        loadUserData();
        loadHomeData(); 
    }
    if(pageId === 'page-projects' || pageId === 'page-vip-list') {
        loadAllPlans();
    }
    if(pageId === 'page-profits') {
        loadProfitClaims();
    }
    if(isAuthPage) window.generateCaptcha();
}

// 3. Carregar Dados do Usuário (SOMA TOTAL, SEMANA E MÊS)
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return;
        const user = await res.json();
        window.currentUser = user; 
        
        const update = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.innerText = parseFloat(val || 0).toFixed(2);
        };

        // Atualiza Home e Bloco de Saldo
        update('u-balance', user.balance);
        update('stat-with', user.total_with);
        update('stat-week', user.week_earned);
        update('stat-month', user.month_earned);
        update('stat-total', user.total_earned);
        update('stat-ref', user.total_ref);

        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;

        // Atualiza Página de Conta
        if(document.getElementById('acc-name')) document.getElementById('acc-name').innerText = user.name;
        if(document.getElementById('acc-phone')) document.getElementById('acc-phone').innerText = user.phone;

        // Atualiza Página de Equipe
        if(document.getElementById('display-ref-id')) document.getElementById('display-ref-id').innerText = user.ref_code;
        if(document.getElementById('ref-link-input')) {
            document.getElementById('ref-link-input').value = window.location.origin + "/?ref=" + user.ref_code;
        }
        update('team-total-earned', user.total_ref);

    } catch(e) { console.error("Erro ao carregar dados:", e); }
}

// 4. Carregar Planos e Anúncios na Home
window.loadHomeData = async function() {
    try {
        const res = await fetch('/api/plans');
        window.allPlans = await res.json();
        
        const container = document.getElementById('beginner-plans');
        if(container) {
            let html = "";
            const homePlans = [
                ...window.allPlans.filter(p => p.category === 'Normal').slice(0, 1),
                ...window.allPlans.filter(p => p.category === 'VIP').slice(0, 1)
            ];
            homePlans.forEach(p => html += createPlanCard(p));
            container.innerHTML = html;
        }

        const adsRes = await fetch('/api/admin/list-ads');
        const ads = await adsRes.json();
        const adsContainer = document.getElementById('mini-history'); 
        if(ads.length > 0 && adsContainer) {
            adsContainer.innerHTML = `<div class="wealth-card" style="background:rgba(0,123,255,0.1); font-size:12px; border-left:4px solid var(--blue); padding:10px">📢 <b>AVISO:</b> ${ads[0].message}</div>`;
        }
    } catch(e) { console.error(e); }
}

// 5. Carregar TODOS os Planos (Página de Projetos)
window.loadAllPlans = async function() {
    try {
        const res = await fetch('/api/plans');
        window.allPlans = await res.json();

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
    } catch(e) { console.error(e); }
}

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
            <button class="btn-buy-mini" onclick="handleBuyPlan(${p.id}, '${p.category}')">INVESTIR AGORA</button>
        </div>
        <img src="${p.image_url || 'https://via.placeholder.com/80'}" class="plan-img-right">
    </div>`;
}

// 6. Página de Lucros (Colheita Diária)
window.loadProfitClaims = async function() {
    try {
        const res = await fetch('/api/user/available-profits');
        const data = await res.json();
        const activeContainer = document.getElementById('active-plans-container');
        
        document.getElementById('total-invested').innerText = window.currentUser.total_invested || "0.00";
        document.getElementById('total-collected').innerText = window.currentUser.total_earned || "0.00";

        activeContainer.innerHTML = data.length === 0 ? "<p style='text-align:center; color:#8899ac; padding:20px;'>Nenhum lucro pendente hoje.</p>" : "";

        data.forEach(p => {
            const progress = (p.days_passed / p.duration) * 100;
            const btnHtml = p.claimed_today 
                ? `<button class="btn-claim" style="background:#2d3748; color:#718096; cursor:default;" disabled>✓ Recebido Hoje</button>`
                : `<button class="btn-claim" onclick="claimProfit(${p.id})">💸 Receber Lucro Hoje — MT ${p.daily_profit.toFixed(2)}</button>`;

            activeContainer.innerHTML += `
                <div class="profit-card-full">
                    <div class="profit-card-header"><strong>${p.name}</strong> <span class="status-badge">ATIVO</span></div>
                    <div class="progress-container">
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
                        <div class="progress-info"><span>${progress.toFixed(0)}%</span><span>${p.days_passed}/${p.duration} dias</span></div>
                    </div>
                    ${btnHtml}
                </div>`;
        });
    } catch (e) { console.error(e); }
}

async function claimProfit(id) {
    const res = await fetch('/api/user/claim-profit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userPlanId: id })
    });
    if(res.ok) {
        showAlert("Sucesso", "Lucro coletado!");
        loadProfitClaims();
        loadUserData();
    }
}

// 7. Equipe: Link e Compartilhamento
window.copyInvite = function() {
    const input = document.getElementById('ref-link-input');
    input.select();
    navigator.clipboard.writeText(input.value);
    showAlert("Sucesso", "Link copiado!");
}

window.shareSocial = function(platform) {
    const link = document.getElementById('ref-link-input').value;
    const msg = encodeURIComponent(`Ganhe dinheiro comigo na Wealth Pro! Link: ${link}`);
    let url = platform === 'wa' ? `https://wa.me/?text=${msg}` : `https://t.me/share/url?url=${link}&text=${msg}`;
    window.open(url, '_blank');
}

// 8. Modais e Auth
window.showAlert = function(title, text, confirmCallback = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    const modal = document.getElementById('wealth-modal');
    modal.style.display = 'flex';
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    if (confirmCallback) {
        cancelBtn.style.display = 'block';
        okBtn.onclick = () => { closeWealthModal(); confirmCallback(); };
    } else {
        cancelBtn.style.display = 'none';
        okBtn.onclick = closeWealthModal;
    }
}

window.closeWealthModal = () => document.getElementById('wealth-modal').style.display = 'none';

window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capIn = document.getElementById('l_cap_in').value.toUpperCase();

    if(capIn !== currentCaptcha) {
        showAlert("Segurança", "Captcha incorreto.");
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
        else { await loadUserData(); goTo('page-home'); }
    } else showAlert("Erro", "Dados inválidos.");
}

window.handleRegister = async function() {
    const phone = document.getElementById('r_phone').value;
    const name = document.getElementById('r_name').value;
    const pass = document.getElementById('r_pass').value;
    const capIn = document.getElementById('r_cap_in').value.toUpperCase();

    if(capIn !== currentCaptcha) return showAlert("Erro", "Captcha incorreto.");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, name, password: pass, invite: document.getElementById('r_invite').value })
    });
    if(res.ok) { showAlert("Sucesso", "Conta criada!"); goTo('page-login'); }
    else showAlert("Erro", "Telefone já existe.");
}

window.doCheckin = async function() {
    const res = await fetch('/api/user/checkin', { method: 'POST' });
    const data = await res.json();
    if (res.ok) { showAlert("Bónus", `Ganhou MT ${data.amount}!`); loadUserData(); }
    else showAlert("Check-in", data.error);
}

window.handleBuyPlan = async function(planId, category) {
    const plan = window.allPlans.find(p => p.id === planId);
    if(category === 'VIP' && (!window.currentUser.plans_count || window.currentUser.plans_count == 0)) {
        return showAlert("Acesso Negado", "Ative um plano Normal primeiro.");
    }
    showAlert("Investimento", `Pagar MT ${plan.price} pelo plano ${plan.name}?`, async () => {
        const res = await fetch('/api/user/buy-plan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({planId}) });
        if((await res.json()).success) { showAlert("Sucesso", "Ativado!"); loadUserData(); goTo('page-home'); }
        else showAlert("Saldo", "Saldo insuficiente.");
    });
}

// 1. Lógica do Slider Automático
let currentSlide = 0;
function startAccountSlider() {
    const wrapper = document.getElementById('account-slider-wrapper');
    if(!wrapper) return;
    
    setInterval(() => {
        currentSlide++;
        if(currentSlide > 3) currentSlide = 0; // Volta para o primeiro (4 slides)
        wrapper.style.transform = `translateX(-${currentSlide * 25}%)`;
    }, 4000); // 4 segundos por imagem
}

// 2. Atualizar Dados na Aba Conta (Adicionar dentro da sua função loadUserData)
// Procure a função loadUserData e adicione estas linhas no final:
window.loadUserData = async function() {
    // ... seu código fetch de dados ...
    
    // Injeta na página de CONTA
    const nameLabel = document.getElementById('acc-name-label');
    const phoneLabel = document.getElementById('acc-phone-label');
    const balanceLabel = document.getElementById('acc-balance-total');
    
    if(nameLabel) nameLabel.innerText = user.name;
    if(phoneLabel) phoneLabel.innerText = user.phone;
    if(balanceLabel) balanceLabel.innerText = parseFloat(user.balance).toFixed(2);
}

// 3. Inicializar Slider quando entrar na conta
const originalGoToAccount = window.goTo;
window.goTo = function(pageId, btn) {
    if(pageId === 'page-account') {
        setTimeout(startAccountSlider, 100);
    }
    originalGoToAccount(pageId, btn);
        }

window.toggleSupport = () => {
    const m = document.getElementById('support-modal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

window.onload = () => {
    window.generateCaptcha();
    const date = new Date();
    if(document.getElementById('cur-date')) {
        document.getElementById('cur-date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }
};

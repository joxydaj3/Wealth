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
    const lVal = document.getElementById('l_cap_val');
    const rVal = document.getElementById('r_cap_val');
    if(lVal) lVal.innerText = code;
    if(rVal) rVal.innerText = code;
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
        loadHomeData(); 
    }
    if(pageId === 'page-projects' || pageId === 'page-vip-list') {
        loadAllPlans();
    }
    if(pageId === 'page-login' || pageId === 'page-register') window.generateCaptcha();
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

        update('u-balance', user.balance);
        update('stat-with', user.total_with);
        update('stat-week', user.week_earned);
        update('stat-month', user.month_earned);
        update('stat-total', user.total_earned);
        update('stat-ref', user.total_ref);

        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;
        if(document.getElementById('acc-name')) document.getElementById('acc-name').innerText = user.name;
        if(document.getElementById('acc-phone')) document.getElementById('acc-phone').innerText = user.phone;
        if(document.getElementById('ref-link')) document.getElementById('ref-link').value = window.location.origin + "/?ref=" + user.ref_code;

    } catch(e) { console.error("Erro ao carregar dados:", e); }
}

// 4. Carregar Planos e Anúncios
window.loadHomeData = async function() {
    try {
        const res = await fetch('/api/plans');
        window.allPlans = await res.json();
        
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

        const adsRes = await fetch('/api/admin/list-ads');
        const ads = await adsRes.json();
        const adsContainer = document.getElementById('mini-history'); 
        if(ads.length > 0 && adsContainer) {
            adsContainer.innerHTML = `<div class="wealth-card" style="background:rgba(0,123,255,0.1); font-size:12px; border-left:4px solid var(--blue); padding:10px">📢 <b>AVISO:</b> ${ads[0].message}</div>`;
        }
    } catch(e) { console.error(e); }
}

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
            normalList.innerHTML = html;
        }
        if(vipList) {
            let html = "";
            window.allPlans.filter(p => p.category === 'VIP').forEach(p => html += createPlanCard(p));
            vipList.innerHTML = html;
        }
    } catch(e) { console.error(e); }
}

function createPlanCard(p) {
    const totalProfit = (parseFloat(p.daily_profit) * parseInt(p.duration)).toFixed(2);
    const totalGain = (parseFloat(p.price) + parseFloat(totalProfit)).toFixed(2);
    return `
    <div class="plan-mini-card ${p.category === 'VIP' ? 'vip-card' : ''}">
        <div class="plan-info-left">
            <h5>${p.name}</h5>
            <p>Compra: <b>MT ${p.price}</b> | Dias: <b>${p.duration}</b></p>
            <p>Diário: <b>MT ${p.daily_profit}</b> | Ganho: <b>MT ${totalProfit}</b></p>
            <button class="btn-buy-mini" onclick="handleBuyPlan(${p.id}, '${p.category}')">INVESTIR AGORA</button>
        </div>
        <img src="${p.image_url || 'https://via.placeholder.com/80'}" class="plan-img-right">
    </div>`;
}

window.loadProfitClaims = async function() {
    try {
        const res = await fetch('/api/user/available-profits');
        const data = await res.json();
        
        const activeContainer = document.getElementById('active-plans-container');
        const historyList = document.getElementById('profit-history-list');
        
        // Atualiza Resumo (Soma simples na interface)
        document.getElementById('total-invested').innerText = window.currentUser.total_invested || "0.00";
        document.getElementById('total-collected').innerText = window.currentUser.total_earned || "0.00";

        activeContainer.innerHTML = "";
        
        if (data.length === 0) {
            activeContainer.innerHTML = "<p style='text-align:center; color:#8899ac; padding:20px;'>Nenhum plano gerando lucros no momento.</p>";
        }

        data.forEach(p => {
            // Cálculo de porcentagem de dias passados
            const progress = (p.days_passed / p.duration) * 100;
            
            activeContainer.innerHTML += `
                <div class="profit-card-full">
                    <div class="profit-card-header">
                        <strong>${p.name}</strong>
                        <span class="status-badge">ATIVO</span>
                    </div>
                    
                    <div class="profit-card-grid">
                        <div class="grid-stat"><small>Investimento</small><span>MT ${p.price}</span></div>
                        <div class="grid-stat"><small>Dias Totais</small><span>${p.duration} dias</span></div>
                        <div class="grid-stat"><small>Ganho/Dia</small><span>MT ${p.daily_profit}</span></div>
                        <div class="grid-stat"><small>Acumulado</small><span>MT ${p.total_accumulated || 0}</span></div>
                    </div>

                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-info">
                            <span>${progress.toFixed(0)}%</span>
                            <span>${p.days_passed}/${p.duration} dias</span>
                        </div>
                    </div>

                    <button class="btn-claim" onclick="claimProfit(${p.id})">
                        💸 Receber — MT ${p.daily_profit}
                    </button>
                </div>
            `;
        });

        // Carregar Histórico Curto (Simulação)
        loadProfitHistory();

    } catch (e) { console.error(e); }
}

async function loadProfitHistory() {
    // Busca as últimas 10 transações do tipo 'profit'
    const res = await fetch('/api/user/transactions?type=profit&limit=10');
    const logs = await res.json();
    const list = document.getElementById('profit-history-list');
    
    list.innerHTML = logs.map(log => `
        <div class="history-item">
            <div class="history-icon green">✓</div>
            <div class="history-info">
                <strong>MT ${log.amount}</strong>
                <span>${new Date(log.created_at).toLocaleString()}</span>
            </div>
            <div class="history-status" style="color:var(--green)">Coletado</div>
        </div>
    `).join('');
}

// 5. Modais e Check-in
window.showAlert = function(title, text, confirmCallback = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    const modal = document.getElementById('wealth-modal');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    modal.style.display = 'flex';
    if (confirmCallback) {
        cancelBtn.style.display = 'block';
        okBtn.onclick = () => { closeWealthModal(); confirmCallback(); };
    } else {
        cancelBtn.style.display = 'none';
        okBtn.onclick = closeWealthModal;
    }
}

window.closeWealthModal = () => document.getElementById('wealth-modal').style.display = 'none';

window.doCheckin = async function() {
    try {
        const res = await fetch('/api/user/checkin', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showAlert("Bónus Diário", `🎉 Parabéns! Recebeu MT ${data.amount} no seu check-in de hoje.`);
            loadUserData();
        } else {
            showAlert("Check-in", data.error || "Tente novamente amanhã.");
        }
    } catch (e) { showAlert("Erro", "Erro ao processar."); }
}

// 6. Login e Registro
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capIn = document.getElementById('l_cap_in').value.toUpperCase();

    if(!phone || !pass) return showAlert("Atenção", "Preencha todos os campos.");
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
    } else {
        showAlert("Erro", "Telefone ou senha inválidos.");
        window.generateCaptcha();
    }
}

window.handleRegister = async function() {
    const phone = document.getElementById('r_phone').value;
    const name = document.getElementById('r_name').value;
    const pass = document.getElementById('r_pass').value;
    const conf = document.getElementById('r_conf').value;
    const capIn = document.getElementById('r_cap_in').value.toUpperCase();

    if(pass !== conf) return showAlert("Erro", "Senhas não coincidem.");
    if(capIn !== currentCaptcha) return showAlert("Erro", "Captcha incorreto.");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, name, password: pass, invite: document.getElementById('r_invite').value })
    });
    if(res.ok) {
        showAlert("Sucesso", "Conta criada! Já pode entrar.");
        goTo('page-login');
    } else { showAlert("Erro", "Telefone já registrado."); }
}

window.handleBuyPlan = async function(planId, category) {
    const plan = window.allPlans.find(p => p.id === planId);
    if(category === 'VIP') {
        if(!window.currentUser.plans_count || window.currentUser.plans_count == 0) {
            return showAlert("Acesso Negado", "Você precisa de um Plano Normal ativo para comprar VIP.");
        }
    }
    showAlert("Investimento", `Deseja pagar MT ${parseFloat(plan.price).toFixed(2)} para activar o plano "${plan.name}"?`, async () => {
        const res = await fetch('/api/user/buy-plan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({planId}) });
        const data = await res.json();
        if(data.success) { showAlert("Sucesso", "Plano activado!"); loadUserData(); goTo('page-home'); }
        else { showAlert("Saldo Insuficiente", data.error || "Falha na compra."); }
    });
}

window.toggleSupport = () => {
    const m = document.getElementById('support-modal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

// 1. Função para Copiar Link
window.copyInvite = function() {
    const linkInput = document.getElementById('ref-link-input');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Para celulares
    navigator.clipboard.writeText(linkInput.value);
    showAlert("Sucesso", "Link de convite copiado para a área de transferência!");
}

// 2. Função de Compartilhamento nas Redes Sociais
window.shareSocial = function(platform) {
    const link = document.getElementById('ref-link-input').value;
    const message = encodeURIComponent(`Olá! Venha ganhar dinheiro comigo na Wealth Pro. Use meu link para começar: ${link}`);
    
    let url = "";
    switch(platform) {
        case 'wa': url = `https://wa.me/?text=${message}`; break;
        case 'tg': url = `https://t.me/share/url?url=${link}&text=${message}`; break;
        case 'fb': url = `https://www.facebook.com/sharer/sharer.php?u=${link}`; break;
        case 'tw': url = `https://twitter.com/intent/tweet?text=${message}`; break;
    }
    window.open(url, '_blank');
}

// 3. Atualizar dados da Equipe (Adicionar dentro do seu loadUserData)
// No fetch de /api/user/data, certifique-se que o server envie 'ref_code'
if(user.ref_code) {
    const fullLink = window.location.origin + "/?ref=" + user.ref_code;
    document.getElementById('ref-link-input').value = fullLink;
    document.getElementById('display-ref-id').innerText = user.ref_code;
    
    // Se você tiver os dados de ganhos por nível no banco, preencha aqui:
    // document.getElementById('team-lv1-earned').innerText = user.lv1_bonus.toFixed(2);
}

// Inicialização
window.onload = () => {
    window.generateCaptcha();
    const date = new Date();
    if(document.getElementById('cur-date')) {
        document.getElementById('cur-date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
    }
};

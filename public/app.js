let currentCaptcha = "";
window.allPlans = [];
window.currentUser = null;
let currentSlide = 0;

// 1. GERAR CAPTCHA (Ajustado para 5 caracteres e carregamento seguro)
window.generateCaptcha = function() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) { // Aumentado para 5 para ficar mais bonito no bloco
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = code;
    
    // Pequeno delay para garantir que o HTML já carregou na tela
    setTimeout(() => {
        const lVal = document.getElementById('l_cap_val');
        const rVal = document.getElementById('r_cap_val');
        if(lVal) lVal.innerText = code;
        if(rVal) rVal.innerText = code;
    }, 50);
}

window.onload = async () => {
    window.generateCaptcha();
    
    // Verifica se há um código de convite na URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if(refCode) {
        window.goTo('page-register');
        if(document.getElementById('r_invite')) document.getElementById('r_invite').value = refCode;
        return;
    }

    // Tenta carregar dados do usuário para ver se ele está logado no SERVIDOR
    const res = await fetch('/api/user/data');
    
    if (res.ok) {
        // SE ESTÁ LOGADO: Vai para a última página salva ou para a Home
        const lastPage = localStorage.getItem('wealth_last_page');
        if(lastPage && lastPage !== 'page-login' && lastPage !== 'page-register') {
            window.goTo(lastPage);
        } else {
            window.goTo('page-home');
        }
    } else {
        // SE NÃO ESTÁ LOGADO: Limpa lixo da memória e fica no login
        localStorage.removeItem('wealth_last_page');
        window.goTo('page-login');
    }
};

// 2. NAVEGAÇÃO ENTRE PÁGINAS (SPA) - VERSÃO BLINDADA
window.goTo = function(pageId, btn) {
    const target = document.getElementById(pageId);
    const nav = document.getElementById('main-nav');

    if (!target) {
        console.error("Página não encontrada no HTML: " + pageId);
        return;
    }

    // 1. MOSTRA A PÁGINA PRIMEIRO (Para acabar com a tela branca)
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });
    target.classList.add('active');
    target.style.display = 'block';

    // 2. MOSTRA O MENU
    if (nav) {
        const isAuth = (pageId === 'page-login' || pageId === 'page-register');
        nav.style.display = isAuth ? 'none' : 'flex';
    }

    // 3. ATUALIZA OS BOTÕES DO MENU
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 4. CARREGA OS DADOS EM SEGUNDO PLANO (Se falhar, a tela já apareceu)
    setTimeout(async () => {
        try {
            if (pageId === 'page-home') {
                if(window.loadUserData) await window.loadUserData();
                if(window.loadHomeData) await window.loadHomeData();
            }
            if (pageId === 'page-projects' || pageId === 'page-vip-list') {
                if(window.loadAllPlans) await window.loadAllPlans();
            }
            if (pageId === 'page-profits') {
                if(window.loadProfitClaims) await window.loadProfitClaims();
            }
            if (pageId === 'page-account') {
                if(window.startAccountSlider) window.startAccountSlider();
            }
            if (pageId === 'page-team') {
                if(window.loadUserData) await window.loadUserData();
            }
        } catch (e) {
            console.warn("Dica: Os dados desta aba ainda estão sendo processados...");
        }
    }, 100);

    // 5. SALVA A PÁGINA NA MEMÓRIA
    if (pageId !== 'page-login' && pageId !== 'page-register') {
        localStorage.setItem('wealth_last_page', pageId);
    }
        }


// --- AJUSTE NA FUNÇÃO GOTO ---
// Garante que os planos carreguem na Home e nos Projetos
const originalGoToFix = window.goTo;
window.goTo = function(pageId, btn) {
    if(pageId === 'page-history') loadFullHistory('all');
    if(pageId === 'page-home') loadHomeData(); // Força recarregar planos na home
    originalGoToFix(pageId, btn);
}

// 3. CARREGAR DADOS DO USUÁRIO (COMPLETO: SALDO, EQUIPE E CONTA)
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return;
        const user = await res.json();
        window.currentUser = user; 
        
        const update = (id, val) => {
            const el = document.getElementById(id);
            if(el) {
                // Se for dinheiro, formata com MT. Se for apenas número, mostra normal.
                if(id.includes('money') || id.includes('earned') || id.includes('balance') || id.includes('stat')) {
                    el.innerText = parseFloat(val || 0).toFixed(2);
                } else {
                    el.innerText = val || 0;
                }
            }
        };

        // --- ATUALIZA HOME E BLOCO DE SALDO ---
        update('u-balance', user.balance);
        update('stat-with', user.total_with);
        update('stat-week', user.week_earned);
        update('stat-month', user.month_earned);
        update('stat-total', user.total_earned);
        update('stat-ref', user.total_ref);
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;

        // --- ATUALIZA PÁGINA DE EQUIPE (DADOS REAIS) ---
        if(document.getElementById('display-ref-id')) document.getElementById('display-ref-id').innerText = user.ref_code;
        if(document.getElementById('ref-link-input')) {
            document.getElementById('ref-link-input').value = window.location.origin + "/?ref=" + user.ref_code;
        }

        // Ganhos de Comissão nos 4 blocos
        update('team-total-earned', user.total_ref);
        update('team-lv1-earned', user.lv1_earned || 0);
        update('team-lv2-earned', user.lv2_earned || 0);
        update('team-lv3-earned', user.lv3_earned || 0);

        // Contagem de Membros (Ativos/Inativos)
        update('team-total-count', user.team_total);
        update('lv1-count', user.lv1_count);
        update('lv2-count', user.lv2_count);
        update('lv3-count', user.lv3_count);
        update('team-active-count', user.team_active);
        update('team-inactive-count', user.team_inactive);

        // Financeiro da Equipe (Soma de MT)
        if(document.getElementById('team-dep-money')) document.getElementById('team-dep-money').innerText = "MT " + parseFloat(user.team_dep_money || 0).toFixed(2);
        if(document.getElementById('team-with-money')) document.getElementById('team-with-money').innerText = "MT " + parseFloat(user.team_with_money || 0).toFixed(2);
        if(document.getElementById('team-prof-money')) document.getElementById('team-prof-money').innerText = "MT " + parseFloat(user.team_prof_money || 0).toFixed(2);

        // --- ATUALIZA PÁGINA DE CONTA ---
        if(document.getElementById('acc-name-label')) document.getElementById('acc-name-label').innerText = user.name;
        if(document.getElementById('acc-phone-label')) document.getElementById('acc-phone-label').innerText = user.phone;
        if(document.getElementById('acc-balance-total')) document.getElementById('acc-balance-total').innerText = parseFloat(user.balance || 0).toFixed(2);

        // --- CORREÇÃO AQUI: Atualiza o Saldo Disponível na tela de SAQUE ---
        const drawBalanceEl = document.getElementById('draw-balance');
        if(drawBalanceEl) drawBalanceEl.innerText = "MT " + parseFloat(user.balance).toFixed(2);

        // --- ATUALIZA CAMPANHAS (METAS) ---
        renderCampaigns(user.campaign_count);

    } catch(e) { console.error("Erro ao carregar dados:", e); }
}

// 4. LÓGICA DAS CAMPANHAS (METAS DE CONVITE)
window.renderCampaigns = function(count) {
    const listContainer = document.getElementById('campaign-list');
    if(!listContainer) return;

    // Definição das metas e prêmios
    const goals = [
        { target: 10, prize: 50 },
        { target: 20, prize: 100 },
        { target: 50, prize: 300 },
        { target: 100, prize: 650 },
        { target: 500, prize: 3500 },
        { target: 1000, prize: 10000 }
    ];

    let html = "";
    goals.forEach(g => {
        const progress = Math.min((count / g.target) * 100, 100);
        const canClaim = count >= g.target;

        html += `
        <div class="campaign-card">
            <div class="camp-info">
                <strong>Meta: ${g.target} Convidados Ativos</strong>
                <span>Prêmio: <b style="color:var(--green)">MT ${g.prize}.00</b></span>
            </div>
            <div class="camp-progress-area">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <small>${count}/${g.target}</small>
            </div>
            <button class="btn-claim-camp ${canClaim ? 'active' : ''}" 
                    ${canClaim ? '' : 'disabled'} 
                    onclick="claimCampaign(${g.target}, ${g.prize})">
                ${canClaim ? 'Resgatar Agora' : 'Ainda Falta'}
            </button>
        </div>`;
    });
    listContainer.innerHTML = html;
}

// 5. RESGATAR PRÊMIO DA CAMPANHA
window.claimCampaign = async function(target, prize) {
    showAlert("Resgatar Prêmio", `Deseja coletar o bónus de MT ${prize}.00 pela meta de ${target} convidados?`, async () => {
        try {
            const res = await fetch('/api/user/claim-campaign', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ target, prize })
            });
            const data = await res.json();
            if(data.success) {
                showAlert("Sucesso", `🎉 Parabéns! MT ${prize}.00 foram adicionados ao seu saldo por completar a meta, continuem a convidar para ganhar prêmios especiais.`);
                loadUserData(); // Recarrega tudo para atualizar saldo e barras
            } else {
                showAlert("Erro", data.error || "Você ainda não atingiu esta meta.");
            }
        } catch(e) {
            showAlert("Erro", "Falha ao processar resgate.");
        }
    });
    }

// 4. CARREGAR PLANOS NA HOME E ANÚNCIOS
window.loadHomeData = async function() {
    try {
        const res = await fetch('/api/plans');
        const plans = await res.json();
        window.allPlans = plans;
        
        const container = document.getElementById('beginner-plans');
        if(container) {
            let html = "";
            const normalPlans = plans.filter(p => p.category === 'Normal').slice(0, 1);
            const vipPlans = plans.filter(p => p.category === 'VIP').slice(0, 1);
            
            [...normalPlans, ...vipPlans].forEach(p => {
                html += createPlanCard(p);
            });
            container.innerHTML = html;
        }

        // Carregar Anúncios
        const adsRes = await fetch('/api/admin/list-ads');
        const ads = await adsRes.json();
        const adsContainer = document.getElementById('mini-history'); 
        if(ads.length > 0 && adsContainer) {
            adsContainer.innerHTML = `<div class="wealth-card" style="background:rgba(0,123,255,0.1); font-size:12px; border-left:4px solid var(--blue); padding:10px">📢 <b>AVISO:</b> ${ads[0].message}</div>`;
        }
    } catch(e) { console.error(e); }
}

// 5. CARREGAR TODOS OS PLANOS (PROJETOS)
window.loadAllPlans = async function() {
    try {
        const res = await fetch('/api/plans');
        const plans = await res.json();
        window.allPlans = plans;

        const normalList = document.getElementById('plans_normal_list');
        const vipList = document.getElementById('plans_vip_list');

        if(normalList) {
            let html = "";
            plans.filter(p => p.category === 'Normal').forEach(p => html += createPlanCard(p));
            normalList.innerHTML = html || "<p style='text-align:center; color:grey'>Nenhum plano disponível.</p>";
        }
        if(vipList) {
            let html = "";
            plans.filter(p => p.category === 'VIP').forEach(p => html += createPlanCard(p));
            vipList.innerHTML = html || "<p style='text-align:center; color:grey'>Nenhum plano VIP disponível.</p>";
        }
    } catch(e) { console.error(e); }
}

// 6. LÓGICA DE LOGIN (Blindada)
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capInInput = document.getElementById('l_cap_in');
    const capIn = capInInput ? capInInput.value.toUpperCase() : "";

    if(!phone || !pass) return showAlert("Atenção", "Preencha telefone e senha.");
    if(capIn !== currentCaptcha) {
        showAlert("Segurança", "Captcha incorreto.");
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
            if(data.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                await window.loadUserData();
                window.goTo('page-home');
            }
        } else {
            showAlert("Erro", data.error || "Dados incorretos.");
            window.generateCaptcha();
        }
    } catch(e) {
        showAlert("Erro", "Falha ao conectar com o servidor. Verifique sua internet.");
    }
}

// 7. DESENHAR O CARD DO PLANO
function createPlanCard(p) {
    const name = p.name || "Plano Wealth";
    const price = parseFloat(p.price || 0);
    const daily = parseFloat(p.daily_profit || 0);
    const duration = parseInt(p.duration || 0);
    const totalReturn = parseFloat(p.total_return || 0);
    const image = p.image_url || 'https://via.placeholder.com/80';
    const category = (p.category || 'Normal').toUpperCase();

    const isVip = category === 'VIP';
    
    const profitText = isVip 
        ? `<p>Lucro Total: <b>MT ${totalReturn.toFixed(2)}</b></p><p style="color:#ffa500; font-size:9px; font-weight:bold;">⚠️ Capital não devolvido</p>`
        : `<p>Ganho Total: <b>MT ${(daily * duration).toFixed(2)}</b></p><p>Total + Capital: <b style="color:#00d084">MT ${totalReturn.toFixed(2)}</b></p>`;

    return `
    <div class="plan-mini-card ${isVip ? 'vip-card' : ''}">
        <div class="plan-info-left">
            <h5 style="margin:0; font-size:14px; color:white;">${name}</h5>
            <p style="margin:2px 0; font-size:10px;">Compra: <b>MT ${price}</b> | Dias: <b>${duration}</b></p>
            <p style="margin:2px 0; font-size:10px;">Diário: <b style="color:#00d084">MT ${daily}</b></p>
            <div style="margin-top:4px; font-size:10px; color:#8899ac;">
                ${profitText}
            </div>
            <button class="btn-buy-mini" onclick="handleBuyPlan(${p.id}, '${category}')">INVESTIR AGORA</button>
        </div>
        <img src="${image}" class="plan-img-right">
    </div>`;
}

// 2. Carregamento dos Planos
window.loadAllPlans = async function() {
    console.log("Buscando planos...");
    try {
        const res = await fetch('/api/plans');
        const plans = await res.json();
        
        console.log("Dados que chegaram do banco:", plans);

        const normalList = document.getElementById('plans_normal_list');
        const vipList = document.getElementById('plans_vip_list');
        const homeList = document.getElementById('beginner-plans');

        // Limpeza absoluta
        if(normalList) normalList.innerHTML = "";
        if(vipList) vipList.innerHTML = "";
        if(homeList) homeList.innerHTML = "";

        if (!plans || plans.length === 0) {
            console.error("ERRO: O Banco de dados retornou zero planos!");
            if(normalList) normalList.innerHTML = "<p style='color:orange; text-align:center'>O Banco de dados está vazio. Vá no Admin e crie um plano.</p>";
            return;
        }

        plans.forEach((p, index) => {
            const cardHtml = createPlanCard(p);
            const category = (p.category || 'Normal').trim().toUpperCase();

            if (category === 'VIP') {
                if(vipList) vipList.innerHTML += cardHtml;
            } else {
                if(normalList) normalList.innerHTML += cardHtml;
            }

            // Na Home, mostra os 2 primeiros
            if (homeList && index < 2) {
                homeList.innerHTML += cardHtml;
            }
        });

    } catch (err) {
        console.error("ERRO NO FETCH:", err);
    }
                }

// Carregar Histórico com correção nos botões
window.loadFullHistory = async function(type = 'all', btn) {
    if(btn) {
        document.querySelectorAll('.tab-item-sm').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    try {
        const res = await fetch(`/api/user/transactions?type=${type}`);
        const data = await res.json();
        const container = document.getElementById('full-history-list');
        
        if(!container) return;
        container.innerHTML = data.length ? "" : "<p style='text-align:center; padding:50px; color:#8899ac;'>Nenhum registo de "+type+" encontrado.</p>";
        
        data.forEach(t => {
            const isNegative = ['withdraw', 'plan_buy'].includes(t.type);
            const typeLabels = {
                'deposit': 'Depósito',
                'withdraw': 'Saque',
                'profit': 'Lucro Plano',
                'bonus': 'Check-in',
                'referral': 'Convite'
            };

            container.innerHTML += `
                <div class="hist-card ${t.type}">
                    <div>
                        <strong>${typeLabels[t.type] || t.type}</strong>
                        <small style="display:block; color:#8899ac">${new Date(t.created_at).toLocaleString('pt-MZ')}</small>
                    </div>
                    <div style="text-align:right">
                        <b style="color:${isNegative ? '#ff4d4d' : '#00d084'}">
                            ${isNegative ? '-' : '+'} MT ${parseFloat(t.amount).toFixed(2)}
                        </b>
                        <small style="display:block; font-size:10px; opacity:0.7">${t.status.toUpperCase()}</small>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

// 6. Página de Lucros (Colheita Diária)
window.loadProfitClaims = async function() {
    const container = document.getElementById('profits-main-content');
    const expiredContainer = document.getElementById('expired-plans-container');
    const expiredSection = document.getElementById('expired-section');
    const historySection = document.getElementById('history-section');

    try {
        const res = await fetch('/api/user/available-profits');
        const data = await res.json();
        
        // Atualiza cabeçalho
        document.getElementById('total-invested').innerText = window.currentUser.total_invested || "0.00";
        document.getElementById('total-collected').innerText = window.currentUser.total_earned || "0.00";

        if (data.length === 0) {
            // TELA DE SEM PLANOS (Igual à imagem 2)
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📈</div>
                    <h3>Sem Planos</h3>
                    <p>Comece a investir para ver seus lucros aqui.</p>
                </div>`;
            expiredSection.style.display = 'none';
            historySection.style.display = 'none';
            return;
        }

        container.innerHTML = `<div class="section-label">🚀 Planos Ativos</div>`;
        expiredContainer.innerHTML = "";
        let hasExpired = false;

        data.forEach(p => {
            const progress = (p.days_passed / p.duration) * 100;
            const isExpired = p.days_passed >= p.duration;

            // Lógica do Botão: Se comprou hoje (days_passed 0) ou já coletou
            let buttonHTML = "";
            if (p.days_passed === 0) {
                buttonHTML = `<button class="btn-claim-today btn-claim-waiting">⏳ Começa amanhã às 00:00</button>`;
            } else if (p.claimed_today) {
                buttonHTML = `<button class="btn-claim-today btn-claim-waiting">✅ Recebido Hoje</button>`;
            } else {
                buttonHTML = `<button class="btn-claim-today" onclick="claimProfit(${p.id})">💰 Receber Lucro Hoje — MT ${parseFloat(p.daily_profit).toFixed(2)}</button>`;
            }

            const cardHTML = `
                <div class="profit-card-detailed">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <strong>${p.name}</strong>
                        <span class="status-badge" style="background:${isExpired ? '#red22' : '#00d08422'}; color:${isExpired ? 'red' : '#00d084'}">${isExpired ? 'EXPIRADO' : 'ATIVO'}</span>
                    </div>
                    <div class="profit-data-grid">
                        <div class="data-box"><small>Investimento</small><span>MT ${p.price}</span></div>
                        <div class="data-box"><small>Dias Totais</small><span>${p.duration} dias</span></div>
                        <div class="data-box"><small>Ganho/Dia</small><span>MT ${p.daily_profit}</span></div>
                        <div class="data-box"><small>Restantes</small><span>${p.duration - p.days_passed} dias</span></div>
                    </div>
                    <div class="total-gain-box">
                        <small>TOTAL DE GANHO</small>
                        <h2>MT ${(p.daily_profit * p.duration).toFixed(2)}</h2>
                        <small>+150% (Capital + Lucro)</small>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
                        <div class="progress-info"><span>${progress.toFixed(0)}%</span><span>${p.days_passed}/${p.duration} dias</span></div>
                    </div>
                    ${!isExpired ? buttonHTML : ''}
                </div>`;

            if (isExpired) {
                expiredContainer.innerHTML += cardHTML;
                hasExpired = true;
            } else {
                container.innerHTML += cardHTML;
            }
        });

        expiredSection.style.display = hasExpired ? 'block' : 'none';
        historySection.style.display = 'block';
        loadProfitHistory(); // Chama a função de histórico que já criamos antes

    } catch (e) { console.error(e); }
            }

// 7. Equipe: Funções
window.copyInvite = function() {
    const input = document.getElementById('ref-link-input');
    if(!input) return;
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

// 8. Modais, Alertas e Auth
window.showAlert = function(title, text, confirmCallback = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    const modal = document.getElementById('wealth-modal');
    if(!modal) return;
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
        if((await res.json()).success) { showAlert("Sucesso", "Ativado!"); window.loadUserData(); window.goTo('page-home'); }
        else showAlert("Saldo", "Saldo insuficiente.");
    });
}

// 9. Slider Automático da Conta
window.startAccountSlider = function() {
    const wrapper = document.getElementById('account-slider-wrapper');
    if(!wrapper) return;
    if(window.accInterval) clearInterval(window.accInterval);
    window.accInterval = setInterval(() => {
        currentSlide++;
        if(currentSlide >= 4) currentSlide = 0;
        wrapper.style.transform = `translateX(-${currentSlide * 25}%)`;
    }, 4000);
}

window.toggleSupport = () => {
    const m = document.getElementById('support-modal');
    if(m) m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

window.saveBankInfo = async function() {
    const method = document.getElementById('bank-method').value;
    const name = document.getElementById('bank-name').value;
    const phone = document.getElementById('bank-phone').value;
    const pin = document.getElementById('bank-pin').value;
    if(!name || !phone || !pin) return showAlert("Atenção", "Preencha todos os campos.");
    const res = await fetch('/api/user/update-bank', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ method, name, phone, pin }) });
    if(res.ok) { showAlert("Sucesso", "Dados salvos!"); goTo('page-account'); }
}

// Função para renderizar a página de banco (chamar no goTo)
window.renderBankPage = function() {
    const area = document.getElementById('bank-content-area');
    const u = window.currentUser;

    // Se o usuário já tem banco e PIN configurado
    if (u.bank_method && u.bank_phone) {
        area.innerHTML = `
            <div class="bank-display-card">
                <div class="bank-info-item"><small>Método Ativo</small><b>${u.bank_method}</b></div>
                <div class="bank-info-item"><small>Titular da Conta</small><b>${u.bank_name}</b></div>
                <div class="bank-info-item"><small>Número / Endereço</small><b>${u.bank_phone}</b></div>
                <div class="bank-info-item"><small>PIN de Segurança</small><b>${u.pin.substring(0,1)}***</b></div>
            </div>
            <div style="padding: 0 20px;">
                <button class="btn btn-blue" onclick="showBankForm(true)">Mudar Dados de Saque</button>
                <button class="btn-logout-small" style="width:100%; margin-top:10px; border-color:var(--blue); color:var(--blue)" onclick="showPinForm()">Alterar PIN de Saque</button>
            </div>
        `;
    } else {
        showBankForm(false);
    }
}

// Mostrar Formulário de Cadastro/Edição
window.showBankForm = function(isEdit) {
    const area = document.getElementById('bank-content-area');
    area.innerHTML = `
        <div class="wealth-card">
            <p>${isEdit ? 'Editar' : 'Vincular'} Conta para Saques:</p>
            <select id="bank-method" class="input-tiny">
                <option value="M-Pesa">M-Pesa</option>
                <option value="e-Mola">e-Mola</option>
                <option value="Binance UID">Binance UID (Cripto)</option>
                <option value="USDT (BSC/BEP-20)">USDT (Rede BSC)</option>
            </select>
            <input type="text" id="bank-name" placeholder="Nome Completo do Titular" class="input-tiny" value="${window.currentUser.bank_name || ''}">
            <input type="text" id="bank-phone" placeholder="Número ou Endereço da Carteira" class="input-tiny" value="${window.currentUser.bank_phone || ''}">
            <hr style="opacity:0.1; margin:15px 0;">
            <p>🔒 ${isEdit ? 'Confirme seu PIN atual:' : 'Crie seu PIN de 4 dígitos:'}</p>
            <input type="password" id="bank-pin" maxlength="4" placeholder="****" class="input-tiny input-pin-confirm">
            ${!isEdit ? '<input type="password" id="bank-pin-confirm" maxlength="4" placeholder="Confirme o PIN" class="input-tiny input-pin-confirm">' : ''}
            <button class="btn btn-green" onclick="saveBankInfo(${isEdit})">Confirmar e Salvar</button>
        </div>
    `;
}

// Salvar no Banco (AJUSTADO)
window.saveBankInfo = async function(isEdit) {
    const method = document.getElementById('bank-method').value;
    const name = document.getElementById('bank-name').value;
    const phone = document.getElementById('bank-phone').value;
    const pin = document.getElementById('bank-pin').value;

    if(!name || !phone || !pin) return showAlert("Atenção", "Preencha todos os campos.");
    
    if(!isEdit) {
        const confirmPin = document.getElementById('bank-pin-confirm').value;
        if(pin !== confirmPin) return showAlert("Erro", "Os PINs digitados não coincidem.");
    }

    const res = await fetch('/api/user/update-bank', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ method, name, phone, pin, isEdit })
    });

    const data = await res.json();
    if(res.ok) {
        showAlert("Sucesso", "Os seus dados bancários foram actualizados!");
        await loadUserData(); // Atualiza dados globais
        renderBankPage(); // Volta para a tela de visualização
    } else {
        showAlert("Erro", data.error || "Falha ao salvar dados.");
    }
}

// Ajuste na função goTo para chamar a renderização
const originalGoToBank = window.goTo;
window.goTo = function(pageId, btn) {
    if(pageId === 'sub-page-bank') {
        renderBankPage();
    }
    originalGoToBank(pageId, btn);
    }

window.changePass = async function() {
    const oldP = document.getElementById('pass-old').value;
    const newP = document.getElementById('pass-new').value;
    if(!oldP || !newP) return showAlert("Atenção", "Preencha as senhas.");
    const res = await fetch('/api/user/change-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ oldP, newP }) });
    if(res.ok) { showAlert("Sucesso", "Senha alterada!"); location.reload(); }
    else showAlert("Erro", "Senha antiga incorreta.");
}
// =========================================
// SISTEMA DE DEPÓSITO - LÓGICA COMPLETA
// =========================================

// Variável global para controle dos dados
let depositData = { 
    amount: 0, 
    method: '', 
    subMethod: '', 
    bonus: 0 
};

let depTimerInterval = null;

// 1. Preenchimento Automático de Valor (Preset)
window.setDepAmount = function(val) {
    const input = document.getElementById('in-dep-amount');
    if (input) {
        input.value = val;
        // Opcional: Feedback visual ao clicar
        document.querySelectorAll('.btn-preset').forEach(b => {
            b.classList.remove('active');
            if(b.innerText.includes(val)) b.classList.add('active');
        });
    }
}

// 2. Seleção de Método
window.setDepMethod = function(m) {
    depositData.method = m;
    depositData.subMethod = ''; // Reseta escolha anterior
    
    // UI: Destaca o selecionado
    document.querySelectorAll('.method-card').forEach(card => card.classList.remove('selected'));
    // Encontra o card pelo ID definido no HTML
    const idMap = { 'e-Mola': 'method-emola', 'M-Pesa': 'method-mpesa', 'Cripto': 'method-crypto' };
    const selectedCard = document.getElementById(idMap[m]);
    if(selectedCard) selectedCard.classList.add('selected');

    // Lógica de Cripto
    const cryptoSubOptions = document.getElementById('crypto-sub-options');
    if(cryptoSubOptions) {
        cryptoSubOptions.style.display = (m === 'Cripto') ? 'block' : 'none';
    }
    
    // Define bónus de 2% se for cripto
    depositData.bonus = (m === 'Cripto') ? 0.02 : 0;
}

// 3. Seleção de Sub-método Cripto
window.setCryptoSub = function(sub) {
    depositData.subMethod = sub;
    document.querySelectorAll('.btn-sub-crypto').forEach(b => {
        b.classList.remove('active');
        if(b.innerText.toLowerCase().includes(sub.toLowerCase().replace('_', ''))) b.classList.add('active');
    });
}

// 4. Navegação entre Passos (1 -> 2 -> 3)
window.nextDepStep = function(step) {
    // Validação do Passo 1 para o 2
    if (step === 2) {
        const inputVal = document.getElementById('in-dep-amount').value;
        depositData.amount = parseFloat(inputVal);
        
        if (isNaN(depositData.amount) || depositData.amount < 500) {
            return showAlert("Atenção", "O valor mínimo de depósito é 500 MT.");
        }
        
        document.getElementById('display-dep-val').innerText = "MT " + depositData.amount.toFixed(2);
    }
    
    // Configuração do Passo 3 (Pagamento Final)
    if (step === 3) {
        if (!depositData.method) return showAlert("Atenção", "Por favor, selecione um método de pagamento.");
        if (depositData.method === 'Cripto' && !depositData.subMethod) {
            return showAlert("Atenção", "Escolha a rede Cripto (USDT ou Binance ID).");
        }

        const destAddress = document.getElementById('dest-address');
        const destName = document.getElementById('dest-name');
        const destLabel = document.getElementById('dest-label');
        const destNameCont = document.getElementById('dest-name-container');
        const usdDisplay = document.getElementById('usd-display');
        
        // Reset padrão
        usdDisplay.style.display = 'none';
        destNameCont.style.display = 'block';
        destLabel.innerText = "Número:";

        // Lógica Dinâmica de Dados de Destino
        if (depositData.method === 'e-Mola') {
            destAddress.innerText = "878354556";
            destName.innerText = "Moz Wealth Pay";
        } else if (depositData.method === 'M-Pesa') {
            destAddress.innerText = "858285865";
            destName.innerText = "Joaquim Jorge";
        } else if (depositData.method === 'Cripto') {
            destNameCont.style.display = 'none';
            usdDisplay.style.display = 'block';
            
            if (depositData.subMethod === 'Binance_ID') {
                destLabel.innerText = "Binance UID:";
                destAddress.innerText = "548291032"; // Coloque seu UID Real aqui
            } else {
                destLabel.innerText = "Endereço BSC:";
                destAddress.innerText = "0x7F2e...A9B"; // Coloque sua Carteira Real aqui
            }
            
            // Câmbio 1$ = 70MT
            const usdVal = (depositData.amount / 70).toFixed(2);
            document.getElementById('crypto-usd-val').innerText = usdVal + " USDT";
        }

        document.getElementById('final-amount').innerText = "MT " + depositData.amount.toFixed(2);
        document.getElementById('final-method').innerText = depositData.subMethod ? depositData.subMethod.replace('_', ' ') : depositData.method;
        
        // Inicia o cronômetro de 5 minutos
        startDepositTimer();
    }

    // Gerenciamento Visual das Telas
    document.querySelectorAll('.dep-container').forEach(c => c.classList.remove('active'));
    const nextContent = document.getElementById(`dep-step-content-${step}`);
    if(nextContent) nextContent.classList.add('active');
    
    // Atualiza Barra de Progresso Superior
    document.querySelectorAll('.step-circle').forEach((c, idx) => {
        if (idx < step) c.classList.add('active'); else c.classList.remove('active');
    });
}

// 5. Cronômetro de 7 Minutos
function startDepositTimer() {
    let timeLeft = 420; // 7 minutos em segundos
    const timerDisplay = document.getElementById('dep-timer');
    const sendBtn = document.getElementById('btn-send-dep');
    
    if(depTimerInterval) clearInterval(depTimerInterval);

    depTimerInterval = setInterval(() => {
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        
        if (timerDisplay) {
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(depTimerInterval);
            if(sendBtn) sendBtn.style.display = 'none';
            showAlert("Sessão Expirada", "O tempo para realizar o depósito acabou. Comece novamente.", () => {
                resetDeposit();
            });
        }
        timeLeft--;
    }, 1000);
}

// 6. Resetar e Cancelar Depósito
window.resetDeposit = function() {
    clearInterval(depTimerInterval);
    const sendBtn = document.getElementById('btn-send-dep');
    if(sendBtn) sendBtn.style.display = 'block';
    
    // Limpa dados
    document.getElementById('in-dep-amount').value = "";
    depositData = { amount: 0, method: '', subMethod: '', bonus: 0 };
    
    // Volta visualmente
    nextDepStep(1);
    goTo('page-home');
}

// Função para copiar texto (número ou carteira)
window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert("Copiado", "Dados copiados para a área de transferência!");
    });
            }
// Mostrar a foto escolhida na tela
window.previewFile = function() {
    const file = document.getElementById('dep-file').files[0];
    const preview = document.getElementById('img-preview');
    const label = document.getElementById('upload-label');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            label.innerText = "✅ Comprovante Selecionado";
        }
        reader.readAsDataURL(file);
    }
}

// Enviar Depósito para o Servidor e Admin
window.submitDeposit = async function() {
    const txid = document.getElementById('dep-txid').value;
    const file = document.getElementById('dep-file').files[0];
    
    if(!txid) return showAlert("Erro", "Por favor, cole o ID da transação.");
    if(!file) return showAlert("Erro", "Por favor, selecione a foto do comprovante.");

    const btn = document.getElementById('btn-send-dep');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const formData = new FormData();
    formData.append('amount', depositData.amount);
    formData.append('method', depositData.subMethod || depositData.method);
    formData.append('txid', txid);
    formData.append('proof', file);

    try {
        const res = await fetch('/api/user/deposit', {
            method: 'POST',
            body: formData // Envia tudo: Valor, ID e Foto
        });

        if(res.ok) {
            clearInterval(depTimerInterval);
            document.getElementById('success-msg-text').innerHTML = `Seu depósito de <b>MT ${depositData.amount.toFixed(2)}</b> foi enviado ao nosso departamento de depósitos para análise.`;
            
            // Mostra popup por 15 segundos
            document.getElementById('success-dep-modal').style.display = 'flex';
            setTimeout(() => { closeSuccessModal(); }, 15000);
        } else {
            showAlert("Erro", "Falha ao enviar. Tente novamente.");
            btn.disabled = false;
        }
    } catch(e) {
        btn.disabled = false;
    }
}

window.closeSuccessModal = () => {
    document.getElementById('success-dep-modal').style.display = 'none';
    resetDeposit(); // Volta para a home
}

// --- CARREGAR HISTÓRICO COMPLETO ---
window.loadFullHistory = async function(type = 'all', btn) {
    // UI: Muda cor do botão ativo
    if(btn) {
        document.querySelectorAll('.tab-item-sm').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    try {
        // Atualiza o resumo no topo puxando do usuário atual
        document.getElementById('hist-total-earned').innerText = parseFloat(window.currentUser.total_earned || 0).toFixed(2);
        document.getElementById('hist-total-with').innerText = parseFloat(window.currentUser.total_with || 0).toFixed(2);

        const res = await fetch(`/api/user/transactions?type=${type}`);
        const data = await res.json();
        const container = document.getElementById('full-history-list');
        
        container.innerHTML = data.length ? "" : "<p style='text-align:center; padding:50px; color:#8899ac;'>Nenhum registo encontrado.</p>";
        
        data.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString('pt-MZ');
            const time = new Date(t.created_at).toLocaleTimeString('pt-MZ', {hour: '2-digit', minute:'2-digit'});
            
            container.innerHTML += `
                <div class="hist-card ${t.type}">
                    <div>
                        <strong style="display:block; text-transform: capitalize;">${t.type.replace('profit','Lucro').replace('bonus','Check-in').replace('referral','Convite')}</strong>
                        <small style="color:#8899ac">${date} às ${time}</small>
                    </div>
                    <div style="text-align:right">
                        <b style="color:${['withdraw','plan_buy'].includes(t.type) ? 'var(--red)' : 'var(--green)'}">
                            ${['withdraw','plan_buy'].includes(t.type) ? '-' : '+'} MT ${parseFloat(t.amount).toFixed(2)}
                        </b>
                        <small style="display:block; font-size:9px; color:#8899ac">${t.status.toUpperCase()}</small>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

let currentWithdraw = { amount: 0, net: 0, tax: 0 };

// --- ATUALIZAÇÃO DO SAQUE EM TEMPO REAL ---
window.calculateWithdraw = function() {
    const input = document.getElementById('in-withdraw-amount');
    const val = parseFloat(input.value) || 0;
    const calcBox = document.getElementById('calc-box-withdraw');

    // Só mostra o bloco de cálculo se o valor for 150 ou mais
    if (val >= 150) {
        calcBox.style.display = 'block';
        
        const tax = val * 0.13; // Cálculo de 13%
        const net = val - tax;

        document.getElementById('calc-req').innerText = "MT " + val.toFixed(2);
        document.getElementById('calc-tax-val').innerText = "-MT " + tax.toFixed(2);
        document.getElementById('calc-net').innerText = "MT " + net.toFixed(2);

        // Guarda os valores para o próximo passo
        currentWithdraw = { amount: val, net: net, tax: tax };
    } else {
        // Esconde o bloco se o valor for menor que 150
        calcBox.style.display = 'none';
    }
}

window.nextWithdrawStep = async function(step) {
    if (step === 2) {
        const amountToDraw = parseFloat(document.getElementById('in-withdraw-amount').value);
        
        if (isNaN(amountToDraw) || amountToDraw < 150) return showAlert("Atenção", "O valor mínimo de saque é 150 MT");
        if (amountToDraw > window.currentUser.balance) return showAlert("Erro", "Saldo insuficiente.");

        // TRAVA OBRIGATÓRIA: Verifica se o usuário vinculou a conta bancária
        // Não usa dados do registro, exige dados do banco
        if (!window.currentUser.bank_method || !window.currentUser.bank_phone || !window.currentUser.bank_name) {
            return showAlert("Conta Necessária", "Você ainda não vinculou uma conta de saque. Por favor, vá ao menu 'Conta Bancária' e cadastre seus dados antes de solicitar um levantamento.", () => {
                goTo('sub-page-bank'); // Leva ele direto para vincular
            });
        }

        // Se tiver conta vinculada, preenche com os dados REAIS DO BANCO
        document.getElementById('conf-req').innerText = "MT " + amountToDraw.toFixed(2);
        document.getElementById('conf-tax').innerText = "-MT " + (amountToDraw * 0.13).toFixed(2);
        document.getElementById('conf-net').innerText = "MT " + (amountToDraw * 0.87).toFixed(2);
        
        // MOSTRAR DADOS VINCULADOS (NÃO DO REGISTRO)
        document.getElementById('draw-method').innerText = window.currentUser.bank_method;
        document.getElementById('draw-number').innerText = window.currentUser.bank_phone;
        document.getElementById('draw-name').innerText = window.currentUser.bank_name;
    }

    document.querySelectorAll('.withdraw-container').forEach(c => c.classList.remove('active'));
    const nextTab = document.getElementById(`withdraw-step-${step}`);
    if(nextTab) nextTab.classList.add('active');
}

window.confirmWithdraw = async function() {
    const pin = document.getElementById('draw-pin').value;
    if (!pin) return showAlert("PIN", "Digite seu PIN de 4 dígitos.");

    const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ amount: currentWithdraw.amount, pin: pin })
    });

    const data = await res.json();
    if (data.success) {
        document.getElementById('final-draw-amount').innerText = "MT " + currentWithdraw.net.toFixed(2);
        nextWithdrawStep(3);
        loadUserData(); // Atualiza saldo real
    } else {
        showAlert("Erro", data.error || "Falha no saque.");
    }
        }

// Abrir o formulário de PIN
window.showPinForm = function() {
    goTo('sub-page-pin');
}

// Executar a troca de PIN
window.updatePinAction = async function() {
    const oldPin = document.getElementById('pin-old').value;
    const newPin = document.getElementById('pin-new').value;
    const confPin = document.getElementById('pin-conf').value;

    if(!oldPin || !newPin || !confPin) return showAlert("Atenção", "Preencha todos os campos.");
    if(newPin !== confPin) return showAlert("Erro", "O novo PIN e a confirmação não coincidem.");
    if(newPin.length < 4) return showAlert("Erro", "O PIN deve ter 4 dígitos.");

    const res = await fetch('/api/user/update-pin', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ oldPin, newPin })
    });

    const data = await res.json();
    if(res.ok) {
        showAlert("Sucesso", "O seu PIN de levantamento foi alterado!");
        await loadUserData(); // Atualiza dados na memória
        renderBankPage(); // Volta para a tela principal do banco
        goTo('sub-page-bank');
    } else {
        showAlert("Erro", data.error || "Falha ao mudar PIN.");
    }
}

// FUNÇÃO PARA CONTROLAR ACESSO AO GRUPO VIP
window.accessVipGroup = function() {
    // Verifica se o usuário tem planos ativos (plans_count vem da nossa rota /api/user/data)
    if (window.currentUser && window.currentUser.plans_count > 0) {
        // Se tem plano, abre o link do Telegram VIP
        window.open('https://t.me/seulinkvip_aqui', '_blank');
    } else {
        // Se não tem plano, mostra o alerta profissional azul marinho
        showAlert("Acesso Negado", "O Grupo VIP é exclusivo para investidores ativos. Por favor, adquira um plano de investimento para liberar o seu acesso.");
    }
}

// FUNÇÃO PARA SAIR DA CONTA DE VERDADE
window.logout = async function() {
    showAlert("Sair", "Deseja realmente sair da sua conta?", async () => {
        // 1. Limpa a memória do navegador
        localStorage.removeItem('wealth_last_page');
        localStorage.removeItem('isLogged'); // Caso você use essa marcação
        
        // 2. Avisa o servidor para encerrar a sessão
        await fetch('/api/logout');

        // 3. Volta para a tela de login
        window.location.href = "/"; 
    });
}

// 10. Inicialização Protegida e Persistência de Navegação
window.onload = async () => {
    // 1. Gera o primeiro captcha do dia
    if (typeof window.generateCaptcha === 'function') window.generateCaptcha();
    
    // 2. Verifica se o usuário veio por um link de convite (?ref=CÓDIGO)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
        // Se tiver código de convite, força ir para o Registro
        window.goTo('page-register');
        const inputInvite = document.getElementById('r_invite');
        if (inputInvite) inputInvite.value = refCode;
        return; // Para a execução aqui para focar no registro
    }

    try {
        // 3. Valida a sessão real com o servidor (Supabase)
        const res = await fetch('/api/user/data');
        
        if (res.ok) {
            // --- USUÁRIO LOGADO COM SUCESSO ---
            const lastPage = localStorage.getItem('wealth_last_page');
            
            // LISTA DE PÁGINAS PROIBIDAS: O site nunca abrirá nessas telas sozinho
            // Adicionamos 'page-support' aqui para evitar que ele fique preso nela
            const restrictedPages = ['page-login', 'page-register', 'page-support'];

            if (lastPage && !restrictedPages.includes(lastPage)) {
                // Se a última página for válida (ex: Equipe, Conta, Lucros), abre ela
                window.goTo(lastPage);
            } else {
                // Caso contrário, abre sempre a Home por segurança
                window.goTo('page-home');
            }
        } else {
            // --- USUÁRIO NÃO LOGADO OU SESSÃO EXPIROU ---
            localStorage.removeItem('wealth_last_page'); // Limpa memória antiga
            window.goTo('page-login'); // Força tela de login
        }
    } catch (e) {
        // Se o servidor estiver fora do ar ou sem internet, volta para o login
        console.error("Falha ao conectar com servidor:", e);
        window.goTo('page-login');
    }

    // 4. Configura a data de Moçambique no topo da Home
    const date = new Date();
    const dEl = document.getElementById('cur-date');
    if (dEl) {
        dEl.innerText = date.toLocaleDateString('pt-MZ', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
    }
};

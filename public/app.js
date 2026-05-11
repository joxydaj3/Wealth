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

// 2. NAVEGAÇÃO ENTRE PÁGINAS (Corrigida para carregar os planos)
window.goTo = function(pageId, btn) {
    const target = document.getElementById(pageId);
    const nav = document.getElementById('main-nav');

    if (!target) return;

    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    // Mostra a página desejada
    target.classList.add('active');
    target.style.display = 'block';

    // Gerencia o Menu Inferior
    if (nav) {
        if (pageId === 'page-login' || pageId === 'page-register') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
    }

    // Marca o botão do menu como ativo
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // GATILHOS DE CARREGAMENTO (Essencial para os planos aparecerem)
    if (pageId === 'page-home') {
        window.loadUserData();
        window.loadHomeData(); 
    }
    if (pageId === 'page-projects' || pageId === 'page-vip-list') {
        window.loadAllPlans();
    }
    if (pageId === 'page-account') {
        window.startAccountSlider();
    }
    if (pageId === 'page-login' || pageId === 'page-register') {
        window.generateCaptcha();
    }
}

// 3. CARREGAR DADOS DO USUÁRIO
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

        // Atualiza Página de Equipe
        if(document.getElementById('display-ref-id')) document.getElementById('display-ref-id').innerText = user.ref_code;
        if(document.getElementById('ref-link-input')) {
            document.getElementById('ref-link-input').value = window.location.origin + "/?ref=" + user.ref_code;
        }
        update('team-total-earned', user.total_ref);
        if(document.getElementById('team-total-count')) document.getElementById('team-total-count').innerText = user.total_team || 0;
        if(document.getElementById('lv1-count')) document.getElementById('lv1-count').innerText = user.lv1_count || 0;
        if(document.getElementById('lv2-count')) document.getElementById('lv2-count').innerText = user.lv2_count || 0;
        if(document.getElementById('lv3-count')) document.getElementById('lv3-count').innerText = user.lv3_count || 0;

        // Atualiza Página de Conta
        if(document.getElementById('acc-name-label')) document.getElementById('acc-name-label').innerText = user.name;
        if(document.getElementById('acc-phone-label')) document.getElementById('acc-phone-label').innerText = user.phone;
        if(document.getElementById('acc-balance-total')) document.getElementById('acc-balance-total').innerText = parseFloat(user.balance || 0).toFixed(2);

    } catch(e) { console.error("Erro ao carregar dados:", e); }
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

// --- AJUSTE NA FUNÇÃO GOTO ---
// Garante que os planos carreguem na Home e nos Projetos
const originalGoToFix = window.goTo;
window.goTo = function(pageId, btn) {
    if(pageId === 'page-history') loadFullHistory('all');
    if(pageId === 'page-home') loadHomeData(); // Força recarregar planos na home
    originalGoToFix(pageId, btn);
}

// 10. Inicialização Protegida (Verifica sessão real no servidor)
window.onload = async () => {
    window.generateCaptcha();
    
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    // Se tiver link de convite, vai direto para o registro
    if(refCode) {
        window.goTo('page-register');
        const inputInvite = document.getElementById('r_invite');
        if(inputInvite) inputInvite.value = refCode;
        return;
    }

    try {
        // PERGUNTA AO SERVIDOR: O usuário está logado de verdade?
        const res = await fetch('/api/user/data');
        
        if (res.ok) {
            // Se estiver logado, tenta voltar para a última página que ele viu
            const lastPage = localStorage.getItem('wealth_last_page');
            if(lastPage && lastPage !== 'page-login' && lastPage !== 'page-register') {
                window.goTo(lastPage);
            } else {
                window.goTo('page-home');
            }
        } else {
            // SE NÃO ESTIVER LOGADO (OU SESSÃO EXPIROU):
            localStorage.removeItem('wealth_last_page'); // Limpa a memória antiga
            window.goTo('page-login'); // Força a tela de login
        }
    } catch (e) {
        // Se houver erro de rede, fica no login por segurança
        window.goTo('page-login');
    }

    // Configura a data
    const date = new Date();
    const dEl = document.getElementById('cur-date');
    if(dEl) dEl.innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

let currentCaptcha = "";
window.allPlans = [];
window.currentUser = null;
let currentSlide = 0;

// 1. GERAR CAPTCHA (Forçado)
window.generateCaptcha = function() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 3; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptcha = code;
    
    // Procura a ID no HTML. Se achar, coloca o código.
    const lVal = document.getElementById('l_cap_val');
    const rVal = document.getElementById('r_cap_val');
    
    if(lVal) lVal.innerText = code;
    if(rVal) rVal.innerText = code;
}

// 2. FUNÇÃO DE LOGIN (Blindada e Organizada)
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capInElement = document.getElementById('l_cap_in');
    const captchaInput = capInElement ? capInElement.value.toUpperCase() : "";

    // 1. Validação de Campos Vazios
    if(!phone || !pass) {
        return showAlert("Atenção", "Por favor, preencha o número de telefone e a senha.");
    }

    // 2. Validação do Captcha
    if(captchaInput !== currentCaptcha) {
        showAlert("Erro", "Código de verificação (Captcha) incorreto.");
        window.generateCaptcha(); // Muda o código para segurança
        return;
    }

    try {
        // 3. Chamada para o Servidor
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone, password: pass })
        });
        
        const data = await res.json();

        if(data.success) {
            if(data.role === 'admin') {
                // Se for Admin, vai para a página de administração
                window.location.href = '/admin.html';
            } else {
                // Se for Usuário Comum:
                
                // A. Carrega os dados (Saldo, Nome, etc)
                await window.loadUserData();
                
                // B. FORÇA o menu de navegação a aparecer
                const nav = document.getElementById('main-nav');
                if(nav) {
                    nav.style.display = 'flex';
                    nav.classList.add('show-menu');
                }

                // C. Entra na Dashboard (Home)
                window.goTo('page-home');
            }
        } else {
            // Caso o servidor retorne erro (senha errada, etc)
            showAlert("Erro", data.error || "Telefone ou senha incorretos.");
            window.generateCaptcha();
        }

    } catch(e) {
        // Caso haja falha de internet ou servidor fora do ar
        showAlert("Erro", "Falha ao conectar com o servidor. Verifique sua internet.");
        console.error("Erro no login:", e);
    }
        }

// 3. COMANDO QUE FAZ TUDO ACORDAR ASSIM QUE O SITE ABRE
window.onload = () => {
    window.generateCaptcha();
    // Outras inicializações...
};

// 2. Navegação entre Páginas (SPA)
window.goTo = function(pageId, btn) {
    const target = document.getElementById(pageId);
    const nav = document.getElementById('main-nav');

    if (!target) return;

    // 1. Esconde TODAS as páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    // 2. Mostra a página desejada
    target.classList.add('active');
    target.style.display = 'block';

    // 3. Gerencia o Menu Inferior
    if (nav) {
        if (pageId === 'page-login' || pageId === 'page-register') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex'; // Mostra em todas as outras
        }
    }

    // 4. Marca o botão do menu como ativo
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 5. Carrega dados se for pra Home
    if (pageId === 'page-home') window.loadUserData();
}

// 3. Carregar Dados do Usuário (SOMA TOTAL, SEMANA, MÊS, EQUIPE E CONTA)
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

        // --- Atualiza Home e Bloco de Saldo ---
        update('u-balance', user.balance);
        update('stat-with', user.total_with);
        update('stat-week', user.week_earned);
        update('stat-month', user.month_earned);
        update('stat-total', user.total_earned);
        update('stat-ref', user.total_ref);
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;

        // --- Atualiza Página de Equipe ---
        if(document.getElementById('display-ref-id')) document.getElementById('display-ref-id').innerText = user.ref_code;
        if(document.getElementById('ref-link-input')) {
            document.getElementById('ref-link-input').value = window.location.origin + "/?ref=" + user.ref_code;
        }
        update('team-total-earned', user.total_ref);
        if(document.getElementById('team-total-count')) document.getElementById('team-total-count').innerText = user.total_team || 0;
        if(document.getElementById('lv1-count')) document.getElementById('lv1-count').innerText = user.lv1_count || 0;
        if(document.getElementById('lv2-count')) document.getElementById('lv2-count').innerText = user.lv2_count || 0;
        if(document.getElementById('lv3-count')) document.getElementById('lv3-count').innerText = user.lv3_count || 0;

        // --- Atualiza Página de Conta ---
        const nameLabel = document.getElementById('acc-name-label');
        const phoneLabel = document.getElementById('acc-phone-label');
        const balanceLabel = document.getElementById('acc-balance-total');
        
        if(nameLabel) nameLabel.innerText = user.name;
        if(phoneLabel) phoneLabel.innerText = user.phone;
        if(balanceLabel) balanceLabel.innerText = parseFloat(user.balance || 0).toFixed(2);

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
    return `
    <div class="plan-mini-card ${p.category === 'VIP' ? 'vip-card' : ''}">
        <div class="plan-info-left">
            <h5>${p.name}</h5>
            <p>Compra: <b>MT ${p.price}</b> | Dias: <b>${p.duration}</b></p>
            <p>Diário: <b>MT ${p.daily_profit}</b> | Ganho: <b>MT ${totalProfit}</b></p>
            <p>Total + Capital: <b>MT ${totalGain}</b></p>
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
        if(document.getElementById('total-collected')) document.getElementById('total-collected').innerText = window.currentUser.total_earned || "0.00";
        if(document.getElementById('total-invested')) document.getElementById('total-invested').innerText = window.currentUser.total_invested || "0.00";

        activeContainer.innerHTML = data.length === 0 ? "<p style='text-align:center; color:#8899ac; padding:20px;'>Nenhum lucro pendente hoje.</p>" : "";

        data.forEach(p => {
            const progress = (p.days_passed / p.duration) * 100;
            const btnHtml = p.claimed_today 
                ? `<button class="btn-claim" style="background:#2d3748; color:#718096; cursor:default;" disabled>✓ Recebido Hoje</button>`
                : `<button class="btn-claim" onclick="claimProfit(${p.id})">💸 Receber Lucro Hoje — MT ${p.daily_profit}</button>`;

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
    const res = await fetch('/api/user/claim-profit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userPlanId: id }) });
    if(res.ok) { showAlert("Sucesso", "Lucro coletado!"); window.loadProfitClaims(); window.loadUserData(); }
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

// 10. Inicialização e Lógica de Link de Convite
window.onload = () => {
    window.generateCaptcha();
    
    // Captura código de convite da URL (?ref=ABCDE)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if(refCode) {
        window.goTo('page-register');
        const inputInvite = document.getElementById('r_invite');
        if(inputInvite) inputInvite.value = refCode;
    } else {
        // Persistência: Volta para a última página aberta
        const lastPage = localStorage.getItem('wealth_last_page');
        if(lastPage) window.goTo(lastPage);
    }

    const date = new Date();
    const dEl = document.getElementById('cur-date');
    if(dEl) dEl.innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

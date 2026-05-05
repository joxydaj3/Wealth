let currentCaptcha = "";
let currentSlide = 0;

// 1. Gerador de Captcha (Estilo Imagem)
window.generateCaptcha = function() {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removido 0, 1, I, O para evitar confusão
    let code = "";
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    currentCaptcha = code;
    
    if(document.getElementById('l_cap_val')) document.getElementById('l_cap_val').innerText = code;
    if(document.getElementById('r_cap_val')) document.getElementById('r_cap_val').innerText = code;
}

// 2. Navegação com Persistência
window.goTo = function(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if(target) target.classList.add('active');

    // Salva a página atual para não perder no refresh
    sessionStorage.setItem('lastPage', pageId);

    const nav = document.getElementById('main-nav');
    const isAuth = (pageId === 'page-login' || pageId === 'page-register');
    if(nav) nav.style.display = isAuth ? 'none' : 'flex';

    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if(pageId === 'page-home') loadUserData();
    if(pageId === 'page-account') window.startAccountSlider();
    if(isAuth) window.generateCaptcha();
}

// 3. Login
window.handleLogin = async function() {
    const phone = document.getElementById('l_phone').value;
    const pass = document.getElementById('l_pass').value;
    const capIn = document.getElementById('l_cap_in').value.toUpperCase();

    if(capIn !== currentCaptcha) { alert("Captcha incorreto!"); return window.generateCaptcha(); }

    const res = await fetch('/api/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, password: pass })
    });
    const data = await res.json();
    if(data.success) {
        if(data.role === 'admin') window.location.href = '/admin.html';
        else goTo('page-home');
    } else alert("Dados incorretos!");
}

// 4. Carregar Dados Completo
window.loadUserData = async function() {
    try {
        const res = await fetch('/api/user/data');
        if(!res.ok) return;
        const user = await res.json();
        
        const update = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = parseFloat(val || 0).toFixed(2); };

        update('u-balance', user.balance);
        update('stat-with', user.total_with);
        update('stat-week', user.week_earned);
        update('stat-month', user.month_earned);
        update('stat-total', user.total_earned);
        update('stat-ref', user.total_ref);

        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = user.name;
        if(document.getElementById('acc-name-label')) document.getElementById('acc-name-label').innerText = user.name;
        if(document.getElementById('acc-phone-label')) document.getElementById('acc-phone-label').innerText = user.phone;
        if(document.getElementById('acc-balance-total')) document.getElementById('acc-balance-total').innerText = parseFloat(user.balance).toFixed(2);
        
        if(document.getElementById('display-ref-id')) document.getElementById('display-ref-id').innerText = user.ref_code;
        if(document.getElementById('ref-link-input')) document.getElementById('ref-link-input').value = window.location.origin + "/?ref=" + user.ref_code;

    } catch(e) { console.error(e); }
}

// 5. Check-in
window.doCheckin = async function() {
    const res = await fetch('/api/user/checkin', { method: 'POST' });
    const data = await res.json();
    if (res.ok) { showAlert("Sucesso", `Ganhou MT ${data.amount}!`); loadUserData(); }
    else showAlert("Erro", data.error);
}

// 6. Slider
window.startAccountSlider = function() {
    const wrapper = document.getElementById('account-slider-wrapper');
    if(!wrapper || window.sliderRunning) return;
    window.sliderRunning = true;
    setInterval(() => {
        currentSlide = (currentSlide + 1) % 4;
        wrapper.style.transform = `translateX(-${currentSlide * 25}%)`;
    }, 4000);
}

// Inicialização e Captura de Convite
window.onload = () => {
    window.generateCaptcha();
    
    // Captura o convite da URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if(ref) {
        sessionStorage.setItem('pendingRef', ref);
        window.goTo('page-register');
        setTimeout(() => { if(document.getElementById('r_invite')) document.getElementById('r_invite').value = ref; }, 500);
    } else {
        // Volta para a última página aberta antes do refresh
        const lastPage = sessionStorage.getItem('lastPage');
        if(lastPage && lastPage !== 'page-login') window.goTo(lastPage);
    }
};

// Funções de Alerta (Wealth Modal)
window.showAlert = (title, text) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    document.getElementById('wealth-modal').style.display = 'flex';
    document.getElementById('modal-ok').onclick = () => closeWealthModal();
};
window.closeWealthModal = () => document.getElementById('wealth-modal').style.display = 'none';

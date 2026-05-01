let currentCaptcha = "";

// Função para Gerar Captcha
function generateCaptcha() {
    const chars = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    currentCaptcha = code;
    if (document.getElementById('l-cap-val')) document.getElementById('l-cap-val').innerText = code;
    if (document.getElementById('r-cap-val')) document.getElementById('r-cap-val').innerText = code;
}

// Trocar Páginas
function showPage(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    const nav = document.getElementById('main-nav');
    nav.style.display = (pageId === 'page-login' || pageId === 'page-register') ? 'none' : 'flex';

    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    
    if(pageId === 'page-home') loadUserData();
    if(pageId === 'page-login' || pageId === 'page-register') generateCaptcha();
}

// FUNÇÃO ENTRAR (LOGIN)
async function doLogin() {
    const phone = document.getElementById('l-phone').value;
    const pass = document.getElementById('l-pass').value;
    const capIn = document.getElementById('l-cap-in').value.toUpperCase();

    if (!phone || !pass) return alert("Preencha todos os campos!");
    if (capIn !== currentCaptcha) {
        alert("Captcha Incorreto!");
        return generateCaptcha();
    }

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, password: pass })
    });

    const data = await res.json();
    if(data.success) {
        if(data.role === 'admin') window.location.href = '/admin.html';
        else showPage('page-home');
    } else {
        alert("Telefone ou Senha incorretos!");
        generateCaptcha();
    }
}

// FUNÇÃO REGISTRAR
async function doRegister() {
    const phone = document.getElementById('r-phone').value;
    const name = document.getElementById('r-name').value;
    const pass = document.getElementById('r-pass').value;
    const conf = document.getElementById('r-confirm').value;
    const capIn = document.getElementById('r-cap-in').value.toUpperCase();

    if (!phone || !name || !pass) return alert("Preencha tudo!");
    if (pass !== conf) return alert("Senhas não coincidem!");
    if (capIn !== currentCaptcha) {
        alert("Captcha Incorreto!");
        return generateCaptcha();
    }

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            phone, 
            name, 
            password: pass, 
            invite: document.getElementById('r-invite').value 
        })
    });

    if(res.ok) {
        alert("Conta criada com sucesso! Faça login.");
        showPage('page-login');
    } else {
        alert("Erro ao registrar. Telefone pode já existir.");
        generateCaptcha();
    }
}

// Carregar Dados
async function loadUserData() {
    const res = await fetch('/api/user/data');
    if(!res.ok) return showPage('page-login');
    const user = await res.json();
    document.getElementById('u-name').innerText = user.name;
    document.getElementById('u-balance').innerText = user.balance.toFixed(2);
    // Adicione aqui a carga de planos e outras infos...
}

window.onload = () => {
    generateCaptcha();
    const date = new Date();
    document.getElementById('cur-date').innerText = date.toLocaleDateString('pt-MZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

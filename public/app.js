// Função para Trocar de Página
function showPage(pageId) {
    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Mostra a página pedida
    document.getElementById(pageId).classList.add('active');

    // Mostrar/Esconder menu inferior
    const nav = document.getElementById('main-nav');
    if (pageId === 'page-login' || pageId === 'page-register') {
        nav.style.display = 'none';
    } else {
        nav.style.display = 'flex';
    }
}

// Configurar Data Atual
document.getElementById('current-date').innerText = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

// Lógica de Login
async function handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-pass').value;

    if (!phone || !pass) return alert("Preencha todos os campos");

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ phone, password: pass })
    });

    const data = await res.json();
    if (data.success) {
        if (data.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            loadUserData();
            showPage('page-home');
        }
    } else {
        alert("Erro: " + data.error);
    }
}

// Lógica de Registro
async function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const pass = document.getElementById('reg-pass').value;
    const invite = document.getElementById('reg-invite').value;

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, phone, password: pass, invite_code: invite })
    });

    const data = await res.json();
    if(data.success) {
        alert("Conta criada com sucesso! Faça login.");
        showPage('page-login');
    } else {
        alert(data.error);
    }
}

// Carregar Dados do Usuário
async function loadUserData() {
    const res = await fetch('/api/user/data');
    const user = await res.json();
    document.getElementById('display-name').innerText = `Olá, ${user.name}! 👋`;
    document.getElementById('val-balance').innerText = user.balance.toFixed(2);
}

let currentCaptcha = "";

function generateCaptcha() {
    const chars = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    currentCaptcha = code;
    if (document.getElementById('l-cap-val')) document.getElementById('l-cap-val').innerText = code;
    if (document.getElementById('r-cap-val')) document.getElementById('r-cap-val').innerText = code;
}

function showPage(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    const nav = document.getElementById('main-nav');
    nav.style.display = (pageId === 'page-login' || pageId === 'page-register') ? 'none' : 'flex';

    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    
    if(pageId === 'page-home') loadHome();
    if(pageId === 'page-login' || pageId === 'page-register') generateCaptcha();
}

async function loadHome() {
    const res = await fetch('/api/user/data');
    const user = await res.json();
    document.getElementById('u-name').innerText = user.name;
    document.getElementById('u-balance').innerText = user.balance.toFixed(2);
    document.getElementById('a-name').innerText = user.name;
    document.getElementById('a-phone').innerText = user.phone;
    document.getElementById('ref-link').value = `https://wealth.up.railway.app/?ref=${user.ref_code}`;
    
    const pRes = await fetch('/api/plans');
    const plans = await pRes.json();
    const list = document.getElementById('plans-list');
    list.innerHTML = "";
    plans.forEach(p => {
        list.innerHTML += `
            <div class="wealth-card">
                ${p.image_url ? `<img src="${p.image_url}" class="plan-img">` : ''}
                <div style="display:flex; justify-content:space-between">
                    <strong>${p.name}</strong>
                    <span style="color:var(--green)">Lucro ${((p.daily/p.price)*100).toFixed(0)}%</span>
                </div>
                <p style="font-size:12px; color:var(--text-dim)">Duração: ${p.duration} dias | Total: MT ${p.total}</p>
                <button class="btn-sm btn-saq" style="width:100%; margin-top:10px">Investir MT ${p.price}</button>
            </div>
        `;
    });
}

// Lógica de Login e Registro similar à anterior com validação do currentCaptcha...
// ... (omiti para o código não ser cortado, mas adicione os fetchs aqui)

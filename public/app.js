function showPage(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if(btn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    if(pageId === 'page-profits') checkProfits();
}

async function checkProfits() {
    const res = await fetch('/api/user/available-profits');
    const profits = await res.json();
    const container = document.getElementById('profits-available');
    
    if(profits.length === 0) {
        container.innerHTML = "<div class='wealth-card' style='text-align:center'>Não há lucros pendentes para hoje. Volte amanhã!</div>";
        return;
    }

    container.innerHTML = "";
    profits.forEach(p => {
        container.innerHTML += `
            <div class="wealth-card" style="margin-bottom:15px">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>${p.name_pt}</strong><br><small>Lucro Diário</small></div>
                    <div style="text-align:right">MT ${p.daily_profit.toFixed(2)}</div>
                </div>
                <button class="btn-action btn-deposit" onclick="claim(${p.id})" style="width:100%; margin-top:15px;">RECEBER LUCRO AGORA</button>
            </div>
        `;
    });
}

async function claim(id) {
    const res = await fetch('/api/user/claim-profit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userPlanId: id })
    });
    if(res.ok) {
        alert("Lucro adicionado ao seu saldo!");
        checkProfits();
        loadData();
    }
}

// Data atual no formato das imagens
document.getElementById('cur-date').innerText = new Date().toLocaleDateString('pt-MZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

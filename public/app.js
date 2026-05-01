function showPage(pageId, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if(btn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if(pageId === 'page-profits') loadProfits();
}

async function loadProfits() {
    const res = await fetch('/api/user/check-profits');
    const data = await res.json();
    const container = document.getElementById('profit-claims');
    
    if(data.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>Você não tem lucros para coletar hoje.</p>";
        return;
    }

    container.innerHTML = "";
    data.forEach(p => {
        container.innerHTML += `
            <div class="card-glass" style="margin-bottom:10px;">
                <p>Plano: ${p.name}</p>
                <p>Valor: <strong>MT ${p.daily_profit.toFixed(2)}</strong></p>
                <button class="btn-blue" onclick="claimProfit(${p.id})">RECEBER AGORA</button>
            </div>
        `;
    });
}

async function claimProfit(id) {
    const res = await fetch('/api/user/claim-profit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userPlanId: id })
    });
    if(res.ok) {
        alert("Dinheiro recebido com sucesso!");
        loadProfits();
        updateBalance();
    }
}

// Outras funções de Login e Balanço mantêm a lógica anterior conectada às novas IDs do HTML.

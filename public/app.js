let timeLeft = 300; // 5 minutos

let timerId;



function startDepositTimer() {

    timerId = setInterval(() => {

        timeLeft--;

        let mins = Math.floor(timeLeft / 60);

        let secs = timeLeft % 60;

        document.getElementById('deposit-timer').innerText = 

            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        

        if (timeLeft <= 0) {

            clearInterval(timerId);

            document.getElementById('send-dep-btn').style.display = 'none';

            alert('Tempo esgotado! O depósito foi cancelado automaticamente.');

            location.reload();

        }

    }, 1000);

}



// Lógica de Login/Navegação baseada no texto fornecido

async function login() {

    const phone = document.getElementById('phone').value;

    const pass = document.getElementById('pass').value;



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

            document.getElementById('auth-page').style.display = 'none';

            document.getElementById('main-dashboard').style.display = 'block';

            loadUserData();

        }

    } else {

        alert('Erro ao entrar');

    }

}



function openDeposit() {

    document.getElementById('deposit-modal').style.display = 'flex';

    startDepositTimer();

    }

// SOLUSI: 
// Kita tidak lagi mendeklarasikan API_URL, token, atau user.
// Variabel-variabel tersebut sekarang datang dari 'utils.js',
// yang harus dimuat SEBELUM file ini di login.html.

// --- Logika Pengecekan Sesi (Redirect) ---

// Variabel 'token' dan 'user' (objek) sekarang datang dari utils.js
if (token && user) {
    try {
        // 'user' sudah di-parse di utils.js
        let destination = 'dashboard.html'; // Default untuk student

        if (user.role === 'instructor') {
            destination = 'instructor-dashboard.html';
        }
        
        // Pindahkan ke halaman yang benar
        window.location.href = destination; 

    } catch (e) {
        // Jika data 'user' di localStorage rusak, utils.js 
        // mungkin error saat parse. Kita amankan dengan hapus token.
        console.error("Gagal memproses redirect otomatis:", e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

// --- Logika Form Login ---
// Menunggu DOM (halaman HTML) siap
document.addEventListener('DOMContentLoaded', () => {
    
    const loginForm = document.getElementById('loginForm');
    
    // Pastikan form ada
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');
            
            // Bersihkan pesan error sebelumnya
            messageDiv.textContent = '';
            messageDiv.style.display = 'none';

            try {
                // 'API_URL' sekarang datang dari utils.js
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Berhasil login, simpan data sesi
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Arahkan ke dashboard yang sesuai
                    let destination = 'dashboard.html'; 
                    if (data.user.role === 'instructor') {
                        destination = 'instructor-dashboard.html';
                    }
                    window.location.href = destination; 

                } else {
                    // Tampilkan pesan error dari server
                    messageDiv.textContent = data.error || 'Login gagal';
                    messageDiv.style.display = 'block';
                }
            } catch (error) {
                // Gagal terhubung ke server
                console.error('Error saat login:', error);
                messageDiv.textContent = 'Tidak bisa terhubung ke server.';
                messageDiv.style.display = 'block';
            }
        });
    }
});
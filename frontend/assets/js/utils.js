// URL API Gateway Anda
const API_URL = 'http://localhost:3000/api';

// Ambil token dan user dari localStorage
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

/**
 * Menampilkan pesan di elemen #message.
 * @param {string} message - Teks pesan yang akan ditampilkan.
 * @param {string} type - Tipe alert (default: 'danger').
 * @param {string} elementId - ID elemen target (default: 'message').
 */
function setMessage(message, type = 'danger', elementId = 'message') {
    // SOLUSI: Fungsi ini sekarang bisa menargetkan ID apa pun,
    // membuatnya lebih fleksibel.
    const messageEl = document.getElementById(elementId);
    if (!messageEl) return;

    messageEl.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    
    // Tampilkan elemen jika sebelumnya disembunyikan
    messageEl.style.display = 'block';

    // Sembunyikan pesan setelah 3 detik
    setTimeout(() => {
        messageEl.innerHTML = '';
        messageEl.style.display = 'none';
    }, 3000);
}

/**
 * Fungsi helper untuk fetch API (dengan Token).
 * @param {string} endpoint - Endpoint API (misal: '/courses').
 * @param {object} options - Opsi untuk fetch (method, body, dll.).
 * @returns {Promise<any>} - Respon JSON atau teks.
 */
async function fetchAPI(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const config = { ...options, headers: { ...defaultHeaders, ...options.headers } };

    if (!token) {
        window.location.href = 'login.html';
        return Promise.reject(new Error("No token found"));
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, config);

    // Otomatis logout HANYA JIKA token tidak valid (401)
    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
    
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
        const errorData = (contentType && contentType.indexOf("application/json") !== -1) 
                            ? await response.json() 
                            : { error: `Error ${response.status}` };
        throw new Error(errorData.error || `Terjadi kesalahan ${response.status}`);
    }

    // Handle jika respon tidak ada konten (misal: 204 No Content)
    if (response.status === 204) {
        return null;
    }

    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return response.text();
    }
}
// URL API Gateway Anda
const API_URL = 'http://localhost:3000/api';

// Ambil token dan user dari localStorage
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Elemen UI
const courseListEl = document.getElementById('courseList');
const myEnrollmentListEl = document.getElementById('myEnrollmentList');
const userInfoEl = document.getElementById('userInfo');
const messageEl = document.getElementById('message');

// Fungsi untuk menampilkan pesan
function setMessage(message, type = 'danger') {
    if (!messageEl) return;
    messageEl.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    
    setTimeout(() => {
        messageEl.innerHTML = '';
        messageEl.style.display = 'none';
    }, 3000);
    messageEl.style.display = 'block';
}

// Fungsi helper untuk fetch API (dengan Token)
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

    if (response.status === 401 || response.status === 403) {
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

    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return response.text();
    }
}

// Mengambil dan menampilkan semua kursus
async function loadCourses() {
    if (!courseListEl) return;
    try {
        const courses = await fetchAPI('/courses'); 
        courseListEl.innerHTML = ''; 
        
        if (courses.length === 0) {
            courseListEl.innerHTML = '<p class="text-muted">Belum ada kursus yang tersedia.</p>';
            return;
        }

        courses.forEach(course => {
            const col = document.createElement('div');
            col.className = 'col';

            // ==============================================
            // PERUBAHAN DI SINI: ?id= menjadi #id=
            // ==============================================
            col.innerHTML = `
                <a href="course-detail.html#id=${course.id}" class="card h-100 course-card text-decoration-none text-dark">
                    <img src="${course.thumbnail_url || 'https://via.placeholder.com/300x200.png?text=Kursus'}" class="card-img-top" alt="${course.title}">
                    <div class="card-body">
                        <h5 class="card-title">${course.title}</h5>
                        <p class="card-text text-muted">${(course.description || '').substring(0, 100)}...</p>
                    </div>
                    <div class="card-footer bg-transparent">
                        <small class="text-muted">${course.category || 'Umum'}</small>
                    </div>
                </a>
            `;
            courseListEl.appendChild(col);
        });
    } catch (error) {
        courseListEl.innerHTML = `<div class="col"><div class="alert alert-danger">Gagal memuat kursus: ${error.message}</div></div>`;
    }
}

// Mengambil dan menampilkan kursus yang sudah di-enroll
async function loadMyEnrollments() {
    if (!myEnrollmentListEl) return;
    try {
        const enrollments = await fetchAPI('/enrollments/my-enrollments'); 
        
        if (enrollments.length === 0) {
            myEnrollmentListEl.innerHTML = '<li class="list-group-item text-muted">Anda belum mendaftar kursus apapun.</li>';
            return;
        }

        const allCourses = await fetchAPI('/courses');
        const courseMap = new Map(allCourses.map(course => [course.id, course.title]));

        myEnrollmentListEl.innerHTML = '';
        
        enrollments.forEach(enroll => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            const courseTitle = courseMap.get(enroll.course_id) || `Kursus (ID: ${enroll.course_id})`;
            
            // ==============================================
            // PERUBAHAN DI SINI: ?id= menjadi #id=
            // ==============================================
            li.innerHTML = `
                <a href="course-detail.html#id=${enroll.course_id}" class="text-decoration-none">
                    ${courseTitle}
                    <span class="badge bg-secondary float-end">${enroll.status}</span>
                </a>
            `;
            myEnrollmentListEl.appendChild(li);
        });
    } catch (error) {
        myEnrollmentListEl.innerHTML = '<li class="list-group-item list-group-item-danger">Gagal memuat kursus Anda.</li>';
    }
}

// --- MAIN LOGIC (Hanya berjalan jika di dashboard.html) ---
if (userInfoEl) {
    if (!token || !user) {
        window.location.href = 'login.html';
    } else {
        userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });

        loadCourses();
        loadMyEnrollments();
    }
}
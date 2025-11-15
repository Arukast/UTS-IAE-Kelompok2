// enrollment.js
// Keterangan: API_URL, token, user, fetchAPI, dan setMessage dimuat dari utils.js

// --- 1. Ambil ID Kursus & Lesson dari URL ---
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const courseId = urlParams.get("courseId");
let currentLessonId = urlParams.get("lessonId"); // ID materi yang sedang aktif

// --- Elemen UI ---
const lessonTitleEl = document.getElementById("lesson-title");
const moduleTitleEl = document.getElementById("module-title");
const lessonContentEl = document.getElementById("lesson-content");
const courseTitleSidebarEl = document.getElementById("course-title-sidebar");
const currentLessonInfoEl = document.getElementById("current-lesson-info");
const moduleLessonListEl = document.getElementById("module-lesson-list");

const prevButton = document.getElementById("prev-lesson-button");
const nextButton = document.getElementById("next-lesson-button");
const markCompleteButton = document.getElementById("mark-complete-button");

let courseData = null; // Menyimpan seluruh data kursus
let progressData = null; // Menyimpan data progres siswa
let allLessons = []; // Array datar semua materi (untuk navigasi)

// --- 2. Verifikasi & Setup Awal ---
if (!token || !user) {
  window.location.href = "login.html";
} else if (!courseId) {
  alert("ID Kursus tidak ditemukan!");
  window.location.href = "dashboard.html";
} else {
  // Setup Info User
  const userInfoEl = document.getElementById("userInfo");
  if (userInfoEl) {
    userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  // Panggil fungsi utama
  loadEnrollmentData();
}

// --- 3. Fungsi Utama: Muat Data Enrollment & Konten ---
async function loadEnrollmentData() {
  setMessage("Memuat data kursus...", "info");

  try {
    // 1. Ambil data kursus (termasuk modul & lesson)
    courseData = await fetchAPI(`/courses/${courseId}`);

    // 2. Ambil data progres siswa (untuk menentukan completed)
    progressData = await fetchAPI(`/progress/my-progress/${courseId}`);

    // Cek apakah siswa sudah mendaftar, jika tidak, arahkan ke detail kursus
    if (!progressData || progressData.course_id !== parseInt(courseId)) {
      setMessage("Anda belum mendaftar kursus ini. Mengalihkan...", "danger");
      setTimeout(() => {
        window.location.href = `course-detail.html#id=${courseId}`;
      }, 2000);
      return;
    }

    // 3. Bangun daftar datar semua materi untuk navigasi mudah
    allLessons = flattenLessons(courseData.Modules);

    // 4. Tentukan lesson pertama jika belum ada di URL
    if (!currentLessonId && allLessons.length > 0) {
      currentLessonId = allLessons[0].id;
      // Update URL tanpa memuat ulang
      window.history.replaceState(null, null, `enrollment.html#courseId=${courseId}&lessonId=${currentLessonId}`);
    } else if (allLessons.length === 0) {
      setMessage("Kursus ini belum memiliki materi. Silakan periksa kembali nanti.", "info");
      return;
    }

    // 5. Render halaman
    renderPage();
    setMessage("", "info"); // Hapus pesan 'Memuat...'
  } catch (error) {
    // Jika gagal memuat progress, kemungkinan belum enroll
    if (error.message.includes("404") || error.message.includes("403")) {
      setMessage("Anda belum mendaftar kursus ini. Mengalihkan...", "danger");
      setTimeout(() => {
        window.location.href = `course-detail.html#id=${courseId}`;
      }, 2000);
    } else {
      setMessage(`Gagal memuat enrollment: ${error.message}`, "danger");
    }
  }
}

// --- 4. Fungsi Render Halaman ---
function renderPage() {
  if (!courseData || !progressData || !currentLessonId) return;

  // A. Setup Sidebar
  courseTitleSidebarEl.textContent = courseData.title || "Kursus";
  document.getElementById("page-title").textContent = `Materi: ${courseData.title}`;
  renderSidebarLessons();

  // B. Tampilkan Konten Materi Aktif
  const currentLesson = allLessons.find((l) => l.id == currentLessonId);
  if (!currentLesson) {
    lessonTitleEl.textContent = "Materi Tidak Ditemukan";
    moduleTitleEl.textContent = "Modul Tidak Ditemukan";
    lessonContentEl.innerHTML = '<p class="alert alert-warning">Materi dengan ID ini tidak ditemukan dalam kursus.</p>';
    return;
  }

  // Temukan modul induk untuk informasi
  const parentModule = courseData.Modules.find((m) => m.id === currentLesson.module_id);

  // Set Judul
  lessonTitleEl.textContent = currentLesson.title || "Materi Tanpa Judul";
  currentLessonInfoEl.textContent = `${parentModule.title || "Modul"}: ${currentLesson.title}`;
  moduleTitleEl.textContent = `dari ${parentModule.title || "Modul Tanpa Judul"}`;

  // Tampilkan konten
  displayLessonContent(currentLesson);

  // C. Setup Navigasi & Progres
  setupLessonNavigation(currentLesson);
  setupMarkCompleteButton(currentLesson);

  // D. Update URL agar Lesson ID selalu benar saat konten dimuat
  window.history.replaceState(null, null, `enrollment.html#courseId=${courseId}&lessonId=${currentLesson.id}`);
}

// --- 5. Fungsi Helper: Flatten Lessons ---
function flattenLessons(modules) {
  const lessons = [];
  modules
    .sort((a, b) => a.module_order - b.module_order)
    .forEach((module) => {
      if (module.Lessons) {
        module.Lessons.sort((a, b) => a.lesson_order - b.lesson_order).forEach((lesson) => {
          // Tambahkan module_id untuk referensi
          lessons.push({ ...lesson, module_id: module.id });
        });
      }
    });
  return lessons;
}

// --- 6. Fungsi Render Sidebar Lessons ---
function renderSidebarLessons() {
  moduleLessonListEl.innerHTML = "";
  const completedLessonIds = new Set((progressData?.completed_lessons || []).map((lesson) => lesson.lesson_id));

  courseData.Modules.sort((a, b) => a.module_order - b.module_order).forEach((module) => {
    // Judul Modul (Header)
    const moduleHeader = document.createElement("li");
    moduleHeader.className = "list-group-item list-group-item-secondary fw-bold mt-2";
    moduleHeader.innerHTML = `<i class="bi bi-collection-fill me-2"></i> ${module.title}`;
    moduleLessonListEl.appendChild(moduleHeader);

    // Daftar Materi
    if (module.Lessons && module.Lessons.length > 0) {
      module.Lessons.sort((a, b) => a.lesson_order - b.lesson_order).forEach((lesson) => {
        const isCompleted = completedLessonIds.has(lesson.id);
        const isActive = lesson.id == currentLessonId;

        let icon;
        if (isCompleted) icon = "bi-check-circle-fill text-success";
        else if (lesson.content_type === "video") icon = "bi-play-circle";
        else if (lesson.content_type === "quiz") icon = "bi-patch-question";
        else icon = "bi-file-text";

        const li = document.createElement("li");
        li.className = `list-group-item lesson-item ${isActive ? "active-lesson" : ""} ${isCompleted ? "list-group-item-success" : ""}`;
        li.innerHTML = `
                    <a href="enrollment.html#courseId=${courseId}&lessonId=${lesson.id}" class="text-decoration-none d-flex align-items-center ${isActive ? "text-white" : "text-dark"}">
                        <i class="bi ${icon} me-2 ${isActive ? "text-white" : ""}"></i>
                        <span class="flex-grow-1">${lesson.title}</span>
                    </a>
                `;
        moduleLessonListEl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.className = "list-group-item text-muted small";
      li.textContent = "Tidak ada materi.";
      moduleLessonListEl.appendChild(li);
    }
  });
}

// --- 7. Fungsi Tampilkan Konten Lesson ---
function displayLessonContent(lesson) {
  lessonContentEl.innerHTML = ""; // Bersihkan konten lama

  if (lesson.content_type === "video") {
    const videoUrl = lesson.content_url_or_text;
    let embedUrl = "";

    // Logika sederhana untuk embed YouTube
    if (videoUrl && videoUrl.includes("youtube.com/watch?v=")) {
      const videoId = videoUrl.split("v=")[1].split("&")[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (videoUrl && videoUrl.includes("youtu.be/")) {
      const videoId = videoUrl.split("youtu.be/")[1].split("?")[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else {
      // Konten video tidak valid
      lessonContentEl.innerHTML = `<div class="p-4"><p class="alert alert-warning">URL video tidak valid atau tidak didukung.</p></div>`;
      return;
    }

    lessonContentEl.innerHTML = `
            <div class="ratio ratio-16x9">
                <iframe src="${embedUrl}" title="${lesson.title}" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>
            </div>
            <div class="p-4">
                <h4>Deskripsi Video</h4>
                <p class="text-muted">Tonton video di atas untuk memahami materi ini. Setelah selesai, klik "Tandai Selesai".</p>
            </div>
        `;
  } else if (lesson.content_type === "text") {
    lessonContentEl.innerHTML = `
            <div class="p-4 lesson-text-content">
                <div class="alert alert-info d-flex align-items-center" role="alert">
                    <i class="bi bi-file-text-fill me-2 fs-4"></i>
                    <div>
                        Ini adalah materi dalam format **Teks**.
                    </div>
                </div>
                <div class="mt-4">${lesson.content_url_or_text || '<p class="text-muted">Konten teks belum diisi.</p>'}</div>
            </div>
        `;
  } else if (lesson.content_type === "quiz") {
    lessonContentEl.innerHTML = `
            <div class="p-4 lesson-quiz-content">
                <div class="alert alert-warning d-flex align-items-center" role="alert">
                    <i class="bi bi-patch-question-fill me-2 fs-4"></i>
                    <div>
                        Ini adalah materi **Kuis**. Selesaikan kuis untuk melanjutkan!
                    </div>
                </div>
                <p>Kuis ini dapat diakses melalui link berikut:</p>
                <a href="${lesson.content_url_or_text}" target="_blank" class="btn btn-warning btn-lg">
                    <i class="bi bi-box-arrow-up-right me-2"></i> Akses Kuis
                </a>
                <p class="mt-3 text-muted">Setelah menyelesaikan kuis, kembali ke halaman ini dan klik "Tandai Selesai".</p>
            </div>
        `;
  } else {
    lessonContentEl.innerHTML = `<div class="p-4"><p class="alert alert-warning">Tipe konten tidak dikenal: ${lesson.content_type}</p></div>`;
  }
}

// --- 8. Fungsi Setup Navigasi ---
function setupLessonNavigation(currentLesson) {
  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
  const prevLesson = allLessons[currentIndex - 1];
  const nextLesson = allLessons[currentIndex + 1];

  // Tombol Sebelumnya
  if (prevLesson) {
    prevButton.disabled = false;
    prevButton.onclick = () => {
      window.location.href = `enrollment.html#courseId=${courseId}&lessonId=${prevLesson.id}`;
    };
  } else {
    prevButton.disabled = true;
    prevButton.onclick = null;
  }

  // Tombol Selanjutnya
  if (nextLesson) {
    nextButton.disabled = false;
    nextButton.onclick = () => {
      window.location.href = `enrollment.html#courseId=${courseId}&lessonId=${nextLesson.id}`;
    };
  } else {
    nextButton.disabled = true;
    nextButton.onclick = null;
  }
}

// --- 9. Fungsi Setup Tombol Tandai Selesai ---
function setupMarkCompleteButton(currentLesson) {
  const completedLessonIds = new Set((progressData?.completed_lessons || []).map((lesson) => lesson.lesson_id));
  const isCompleted = completedLessonIds.has(currentLesson.id);

  if (isCompleted) {
    markCompleteButton.textContent = "Materi Sudah Selesai";
    markCompleteButton.className = "btn btn-success btn-lg";
    markCompleteButton.disabled = true;
    markCompleteButton.onclick = null;
  } else {
    markCompleteButton.textContent = "Tandai Selesai";
    markCompleteButton.className = "btn btn-primary btn-lg";
    markCompleteButton.disabled = false;
    markCompleteButton.onclick = () => markLessonAsComplete(currentLesson.id);
  }
}

// --- 10. Fungsi Mark Lesson As Complete ---
async function markLessonAsComplete(lessonId) {
  markCompleteButton.textContent = "Memproses...";
  markCompleteButton.disabled = true;

  try {
    await fetchAPI("/progress/lessons/complete", {
      method: "POST",
      body: JSON.stringify({
        lesson_id: lessonId,
        course_id: courseId,
      }),
    });

    setMessage("Progres berhasil disimpan! Memuat materi selanjutnya...", "success");

    // Coba langsung pindah ke materi selanjutnya
    const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
    const nextLesson = allLessons[currentIndex + 1];

    if (nextLesson) {
      setTimeout(() => {
        window.location.href = `enrollment.html#courseId=${courseId}&lessonId=${nextLesson.id}`;
        window.location.reload(); // Memaksa refresh untuk memuat data baru
      }, 1000);
    } else {
      // Jika tidak ada materi lagi, muat ulang halaman saat ini
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (error) {
    setMessage(`Gagal menyimpan progres: ${error.message}`, "danger");
    setupMarkCompleteButton(allLessons.find((l) => l.id === lessonId)); // Kembalikan tombol ke keadaan semula
  }
}

// --- 11. Listener untuk Navigasi Berdasarkan Perubahan Hash (jika di-klik di sidebar) ---
window.addEventListener("hashchange", () => {
  const newHash = window.location.hash.substring(1);
  const newParams = new URLSearchParams(newHash);
  const newLessonId = newParams.get("lessonId");

  // Hanya muat ulang konten jika lessonId berubah dan courseId sama
  if (newLessonId && newLessonId != currentLessonId && newParams.get("courseId") == courseId) {
    currentLessonId = newLessonId;
    renderPage();
  }
});

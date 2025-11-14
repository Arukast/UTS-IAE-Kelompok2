require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

// --- 1. Konfigurasi Awal ---
const app = express();
const PORT = process.env.PORT || 3004;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!API_GATEWAY_URL || !DATABASE_URL) {
  throw new Error("FATAL_ERROR: API_GATEWAY_URL dan DATABASE_URL tidak ada di .env");
}

const isProduction = process.env.NODE_ENV === 'production';

// --- 2. Middleware Global ---
app.use(cors());
app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// --- 3. Database (Sequelize + SQLite) ---
const sequelize = new Sequelize(DATABASE_URL, {
  logging: isProduction ? false : console.log,
});

// Model LessonProgress
const LessonProgress = sequelize.define('LessonProgress', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  enrollment_id: { type: DataTypes.INTEGER, allowNull: false },
  lesson_id: { type: DataTypes.INTEGER, allowNull: false }, 
  is_completed: { type: DataTypes.BOOLEAN, defaultValue: true },
  completed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'lesson_progress',
  timestamps: false,
  indexes: [
    // Mencegah duplikat: satu user hanya bisa menyelesaikan satu materi satu kali
    {
      unique: true,
      fields: ['enrollment_id', 'lesson_id']
    }
  ]
});

// Model Grade (untuk Kuis)
const Grade = sequelize.define('Grade', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  enrollment_id: { type: DataTypes.INTEGER, allowNull: false },
  lesson_id: { type: DataTypes.INTEGER, allowNull: false }, // ID materi (Kuis)
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: false } // Skor 0-100.00
}, {
  tableName: 'grades',
  timestamps: true // Kapan nilai dicatat
});

// --- 4. Utilitas (Helpers) ---

/**
 * Wrapper untuk menangani error pada async route handlers.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware untuk mengekstrak dan memvalidasi header autentikasi
 * yang diteruskan oleh API Gateway.
 */
const checkAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const token = req.headers.authorization;

  if (!userId || !token) {
    // 401 Unauthorized (Header tidak ada)
    return res.status(401).json({ 
      error: 'Autentikasi diperlukan. Header X-User-Id atau Token tidak ada.' 
    });
  }

  // Lampirkan ke request agar bisa digunakan oleh rute
  req.userId = userId;
  req.token = token;
  next();
};

/**
 * [CONSUMER] Helper untuk memvalidasi enrollment via Enrollment Service
 * @returns {Promise<number>} enrollment_id
 */
async function getEnrollmentId(token, courseId, userId) {
  try {
    const response = await axios.get(`${API_GATEWAY_URL}/api/enrollments/check`, {
      params: { courseId: courseId },
      headers: {
        Authorization: token,
        'X-User-Id': userId 
      }
    });
    return response.data.id; // Mengembalikan enrollment_id
  } catch (error) {
    console.error('Gagal memvalidasi enrollment:', error.message);
    if (error.response && error.response.status === 404) {
      // 404 dari Enrollment Service artinya "tidak terdaftar"
      const err = new Error('User tidak terdaftar di kursus ini');
      err.status = 403; // 403 Forbidden (dilarang akses)
      throw err;
    }
    // Gagal menghubungi service lain (cth: service down)
    const err = new Error('Gagal menghubungi Layanan Enrollment');
    err.status = 502; // 502 Bad Gateway
    throw err;
  }
}

// --- 5. Rute (Routes) ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'progress-service' });
});

/**
 * POST /lessons/complete - Menandai materi (lesson) selesai
 */
app.post('/lessons/complete', checkAuth, asyncHandler(async (req, res) => {
  const { lesson_id, course_id } = req.body;
  const { userId, token } = req; // Diambil dari middleware checkAuth

  if (!lesson_id || !course_id) {
    return res.status(400).json({ error: 'lesson_id dan course_id diperlukan' });
  }

  // 1. Validasi pendaftaran (jika gagal, asyncHandler akan menangkap error 403/502)
  const enrollment_id = await getEnrollmentId(token, course_id, userId);

  // 2. Buat atau cari data progress
  const [progress, created] = await LessonProgress.findOrCreate({
    where: {
      enrollment_id: enrollment_id,
      lesson_id: lesson_id
    },
    // findOrCreate akan mengabaikan 'defaults' jika data sudah ada
    defaults: {
      enrollment_id: enrollment_id,
      lesson_id: lesson_id
    }
  });

  if (!created) {
    return res.status(200).json({ message: 'Materi sudah pernah diselesaikan', progress });
  }

  res.status(201).json({ message: 'Materi berhasil diselesaikan', progress });
}));

/**
 * GET /my-progress/:courseId - Mengambil semua progres user di kursus tsb
 */
app.get('/my-progress/:courseId', checkAuth, asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { userId, token } = req; // Diambil dari middleware checkAuth

  // 1. Validasi pendaftaran (akan throw error 403 jika tidak terdaftar)
  const enrollment_id = await getEnrollmentId(token, courseId, userId);

  // 2. Ambil data LessonProgress
  const progress = await LessonProgress.findAll({
    where: { enrollment_id: enrollment_id },
    attributes: ['lesson_id', 'completed_at']
  });

  // 3. Ambil data Nilai (Grades)
  const grades = await Grade.findAll({
      where: { enrollment_id: enrollment_id },
      attributes: ['lesson_id', 'score', 'updatedAt']
  });

  res.json({
    enrollment_id: enrollment_id,
    completed_lessons: progress,
    grades: grades
  });
}));

// TODO: Tambahkan rute POST /grade/submit (Mirip /lessons/complete, tapi pakai Grade.upsert)

// --- 6. Penanganan Error (Global) ---

// Catch-all untuk 404 (Endpoint tidak ditemukan)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Error handler utama (Global)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Error spesifik dari helper (403 atau 502)
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Error unik dari Sequelize (findOrCreate gagal karena race condition)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Data progress sudah ada' });
  }
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors.map(e => e.message) });
  }

  // Error default
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? 'Terjadi kesalahan pada server' : err.message
  });
});


// --- 7. Menjalankan Server ---

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Koneksi database (SQLite) berhasil.');
    
    await sequelize.sync();
    console.log('Database tersinkronisasi.');

    app.listen(PORT, () => {
      console.log(`Progress Service (Layanan 4) berjalan di http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    process.exit(1); // Keluar jika koneksi DB gagal
  }
};

startServer();
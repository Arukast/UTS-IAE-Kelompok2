require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios'); 
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3003;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = new Sequelize(process.env.DATABASE_URL);

const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false }, // ID Siswa dari User Service
  course_id: { type: DataTypes.INTEGER, allowNull: false }, // ID Kursus dari Course Service
  enrollment_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: {
    type: DataTypes.ENUM('active', 'completed'),
    defaultValue: 'active'
  }
}, {
  tableName: 'enrollments',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'course_id']
    }
  ]
});

// --- Fungsi Helper (Consumer) ---
async function sendNotification(token, user_id, message, type) {
  try {
    // Panggil Notification Service via Gateway
    await axios.post(`${API_GATEWAY_URL}/api/notifications`, 
    {
      user_id: user_id,
      message: message,
      type: type
    }, 
    {
      headers: { Authorization: token }
    });
    console.log('Notifikasi terkirim (dicatat)');
  } catch (error) {
    // Gagal kirim notifikasi jangan sampai menggagalkan proses utama
    console.error('Gagal mengirim notifikasi:', error.message);
  }
}

// --- Middleware Otentikasi Sederhana ---
const checkRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Akses ditolak. Peran tidak memadai.' });
    }
    next();
  };
};

// --- Rute (Routes) ---

/**
 * [CONSUMER]
 * POST /:courseId - Mendaftarkan user (dari token) ke sebuah kursus
 */
app.post('/:courseId', async (req, res) => {
  let courseTitle = 'kursus'; // default title
  try {
    const user_id = req.headers['x-user-id'];
    const { courseId } = req.params;
    const token = req.headers.authorization; // Ambil token dari request asli

    if (!user_id) {
      return res.status(401).json({ error: 'User tidak terautentikasi (header X-User-Id tidak ada)' });
    }
    if (!token) {
        return res.status(401).json({ error: 'Token autentikasi tidak ada' });
    }

    // --- LOGIKA CONSUMER 1: Memanggil API Gateway untuk validasi Course ---
    try {
      const courseResponse = await axios.get(`${API_GATEWAY_URL}/api/courses/${courseId}`, {
        headers: { Authorization: token } // Teruskan token JWT
      });
      courseTitle = courseResponse.data.title; // Ambil judul kursus
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Kursus tidak ditemukan' });
      }
      return res.status(500).json({ 
        error: 'Gagal memvalidasi kursus', 
        details: error.message 
      });
    }
    // --- Akhir Logika Consumer 1 ---

    // Coba daftarkan
    const newEnrollment = await Enrollment.create({
      user_id,
      course_id: courseId
    });

    // --- LOGIKA CONSUMER 2: Memanggil Notification Service (tanpa await) ---
    sendNotification(
      token,
      user_id,
      `Anda telah berhasil mendaftar di kursus: ${courseTitle}`,
      'ENROLLMENT_SUCCESS'
    );
    // --- Akhir Logika Consumer 2 ---

    res.status(201).json({
      message: 'Berhasil mendaftar di kursus',
      enrollment: newEnrollment
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Anda sudah terdaftar di kursus ini' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * [PROVIDER]
 * GET /my-enrollments - Melihat semua kursus yang diambil user | Digunakan di halaman dashboard.html
 */
app.get('/my-enrollments', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    if (!user_id) {
      return res.status(401).json({ error: 'User tidak terautentikasi' });
    }

    const enrollments = await Enrollment.findAll({
      where: { user_id }
    });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * [PROVIDER]
 * GET /course-roster/:courseId - (Untuk Instruktur) Melihat siapa saja di kursus
 */
app.get('/course-roster/:courseId', checkRole(['instructor', 'admin']), async (req, res) => {
    try {
        const { courseId } = req.params;
        const enrollments = await Enrollment.findAll({
            where: { course_id: courseId },
            attributes: ['user_id', 'enrollment_date', 'status']
        });
        res.json(enrollments);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * [PROVIDER]
 * GET /check - Endpoint internal untuk validasi oleh service lain
 */
app.get('/check', async (req, res) => {
    try {
        const user_id = req.headers['x-user-id'];
        const { courseId } = req.query; // Ambil dari query param ?courseId=...

        if (!user_id || !courseId) {
            return res.status(400).json({ error: 'user_id dan courseId diperlukan' });
        }
        
        const enrollment = await Enrollment.findOne({
            where: {
                user_id: user_id,
                course_id: courseId,
                status: 'active' // Pastikan masih aktif
            }
        });

        if (!enrollment) {
            return res.status(404).json({ error: 'User tidak terdaftar di kursus ini' });
        }

        // Kirim data enrollment (terutama ID-nya)
        res.json(enrollment);

    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});


// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'enrollment-service' });
});

// --- Menjalankan Server ---
sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`Enrollment Service (Layanan 3) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });
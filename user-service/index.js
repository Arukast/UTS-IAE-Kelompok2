require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');

// --- 1. Konfigurasi Awal ---
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET || !DATABASE_URL) {
  throw new Error("FATAL_ERROR: JWT_SECRET dan DATABASE_URL tidak ada di .env");
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

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('student', 'instructor', 'admin'),
    defaultValue: 'student'
  }
}, {
  tableName: 'users',
  timestamps: true,
});

// --- 4. Utilitas (Helpers) ---

/**
 * Wrapper untuk menangani error pada async route handlers.
 * Menghilangkan kebutuhan try...catch di setiap rute.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware untuk mengecek header autentikasi.
 * Digunakan untuk rute GET (read-only) yang dipanggil oleh service lain.
 */
const checkAuthHeaders = (req, res, next) => {
  const requesterId = req.headers['x-user-id'];
  if (!requesterId) {
    return res.status(401).json({ error: 'Header X-User-Id tidak ada. Akses ditolak.' });
  }
  next();
};

/**
 * Middleware untuk mengecek izin (Otorisasi).
 * Hanya Admin atau pemilik akun yang diizinkan.
 * Digunakan untuk rute PUT, DELETE (write).
 */
const checkPermission = (req, res, next) => {
  const requesterId = req.headers['x-user-id'];
  const requesterRole = req.headers['x-user-role'];
  const requestedId = req.params.id; // ID user yang ingin diubah

  if (!requesterId || !requesterRole) {
    return res.status(401).json({ error: 'Header autentikasi (X-User-Id, X-User-Role) tidak ada.' });
  }

  // Admin boleh melakukan apa saja
  if (requesterRole === 'admin') {
    return next();
  }

  // User hanya boleh mengubah data diri sendiri
  if (requesterId === requestedId) {
    return next();
  }

  // Jika tidak keduanya, dilarang
  return res.status(403).json({ error: 'Akses ditolak. Anda tidak punya izin.' });
};


// --- 5. Rute Publik (Authentication) ---
// Rute-rute ini akan dipanggil oleh API Gateway di /api/auth/*
const authRouter = express.Router();

/**
 * POST /auth/register
 */
authRouter.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, dan password diperlukan' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    username,
    email,
    password_hash: hashedPassword,
    role: role || 'student' // Default ke student jika tidak dispesifikasi
  });

  res.status(201).json({
    message: 'User berhasil dibuat',
    user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }
  });
}));

/**
 * POST /auth/login
 */
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password diperlukan' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  // Buat JWT Token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login berhasil',
    token: token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  });
}));

// --- 6. Rute Privat (User Management) ---
// Rute-rute ini akan dipanggil oleh Gateway di /api/users/*
const userRouter = express.Router();

/**
 * GET /:id - Mendapatkan detail user
 * Dilonggarkan: Cukup cek header auth, agar service lain bisa panggil
 */
userRouter.get('/:id', checkAuthHeaders, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    // Hanya kembalikan data yang aman
    attributes: ['id', 'username', 'email', 'role', 'createdAt']
  });

  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }
  res.json(user);
}));

/**
 * PUT /:id - Update data user
 * Diketatkan: Hanya Admin atau pemilik akun
 */
userRouter.put('/:id', checkPermission, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  const { username, email } = req.body;
  
  // Update HANYA username dan email. Password tidak diubah di sini.
  const updatedUser = await user.update({
    username: username || user.username,
    email: email || user.email
  });

  res.json({
    message: 'User berhasil diupdate',
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email
    }
  });
}));

// --- 7. Mounting Rute & Penanganan Error ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Pasang router
app.use('/auth', authRouter); // Rute publik
app.use('/', userRouter); // Rute privat (Gateway me-map /api/users/* ke /*)

// Catch-all untuk 404 (Endpoint tidak ditemukan)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Error handler utama (Global)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Error unik dari Sequelize (username/email sudah ada)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Username atau email sudah digunakan' });
  }
  // Error validasi (cth: email tidak valid)
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }
  // Error JWT (jika service ini memvalidasi, walau sekarang tidak)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token tidak valid' });
  }

  // Error default
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? 'Terjadi kesalahan pada server' : err.message
  });
});

// --- 8. Menjalankan Server ---

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Koneksi database (SQLite) berhasil.');
    
    // { force: true } akan drop tabel. Hati-hati!
    await sequelize.sync(); 
    console.log('Database tersinkronisasi.');

    app.listen(PORT, () => {
      console.log(`User Service (Layanan 1) berjalan di http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    process.exit(1); // Keluar jika koneksi DB gagal
  }
};

startServer();
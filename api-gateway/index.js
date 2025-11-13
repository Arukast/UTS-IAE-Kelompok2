require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- 1. Middleware Global ---
const corsOptions = {
  origin: 'http://localhost:5000' // Izinkan frontend
};
app.use(cors(corsOptions));
// HAPUS app.use(express.json()); // Penting agar proxy tidak "memakan" body
app.use(morgan('dev')); // Logger

// --- 2. Daftar URL Service ---
const services = {
  user: process.env.USER_SERVICE_URL,
  course: process.env.COURSE_SERVICE_URL,
  enrollment: process.env.ENROLLMENT_SERVICE_URL,
  progress: process.env.PROGRESS_SERVICE_URL,
  notification: process.env.NOTIFICATION_SERVICE_URL,
};

// --- 3. Middleware Autentikasi ---
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Format: Bearer TOKEN
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Menyimpan data user dari token ke request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

//
// --- 4. Fungsi Bantuan Proxy (untuk rute terproteksi) ---
const createAuthProxy = (target, servicePrefix) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Meneruskan informasi user (dari token) ke service backend
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
    },
    pathRewrite: (path, req) => {
      // Buat pola regex untuk /api/servicePrefix
      // Contoh: /api/courses
      const regex = new RegExp(`^/api/${servicePrefix}`);
      
      // Ganti /api/servicePrefix dengan string kosong
      const newPath = path.replace(regex, '');

      // ==========================================================
      // == [ INI BAGIAN YANG DIPERBAIKI ] ==
      // ==========================================================
      // Jika newPath adalah string kosong (cth: dari /api/courses),
      // kembalikan '/', jika tidak, kembalikan path (cth: /1 atau /my-enrollments)
      return newPath || '/';
    }
  });
};

// --- 5. Definisi Rute Proxy ---

// 5a. Rute Publik (Login/Register) - TIDAK PERLU JWT
app.use('/api/auth', createProxyMiddleware({
    target: services.user,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '/auth' // /api/auth/login -> /auth/login
    }
}));

// 5b. Terapkan JWT untuk SEMUA RUTE DI BAWAH INI
app.use(authenticateJWT);

// 5c. Rute Terproteksi - BUTUH JWT
// ==========================================================
// == [ PANGGILAN FUNGSI INI TELAH DIPERBAIKI ] ==
// ==========================================================
app.use('/api/users', createAuthProxy(services.user, 'users'));
app.use('/api/courses', createAuthProxy(services.course, 'courses'));

// ==========================================================
// == [ INI ADALAH PERBAIKANNYA ] == (Blok ini sudah benar dari aslinya)
// Kita tidak bisa pakai createAuthProxy karena pathRewrite-nya salah.
// Kita buat proxy khusus untuk /api/modules.
// ==========================================================
app.use('/api/modules', createProxyMiddleware({
    target: services.course,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Tetap teruskan info user
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
    },
    pathRewrite: {
      '^/api': '' // Penulisan ulang yang benar: /api/modules/2 -> /modules/2
    }
}));

// ==========================================================
// == [ PANGGILAN FUNGSI INI TELAH DIPERBAIKI ] ==
// ==========================================================
app.use('/api/enrollments', createAuthProxy(services.enrollment, 'enrollments'));
app.use('/api/progress', createAuthProxy(services.progress, 'progress'));
app.use('/api/notifications', createAuthProxy(services.notification, 'notifications'));

// --- 6. Rute Lain (Health Check) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: Object.keys(services)
  });
});

// --- 7. Jalankan Server ---
app.listen(PORT, () => {
  console.log(`API Gateway with JWT (FIXED) running on port ${PORT}`);
});
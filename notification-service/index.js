require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios'); // <-- TAMBAHKAN INI

const app = express();
const PORT = process.env.PORT || 3005;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL; // <-- TAMBAHKAN INI

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = new Sequelize(process.env.DATABASE_URL);

const NotificationLog = sequelize.define('NotificationLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false }, 
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'INFO' }, 
  status: { type: DataTypes.ENUM('sent', 'failed'), defaultValue: 'sent' }
}, {
  tableName: 'notification_logs',
  timestamps: true 
});

// --- FUNGSI BARU UNTUK MENGAMBIL DATA USER & KIRIM NOTIFIKASI ---
async function processNotification(log, token) {
  try {
    // 1. Panggil User Service (via Gateway) untuk dapatkan email
    const userResponse = await axios.get(`${API_GATEWAY_URL}/api/users/${log.user_id}`, {
      headers: { Authorization: token }
    });

    const email = userResponse.data.email;

    // 2. Kirim notifikasi (Kita simulasi dengan console.log)
    console.log('--------------------------------------------------');
    console.log(`[SIMULASI NOTIFIKASI]`);
    console.log(`KE: ${email} (User ID: ${log.user_id})`);
    console.log(`PESAN: ${log.message}`);
    console.log(`TIPE: ${log.type}`);
    console.log('--------------------------------------------------');

    // (Di dunia nyata, di sini Anda akan memanggil Nodemailer, SendGrid, dll)
    // Jika pengiriman email gagal, Anda bisa update log.status ke 'failed'

  } catch (error) {
    console.error(`Gagal memproses notifikasi (ID: ${log.id}): ${error.message}`);
    // Update status log ke 'failed' jika user tidak ditemukan atau ada error
    await log.update({ status: 'failed' });
  }
}

// --- ENDPOINT INI SEKARANG DIPERBARUI ---
app.post('/', async (req, res) => {
  try {
    const { user_id, message, type } = req.body;
    // Ambil token yang diteruskan oleh layanan lain (misal: Enrollment Service)
    const token = req.headers.authorization; 
    
    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id dan message diperlukan' });
    }
    if (!token) {
        return res.status(401).json({ error: 'Endpoint ini memerlukan token internal' });
    }

    const log = await NotificationLog.create({
      user_id,
      message,
      type: type || 'INFO',
      status: 'sent' // Asumsi awal terkirim (dicatat)
    });
    
    // Memproses notifikasi secara asinkron (tidak perlu ditunggu)
    // Ini memenuhi rencana arsitektur 
    processNotification(log, token);

    // Langsung beri respon, jangan tunggu notifikasi terkirim
    res.status(201).json({ message: 'Notifikasi dicatat dan sedang diproses', log });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/my-notifications', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    if (!user_id) {
      return res.status(401).json({ error: 'User tidak terautentikasi' });
    }

    const notifications = await NotificationLog.findAll({
      where: { user_id },
      order: [['createdAt', 'DESC']],
      limit: 20 
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`Notification Service (Layanan 5) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });
require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = new Sequelize(process.env.DATABASE_URL);

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('student', 'instructor', 'admin'),
    defaultValue: 'student'
  }
}, {
  tableName: 'users',
  timestamps: true, 
});


const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, dan password diperlukan' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password_hash: hashedPassword,
      role: role || 'student'
    });

    res.status(201).json({
      message: 'User berhasil dibuat',
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Username atau email sudah digunakan' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.use('/auth', authRouter);

const userRouter = express.Router();

userRouter.get('/:id', async (req, res) => {
  try {
    const requesterId = req.headers['x-user-id'];
    const requesterRole = req.headers['x-user-role'];
    
    const requestedId = req.params.id;

    if (requesterRole !== 'admin' && requesterId !== requestedId) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak punya izin.' });
    }

    const user = await User.findByPk(requestedId, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt'] 
    });

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT /:id - Update data user
userRouter.put('/:id', async (req, res) => {
  try {
    const requesterId = req.headers['x-user-id'];
    const requesterRole = req.headers['x-user-role'];
    const requestedId = req.params.id;

    // Hanya admin atau user itu sendiri yang boleh update
    if (requesterRole !== 'admin' && requesterId !== requestedId) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak punya izin.' });
    }

    const user = await User.findByPk(requestedId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    // Ambil data yang boleh di-update dari body
    const { username, email } = req.body;
    
    // Validasi sederhana (bisa Anda kembangkan)
    if (!username && !email) {
      return res.status(400).json({ error: 'Username atau email diperlukan untuk update' });
    }

    // Lakukan update
    const updatedUser = await user.update({
      username: username || user.username, // Gunakan nilai baru atau nilai lama jika tidak disediakan
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
  } catch (error) {
     if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Username atau email sudah digunakan' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Pastikan ini ada di bagian bawah file
// app.use('/', userRouter); // Anda sudah punya ini

app.use('/', userRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`User Service (Layanan 1) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });
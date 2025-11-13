require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');

// --- Konfigurasi ---
const app = express();
const PORT = process.env.PORT || 3002;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- Database (Sequelize + SQLite) ---
const sequelize = new Sequelize(process.env.DATABASE_URL);

// Model Course
const Course = sequelize.define('Course', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  instructor_id: { type: DataTypes.INTEGER, allowNull: false } // ID dari User Service
}, { tableName: 'courses', timestamps: true });

// Model Module
const Module = sequelize.define('Module', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  module_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'modules', timestamps: false });

// Model Lesson
const Lesson = sequelize.define('Lesson', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content_type: { type: DataTypes.ENUM('video', 'text', 'quiz'), allowNull: false },
  content_url_or_text: { type: DataTypes.TEXT },
  lesson_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'lessons', timestamps: false });

// --- Relasi Database ---
Course.hasMany(Module, { foreignKey: 'course_id', onDelete: 'CASCADE' });
Module.belongsTo(Course, { foreignKey: 'course_id' });

Module.hasMany(Lesson, { foreignKey: 'module_id', onDelete: 'CASCADE' });
Lesson.belongsTo(Module, { foreignKey: 'module_id' });


// --- Middleware Otentikasi Sederhana ---
// Cek header yang dikirim oleh API Gateway
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
// (Semua rute ini akan diakses via /api/courses oleh Gateway)

// POST / (Membuat Kursus baru) - Hanya untuk Instructor/Admin
app.post('/', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, description } = req.body;
    const instructor_id = req.headers['x-user-id']; // Ambil ID instruktur dari token

    if (!title || !description) {
      return res.status(400).json({ error: 'Title dan description diperlukan' });
    }

    const newCourse = await Course.create({
      title,
      description,
      instructor_id
    });
    res.status(201).json(newCourse);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET / (Mendapatkan semua kursus) - Untuk semua peran
app.get('/', async (req, res) => {
  try {
    const courses = await Course.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /:id (Mendapatkan detail kursus, termasuk modul dan lesson)
app.get('/:id', async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: {
        model: Module,
        include: {
          model: Lesson,
          order: [['lesson_order', 'ASC']]
        },
        order: [['module_order', 'ASC']]
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Kursus tidak ditemukan' });
    }
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ===============================================
// == FITUR BARU 1: MEMBUAT MODUL BARU (INSTRUKTUR) ==
// ===============================================
app.post('/:courseId/modules', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, module_order } = req.body;
    const { courseId } = req.params;

    if (!title || module_order === undefined) {
      return res.status(400).json({ error: 'Title dan module_order diperlukan' });
    }
    
    // Pastikan kursus ada
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Kursus tidak ditemukan' });
    }

    const newModule = await Module.create({
      title,
      module_order,
      course_id: courseId
    });
    res.status(201).json(newModule);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ====================================================
// == FITUR BARU 2: MEMBUAT MATERI BARU (INSTRUKTUR) ==
// ====================================================
app.post('/modules/:moduleId/lessons', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, content_type, content_url_or_text, lesson_order } = req.body;
    const { moduleId } = req.params;

    if (!title || !content_type || lesson_order === undefined) {
      return res.status(400).json({ error: 'Title, content_type, dan lesson_order diperlukan' });
    }

    // Pastikan modul ada
    const module = await Module.findByPk(moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Modul tidak ditemukan' });
    }

    const newLesson = await Lesson.create({
      title,
      content_type,
      content_url_or_text: content_url_or_text || '',
      lesson_order,
      module_id: moduleId
    });
    res.status(201).json(newLesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'course-service' });
});

// --- Menjalankan Server ---
sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`Course Service (Layanan 2) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });
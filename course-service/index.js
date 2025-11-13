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

// Model Course (TANPA 'price')
const Course = sequelize.define('Course', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  instructor_id: { type: DataTypes.INTEGER, allowNull: false }, // ID dari User Service
  thumbnail_url: { 
    type: DataTypes.STRING, 
    allowNull: true,
    defaultValue: 'https://via.placeholder.com/300x200.png?text=Kursus'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  }
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

// POST / (Membuat Kursus baru) - (TANPA 'price')
app.post('/', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, description, thumbnail_url, category } = req.body;
    const instructor_id = req.headers['x-user-id'];

    if (!title || !description) {
      return res.status(400).json({ error: 'Title dan description diperlukan' });
    }

    const newCourse = await Course.create({
      title,
      description,
      instructor_id,
      thumbnail_url: thumbnail_url,
      category: category
    });
    res.status(201).json(newCourse);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET / (Mendapatkan semua kursus) - Untuk semua peran | Digunakan di halaman dashboard.html
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

// GET /:id (Mendapatkan detail kursus, termasuk modul dan lesson) | Digunakan di halaman course-detail.html
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

// PUT /:id (Update Kursus) - (TANPA 'price')
app.put('/:id', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, description, thumbnail_url, category } = req.body;
    const courseId = req.params.id;
    const requesterId = req.headers['x-user-id'];
    const requesterRole = req.headers['x-user-role'];

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Kursus tidak ditemukan' });
    }

    // Validasi kepemilikan
    if (requesterRole !== 'admin' && course.instructor_id !== parseInt(requesterId)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda bukan pemilik kursus ini.' });
    }

    // Lakukan update
    const updatedCourse = await course.update({
      title: title || course.title,
      description: description || course.description,
      thumbnail_url: thumbnail_url || course.thumbnail_url,
      category: category || course.category
    });

    res.json(updatedCourse);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/:courseId/modules', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, module_order } = req.body;
    const { courseId } = req.params;

    if (!title || module_order === undefined) {
      return res.status(400).json({ error: 'Title dan module_order diperlukan' });
    }
    
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

// POST /modules/:moduleId/lessons (membuat materi baru)
app.post('/modules/:moduleId/lessons', checkRole(['instructor', 'admin']), async (req, res) => {
  try {
    const { title, content_type, content_url_or_text, lesson_order } = req.body;
    const { moduleId } = req.params;

    if (!title || !content_type || lesson_order === undefined) {
      return res.status(400).json({ error: 'Title, content_type, dan lesson_order diperlukan' });
    }

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
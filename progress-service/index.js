require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3004;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = new Sequelize(process.env.DATABASE_URL);

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
    {
      unique: true,
      fields: ['enrollment_id', 'lesson_id']
    }
  ]
});

const Grade = sequelize.define('Grade', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  enrollment_id: { type: DataTypes.INTEGER, allowNull: false },
  lesson_id: { type: DataTypes.INTEGER, allowNull: false }, // ID kuis
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: false }
}, {
  tableName: 'grades',
  timestamps: true
});

/**
 * @param {string} token 
 * @param {string} courseId 
 * @param {string} userId 
 * @returns {Promise<number>} 
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
    return response.data.id; 
  } catch (error) {
    console.error('Gagal memvalidasi enrollment:', error.message);
    if (error.response && error.response.status === 404) {
      throw new Error('User tidak terdaftar di kursus ini');
    }
    throw new Error('Gagal menghubungi Enrollment Service');
  }
}
// Digunakan di halaman course-details.html
app.post('/lessons/complete', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    const token = req.headers.authorization;
    const { lesson_id, course_id } = req.body;

    if (!lesson_id || !course_id) {
      return res.status(400).json({ error: 'lesson_id dan course_id diperlukan' });
    }
    if (!user_id || !token) {
      return res.status(401).json({ error: 'Autentikasi diperlukan' });
    }

    let enrollment_id;
    try {
      enrollment_id = await getEnrollmentId(token, course_id, user_id);
    } catch (error) {
      return res.status(403).json({ error: error.message });
    }

    const [progress, created] = await LessonProgress.findOrCreate({
      where: {
        enrollment_id: enrollment_id,
        lesson_id: lesson_id
      }
    });

    if (!created) {
      return res.status(200).json({ message: 'Materi sudah pernah diselesaikan', progress });
    }

    res.status(201).json({ message: 'Materi berhasil diselesaikan', progress });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
// Digunakan di halaman course-details.html
app.get('/my-progress/:courseId', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    const token = req.headers.authorization;
    const { courseId } = req.params;

    let enrollment_id;
    try {
      enrollment_id = await getEnrollmentId(token, courseId, user_id);
    } catch (error) {
      return res.status(403).json({ error: error.message });
    }

    const progress = await LessonProgress.findAll({
      where: { enrollment_id: enrollment_id },
      attributes: ['lesson_id', 'completed_at']
    });

    const grades = await Grade.findAll({
        where: { enrollment_id: enrollment_id },
        attributes: ['lesson_id', 'score']
    });

    res.json({
      enrollment_id: enrollment_id,
      completed_lessons: progress,
      grades: grades
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'progress-service' });
});

sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`Progress Service (Layanan 4) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });
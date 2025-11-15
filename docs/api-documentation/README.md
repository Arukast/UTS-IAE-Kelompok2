Dokumentasi API - EduConnect (uts IAE)

Koleksi Postman untuk layanan API EduConnect, yang terbagi menjadi beberapa microservice.

Base URL

Semua endpoint API menggunakan URL dasar berikut:

http://localhost:3000

Authentication

Sebagian besar endpoint memerlukan autentikasi Bearer Token.

Dapatkan token dengan melakukan POST /api/auth/login (sebagai Student atau Instructor).

Untuk semua request selanjutnya yang memerlukan autentikasi, tambahkan header berikut:
Authorization: Bearer {{jwt_token}}

(Token ini akan otomatis tersimpan dalam variabel environment jwt_token jika Anda menjalankan request Login dari dalam Postman).

Endpoints

1. User Service

Layanan 1: Mengelola data siswa & pengajar dan autentikasi.

POST Register Student

Method: POST

URL: /api/auth/register

Description: Mendaftarkan user baru sebagai student.

Headers: Content-Type: application/json

Body:

{
  "username": "muridbaru",
  "email": "murid@example.com",
  "password": "password123",
  "role": "student"
}


Response Example (201 Created):

{
  "message": "User berhasil dibuat",
  "user": {
    "id": 1,
    "username": "muridbaru",
    "email": "murid@example.com"
  }
}


POST Register Instructor

Method: POST

URL: /api/auth/register

Description: Mendaftarkan user baru sebagai instructor.

Headers: Content-Type: application/json

Body:

{
  "username": "dosenbaru",
  "email": "dosen@example.com",
  "password": "passwordDosen456",
  "role": "instructor"
}


Response Example (201 Created):

{
  "message": "User berhasil dibuat",
  "user": {
    "id": 2,
    "username": "dosenbaru",
    "email": "dosen@example.com"
  }
}


POST Login Student

Method: POST

URL: /api/auth/login

Description: Login sebagai student.

Headers: Content-Type: application/json

Body:

{
  "email": "murid@example.com",
  "password": "password123"
}


Response Example (200 OK):

{
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJtdXJpZEBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYzMjEyMDY4LCJleHAiOjE3NjMyOTg0Njh9.KB6WJ-_gT83y9Nc26WK4H49Hf8f8ibvLKHYjpJOYcg0",
  "user": {
    "id": 1,
    "username": "muridbaru",
    "email": "murid@example.com",
    "role": "student"
  }
}


POST Login Instructor

Method: POST

URL: /api/auth/login

Description: Login sebagai instructor.

Headers: Content-Type: application/json

Body:

{
  "email": "dosen@example.com",
  "password": "passwordDosen456"
}


Response Example (200 OK):

{
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJkb3NlbkBleGFtcGxlLmNvbSIsInJvbGUiOiJpbnN0cnVjdG9yIiwiaWF0IjoxNzYzMjEyMTQ4LCJleHAiOjE3NjMyOTg1NDh9.lLBCpQDBo5clntKu_ZXupigi2tBmytSZjfUVuHc5WSA",
  "user": {
    "id": 2,
    "username": "dosenbaru",
    "email": "dosen@example.com",
    "role": "instructor"
  }
}


GET User Details

Method: GET

URL: /api/users/1

Description: Mengambil detail user.

Authentication: Bearer Token

Response Example:
[Contoh respons tidak tersedia di koleksi]

2. Course Service

Layanan 2: Mengelola data kursus/mata kuliah.

GET All Courses

Method: GET

URL: /api/courses

Description: Mengambil semua daftar kursus.

Authentication: Bearer Token

Response Example:
[Contoh respons tidak tersedia di koleksi]

POST Create Course (Instructor)

Method: POST

URL: /api/courses

Description: Membuat kursus baru. Memerlukan token Instruktur.

Authentication: Bearer Token

Headers: Content-Type: application/json

Body:

{
  "title": "Merancang Nuklir",
  "description": "Kursus lengkap merancang reaktor nuklir dari nol.",
  "thumbnail_url": "[https://nypost.com/wp-content/uploads/sites/2/2017/05/gettyimages-1374485.jpg?quality=90&strip=all](https://nypost.com/wp-content/uploads/sites/2/2017/05/gettyimages-1374485.jpg?quality=90&strip=all)",
  "category": "Sains"
}


Response Example (201 Created):

{
  "thumbnail_url": "[https://via.placeholder.com/300x200.png?text=Kursus](https://via.placeholder.com/300x200.png?text=Kursus)",
  "id": 1,
  "title": "Merancang Nuklir",
  "description": "Kursus lengkap merancang reaktor nuklir dari nol.",
  "instructor_id": "2",
  "category": "Sains",
  "updatedAt": "2025-11-15T13:12:26.473Z",
  "createdAt": "2025-11-15T13:12:26.473Z"
}


POST Create Module (Instructor)

Method: POST

URL: /api/courses/1/modules

Description: Membuat modul baru untuk kursus.

Authentication: Bearer Token

Headers: Content-Type: application/json

Body:

{
  "title": "Bab 1: Pengenalan Fisi Nuklir",
  "module_order": 1
}


Response Example (201 Created):

{
  "id": 1,
  "title": "Bab 1: Pengenalan Fisi Nuklir",
  "module_order": 1,
  "course_id": "1"
}


POST Create Lesson (Instructor)

Method: POST

URL: /api/modules/1/lessons

Description: Membuat materi baru untuk modul.

Authentication: Bearer Token

Headers: Content-Type: application/json

Body:

{
  "title": "1.1 Apa itu Uranium?",
  "content_type": "text",
  "content_url_or_text": "Uranium adalah unsur kimia...",
  "lesson_order": 1
}


Response Example (201 Created):

{
  "id": 1,
  "title": "1.1 Apa itu Uranium?",
  "content_type": "text",
  "content_url_or_text": "Uranium adalah unsur kimia...",
  "lesson_order": 1,
  "module_id": "1"
}


3. Enrollment Service

Layanan 3: Mengelola pendaftaran siswa ke kursus.

POST Enroll Course (Student)

Method: POST

URL: /api/enrollments/1

Description: Mendaftarkan student ke kursus.

Authentication: Bearer Token

Response Example (201 Created):

{
  "message": "Berhasil mendaftar di kursus",
  "enrollment": {
    "enrollment_date": "2025-11-15T13:21:00.923Z",
    "status": "active",
    "id": 1,
    "user_id": "2",
    "course_id": "1"
  }
}


GET My Enrollments (Student)

Method: GET

URL: /api/enrollments/my-enrollments

Description: Melihat daftar kursus yang sudah di-enroll oleh student.

Authentication: Bearer Token

Response Example (200 OK):

[
  {
    "id": 1,
    "user_id": 2,
    "course_id": 1,
    "enrollment_date": "2025-11-15T13:21:00.923Z",
    "status": "active"
  }
]


GET Course Roster (Instructor)

Method: GET

URL: /api/enrollments/course-roster/1

Description: Melihat daftar siswa yang mendaftar di kursus ini.

Authentication: Bearer Token

Response Example (200 OK):

[
  {
    "user_id": 2,
    "enrollment_date": "2025-11-15T13:21:00.923Z",
    "status": "active"
  }
]


4. Progress Service

Layanan 4: Mengelola progres & nilai siswa.

GET My Progress (Student)

Method: GET

URL: /api/progress/my-progress/1

Description: Melihat progres materi yang selesai di 1 kursus.

Authentication: Bearer Token

Response Example (200 OK):

{
  "enrollment_id": 1,
  "completed_lessons": [],
  "grades": []
}


POST Complete Lesson (Student)

Method: POST

URL: /api/progress/lessons/complete

Description: Menandai 1 materi sebagai selesai.

Authentication: Bearer Token

Headers: Content-Type: application/json

Body:

{
  "lesson_id": 1,
  "course_id": 1
}


Response Example (201 Created):

{
  "message": "Materi berhasil diselesaikan",
  "progress": {
    "is_completed": true,
    "completed_at": "2025-11-15T13:24:44.516Z",
    "id": 1,
    "enrollment_id": 1,
    "lesson_id": 1
  }
}


5. Notification Service

Layanan 5: Mengelola pengiriman notifikasi.

GET My Notifications (Student)

Method: GET

URL: /api/notifications/my-notifications

Description: Melihat daftar notifikasi untuk user yang login.

Authentication: Bearer Token

Response Example (200 OK):

[
  {
    "id": 1,
    "user_id": 2,
    "message": "Anda telah berhasil mendaftar di kursus: Merancang Nuklir",
    "type": "ENROLLMENT_SUCCESS",
    "status": "sent",
    "createdAt": "2025-11-15T13:21:01.226Z",
    "updatedAt": "2025-11-15T13:21:01.226Z"
  }
]


6. Health Checks

Endpoint ini mengakses service secara langsung untuk memastikan service-nya hidup.

GET API Gateway Health

Method: GET

URL: /health

Description: Mengecek status API Gateway.

Response Example:
[Contoh respons tidak tersedia di koleksi]

GET User Service Health

Method: GET

URL: {{user_service_url}}/health

Description: Mengecek status User Service.

Response Example:
[Contoh respons tidak tersedia di koleksi]

GET Course Service Health

Method: GET

URL: {{course_service_url}}/health

Description: Mengecek status Course Service.

Response Example:
[Contoh respons tidak tersedia di koleksi]

GET Enrollment Service Health

Method: GET

URL: {{enrollment_service_url}}/health

Description: Mengecek status Enrollment Service.

Response Example:
[Contoh respons tidak tersedia di koleksi]

GET Progress Service Health

Method: GET

URL: {{progress_service_url}}/health

Description: Mengecek status Progress Service.

Response Example:
[Contoh respons tidak tersedia di koleksi]

GET Notification Service Health

Method: GET

URL: {{notification_service_url}}/health

Description: Mengecek status Notification Service.

Response Example:
[Contoh respons tidak tersedia di koleksi]

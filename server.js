// server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'student_management',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

const validateStudent = (req, res, next) => {
  const {
    firstName,
    lastName,
    studentId,
    email,
    dateOfBirth,
    contactNumber,
    enrollmentDate
  } = req.body;

  const errors = [];

  // Required field validation
  if (!firstName || firstName.trim() === '') {
    errors.push({ field: 'firstName', message: 'First name is required' });
  }
  if (!lastName || lastName.trim() === '') {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  }
  if (!studentId || studentId.trim() === '') {
    errors.push({ field: 'studentId', message: 'Student ID is required' });
  }
  if (!email || email.trim() === '') {
    errors.push({ field: 'email', message: 'Email is required' });
  }
  if (!dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'Date of birth is required' });
  }
  if (!contactNumber || contactNumber.trim() === '') {
    errors.push({ field: 'contactNumber', message: 'Contact number is required' });
  }
  if (!enrollmentDate) {
    errors.push({ field: 'enrollmentDate', message: 'Enrollment date is required' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Date validation
  if (dateOfBirth && isNaN(Date.parse(dateOfBirth))) {
    errors.push({ field: 'dateOfBirth', message: 'Invalid date format for date of birth' });
  }
  if (enrollmentDate && isNaN(Date.parse(enrollmentDate))) {
    errors.push({ field: 'enrollmentDate', message: 'Invalid date format for enrollment date' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors
    });
  }

  next();
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// GET /api/students - Retrieve all students with pagination and search
app.get('/api/students', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id, first_name, last_name, student_id, email, 
        date_of_birth, contact_number, enrollment_date, 
        status, profile_picture, created_at, updated_at
      FROM students
      WHERE (first_name ILIKE $1 OR last_name ILIKE $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM students
      WHERE (first_name ILIKE $1 OR last_name ILIKE $1)
    `;

    const searchPattern = `%${search}%`;
    
    const [studentsResult, countResult] = await Promise.all([
      pool.query(query, [searchPattern, limit, offset]),
      pool.query(countQuery, [searchPattern])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      students: studentsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalStudents: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/students/search - Search and filter students
app.get('/api/students/search', async (req, res) => {
  try {
    const { name = '', studentId = '', email = '' } = req.query;

    let query = `
      SELECT 
        id, first_name, last_name, student_id, email, 
        date_of_birth, contact_number, enrollment_date, 
        status, profile_picture, created_at, updated_at
      FROM students
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (name) {
      query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      params.push(`%${name}%`);
      paramIndex++;
    }

    if (studentId) {
      query += ` AND student_id ILIKE $${paramIndex}`;
      params.push(`%${studentId}%`);
      paramIndex++;
    }

    if (email) {
      query += ` AND email ILIKE $${paramIndex}`;
      params.push(`%${email}%`);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      students: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching students:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/students/:id - Retrieve specific student details
app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/students - Create a new student record
app.post('/api/students', validateStudent, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      studentId,
      email,
      dateOfBirth,
      contactNumber,
      enrollmentDate,
      profilePicture = null,
      status = 'Enrolled'
    } = req.body;

    // Check for duplicate student_id
    const duplicateIdCheck = await pool.query(
      'SELECT id FROM students WHERE student_id = $1',
      [studentId]
    );

    if (duplicateIdCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this Student ID already exists'
      });
    }

    // Check for duplicate email
    const duplicateEmailCheck = await pool.query(
      'SELECT id FROM students WHERE email = $1',
      [email]
    );

    if (duplicateEmailCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this email already exists'
      });
    }

    // Check for duplicate contact number
    const duplicateContactCheck = await pool.query(
      'SELECT id FROM students WHERE contact_number = $1',
      [contactNumber]
    );

    if (duplicateContactCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this contact number already exists'
      });
    }

    // Insert new student
    const result = await pool.query(
      `INSERT INTO students 
        (first_name, last_name, student_id, email, date_of_birth, 
         contact_number, enrollment_date, profile_picture, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [firstName, lastName, studentId, email, dateOfBirth, 
       contactNumber, enrollmentDate, profilePicture, status]
    );

    res.status(201).json({
      message: 'Student created successfully',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/students/:id - Update an existing student record
app.put('/api/students/:id', validateStudent, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      studentId,
      email,
      dateOfBirth,
      contactNumber,
      enrollmentDate,
      profilePicture,
      status
    } = req.body;

    // Check if student exists
    const existingStudent = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );

    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check for duplicate student_id (excluding current student)
    const duplicateIdCheck = await pool.query(
      'SELECT id FROM students WHERE student_id = $1 AND id != $2',
      [studentId, id]
    );

    if (duplicateIdCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this Student ID already exists'
      });
    }

    // Check for duplicate email (excluding current student)
    const duplicateEmailCheck = await pool.query(
      'SELECT id FROM students WHERE email = $1 AND id != $2',
      [email, id]
    );

    if (duplicateEmailCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this email already exists'
      });
    }

    // Check for duplicate contact number (excluding current student)
    const duplicateContactCheck = await pool.query(
      'SELECT id FROM students WHERE contact_number = $1 AND id != $2',
      [contactNumber, id]
    );

    if (duplicateContactCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A student with this contact number already exists'
      });
    }

    // Update student
    const result = await pool.query(
      `UPDATE students 
      SET first_name = $1, last_name = $2, student_id = $3, email = $4, 
          date_of_birth = $5, contact_number = $6, enrollment_date = $7, 
          profile_picture = $8, status = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [firstName, lastName, studentId, email, dateOfBirth, 
       contactNumber, enrollmentDate, profilePicture, status, id]
    );

    res.json({
      message: 'Student updated successfully',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/students/:id - Delete a student record
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if student exists
    const existingStudent = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );

    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Delete student
    await pool.query('DELETE FROM students WHERE id = $1', [id]);

    res.json({
      message: 'Student deleted successfully',
      deletedStudent: existingStudent.rows[0]
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api/students`);
});

module.exports = app;
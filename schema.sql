-- schema.sql
-- Database: student_management

-- Drop table if exists
DROP TABLE IF EXISTS students;

-- Create students table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    date_of_birth DATE NOT NULL,
    contact_number VARCHAR(20) UNIQUE NOT NULL,
    enrollment_date DATE NOT NULL,
    profile_picture TEXT,
    status VARCHAR(50) DEFAULT 'Enrolled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_name ON students(first_name, last_name);
CREATE INDEX idx_students_status ON students(status);

-- Insert sample data
INSERT INTO students (first_name, last_name, student_id, email, date_of_birth, contact_number, enrollment_date, status) VALUES
('Clark', 'Gill', '1287654', 'clarkgill@email.com', '1998-05-15', '+250784235432', '2022-07-12', 'Enrolled'),
('Emily', 'Hall', '1287655', 'emilyhall@email.com', '1999-03-20', '+250784235433', '2022-07-12', 'Enrolled'),
('David', 'Smith', '1287656', 'davidsmith@email.com', '1997-08-10', '+250784235434', '2022-07-12', 'Enrolled'),
('Davis', 'Gill', '1287657', 'davisgill@email.com', '1998-11-25', '+250784235435', '2022-07-12', 'Enrolled'),
('Sarah', 'Johnson', '1287658', 'sarahjohnson@email.com', '1999-01-05', '+250784235436', '2022-07-12', 'Enrolled'),
('Michael', 'Brown', '1287659', 'michaelbrown@email.com', '1998-07-18', '+250784235437', '2022-07-12', 'Enrolled'),
('Clark', 'Dill', '1287660', 'clarkdill@email.com', '1997-12-30', '+250784235438', '2022-07-12', 'Enrolled'),
('Jessica', 'Williams', '1287661', 'jessicawilliams@email.com', '1999-04-22', '+250784235439', '2022-07-12', 'Enrolled'),
('James', 'Taylor', '1287662', 'jamestaylor@email.com', '1998-09-14', '+250784235440', '2022-07-12', 'Enrolled'),
('Emma', 'Anderson', '1287663', 'emmaanderson@email.com', '1997-06-08', '+250784235441', '2022-07-12', 'Enrolled');

-- Verify data insertion
SELECT COUNT(*) as total_students FROM students;
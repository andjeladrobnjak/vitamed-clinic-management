CREATE DATABASE IF NOT EXISTS vitamed;
USE vitamed;

-- =====================================================
-- PATIENTS
-- =====================================================


CREATE TABLE patients (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    jmbg CHAR(13) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- SPECIALTIES
-- =====================================================

CREATE TABLE IF NOT EXISTS specialties (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500)
);


-- =====================================================
-- DOCTORS
-- =====================================================

CREATE TABLE IF NOT EXISTS doctors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty_id BIGINT NOT NULL,
    biography TEXT,
    education TEXT,
    professional_experience TEXT,
    image_url VARCHAR(500),

    CONSTRAINT fk_doctors_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(id)
);


-- =====================================================
-- DOCTOR ACCOUNTS
-- Login credentials for the doctor portal.
-- One optional account per doctor. Not public catalog data.
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doctor_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_doctor_accounts_doctor_id
        UNIQUE (doctor_id),

    CONSTRAINT uq_doctor_accounts_email
        UNIQUE (email),

    CONSTRAINT fk_doctor_accounts_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE RESTRICT
);


-- =====================================================
-- ADMIN ACCOUNTS
-- Login credentials for the administrator portal.
-- Not public catalog data. No public registration.
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_admin_accounts_email
        UNIQUE (email)
);


-- =====================================================
-- SERVICES
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    specialty_id BIGINT NOT NULL,

    CONSTRAINT fk_services_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(id),

    CONSTRAINT uq_service_specialty
        UNIQUE (name, specialty_id)
);


-- =====================================================
-- DOCTOR - SERVICE
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_services (
    doctor_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,

    PRIMARY KEY (doctor_id, service_id),

    CONSTRAINT fk_doctor_services_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_doctor_services_service
        FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE CASCADE
);


-- =====================================================
-- LOCATIONS
-- Independent clinic branches
-- =====================================================

CREATE TABLE IF NOT EXISTS locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    working_hours VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL
);


-- =====================================================
-- DOCTOR - LOCATION
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_locations (
    doctor_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,

    PRIMARY KEY (doctor_id, location_id),

    CONSTRAINT fk_doctor_locations_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_doctor_locations_location
        FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE
);


-- =====================================================
-- DOCTOR SCHEDULES
-- Weekly working shifts at an already assigned location
-- One continuous shift per doctor per weekday
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doctor_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    day_of_week TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    CONSTRAINT fk_doctor_schedules_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_doctor_schedules_location
        FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_doctor_schedules_doctor_day
        UNIQUE (doctor_id, day_of_week),

    CONSTRAINT chk_doctor_schedules_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT chk_doctor_schedules_time
        CHECK (start_time < end_time)
);


-- =====================================================
-- DOCTOR ABSENCES
-- Date-specific periods when a doctor is unavailable.
-- Regular weekly hours remain in doctor_schedules.
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_absences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doctor_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_absences_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_doctor_absences_dates
        CHECK (start_date <= end_date),

    CONSTRAINT chk_doctor_absences_reason
        CHECK (reason IN ('annual_leave', 'sick_leave', 'day_off', 'other')),

    INDEX idx_doctor_absences_doctor_dates (doctor_id, start_date, end_date)
);


-- =====================================================
-- APPOINTMENTS
-- Runtime bookings (authenticated patients or guests).
-- Not seed/configuration data. Starts empty.
-- =====================================================

CREATE TABLE IF NOT EXISTS appointments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NULL,
    doctor_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    patient_first_name VARCHAR(100) NOT NULL,
    patient_last_name VARCHAR(100) NOT NULL,
    patient_jmbg CHAR(13) NOT NULL,
    patient_email VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    cancelled_by ENUM('patient', 'doctor', 'admin') NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_appointments_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_appointments_service
        FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_appointments_location
        FOREIGN KEY (location_id)
        REFERENCES locations(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_appointments_time
        CHECK (start_time < end_time),

    CONSTRAINT chk_appointments_status
        CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),

    INDEX idx_appointments_doctor_date (doctor_id, appointment_date)
);

-- =====================================================
-- DOCTOR_REVIEWS
-- Reviews from patients about doctors
-- Not seed/configuration data. Starts empty.
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT NOT NULL UNIQUE,
    rating TINYINT NOT NULL,
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_doctor_reviews_rating
        CHECK (rating BETWEEN 1 AND 5),

    CONSTRAINT fk_doctor_reviews_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE RESTRICT
);

-- =====================================================
-- APPOINTMENT_REPORTS
-- Medical report written when a doctor completes an appointment.
-- One report per appointment. Not seed data.
-- =====================================================

CREATE TABLE IF NOT EXISTS appointment_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT NOT NULL UNIQUE,
    anamnesis TEXT NOT NULL,
    findings TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    therapy_recommendations TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_appointment_reports_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE RESTRICT
);

-- =====================================================
-- DOCTOR_ACCOUNTS
-- Login credentials for the doctor portal.
-- One optional account per doctor. Not public catalog data.
-- =====================================================

CREATE TABLE IF NOT EXISTS doctor_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doctor_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_doctor_accounts_doctor_id UNIQUE (doctor_id),
    CONSTRAINT uq_doctor_accounts_email UNIQUE (email),
    CONSTRAINT fk_doctor_accounts_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT
);
CREATE DATABASE IF NOT EXISTS Jahhaazz;
USE Jahhaazz;


CREATE TABLE `Airport` (
  `airport_id` int AUTO_INCREMENT,
  `airport_name` varchar(100) NOT NULL,
  `city` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL,
  `airport_code` Varchar(10) NOT NULL,
  `timezone` Varchar(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`airport_id`)
);

CREATE TABLE `Aircraft_types` (
  `aircraft_type_id` int AUTO_INCREMENT,
  `model_name` varchar(100) NOT NULL,
  `manufacturer` varchar(100) NOT NULL,
  `seat_capacity` int NOT NULL,
  PRIMARY KEY (`aircraft_type_id`)
);

CREATE TABLE `Terminals` (
  `terminal_id` int AUTO_INCREMENT,
  `airport_id` int NOT NULL,
  `terminal_name` varchar(50) NOT NULL,
  `terminal_code` varchar(10) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`terminal_id`),
  FOREIGN KEY (`airport_id`)
      REFERENCES `Airport`(`airport_id`)
);
CREATE TABLE `Gates` (
  `gate_id` int AUTO_INCREMENT,
  `terminal_id` int NOT NULL,
  `gate_number` varchar(10) NOT NULL,
  `status` ENUM ('active','maintenance') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`gate_id`),
  FOREIGN KEY (`terminal_id`)
      REFERENCES `Terminals`(`terminal_id`)
);

CREATE TABLE `Airline` (
  `airline_id` int AUTO_INCREMENT,
  `airline_name` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL,
  `airline_code` varchar(10) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`airline_id`)
);

CREATE TABLE `Flights` (
  `flight_id` int AUTO_INCREMENT,
  `airline_id` int NOT NULL,
  `flight_number` int NOT NULL,
  `source_airport_id` int NOT NULL,
  `destination_airport_id` int NOT NULL,
  `flight_type` ENUM('Passenger','Cargo','Private') NOT NULL DEFAULT 'Passenger',
  `estimated_duration` time NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`flight_id`),
  FOREIGN KEY (`airline_id`)
      REFERENCES `Airline`(`airline_id`),
  FOREIGN KEY (`source_airport_id`)
      REFERENCES `Airport`(`airport_id`),
  FOREIGN KEY (`destination_airport_id`)
      REFERENCES `Airport`(`airport_id`)
);

CREATE TABLE `Aircraft` (
  `aircraft_id` int AUTO_INCREMENT,
  `airline_id` int NOT NULL,
  `aircraft_type_id` int NOT NULL,
  `registration_number` varchar(50) UNIQUE NOT NULL,
  `status` ENUM('Active','Maintenance','Retired') NOT NULL DEFAULT 'Active',
  `economy_seats` int NOT NULL,
  `business_seats` int NOT NULL,
  `first_class_seats` int NOT NULL,
  `max_speed_kmh` int NOT NULL,
  `fuel_capacity_litres` int NOT NULL,
  `manufactered_date` date NOT NULL,
  `latest_maintenance` date,
  `next_maintenance_due` date,
  `current_airport` int NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`aircraft_id`),
  FOREIGN KEY (`aircraft_type_id`)
      REFERENCES `Aircraft_types`(`aircraft_type_id`),
  FOREIGN KEY (`airline_id`)
      REFERENCES `Airline`(`airline_id`),
  FOREIGN KEY (`current_airport`)
      REFERENCES `Airport`(`airport_id`)
);

CREATE TABLE `Flight_schedules` (
  `flight_schedule_id` int AUTO_INCREMENT,
  `flight_id` int NOT NULL,
  `aircraft_id` int NOT NULL,
  `departure_datetime` DATETIME NOT NULL,
  `arrival_datetime` DATETIME NOT NULL,
  `gate_id` int NOT NULL,
  `flight_status` ENUM( 'Scheduled', 'Boarding', 'Departed', 'Delayed', 'Cancelled', 'Completed', 'Consolidated' ) NOT NULL DEFAULT 'Scheduled',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`flight_schedule_id`),
  FOREIGN KEY (`flight_id`)
      REFERENCES `Flights`(`flight_id`),
  FOREIGN KEY (`aircraft_id`)
      REFERENCES `Aircraft`(`aircraft_id`),
  FOREIGN KEY (`gate_id`)
      REFERENCES `Gates`(`gate_id`)
);
CREATE TABLE `GateAssignment` (
  `Assignment_id` int AUTO_INCREMENT,
  `gate_id` int NOT NULL,
  `flight_schedule_id` int NOT NULL,
  `assigned_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  PRIMARY KEY (`Assignment_id`),
  FOREIGN KEY (`gate_id`)
      REFERENCES `Gates`(`gate_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);
CREATE TABLE `Aircraft_Maintenance` (
  `maintenance_id` int AUTO_INCREMENT,
  `aircraft_id` int NOT NULL,
  `maintenance_date` date NOT NULL,
  `maintenance_type` ENUM('Inspection','Repair','Engine Check','Cleaning') NOT NULL,
  `description` TEXT,
  `technical_issues_found` int DEFAULT 0,
  `status` ENUM('Scheduled','Completed', 'Cancelled') NOT NULL,
  PRIMARY KEY (`maintenance_id`),
  FOREIGN KEY (`aircraft_id`)
      REFERENCES `Aircraft`(`aircraft_id`)
);

CREATE TABLE `Runways` (
  `runway_id` int AUTO_INCREMENT,
  `airport_id` int NOT NULL,
  `runway_code` varchar(20) NOT NULL,
  `length` int NOT NULL,
  `status` ENUM ('active', 'maintenance') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`runway_id`),
  FOREIGN KEY (`airport_id`)
      REFERENCES `Airport`(`airport_id`)
);
CREATE TABLE `Runway_bookings` (
  `booking_id` int AUTO_INCREMENT,
  `runway_id` int NOT NULL,
  `aircraft_id` int NOT NULL,
  `booking_date` DATE NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `booking_status` ENUM('Reserved','Approved','Cancelled', 'Completed') NOT NULL DEFAULT 'Reserved',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`booking_id`),
  FOREIGN KEY (`aircraft_id`)
      REFERENCES `Aircraft`(`aircraft_id`),
  FOREIGN KEY (`runway_id`)
      REFERENCES `Runways`(`runway_id`)
);
CREATE TABLE `Cargo` (
  `cargo_id` int AUTO_INCREMENT,
  `flight_id` int NOT NULL,
  `tracking_number` varchar(10) UNIQUE NOT NULL,
  `cargo_type` ENUM ('General', 'Perishable', 'Hazardous', 'Fragile', 'Live Animals', 'Mail') NOT NULL,
  `description` text,
  `weight_kg` decimal(10,2) NOT NULL,
  `origin_airport_id` int NOT NULL,
  `destination_airport_id` int NOT NULL,
  `sender_name` varchar(50) NOT NULL,
  `sender_contact` varchar(50) NOT NULL,
  `reciever_name` varchar(50) NOT NULL,
  `reciever_contact` varchar(50) NOT NULL,
  `status` ENUM ('Booked', 'Loaded', 'In Transit', 'Unloaded', 'Customs Hold', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Booked',
  `is_insured` boolean DEFAULT FALSE,
  PRIMARY KEY (`cargo_id`),
  FOREIGN KEY (`flight_id`)
      REFERENCES `Flights`(`flight_id`),
  FOREIGN KEY (`origin_airport_id`)
      REFERENCES `Airport`(`airport_id`),
  FOREIGN KEY (`destination_airport_id`)
      REFERENCES `Airport`(`airport_id`)
);
CREATE TABLE `Passengers` (
  `passenger_id` int AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `gender` ENUM('male','female') NOT NULL,
  `passport_number` varchar(50) NOT NULL,
  `nationality` varchar(50) NOT NULL,
  `date_of_birth` date NOT NULL,
  `contact_number` varchar(50) NOT NULL,
  `email` varchar(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`passenger_id`)
);

CREATE TABLE `Tickets` (
  `ticket_id` int AUTO_INCREMENT,
  `passenger_id` int NOT NULL,
  `flight_schedule_id` int NOT NULL,
  `seat_number` varchar(50) NOT NULL,
  `seat_class` ENUM('Economy','Business','First') NOT NULL,
  `ticket_price` int NOT NULL,
  `booking_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Confirmed','Checked-In', 'Boarded','Cancelled','Moved') NOT NULL DEFAULT 'Confirmed',
  PRIMARY KEY (`ticket_id`),
  FOREIGN KEY (`passenger_id`)
      REFERENCES `Passengers`(`passenger_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);
CREATE TABLE `Baggage` (
  `Baggage_id` int AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `flight_schedule_id` int NOT NULL,
  `weight` decimal (8,2) NOT NULL,
  `baggage_type` ENUM('Checked','Carry-on','Cargo'),
  `status` ENUM('Checked-In','Loaded','In Transit','Unloaded','Lost') DEFAULT 'Checked-In',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Baggage_id`),
  FOREIGN KEY (`ticket_id`)
      REFERENCES `Tickets`(`ticket_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

CREATE TABLE `Boarding_records` (
  `boarding_id` int AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `flight_schedule_id` int NOT NULL,
  `boarding_time` DATETIME,
  `boarding_status` ENUM('Pending','Boarded','Denied') NOT NULL DEFAULT 'Pending',
  `gate_id` int NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`boarding_id`),
  FOREIGN KEY (`ticket_id`)
      REFERENCES `Tickets`(`ticket_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`),
  FOREIGN KEY (`gate_id`)
      REFERENCES `Gates`(`gate_id`)
);

CREATE TABLE `Staff` (
  `staff_id` int AUTO_INCREMENT,
  `airport_id` int NOT NULL,
  `first_name` VARCHAR(50),
  `last_name` VARCHAR(50),
  `role` ENUM( 'Pilot', 'Co-Pilot', 'Cabin Crew', 'Check-in Staff', 'Boarding Staff', 'Baggage Handler', 'Ramp Operator', 'Maintenance Crew', 'Supervisor' ) NOT NULL,
  `staff_type` ENUM('Flight Crew','Ground Staff') NOT NULL,
  `hire_date` DATE,
  `license_number` varchar(100), -- only for pilots
  `status` ENUM('Active','On Leave','Inactive') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_id`),
  FOREIGN KEY (`airport_id`)
      REFERENCES `Airport`(`airport_id`)
);

CREATE TABLE `Shifts` (
  `shift_id` int AUTO_INCREMENT,
  `staff_id` int NOT NULL,
  `shift_date` DATE NOT NULL,
  `shift_start` TIME NOT NULL,
  `shift_end` TIME NOT NULL,
  `availability_status` ENUM('Available','Assigned','Off') DEFAULT 'Available',
  PRIMARY KEY (`shift_id`),
  FOREIGN KEY (`staff_id`)
      REFERENCES `Staff`(`staff_id`)
);

CREATE TABLE `Tasks` (
  `task_id` int AUTO_INCREMENT,
  `flight_schedule_id` int NOT NULL,
  `task_type` ENUM( 'Pilot Operation', 'Cabin Preparation', 'Boarding', 'Baggage Loading', 'Baggage Unloading', 'Aircraft Cleaning', 'Technical Check' ) NOT NULL,
  `required_role` varchar(100) NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `task_status` ENUM('Pending','Assigned','In Progress','Completed') DEFAULT 'Pending',
  PRIMARY KEY (`task_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

CREATE TABLE `Task_Assignments` (
  `assignment_id` int AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `staff_id` int NOT NULL,
  `assignment_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `assignment_status` ENUM('Assigned','Completed','Cancelled') DEFAULT 'Assigned',
  `end_time` DATETIME,
  PRIMARY KEY (`assignment_id`),
  FOREIGN KEY (`task_id`)
      REFERENCES `Tasks`(`task_id`),
  FOREIGN KEY (`staff_id`)
      REFERENCES `Staff`(`staff_id`)
);

CREATE TABLE `Flight_consolidation` (
  `consolidation_id` int AUTO_INCREMENT,
  `original_flight_schedule_id` int NOT NULL,
  `new_flight_schedule_id` int NOT NULL,
  `reason` varchar(200) NOT NULL,
  `consolidation_date` DATETIME NOT NULL,
  PRIMARY KEY (`consolidation_id`),
  FOREIGN KEY (`original_flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`),
  FOREIGN KEY (`new_flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

CREATE TABLE `Payments` (
  `payment_id` int AUTO_INCREMENT,
  `ticket_id` int,
  `cargo_id` int,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` ENUM('Credit Card','Cash','Online Transfer') NOT NULL,
  `payment_status` ENUM('Pending','Completed','Failed') NOT NULL DEFAULT 'Pending',
  `payment_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  FOREIGN KEY (`cargo_id`)
      REFERENCES `Cargo`(`cargo_id`),
  FOREIGN KEY (`ticket_id`)
      REFERENCES `Tickets`(`ticket_id`)
);

CREATE TABLE `Flight_incidents` (
  `incident_id` int AUTO_INCREMENT,
  `flight_schedule_id` int NOT NULL,
  `incident_type` ENUM( 'Technical Issue', 'Weather Delay', 'Crew Issue', 'Security Issue', 'Emergency' ),
  `description` text,
  `reported_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP,
  `flight_status` ENUM('Open','Resolved') DEFAULT 'Open',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`incident_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

CREATE TABLE `Crew_requirements` (
  `requirement_id` int AUTO_INCREMENT,
  `flight_schedule_id` int NOT NULL,
  `role_required` varchar(100),
  `number_required` int NOT NULL,
  PRIMARY KEY (`requirement_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

CREATE TABLE `Flight_runway_usage` (
  `usage_id` int AUTO_INCREMENT,
  `runway_id` int NOT NULL,
  `flight_schedule_id` int NOT NULL,
  `operation_type` ENUM('Landing','Takeoff') NOT NULL,
  `actual_time` DATETIME NOT NULL,
  PRIMARY KEY (`usage_id`),
  FOREIGN KEY (`runway_id`)
      REFERENCES `Runways`(`runway_id`),
  FOREIGN KEY (`flight_schedule_id`)
      REFERENCES `Flight_schedules`(`flight_schedule_id`)
);

-- ======== Constraints ========

ALTER TABLE `Airport`
ADD CONSTRAINT `unique_airport_code`
UNIQUE (`airport_code`);

ALTER TABLE `Airline`
ADD CONSTRAINT `unique_airline_code`
UNIQUE (`airline_code`);

ALTER TABLE `Passengers`
ADD CONSTRAINT `unique_passport`
UNIQUE (`passport_number`);

ALTER TABLE `Tickets`
ADD CONSTRAINT `unique_seat_per_flight`
UNIQUE (`flight_schedule_id`, `seat_number`);

ALTER TABLE `Runway_bookings`
ADD CONSTRAINT `unique_runway_time`
UNIQUE (`runway_id`, `booking_date`, `start_time`);

ALTER TABLE `GateAssignment`
ADD CONSTRAINT `unique_gate_time`
UNIQUE (`gate_id`, `assigned_date`, `start_time`);


-- ========== Indexes ===========

CREATE INDEX `idx_flight_airline`
ON `Flights` (`airline_id`);

CREATE INDEX `idx_flight_route`
ON `Flights` (`source_airport_id`, `destination_airport_id`);

CREATE INDEX `idx_schedule_departure`
ON `Flight_schedules` (`departure_datetime`);

CREATE INDEX `idx_schedule_status`
ON `Flight_schedules` (`flight_status`);

CREATE INDEX `idx_ticket_passenger`
ON `Tickets` (`passenger_id`);

CREATE INDEX `idx_staff_role`
ON `Staff` (`role`);

CREATE INDEX `idx_task_schedule`
ON `Tasks` (`flight_schedule_id`);

CREATE INDEX `idx_aircraft_airline`
ON `Aircraft` (`airline_id`);

CREATE INDEX `idx_aircraft_current_airport`
ON `Aircraft` (`current_airport`);

CREATE INDEX `idx_schedule_flight`
ON `Flight_schedules` (`flight_id`);

CREATE INDEX `idx_ticket_schedule`
ON `Tickets` (`flight_schedule_id`);

CREATE INDEX `idx_boarding_schedule`
ON `Boarding_records` (`flight_schedule_id`);

CREATE INDEX `idx_baggage_schedule`
ON `Baggage` (`flight_schedule_id`);

CREATE INDEX `idx_cargo_flight`
ON `Cargo` (`flight_id`);

CREATE INDEX `idx_runway_booking_window`
ON `Runway_bookings` (`runway_id`, `booking_date`, `start_time`, `end_time`);

CREATE INDEX `idx_gate_assignment_window`
ON `GateAssignment` (`gate_id`, `assigned_date`, `start_time`, `end_time`);

-- ========== Triggers ==========


DELIMITER $$
CREATE TRIGGER after_boarding_update
AFTER UPDATE ON Boarding_records
FOR EACH ROW
BEGIN
    IF NEW.boarding_status = 'Boarded' THEN
        UPDATE Tickets
        SET status = 'Boarded'
        WHERE ticket_id = NEW.ticket_id;
    END IF;
END$$

DELIMITER $$
CREATE TRIGGER check_tasks_completion
AFTER UPDATE ON Tasks
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM Tasks
        WHERE flight_schedule_id = NEW.flight_schedule_id
          AND task_status <> 'Completed'
    ) THEN
        UPDATE Flight_schedules
        SET flight_status = 'Boarding'
        WHERE flight_schedule_id = NEW.flight_schedule_id;
    END IF;
END$$

DELIMITER $$
CREATE TRIGGER maintenance_status_update
AFTER INSERT ON Aircraft_Maintenance
FOR EACH ROW
BEGIN
    IF NEW.status = 'Scheduled' THEN
        UPDATE Aircraft
        SET status = 'Maintenance'
        WHERE aircraft_id = NEW.aircraft_id;
    END IF;
END$$

DELIMITER $$
CREATE TRIGGER after_task_assignment
AFTER INSERT ON Task_Assignments
FOR EACH ROW
BEGIN
    UPDATE Shifts
    SET availability_status = 'Assigned'
    WHERE staff_id = NEW.staff_id
    AND shift_date = DATE(NEW.assignment_time);
END$$
DELIMITER ;

-- ========== Views ==========
CREATE VIEW active_flights AS
SELECT 
    fs.flight_schedule_id,
    f.flight_number,
    a.airline_name,
    fs.departure_datetime,
    fs.arrival_datetime,
    fs.flight_status
FROM Flight_schedules fs
JOIN Flights f ON fs.flight_id = f.flight_id
JOIN Airline a ON f.airline_id = a.airline_id
WHERE fs.flight_status NOT IN ('Completed','Cancelled');


CREATE VIEW runway_booking_report AS
SELECT 
    r.runway_code,
    rb.booking_date,
    rb.start_time,
    rb.end_time,
    rb.booking_status
FROM Runway_bookings rb
JOIN Runways r ON rb.runway_id = r.runway_id;

CREATE VIEW passenger_data AS
SELECT 
    fs.flight_schedule_id,
    p.first_name,
    p.last_name,
    t.seat_number,
    t.status
FROM Tickets t
JOIN Passengers p ON t.passenger_id = p.passenger_id
JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id;


CREATE VIEW staff_task_overview AS
SELECT 
    s.first_name,
    s.last_name,
    s.role,
    t.task_type,
    ta.assignment_status
FROM Task_Assignments ta
JOIN Staff s ON ta.staff_id = s.staff_id
JOIN Tasks t ON ta.task_id = t.task_id;
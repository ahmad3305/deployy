# Jahhaazzz - Advanced Airport Management System

## 👋 About This Project

This project is a complete **Airport Management System** that we built to simulate how a real airline operates.

It’s not just about booking tickets — it handles flights, passengers, cargo, staff, payments, incidents, and more. We tried to keep everything realistic and properly connected using foreign keys.

---

## 🎯 What This System Covers

### 🛫 Flight Operations
- Flight routes and schedules
- Flight consolidation (when low-demand flights are merged)
- Flight incidents (weather delay, technical issues, emergencies, etc.)

### 👨‍✈️ Staff & Crew Management
- Pilots, cabin crew, ground staff, maintenance crew
- Shift management
- Crew requirements per flight
- Task assignment system

### 🎟 Ticket System
- Passenger booking
- Economy, Business, and First class
- Proper payment tracking
- Boarding records
- Baggage handling

### 📦 Cargo System
- Commercial cargo shipment
- Tracking numbers
- Cargo types (General, Fragile, Perishable, Hazardous, Live Animals, Mail)
- Insurance support
- Cargo payments

### 💰 Payments
- Ticket payments
- Cargo payments
- Completed, Pending, Failed status
---

## 🧠 Design Approach

We made sure:

- All foreign keys are properly connected
- Data is realistic and consistent
- Past and future records exist
- Payments happen before flight dates
- Crew requirements match aircraft needs
- Incidents don’t interfere with active flights
- Consolidation only happens in historical data

We didn’t just create tables randomly — everything is connected logically.

---

## 🗂 Main Tables

Some important tables in this system:

- `Flights`
- `Flight_schedules`
- `Passengers`
- `Tickets`
- `Boarding_Records`
- `Baggage`
- `Cargo`
- `Payments`
- `Staff`
- `Shifts`
- `Tasks`
- `Task_Assignments`
- `Crew_requirements`
- `Flight_incidents`
- `Flight_consolidation`

All relationships are maintained using foreign key constraints.

---

## 📊 Realism in Data

- Ticket prices vary by class
- Cargo price depends on weight and type
- Different payment methods used
- Crew numbers match operational standards

This system includes both **technical operations** and **business logic**.
---

## 🚀 Final Words

This is a complete and structured Airport Management System database with realistic data and proper logical flow.

Not just tables.

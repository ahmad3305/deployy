-- performance.sql -----> 3+ queries with EXPLAIN ANALYZE
-- Before indexing is measured by forcing the optimizer to ignore your manual indexing created
-- via IGNORE INDEX.
-- After indexing uses the indexes normally.


-- Query 1: Flight search by flight_schedule + flights + Airline where id = 1
-- BEFORE INDEXING
EXPLAIN ANALYZE
SELECT fs.flight_schedule_id, f.flight_number, a.airline_name 
		FROM Flight_schedules fs
		JOIN Flights f IGNORE INDEX (idx_flight_airline)
		ON fs.flight_id = f.flight_id
		JOIN Airline a
		ON f.airline_id = a.airline_id
WHERE f.airline_id = 1;

-- -> Nested loop inner join  (cost=0.9 rows=1) (actual time=0.0587..0.122 rows=1 loops=1)\n    
-- -> Filter: (f.airline_id = 1)  (cost=0.55 rows=1) (actual time=0.0356..0.0884 rows=1 loops=1)\n        
-- -> Table scan on f  (cost=0.55 rows=3) (actual time=0.0335..0.084 rows=3 loops=1)\n    
-- -> Covering index lookup on fs using flight_id (flight_id=f.flight_id)  (cost=0.35 rows=1) (actual time=0.0205..0.0288 rows=1 loops=1)\n'

-- AFTER INDEXING
EXPLAIN ANALYZE
SELECT fs.flight_schedule_id, f.flight_number, a.airline_name
		FROM Flight_schedules fs
		JOIN Flights f
		ON fs.flight_id = f.flight_id
		JOIN Airline a
		ON f.airline_id = a.airline_id
WHERE f.airline_id = 1;

-- '-> Nested loop inner join  (cost=0.7 rows=1) (actual time=0.0429..0.0493 rows=1 loops=1)\n    
-- -> Index lookup on f using idx_flight_airline (airline_id=1)  (cost=0.35 rows=1) (actual time=0.0286..0.0301 rows=1 loops=1)\n 
-- -> Covering index lookup on fs using flight_id (flight_id=f.flight_id)  (cost=0.35 rows=1) (actual time=0.0096..0.0136 rows=1 loops=1)\n'


-- ========================================================================================


-- Query 2: Filtering Passengers info between id 100 and 200
-- BEFORE INDEXING
EXPLAIN ANALYZE
SELECT t.ticket_id, p.first_name, f.flight_number, fs.departure_datetime
		FROM Tickets t IGNORE INDEX (idx_ticket_passenger)
		JOIN Passengers p
		ON t.passenger_id = p.passenger_id
		JOIN Flight_schedules fs
		ON t.flight_schedule_id = fs.flight_schedule_id
		JOIN Flights f
		ON fs.flight_id = f.flight_id
WHERE t.passenger_id > 100 AND t.passenger_id <200 order by t.passenger_id asc;

-- '-> Sort: t.passenger_id  (actual time=1.65..1.66 rows=80 loops=1)\n    
-- -> Stream results  (cost=2.77 rows=0.333) (actual time=0.314..1.37 rows=80 loops=1)\n        
-- -> Nested loop inner join  (cost=2.77 rows=0.333) (actual time=0.3..1.22 rows=80 loops=1)\n            
-- -> Nested loop inner join  (cost=2.65 rows=0.333) (actual time=0.288..0.737 rows=80 loops=1)\n               
-- -> Nested loop inner join  (cost=1.6 rows=3) (actual time=0.0707..0.0882 rows=3 loops=1)\n                    
-- -> Table scan on fs  (cost=0.55 rows=3) (actual time=0.0497..0.0566 rows=3 loops=1)\n                   
-- -> Single-row index lookup on f using PRIMARY (flight_id=fs.flight_id)  (cost=0.283 rows=1) (actual time=0.00903..0.0091 rows=1 loops=3)\n              
--  -> Filter: ((t.passenger_id > 100) and (t.passenger_id < 200))  (cost=0.254 rows=0.111) (actual time=0.0779..0.212 rows=26.7 loops=3)\n                   
-- -> Index lookup on t using unique_seat_per_flight (flight_schedule_id=fs.flight_schedule_id)  (cost=0.254 rows=1) (actual time=0.0306..0.189 rows=60 loops=3)\n           
-- -> Single-row index lookup on p using PRIMARY (passenger_id=t.passenger_id)  (cost=0.55 rows=1) (actual time=0.00558..0.00564 rows=1 loops=80)\n'

-- AFTER INDEXING
EXPLAIN ANALYZE
SELECT t.ticket_id, p.first_name, f.flight_number, fs.departure_datetime
		FROM Tickets t
		JOIN Passengers p
		ON t.passenger_id = p.passenger_id
		JOIN Flight_schedules fs
		ON t.flight_schedule_id = fs.flight_schedule_id
		JOIN Flights f
		ON fs.flight_id = f.flight_id
WHERE t.passenger_id = 1;

-- '-> Nested loop inner join  (cost=1.05 rows=1) (actual time=0.0733..0.0769 rows=1 loops=1)\n    
-- -> Nested loop inner join  (cost=0.7 rows=1) (actual time=0.0637..0.0671 rows=1 loops=1)\n        
-- -> Index lookup on t using idx_ticket_passenger (passenger_id=1)  (cost=0.35 rows=1) (actual time=0.0247..0.0278 rows=1 loops=1)\n        
-- -> Single-row index lookup on fs using PRIMARY (flight_schedule_id=t.flight_schedule_id)  (cost=0.35 rows=1) (actual time=0.0367..0.0367 rows=1 loops=1)\n    
-- -> Single-row index lookup on f using PRIMARY (flight_id=fs.flight_id)  (cost=0.35 rows=1) (actual time=0.0083..0.0084 rows=1 loops=1)\n'

-- ========================================================================================
-- Query 3: Upcoming scheduled/boarding departures in a time window
-- BEFORE INDEXING 
EXPLAIN ANALYZE
SELECT fs.flight_schedule_id, fs.departure_datetime, fs.flight_status, f.flight_number, al.airline_name,
	   src.airport_code AS source_airport, dest.airport_code AS destination_airport
		FROM Flight_schedules fs IGNORE INDEX (idx_schedule_departure, idx_schedule_status)
		JOIN Flights f
		ON fs.flight_id = f.flight_id
		JOIN Airline al
		ON f.airline_id = al.airline_id
		JOIN Airport src
		ON f.source_airport_id = src.airport_id
		JOIN Airport dest
		ON f.destination_airport_id = dest.airport_id
WHERE fs.departure_datetime >= '2026-03-01 00:00:00' AND fs.departure_datetime <  '2026-03-02 00:00:00'
		AND fs.flight_status IN ('Scheduled','Boarding')
		ORDER BY fs.departure_datetime;
        
-- '-> Nested loop inner join  (cost=2.75 rows=3) (actual time=0.671..0.712 rows=3 loops=1)\n    
-- -> Nested loop inner join  (cost=2.2 rows=3) (actual time=0.511..0.542 rows=3 loops=1)\n        
-- -> Nested loop inner join  (cost=1.65 rows=3) (actual time=0.405..0.425 rows=3 loops=1)\n            
-- -> Nested loop inner join  (cost=1.1 rows=3) (actual time=0.222..0.24 rows=3 loops=1)\n                
-- -> Sort: fs.departure_datetime  (cost=0.55 rows=3) (actual time=0.185..0.187 rows=3 loops=1)\n                    
-- -> Filter: ((fs.departure_datetime >= TIMESTAMP\'2026-03-01 00:00:00\') and (fs.departure_datetime < TIMESTAMP\'2026-03-02 00:00:00\') and (fs.flight_status in (\'Scheduled\',\'Boarding\')))  (cost=0.55 rows=3) (actual time=0.0714..0.0896 rows=3 loops=1)\n                        
-- -> Table scan on fs  (cost=0.55 rows=3) (actual time=0.0576..0.0701 rows=3 loops=1)\n                
-- -> Single-row index lookup on f using PRIMARY (flight_id=fs.flight_id)  (cost=0.35 rows=1) (actual time=0.0168..0.0168 rows=1 loops=3)\n          
--  -> Single-row index lookup on src using PRIMARY (airport_id=f.source_airport_id)  (cost=0.35 rows=1) (actual time=0.0609..0.0609 rows=1 loops=3)\n       
-- -> Single-row index lookup on dest using PRIMARY (airport_id=f.destination_airport_id)  (cost=0.35 rows=1) (actual time=0.0382..0.0382 rows=1 loops=3)\n   
-- -> Single-row index lookup on al using PRIMARY (airline_id=f.airline_id)  (cost=0.35 rows=1) (actual time=0.0556..0.0557 rows=1 loops=3)\n'


-- AFTER INDEXING 
EXPLAIN ANALYZE
SELECT fs.flight_schedule_id, fs.departure_datetime, fs.flight_status, f.flight_number, al.airline_name,
	   src.airport_code AS source_airport, dest.airport_code AS destination_airport
		FROM Flight_schedules fs
		JOIN Flights f
		ON fs.flight_id = f.flight_id
		JOIN Airline al
		ON f.airline_id = al.airline_id
		JOIN Airport src
		ON f.source_airport_id = src.airport_id
		JOIN Airport dest
		ON f.destination_airport_id = dest.airport_id
WHERE fs.departure_datetime >= '2026-03-01 00:00:00' AND fs.departure_datetime <  '2026-03-02 00:00:00'
		AND fs.flight_status IN ('Scheduled','Boarding')
		ORDER BY fs.departure_datetime;
        
-- '-> Sort: fs.departure_datetime  (actual time=0.456..0.457 rows=3 loops=1)\n    
-- -> Stream results  (cost=4.75 rows=3) (actual time=0.255..0.408 rows=3 loops=1)\n        
-- -> Nested loop inner join  (cost=4.75 rows=3) (actual time=0.236..0.38 rows=3 loops=1)\n            
-- -> Nested loop inner join  (cost=3.7 rows=3) (actual time=0.227..0.36 rows=3 loops=1)\n                
-- -> Nested loop inner join  (cost=2.65 rows=3) (actual time=0.219..0.337 rows=3 loops=1)\n                   
-- -> Nested loop inner join  (cost=1.6 rows=3) (actual time=0.2..0.314 rows=3 loops=1)\n                       
-- -> Table scan on f  (cost=0.55 rows=3) (actual time=0.0852..0.089 rows=3 loops=1)\n                       
-- -> Filter: ((fs.departure_datetime >= TIMESTAMP\'2026-03-01 00:00:00\') and (fs.departure_datetime < TIMESTAMP\'2026-03-02 00:00:00\') and (fs.flight_status in (\'Scheduled\',\'Boarding\')))  (cost=0.283 rows=1) (actual time=0.0701..0.0739 rows=1 loops=3)\n                            
-- -> Index lookup on fs using flight_id (flight_id=f.flight_id)  (cost=0.283 rows=1) (actual time=0.0636..0.0672 rows=1 loops=3)\n                    
-- -> Single-row index lookup on src using PRIMARY (airport_id=f.source_airport_id)  (cost=0.283 rows=1) (actual time=0.00653..0.0066 rows=1 loops=3)\n               
-- -> Single-row index lookup on dest using PRIMARY (airport_id=f.destination_airport_id)  (cost=0.283 rows=1) (actual time=0.00707..0.00713 rows=1 loops=3)\n            
-- -> Single-row index lookup on al using PRIMARY (airline_id=f.airline_id)  (cost=0.283 rows=1) (actual time=0.0057..0.0058 rows=1 loops=3)\n'


-- ========================================================================================
-- Query 4: Staff roster for flights in a date window

-- BEFORE INDEXING 
EXPLAIN ANALYZE
SELECT s.staff_id, CONCAT(s.first_name, ' ', s.last_name) AS staff_name, s.role, fs.flight_schedule_id,
	f.flight_number, t.task_type,t.start_time,t.end_time, ta.assignment_status
		FROM Staff s IGNORE INDEX (idx_staff_role)
		JOIN Task_Assignments ta
		ON ta.staff_id = s.staff_id
		JOIN Tasks t IGNORE INDEX (idx_task_schedule)
		ON t.task_id = ta.task_id
		JOIN Flight_schedules fs
		ON fs.flight_schedule_id = t.flight_schedule_id
		JOIN Flights f
		ON f.flight_id = fs.flight_id
WHERE s.role IN ('Pilot','Co-Pilot','Cabin Crew')
		AND t.start_time >= '2026-03-01 00:00:00'
		AND t.start_time <  '2026-03-04 00:00:00'
		ORDER BY s.role, t.start_time;
        
-- '-> Sort: s.`role`, t.start_time  (actual time=2.12..2.12 rows=6 loops=1)\n    
-- -> Stream results  (cost=4.08 rows=0.555) (actual time=1.48..1.99 rows=6 loops=1)\n        
-- -> Nested loop inner join  (cost=4.08 rows=0.555) (actual time=0.965..1.44 rows=6 loops=1)\n            
-- -> Nested loop inner join  (cost=3.5 rows=1.67) (actual time=0.801..1.16 rows=15 loops=1)\n               
-- -> Nested loop inner join  (cost=2.92 rows=1.67) (actual time=0.602..0.761 rows=15 loops=1)\n                    
-- -> Nested loop inner join  (cost=2.33 rows=1.67) (actual time=0.577..0.712 rows=15 loops=1)\n                        
-- -> Filter: ((t.start_time >= TIMESTAMP\'2026-03-01 00:00:00\') and (t.start_time < TIMESTAMP\'2026-03-04 00:00:00\'))  (cost=1.75 rows=1.67) (actual time=0.519..0.618 rows=15 loops=1)\n                            
-- -> Table scan on t  (cost=1.75 rows=15) (actual time=0.511..0.589 rows=15 loops=1)\n                        
-- -> Single-row index lookup on fs using PRIMARY (flight_schedule_id=t.flight_schedule_id)  (cost=0.31 rows=1) (actual time=0.00525..0.00531 rows=1 loops=15)\n                    
-- -> Single-row index lookup on f using PRIMARY (flight_id=fs.flight_id)  (cost=0.31 rows=1) (actual time=0.0028..0.00285 rows=1 loops=15)\n                
-- -> Index lookup on ta using task_id (task_id=t.task_id)  (cost=0.31 rows=1) (actual time=0.022..0.0256 rows=1 loops=15)\n            
-- -> Filter: (s.`role` in (\'Pilot\',\'Co-Pilot\',\'Cabin Crew\'))  (cost=0.27 rows=0.333) (actual time=0.0183..0.0184 rows=0.4 loops=15)\n                
-- -> Single-row index lookup on s using PRIMARY (staff_id=ta.staff_id)  (cost=0.27 rows=1) (actual time=0.016..0.0161 rows=1 loops=15)\n'


-- AFTER INDEXING 
EXPLAIN ANALYZE
SELECT s.staff_id, CONCAT(s.first_name, ' ', s.last_name) AS staff_name, s.role, fs.flight_schedule_id,
	f.flight_number, t.task_type,t.start_time,t.end_time, ta.assignment_status
		FROM Staff s 
		JOIN Task_Assignments ta
		ON ta.staff_id = s.staff_id
		JOIN Tasks t 
		ON t.task_id = ta.task_id
		JOIN Flight_schedules fs
		ON fs.flight_schedule_id = t.flight_schedule_id
		JOIN Flights f
		ON f.flight_id = fs.flight_id
WHERE s.role IN ('Pilot','Co-Pilot','Cabin Crew')
		AND t.start_time >= '2026-03-01 00:00:00'
		AND t.start_time <  '2026-03-04 00:00:00'
		ORDER BY s.role, t.start_time;
        
-- '-> Sort: s.`role`, t.start_time  (actual time=0.376..0.377 rows=6 loops=1)\n    
-- -> Stream results  (cost=2.88 rows=0.179) (actual time=0.106..0.347 rows=6 loops=1)\n        
-- -> Nested loop inner join  (cost=2.88 rows=0.179) (actual time=0.0939..0.315 rows=6 loops=1)\n            
-- -> Nested loop inner join  (cost=2.77 rows=0.333) (actual time=0.084..0.24 rows=15 loops=1)\n                
-- -> Nested loop inner join  (cost=2.65 rows=0.333) (actual time=0.0737..0.131 rows=15 loops=1)\n                    
-- -> Nested loop inner join  (cost=1.6 rows=3) (actual time=0.0433..0.0528 rows=3 loops=1)\n                        
-- -> Covering index scan on fs using flight_id  (cost=0.55 rows=3) (actual time=0.0275..0.0298 rows=3 loops=1)\n                        
-- -> Single-row index lookup on f using PRIMARY (flight_id=fs.flight_id)  (cost=0.283 rows=1) (actual time=0.0068..0.00683 rows=1 loops=3)\n                    
-- -> Filter: ((t.start_time >= TIMESTAMP\'2026-03-01 00:00:00\') and (t.start_time < TIMESTAMP\'2026-03-04 00:00:00\'))  (cost=0.254 rows=0.111) (actual time=0.0192..0.0248 rows=5 loops=3)\n                        
-- -> Index lookup on t using idx_task_schedule (flight_schedule_id=fs.flight_schedule_id)  (cost=0.254 rows=1) (actual time=0.0177..0.0205 rows=5 loops=3)\n               
-- -> Index lookup on ta using task_id (task_id=t.task_id)  (cost=0.55 rows=1) (actual time=0.00535..0.00696 rows=1 loops=15)\n           
-- -> Filter: (s.`role` in (\'Pilot\',\'Co-Pilot\',\'Cabin Crew\'))  (cost=0.412 rows=0.538) (actual time=0.00457..0.00465 rows=0.4 loops=15)\n                
-- -> Single-row index lookup on s using PRIMARY (staff_id=ta.staff_id)  (cost=0.412 rows=1) (actual time=0.00356..0.00359 rows=1 loops=15)\n'


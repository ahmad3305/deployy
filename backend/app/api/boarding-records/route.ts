import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { boardingRecordCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');
    const gate_id = searchParams.get('gate_id');
    const passenger_id = searchParams.get('passenger_id');
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const boarding_status = searchParams.get('boarding_status');
    const boarding_date = searchParams.get('boarding_date');

    let sql = `
      SELECT 
        br.*,
        t.seat_number,
        t.seat_class,
        t.status as ticket_status,
        p.first_name,
        p.last_name,
        p.email,
        p.passport_number,
        fs.flight_schedule_id,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        g.gate_number,
        term.terminal_name,
        term.terminal_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code
      FROM Boarding_records br
      LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Gates g ON br.gate_id = g.gate_id
      LEFT JOIN Terminals term ON g.terminal_id = term.terminal_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (ticket_id) {
      sql += ' AND br.ticket_id = ?';
      params.push(parseInt(ticket_id));
    }

    if (gate_id) {
      sql += ' AND br.gate_id = ?';
      params.push(parseInt(gate_id));
    }

    if (passenger_id) {
      sql += ' AND p.passenger_id = ?';
      params.push(parseInt(passenger_id));
    }

    if (flight_schedule_id) {
      sql += ' AND fs.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    if (boarding_status) {
      sql += ' AND br.boarding_status = ?';
      params.push(boarding_status);
    }

    if (boarding_date) {
      sql += ' AND DATE(br.boarding_time) = ?';
      params.push(boarding_date);
    }

    sql += ' ORDER BY br.boarding_time DESC';

    const records = await query(sql, params);

    return successResponse(records, 'Boarding records retrieved successfully');
  } catch (error: any) {
    console.error('Get boarding records error:', error);
    return errorResponse('Failed to retrieve boarding records: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(boardingRecordCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const ticket = await queryOne<any>(
      `SELECT t.*, fs.flight_schedule_id, fs.gate_id as scheduled_gate_id, fs.departure_datetime, fs.flight_status
       FROM Tickets t
       LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
       WHERE t.ticket_id = ?`,
      [data.ticket_id]
    );

    if (!ticket) {
      return errorResponse('Ticket not found', 404);
    }

    if (ticket.status === 'Cancelled') {
      return errorResponse('Cannot board with cancelled ticket', 400);
    }

    if (ticket.status === 'Boarded') {
      return errorResponse('Ticket has already been boarded', 409);
    }

    if (ticket.flight_status === 'Cancelled') {
      return errorResponse('Cannot board cancelled flight', 400);
    }

    if (ticket.flight_status === 'Completed') {
      return errorResponse('Cannot board completed flight', 400);
    }

    const gate = await queryOne<any>(
      'SELECT * FROM Gates WHERE gate_id = ?',
      [data.gate_id]
    );

    if (!gate) {
      return errorResponse('Gate not found', 404);
    }

    if (ticket.scheduled_gate_id && ticket.scheduled_gate_id !== data.gate_id) {
      console.warn(`Warning: Gate mismatch. Ticket scheduled for gate ${ticket.scheduled_gate_id}, boarding at gate ${data.gate_id}`);
    }

    if (gate.status === 'maintenance') {
      return errorResponse('Gate is under maintenance and not available for boarding', 400);
    }

    const existingRecord = await queryOne(
      'SELECT boarding_id FROM Boarding_records WHERE ticket_id = ?',
      [data.ticket_id]
    );

    if (existingRecord) {
      return errorResponse('Boarding record already exists for this ticket', 409);
    }

    const boardingTime = new Date(data.boarding_time);
    const departureTime = new Date(ticket.departure_datetime);

    if (boardingTime > departureTime) {
      return errorResponse('Boarding time cannot be after departure time', 400);
    }

    const result = await query<any>(
      `INSERT INTO Boarding_records (
        ticket_id, flight_schedule_id, gate_id, boarding_time, boarding_status
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        data.ticket_id,
        ticket.flight_schedule_id,
        data.gate_id,
        data.boarding_time,
        data.boarding_status || 'Pending'
      ]
    );

    if (data.boarding_status === 'Boarded') {
      await query(
        'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
        ['Boarded', data.ticket_id]
      );
    }

    const newRecord = await queryOne(
      `SELECT 
        br.*,
        t.seat_number,
        t.seat_class,
        p.first_name,
        p.last_name,
        p.email,
        p.passport_number,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name,
        g.gate_number,
        term.terminal_name
      FROM Boarding_records br
      LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Gates g ON br.gate_id = g.gate_id
      LEFT JOIN Terminals term ON g.terminal_id = term.terminal_id
      WHERE br.boarding_id = ?`,
      [result.insertId]
    );

    return createdResponse(newRecord, 'Boarding record created successfully');
  } catch (error: any) {
    console.error('Create boarding record error:', error);
    return errorResponse('Failed to create boarding record: ' + error.message, 500);
  }
}
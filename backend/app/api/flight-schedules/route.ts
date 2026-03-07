import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {

    const [rows] = await pool.query(`
      SELECT 
        fs.schedule_id,
        f.flight_number,
        fs.departure_time,
        fs.arrival_time,
        fs.status
      FROM Flight_Schedules fs
      JOIN Flights f
      ON fs.flight_id = f.flight_id
    `);

    return NextResponse.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
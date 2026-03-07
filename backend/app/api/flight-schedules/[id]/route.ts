import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {

    const [rows]: any = await pool.query(
      `SELECT 
        fs.*,
        f.flight_number
      FROM Flight_Schedules fs
      JOIN Flights f
      ON fs.flight_id = f.flight_id
      WHERE fs.schedule_id = ?`,
      [params.id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
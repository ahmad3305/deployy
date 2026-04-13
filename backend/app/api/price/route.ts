import { NextRequest } from "next/server";
import { priceValidationSchema } from "@/lib/validations";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/response";
import { handleOptions } from "@/lib/cors";

export function OPTIONS() { return handleOptions(); }

export const GET = async () => {
  try {
    const prices = await query(
      `SELECT p.*, 
        sa.airport_name AS source_airport_name, sa.airport_code AS source_airport_code,
        da.airport_name AS dest_airport_name, da.airport_code AS dest_airport_code
      FROM Price p
      JOIN Airport sa ON p.source_airport_id = sa.airport_id
      JOIN Airport da ON p.destination_airport_id = da.airport_id
      ORDER BY source_airport_id, destination_airport_id`
    );
    return successResponse(prices);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
};

export const POST = requireAdmin(async (req: NextRequest) => {
  try {
    const data = await req.json();
    const validated = priceValidationSchema.parse(data);

    const existing = await queryOne(
      `SELECT * FROM Price WHERE source_airport_id=? AND destination_airport_id=?`,
      [validated.source_airport_id, validated.destination_airport_id]
    );
    if (existing) return errorResponse("Price already exists for this route", 409);

    const result = await query(
      `INSERT INTO Price 
        (source_airport_id, destination_airport_id, economy_price, business_price, first_class_price) 
      VALUES (?, ?, ?, ?, ?)`,
      [
        validated.source_airport_id,
        validated.destination_airport_id,
        validated.economy_price,
        validated.business_price,
        validated.first_class_price,
      ]
    );
    return successResponse({ price_id: result.insertId }, "Price added");
  } catch (e: any) {
    if (e?.issues) return errorResponse(e.issues[0]?.message || "Invalid data", 400);
    return errorResponse(e.message, 500);
  }
});
// app/api/price/[id]/route.ts
import { NextRequest } from "next/server";
import { priceUpdateSchema } from "@/lib/validations";
import { queryOne, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/response";
import { handleOptions } from "@/lib/cors";

export function OPTIONS() { return handleOptions(); }

export const GET = async (_req: NextRequest, { params }: any) => {
  try {
    const price = await queryOne(`SELECT * FROM Price WHERE price_id = ?`, [params.id]);
    if (!price) return errorResponse("Not found", 404);
    return successResponse(price);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
};

export const PATCH = requireAdmin(async (req: NextRequest, { params }: any) => {
  try {
    const data = await req.json();
    const validated = priceUpdateSchema.parse(data);

    const fields = [];
    const values: any[] = [];
    if (validated.economy_price !== undefined) {
      fields.push("economy_price=?"); values.push(validated.economy_price);
    }
    if (validated.business_price !== undefined) {
      fields.push("business_price=?"); values.push(validated.business_price);
    }
    if (validated.first_class_price !== undefined) {
      fields.push("first_class_price=?"); values.push(validated.first_class_price);
    }
    if (!fields.length) return errorResponse("No fields to update", 400);
    values.push(params.id);

    const result = await query(
      `UPDATE Price SET ${fields.join(", ")} WHERE price_id=?`,
      values
    );
    return successResponse(null, "Updated successfully");
  } catch (e: any) {
    if (e?.issues) return errorResponse(e.issues[0]?.message || "Invalid data", 400);
    return errorResponse(e.message, 500);
  }
});

export const DELETE = requireAdmin(async (_req: NextRequest, { params }: any) => {
  try {
    await query(`DELETE FROM Price WHERE price_id=?`, [params.id]);
    return successResponse(null, "Deleted successfully");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
});
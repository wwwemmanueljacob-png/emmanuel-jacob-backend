import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
ADMIN REPAYMENT SCHEDULES
JAY C O B FINANCIAL SERVICES
=====================================================
*/

router.get("/", async (req, res) => {
  try {

    const {
      data,
      error
    } = await supabase
      .from("loan_schedules")
      .select(`
        id,
        created_at,
        loan_id,
        customer_id,
        installment_number,
        due_date,
        amount_due,
        amount_paid,
        remaining_amount,
        status,
        paid_date
      `)
      .order(
        "due_date",
        { ascending: true }
      );

    if (error) {

      console.error(
        "Admin schedules fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve repayment schedules",
        error:
          error.message
      });

    }

    return res.json({
      success: true,
      schedules:
        data || []
    });

  } catch (error) {

    console.error(
      "Admin schedules server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Server error",
      error:
        error.message
    });

  }
});

export default router;

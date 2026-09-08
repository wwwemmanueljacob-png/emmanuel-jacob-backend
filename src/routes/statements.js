import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   GET CUSTOMER ACCOUNT STATEMENTS
   GET /api/statements/customer/:customerId
========================================================= */

router.get(
  "/api/statements/customer/:customerId",
  async (req, res) => {
    try {
      const customerId = Number(req.params.customerId);

      if (!Number.isInteger(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID."
        });
      }

      const { data, error } = await supabase
        .from("statements")
        .select(`
          id,
          created_at,
          customer_id,
          account_id,
          transaction_id,
          transaction_type,
          reference_number,
          description,
          debit,
          credit,
          balance_after,
          transaction_date
        `)
        .eq("customer_id", customerId)
        .order("transaction_date", {
          ascending: false
        });

      if (error) {
        console.error(
          "STATEMENTS DATABASE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load account statements."
        });
      }

      return res.json({
        success: true,
        statements: data || []
      });

    } catch (error) {
      console.error(
        "STATEMENTS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error while loading statements."
      });
    }
  }
);

export default router;

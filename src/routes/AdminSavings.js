import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL ADMIN SAVINGS
========================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("savings")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        transaction_type,
        reference_number,
        description,
        balance_after,
        status,
        processed_by
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin savings error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load savings.",
        error: error.message
      });
    }

    res.json({
      success: true,
      savings: data || []
    });

  } catch (error) {
    console.error("Admin savings server error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load savings.",
      error: error.message
    });
  }
});


/* =========================================
   GET SINGLE SAVINGS RECORD
========================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("savings")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        transaction_type,
        reference_number,
        description,
        balance_after,
        status,
        processed_by
      `)
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Savings record not found.",
        error: error.message
      });
    }

    res.json({
      success: true,
      saving: data
    });

  } catch (error) {
    console.error("Single savings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load savings record.",
      error: error.message
    });
  }
});


export default router;

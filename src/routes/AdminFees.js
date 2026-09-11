import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL ADMIN FEES
========================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("fees")
      .select(`
        id,
        created_at,
        customer_id,
        loan_id,
        fee_type,
        amount,
        description,
        status,
        reference_number,
        paid_at,
        processed_by
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin fees error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load fees.",
        error: error.message
      });
    }

    res.json({
      success: true,
      fees: data || []
    });

  } catch (error) {
    console.error("Admin fees server error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load fees.",
      error: error.message
    });
  }
});


/* =========================================
   GET SINGLE FEE
========================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("fees")
      .select(`
        id,
        created_at,
        customer_id,
        loan_id,
        fee_type,
        amount,
        description,
        status,
        reference_number,
        paid_at,
        processed_by
      `)
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Fee not found.",
        error: error.message
      });
    }

    res.json({
      success: true,
      fee: data
    });

  } catch (error) {
    console.error("Single fee error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load fee.",
      error: error.message
    });
  }
});


export default router;

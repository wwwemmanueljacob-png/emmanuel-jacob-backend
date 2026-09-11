import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL ADMIN DEPOSITS
========================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        payment_method,
        reference_number,
        status,
        description,
        processed_by,
        processed_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin deposits error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load deposits.",
        error: error.message
      });
    }

    res.json({
      success: true,
      deposits: data || []
    });

  } catch (error) {
    console.error("Admin deposits server error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load deposits.",
      error: error.message
    });
  }
});


/* =========================================
   GET SINGLE DEPOSIT
========================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        payment_method,
        reference_number,
        status,
        description,
        processed_by,
        processed_at
      `)
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Deposit not found.",
        error: error.message
      });
    }

    res.json({
      success: true,
      deposit: data
    });

  } catch (error) {
    console.error("Single deposit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load deposit.",
      error: error.message
    });
  }
});


export default router;

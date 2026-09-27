import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


/* =========================================
   GET ALL ADMIN SAVINGS DEPOSITS
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
      .order("created_at", {
        ascending: false
      });


    if (error) {

      console.error(
        "Admin savings deposits error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load savings deposits.",
        error: error.message
      });

    }


    return res.json({
      success: true,
      savings: data || []
    });


  } catch (error) {

    console.error(
      "Admin savings deposits server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load savings deposits.",
      error: error.message
    });

  }
});


/* =========================================
   GET SINGLE SAVINGS DEPOSIT
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

      console.error(
        "Single savings deposit error:",
        error
      );

      return res.status(404).json({
        success: false,
        message: "Savings deposit not found.",
        error: error.message
      });

    }


    return res.json({
      success: true,
      saving: data
    });


  } catch (error) {

    console.error(
      "Single savings deposit server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load savings deposit.",
      error: error.message
    });

  }
});


export default router;

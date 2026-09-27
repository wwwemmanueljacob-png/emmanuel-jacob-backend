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

/* =========================================
   APPROVE / REJECT SAVINGS DEPOSIT
========================================= */

router.put("/:id/status", async (req, res) => {
  try {

    const depositId =
      Number(req.params.id);

    const {
      status,
      rejection_reason
    } = req.body;


    /* ==============================
       VALIDATE ID
    ============================== */

    if (!Number.isInteger(depositId)) {

      return res.status(400).json({
        success: false,
        message: "Invalid savings deposit ID."
      });

    }


    /* ==============================
       VALIDATE STATUS
    ============================== */

    const newStatus =
      String(status || "")
        .trim()
        .toUpperCase();


    if (
      newStatus !== "COMPLETED" &&
      newStatus !== "REJECTED"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Status must be COMPLETED or REJECTED."
      });

    }


    /* ==============================
       REJECTION REASON
    ============================== */

    if (
      newStatus === "REJECTED" &&
      !String(
        rejection_reason || ""
      ).trim()
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required."
      });

    }


    /* ==============================
       FIND DEPOSIT
    ============================== */

    const {
      data: deposit,
      error: depositError
    } = await supabase
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .single();


    if (depositError || !deposit) {

      return res.status(404).json({
        success: false,
        message:
          "Savings deposit not found.",
        error:
          depositError?.message || null
      });

    }


    /* ==============================
       ONLY PENDING DEPOSITS
       CAN BE PROCESSED
    ============================== */

    if (
      String(deposit.status || "")
        .toUpperCase() !== "PENDING"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Only pending savings deposits can be processed."
      });

    }


    /* ==============================
       UPDATE DEPOSIT
    ============================== */

    const updateData = {

      status:
        newStatus,

      processed_by:
        req.admin?.id || null,

      processed_at:
        new Date().toISOString()

    };


    if (newStatus === "REJECTED") {

      updateData.rejection_reason =
        String(
          rejection_reason
        ).trim();

    }


    const {
      data: updatedDeposit,
      error: updateError
    } = await supabase
      .from("deposits")
      .update(updateData)
      .eq("id", depositId)
      .select()
      .single();


    if (updateError) {

      console.error(
        "SAVE DEPOSIT STATUS UPDATE ERROR:",
        updateError
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update savings deposit.",
        error:
          updateError.message
      });

    }


    /* ==============================
       SUCCESS
    ============================== */

    return res.json({

      success: true,

      message:
        newStatus === "COMPLETED"
          ? "Savings deposit approved successfully."
          : "Savings deposit rejected successfully.",

      deposit:
        updatedDeposit

    });


  } catch (error) {

    console.error(
      "ADMIN SAVINGS STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to process savings deposit.",
      error:
        error.message
    });

  }
});


export default router;

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
   RECORD NEW DEPOSIT
========================================= */

router.post("/", async (req, res) => {
  try {

    const {
      customer_id,
      account_id,
      amount,
      payment_method,
      reference_number,
      description,
      status
    } = req.body;

    /* -------------------------------
       VALIDATE CUSTOMER
    -------------------------------- */

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer is required."
      });
    }

    /* -------------------------------
       VALIDATE AMOUNT
    -------------------------------- */

    const depositAmount = Number(amount);

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid deposit amount greater than zero."
      });
    }

    /* -------------------------------
       CHECK CUSTOMER
    -------------------------------- */

    const { data: customer, error: customerError } =
      await supabase
        .from("customers")
        .select("id, balance, account_status")
        .eq("id", customer_id)
        .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found."
      });
    }

    /* -------------------------------
       PREVENT DUPLICATE REFERENCE
    -------------------------------- */

    if (reference_number && reference_number.trim()) {

      const { data: existingDeposit, error: duplicateError } =
        await supabase
          .from("deposits")
          .select("id")
          .eq("reference_number", reference_number.trim())
          .maybeSingle();

      if (duplicateError) {
        console.error(
          "Deposit reference check error:",
          duplicateError
        );
      }

      if (existingDeposit) {
        return res.status(409).json({
          success: false,
          message: "A deposit with this reference number already exists."
        });
      }
    }

    /* -------------------------------
       CALCULATE NEW BALANCE
    -------------------------------- */

    const currentBalance = Number(customer.balance || 0);

    const newBalance =
      currentBalance + depositAmount;

    /* -------------------------------
       INSERT DEPOSIT
    -------------------------------- */

    const depositStatus =
      status || "COMPLETED";

    const { data: deposit, error: depositError } =
      await supabase
        .from("deposits")
        .insert({
          customer_id: customer_id,
          account_id: account_id || null,
          amount: depositAmount,
          payment_method:
            payment_method || "OTHER",
          reference_number:
            reference_number
              ? reference_number.trim()
              : null,
          status: depositStatus,
          description:
            description
              ? description.trim()
              : null,
          processed_by:
            req.admin?.id || null,
          processed_at:
            new Date().toISOString()
        })
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
        .single();

    if (depositError) {
      console.error(
        "Create deposit error:",
        depositError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to record deposit.",
        error: depositError.message
      });
    }

    /* -------------------------------
       UPDATE CUSTOMER BALANCE
    -------------------------------- */

    const { data: updatedCustomer, error: balanceError } =
      await supabase
        .from("customers")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq("id", customer_id)
        .select("id, balance")
        .single();

    if (balanceError) {
      console.error(
        "Customer balance update error:",
        balanceError
      );

      return res.status(500).json({
        success: false,
        message:
          "Deposit was recorded, but customer balance could not be updated.",
        error: balanceError.message
      });
    }

    /* -------------------------------
       SUCCESS
    -------------------------------- */

    res.status(201).json({
      success: true,
      message: "Deposit recorded successfully.",
      deposit: deposit,
      customer: updatedCustomer
    });

  } catch (error) {

    console.error(
      "Record deposit server error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to record deposit.",
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

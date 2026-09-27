import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
 JAY C O B FINANCIAL SERVICES
 SAVINGS ROUTES
=====================================================
*/

/*
GET CUSTOMER SAVINGS
GET /api/savings
*/
router.get("/customer/:id", async (req, res) => {
  try {
    const customerId =
      req.params.id ||
      req.user?.id ||
      req.query.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required"
      });
    }

    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Savings route error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load savings",
        error: error.message
      });
    }

    const savings = data || [];

    const totalSavings = savings.reduce((total, item) => {
      return total + Number(
        item.amount || 0
      );
    }, 0);

    res.json({
      success: true,
      total_savings: totalSavings,
      savings
    });

  } catch (error) {
    console.error("Savings server error:", error);

    res.status(500).json({
      success: false,
      message: "Savings service error"
    });
  }
});

/*
=====================================================
 CREATE SAVINGS DEPOSIT
 POST /api/savings/deposit
=====================================================
*/
router.post("/deposit", async (req, res) => {
  try {
    const {
      customer_id,
      account_id,
      amount,
      payment_method,
      reference_number,
      description
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    const depositAmount = Number(amount);

    if (
      !Number.isFinite(depositAmount) ||
      depositAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Deposit amount must be greater than zero"
      });
    }

    /*
    Check that the customer exists
    */
    const {
      data: customer,
      error: customerError
    } = await supabase
      .from("customers")
      .select("id, account_number")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    /*
    Use the customer's account number
    if account_id was not supplied.
    */
    const savingsAccountId =
      account_id ||
      customer.account_number ||
      null;

    /*
    Create the savings deposit
    */
    const {
      data: deposit,
      error: depositError
    } = await supabase
      .from("deposits")
      .insert({
        customer_id: customer_id,
        account_id: savingsAccountId,
        amount: depositAmount,
        payment_method:
          payment_method || "Not specified",
        reference_number:
          reference_number || null,
        status: "pending",
        description:
          description || "Savings deposit"
      })
      .select()
      .single();

    if (depositError) {
      console.error(
        "Savings deposit error:",
        depositError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create savings deposit",
        error: depositError.message
      });
    }

    res.status(201).json({
      success: true,
      message:
        "Savings deposit submitted successfully",
      deposit
    });

  } catch (error) {
    console.error(
      "Savings deposit server error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Savings deposit service error"
    });
  }
});


export default router;

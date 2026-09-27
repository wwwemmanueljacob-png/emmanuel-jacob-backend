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
      amount,
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
    Find the customer
    */
    const {
      data: customer,
      error: customerError
    } = await supabase
      .from("customers")
      .select("id, balance")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    /*
    Calculate new savings balance
    */
    const currentBalance =
      Number(customer.balance || 0);

    const newBalance =
      currentBalance + depositAmount;

    /*
    Record the deposit
    */
    const {
      data: deposit,
      error: depositError
    } = await supabase
      .from("deposits")
      .insert({
        customer_id: customer_id,
        amount: depositAmount,
        transaction_type: "deposit",
        description:
          description ||
          "Savings deposit",
        balance_after: newBalance,
        status: "completed"
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
        message: "Failed to record savings deposit",
        error: depositError.message
      });
    }

    /*
    Update customer balance
    */
    const {
      error: balanceError
    } = await supabase
      .from("customers")
      .update({
        balance: newBalance
      })
      .eq("id", customer_id);

    if (balanceError) {
      console.error(
        "Savings balance update error:",
        balanceError
      );

      return res.status(500).json({
        success: false,
        message:
          "Deposit recorded but balance update failed",
        error: balanceError.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Savings deposit recorded successfully",
      deposit,
      balance: newBalance
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

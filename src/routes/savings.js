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
    const customerId = req.params.id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    /*
    ================================================
    GET COMPLETED SAVINGS DEPOSITS
    ================================================
    */

    const {
      data: deposits,
      error: depositsError
    } = await supabase
      .from("deposits")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "completed")
      .order("created_at", {
        ascending: false
      });

    if (depositsError) {
      console.error(
        "Savings deposits error:",
        depositsError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load savings deposits",
        error: depositsError.message
      });
    }

    /*
    ================================================
    GET COMPLETED SAVINGS WITHDRAWALS
    ================================================
    */

    const {
      data: withdrawals,
      error: withdrawalsError
    } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "completed")
      .order("created_at", {
        ascending: false
      });

    if (withdrawalsError) {
      console.error(
        "Savings withdrawals error:",
        withdrawalsError
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load savings withdrawals",
        error: withdrawalsError.message
      });
    }

    /*
    ================================================
    COMBINE DEPOSITS + WITHDRAWALS
    ================================================
    */

    const savings = [
      ...(deposits || []).map(item => ({
        ...item,
        transaction_type: "deposit"
      })),

      ...(withdrawals || []).map(item => ({
        ...item,
        transaction_type: "withdrawal"
      }))
    ];

    /*
    Newest transaction first
    */

    savings.sort(
      (a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
    );

    /*
    ================================================
    CALCULATE TOTAL DEPOSITS
    ================================================
    */

    const totalDeposits =
      (deposits || []).reduce(
        (total, item) =>
          total +
          Number(item.amount || 0),
        0
      );

    /*
    ================================================
    CALCULATE TOTAL WITHDRAWALS
    ================================================
    */

    const totalWithdrawals =
      (withdrawals || []).reduce(
        (total, item) =>
          total +
          Number(item.amount || 0),
        0
      );

    /*
    ================================================
    CURRENT SAVINGS BALANCE
    ================================================
    */

    const currentBalance =
      totalDeposits -
      totalWithdrawals;

    /*
    ================================================
    ADD RUNNING BALANCE TO HISTORY
    ================================================
    */

    const chronologicalSavings = [
      ...(deposits || []).map(item => ({
        ...item,
        transaction_type: "deposit"
      })),

      ...(withdrawals || []).map(item => ({
        ...item,
        transaction_type: "withdrawal"
      }))
    ];

    chronologicalSavings.sort(
      (a, b) =>
        new Date(a.created_at || 0) -
        new Date(b.created_at || 0)
    );

    let runningBalance = 0;

    chronologicalSavings.forEach(item => {

      const amount =
        Number(item.amount || 0);

      if (
        item.transaction_type ===
        "deposit"
      ) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }

      item.balance_after =
        runningBalance;
    });

    /*
    Return newest first
    */

    chronologicalSavings.sort(
      (a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
    );

    res.json({
      success: true,

      total_savings:
        currentBalance,

      total_deposits:
        totalDeposits,

      total_withdrawals:
        totalWithdrawals,

      transaction_count:
        chronologicalSavings.length,

      savings:
        chronologicalSavings
    });

  } catch (error) {

    console.error(
      "Savings loading error:",
      error
    );

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

import express from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
JAY C O B FINANCIAL SERVICES
TRANSACTIONS API

Supabase table:

transactions
- id
- created_at
- customer_id
- type
- amount
- description
- status
- balance_before
- balance_after
- reference
- related_loan_id
- related_customer_id
- performed_by
=====================================================
*/


/* =====================================================
   GENERATE TRANSACTION REFERENCE
===================================================== */

function generateReference() {
  const random = crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase();

  return `JCOB-TXN-${Date.now()}-${random}`;
}


/* =====================================================
   ALLOWED TRANSACTION TYPES
===================================================== */

const allowedTypes = [
  "deposit",
  "withdrawal",
  "transfer",
  "loan_disbursement",
  "loan_repayment"
];


/* =====================================================
   ALLOWED STATUSES
===================================================== */

const allowedStatuses = [
  "pending",
  "completed",
  "failed",
  "reversed"
];


/* =====================================================
   GET CUSTOMER TRANSACTIONS
===================================================== */

router.get(
  "/api/transactions/customer/:customerId",
  async (req, res) => {

    try {

      const customerId =
        Number(req.params.customerId);

      if (!Number.isInteger(customerId)) {

        return res.status(400).json({
          success: false,
          message: "Invalid customer ID"
        });

      }


      const { data, error } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", {
            ascending: false
          });


      if (error) {

        console.error(
          "Get transactions error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load transactions"
        });

      }


      return res.json({
        success: true,
        count: data?.length || 0,
        transactions: data || []
      });

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
);


/* =====================================================
   GET SINGLE TRANSACTION
===================================================== */

router.get(
  "/api/transactions/:id",
  async (req, res) => {

    try {

      const transactionId =
        Number(req.params.id);

      if (!Number.isInteger(transactionId)) {

        return res.status(400).json({
          success: false,
          message: "Invalid transaction ID"
        });

      }


      const { data, error } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .maybeSingle();


      if (error) {

        console.error(
          "Get transaction error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load transaction"
        });

      }


      if (!data) {

        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });

      }


      return res.json({
        success: true,
        transaction: data
      });

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
);


/* =====================================================
   CREATE TRANSACTION
===================================================== */

router.post(
  "/api/transactions",
  async (req, res) => {

    try {

      const {
        customer_id,
        type,
        amount,
        description,
        status,
        related_loan_id,
        related_customer_id,
        performed_by
      } = req.body;


      /* -----------------------------------------------
         VALIDATE CUSTOMER ID
      ------------------------------------------------ */

      const customerId =
        Number(customer_id);

      if (!Number.isInteger(customerId)) {

        return res.status(400).json({
          success: false,
          message: "Valid customer_id is required"
        });

      }


      /* -----------------------------------------------
         VALIDATE TYPE
      ------------------------------------------------ */

      if (!allowedTypes.includes(type)) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid transaction type"
        });

      }


      /* -----------------------------------------------
         VALIDATE AMOUNT
      ------------------------------------------------ */

      const transactionAmount =
        Number(amount);

      if (
        !Number.isFinite(transactionAmount) ||
        transactionAmount <= 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Transaction amount must be greater than zero"
        });

      }


      /* -----------------------------------------------
         VALIDATE STATUS
      ------------------------------------------------ */

      const transactionStatus =
        status || "completed";

      if (
        !allowedStatuses.includes(
          transactionStatus
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid transaction status"
        });

      }


      /* -----------------------------------------------
         FIND CUSTOMER
      ------------------------------------------------ */

      const {
        data: customer,
        error: customerError
      } = await supabase
        .from("customers")
        .select(
          "id, full_name, balance, account_status"
        )
        .eq("id", customerId)
        .maybeSingle();


      if (customerError) {

        console.error(
          "Customer lookup error:",
          customerError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to verify customer"
        });

      }


      if (!customer) {

        return res.status(404).json({
          success: false,
          message:
            "Customer not found"
        });

      }


      /* -----------------------------------------------
         CHECK ACCOUNT STATUS
      ------------------------------------------------ */

      if (
        customer.account_status &&
        customer.account_status !== "active"
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Customer account is not active"
        });

      }


      /* -----------------------------------------------
         CURRENT BALANCE
      ------------------------------------------------ */

      const balanceBefore =
        Number(customer.balance || 0);


      let balanceAfter =
        balanceBefore;


      /* -----------------------------------------------
         CALCULATE NEW BALANCE

         Deposits and loan disbursements ADD money.

         Withdrawals, transfers and loan repayments
         REMOVE money.
      ------------------------------------------------ */

      if (
        type === "deposit" ||
        type === "loan_disbursement"
      ) {

        balanceAfter =
          balanceBefore +
          transactionAmount;

      }


      if (
        type === "withdrawal" ||
        type === "transfer" ||
        type === "loan_repayment"
      ) {

        if (
          transactionAmount >
          balanceBefore
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Insufficient account balance"
          });

        }


        balanceAfter =
          balanceBefore -
          transactionAmount;

      }


      /* -----------------------------------------------
         GENERATE REFERENCE
      ------------------------------------------------ */

      const reference =
        generateReference();


      /* -----------------------------------------------
         INSERT TRANSACTION
      ------------------------------------------------ */

      const transactionData = {

        customer_id: customerId,

        type: type,

        amount: transactionAmount,

        description:
          description || null,

        status:
          transactionStatus,

        balance_before:
          balanceBefore,

        balance_after:
          balanceAfter,

        reference:

          reference,

        related_loan_id:
          related_loan_id
            ? Number(related_loan_id)
            : null,

        related_customer_id:
          related_customer_id
            ? Number(related_customer_id)
            : null,

        performed_by:
          performed_by || "system"
      };


      const {
        data: transaction,
        error: transactionError
      } = await supabase
        .from("transactions")
        .insert(transactionData)
        .select()
        .single();


      if (transactionError) {

        console.error(
          "Transaction insert error:",
          transactionError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to create transaction"
        });

      }


      /* -----------------------------------------------
         UPDATE CUSTOMER BALANCE

         Only update the customer balance when the
         transaction has been successfully inserted.
      ------------------------------------------------ */

      const {
        error: balanceError
      } = await supabase
        .from("customers")
        .update({
          balance: balanceAfter,
          updated_at: new Date().toISOString()
        })
        .eq("id", customerId);


      if (balanceError) {

        console.error(
          "Balance update error:",
          balanceError
        );

        return res.status(500).json({
          success: false,
          message:
            "Transaction created but balance update failed",
          transaction
        });

      }


      /* -----------------------------------------------
         SUCCESS
      ------------------------------------------------ */

      return res.status(201).json({

        success: true,

        message:
          "Transaction created successfully",

        transaction

      });

    } catch (error) {

      console.error(
        "Transaction server error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error"
      });

    }

  }
);


/* =====================================================
   EXPORT ROUTER
===================================================== */

export default router;

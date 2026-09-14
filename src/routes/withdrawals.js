import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";
import { authenticate } from "./customerAuth.js";

const router = express.Router();


/* =====================================================
   CUSTOMER WITHDRAWALS
===================================================== */


/* =====================================================
   CREATE WITHDRAWAL REQUEST
   POST /api/withdrawals
===================================================== */

router.post(
  "/api/withdrawals",
  authenticate,
  async (req, res) => {

    try {

      const customerId =
        req.customer?.id;

      if (!customerId) {

        return res.status(401).json({
          success: false,
          message: "Customer authentication required."
        });

      }


      const {
        amount,
        withdrawal_method,
        destination_number,
        description
      } = req.body;


      const withdrawalAmount =
        Number(amount);


      /* ==============================
         VALIDATE AMOUNT
      ============================== */

      if (
        !Number.isFinite(withdrawalAmount) ||
        withdrawalAmount <= 0
      ) {

        return res.status(400).json({
          success: false,
          message: "Enter a valid withdrawal amount."
        });

      }


      /* ==============================
         VALIDATE METHOD
      ============================== */

      const allowedMethods = [
        "Airtel Money",
        "Mpamba",
        "Bank Transfer"
      ];

      if (
        !allowedMethods.includes(
          withdrawal_method
        )
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid withdrawal method."
        });

      }


      /* ==============================
         VALIDATE DESTINATION
      ============================== */

      if (
        !destination_number ||
        !String(destination_number).trim()
      ) {

        return res.status(400).json({
          success: false,
          message: "Enter the withdrawal destination."
        });

      }


      /* ==============================
         GET CUSTOMER BALANCE
      ============================== */

      const {
        data: customer,
        error: customerError
      } = await supabase
        .from("customers")
        .select("id, balance")
        .eq("id", customerId)
        .single();


      if (customerError) {

        console.error(
          "WITHDRAWAL CUSTOMER LOOKUP ERROR:",
          customerError
        );

        return res.status(500).json({
          success: false,
          message: "Unable to verify customer account."
        });

      }


      if (!customer) {

        return res.status(404).json({
          success: false,
          message: "Customer account not found."
        });

      }


      const balance =
        Number(customer.balance || 0);


      /* ==============================
         CHECK BALANCE
      ============================== */

      if (withdrawalAmount > balance) {

        return res.status(400).json({
          success: false,
          message:
            "Withdrawal amount cannot exceed your available balance."
        });

      }


      /* ==============================
         GENERATE REFERENCE
      ============================== */

      const randomPart =
        crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase();

      const referenceNumber =
        `WD-${Date.now()}-${randomPart}`;


      /* ==============================
         CREATE WITHDRAWAL
      ============================== */

      const {
        data: withdrawal,
        error: withdrawalError
      } = await supabase
        .from("withdrawals")
        .insert([
          {
            customer_id: customerId,
            amount: withdrawalAmount,
            withdrawal_method:
              withdrawal_method,
            destination_number:
              String(destination_number).trim(),
            reference_number:
              referenceNumber,
            status: "pending",
            description:
              description
                ? String(description).trim()
                : null
          }
        ])
        .select()
        .single();


      if (withdrawalError) {

        console.error(
          "WITHDRAWAL INSERT ERROR:",
          withdrawalError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to create withdrawal request.",
          error: withdrawalError.message
        });

      }


      /* ==============================
         SUCCESS
      ============================== */

      return res.status(201).json({

        success: true,

        message:
          "Withdrawal request submitted successfully.",

        withdrawal

      });

    } catch (error) {

      console.error(
        "WITHDRAWAL REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to process withdrawal request.",
        error: error.message
      });

    }

  }
);


/* =====================================================
   GET CUSTOMER WITHDRAWAL HISTORY
   GET /api/withdrawals/customer/:customerId
===================================================== */

router.get(
  "/api/withdrawals/customer/:customerId",
  authenticate,
  async (req, res) => {

    try {

      const authenticatedCustomerId =
        req.customer?.id;

      const requestedCustomerId =
        req.params.customerId;


      /* ==============================
         SECURITY CHECK
      ============================== */

      if (
        !authenticatedCustomerId ||
        String(authenticatedCustomerId) !==
        String(requestedCustomerId)
      ) {

        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to view these withdrawals."
        });

      }


      /* ==============================
         LOAD WITHDRAWALS
      ============================== */

      const {
        data,
        error
      } = await supabase

        .from("withdrawals")

        .select(`
          id,
          created_at,
          customer_id,
          account_id,
          amount,
          withdrawal_method,
          destination_number,
          reference_number,
          status,
          description,
          processed_by,
          processed_at
        `)

        .eq(
          "customer_id",
          authenticatedCustomerId
        )

        .order(
          "created_at",
          {
            ascending: false
          }
        );


      if (error) {

        console.error(
          "CUSTOMER WITHDRAWALS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load withdrawal history.",

          error:
            error.message

        });

      }


      return res.json({

        success: true,

        withdrawals:
          data || []

      });

    } catch (error) {

      console.error(
        "CUSTOMER WITHDRAWALS SERVER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to load withdrawal history.",

        error:
          error.message

      });

    }

  }
);


export default router;

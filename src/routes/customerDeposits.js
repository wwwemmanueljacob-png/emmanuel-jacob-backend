import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";
import { authenticate } from "./customerAuth.js";

const router = express.Router();


/* =====================================================
   CUSTOMER DEPOSIT REQUESTS
===================================================== */


/* =====================================================
   CREATE DEPOSIT REQUEST
   POST /api/deposits/request
===================================================== */

router.post(
  "/api/deposits/request",
  authenticate,
  async (req, res) => {

    try {

      const customerId =
        req.customer?.id;

      if (!customerId) {

        return res.status(401).json({
          success: false,
          message:
            "Customer authentication required."
        });

      }


      const {
        amount,
        payment_method,
        reference_number,
        description
      } = req.body;


      const depositAmount =
        Number(amount);


      /* ==============================
         VALIDATE AMOUNT
      ============================== */

      if (
        !Number.isFinite(depositAmount) ||
        depositAmount <= 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Enter a valid deposit amount."
        });

      }


      /* ==============================
         VALIDATE PAYMENT METHOD
      ============================== */

      const allowedMethods = [
        "OneKhusa",
        "Airtel Money",
        "Mpamba",
        "Bank",
        "Cash"
      ];

      if (
        !allowedMethods.includes(
          payment_method
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid payment method."
        });

      }


      /* ==============================
         GENERATE REQUEST REFERENCE
      ============================== */

      const randomPart =
        crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase();

      const requestReference =
        `DEP-${Date.now()}-${randomPart}`;


      /* ==============================
         CREATE DEPOSIT REQUEST
      ============================== */

      const {
        data: depositRequest,
        error: depositRequestError
      } = await supabase
        .from("deposit_requests")
        .insert([
          {
            customer_id:
              customerId,

            amount:
              depositAmount,

            payment_method:
              payment_method,

            reference_number:
              reference_number
                ? String(reference_number).trim()
                : requestReference,

            status:
              "PENDING",

            description:
              description
                ? String(description).trim()
                : null
          }
        ])
        .select()
        .single();


      if (depositRequestError) {

        console.error(
          "DEPOSIT REQUEST INSERT ERROR:",
          depositRequestError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to create deposit request.",
          error:
            depositRequestError.message
        });

      }


      /* ==============================
         SUCCESS
      ============================== */

      return res.status(201).json({

        success: true,

        message:
          "Deposit request submitted successfully.",

        depositRequest

      });

    } catch (error) {

      console.error(
        "DEPOSIT REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to process deposit request.",
        error:
          error.message
      });

    }

  }
);


export default router;

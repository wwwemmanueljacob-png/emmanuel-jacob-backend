import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   GET CUSTOMER SUPPORT TICKETS
   GET /api/support/customer/:customerId
========================================================= */

router.get(
  "/api/support/customer/:customerId",
  async (req, res) => {
    try {
      const customerId = Number(req.params.customerId);

      if (!Number.isInteger(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID."
        });
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          id,
          created_at,
          customer_id,
          subject,
          message,
          category,
          priority,
          status,
          admin_response,
          assigned_to,
          updated_at,
          closed_at
        `)
        .eq("customer_id", customerId)
        .order("created_at", {
          ascending: false
        });

      if (error) {
        console.error(
          "SUPPORT DATABASE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load support tickets."
        });
      }

      return res.json({
        success: true,
        tickets: data || []
      });

    } catch (error) {
      console.error(
        "SUPPORT SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error while loading support tickets."
      });
    }
  }
);

/* =========================================================
   CREATE SUPPORT TICKET
   POST /api/support/tickets
========================================================= */

router.post(
  "/api/support/tickets",
  async (req, res) => {
    try {

      const {
        customer_id,
        subject,
        message,
        category,
        priority
      } = req.body;

      const customerId =
        Number(customer_id);

      if (!Number.isInteger(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Valid customer ID is required."
        });
      }

      if (!subject || !String(subject).trim()) {
        return res.status(400).json({
          success: false,
          message: "Subject is required."
        });
      }

      if (!message || !String(message).trim()) {
        return res.status(400).json({
          success: false,
          message: "Message is required."
        });
      }

      /* -----------------------------------------------------
         VERIFY CUSTOMER
      ----------------------------------------------------- */

      const {
        data: customer,
        error: customerError
      } = await supabase
        .from("customers")
        .select("id, account_status")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError) {
        console.error(
          "CUSTOMER LOOKUP ERROR:",
          customerError
        );

        return res.status(500).json({
          success: false,
          message: "Unable to verify customer."
        });
      }

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found."
        });
      }

      if (
        customer.account_status &&
        String(customer.account_status).toLowerCase() !== "active"
      ) {
        return res.status(403).json({
          success: false,
          message: "Customer account is not active."
        });
      }

      /* -----------------------------------------------------
         NORMALIZE CATEGORY AND PRIORITY
      ----------------------------------------------------- */

      const allowedCategories = [
        "general",
        "account",
        "loan",
        "transaction",
        "savings",
        "kyc",
        "technical",
        "other"
      ];

      const allowedPriorities = [
        "low",
        "medium",
        "high",
        "urgent"
      ];

      const normalizedCategory =
        String(
          category || "general"
        )
          .trim()
          .toLowerCase();

      const normalizedPriority =
        String(
          priority || "medium"
        )
          .trim()
          .toLowerCase();

      const finalCategory =
        allowedCategories.includes(
          normalizedCategory
        )
          ? normalizedCategory
          : "general";

      const finalPriority =
        allowedPriorities.includes(
          normalizedPriority
        )
          ? normalizedPriority
          : "medium";

      /* -----------------------------------------------------
         CREATE TICKET
      ----------------------------------------------------- */

      const { data, error } =
        await supabase
          .from("support_tickets")
          .insert([
            {
              customer_id: customerId,
              subject: String(subject).trim(),
              message: String(message).trim(),
              category: finalCategory,
              priority: finalPriority,
              status: "open"
            }
          ])
          .select()
          .single();

      if (error) {
        console.error(
          "SUPPORT INSERT ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to create support ticket."
        });
      }

      return res.status(201).json({
        success: true,
        message: "Support ticket created successfully.",
        ticket: data
      });

    } catch (error) {

      console.error(
        "SUPPORT CREATE SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error while creating support ticket."
      });
    }
  }
);

/* =========================================================
   ADMIN - GET ALL SUPPORT TICKETS
   GET /api/admin/support-tickets
========================================================= */

router.get(
  "/api/admin/support-tickets",
  async (req, res) => {

    try {

      const { data, error } =
        await supabase
          .from("support_tickets")
          .select(`
            id,
            created_at,
            customer_id,
            subject,
            message,
            category,
            priority,
            status,
            admin_response,
            assigned_to,
            updated_at,
            closed_at
          `)
          .order("created_at", {
            ascending: false
          });


      if (error) {

        console.error(
          "ADMIN SUPPORT TICKETS DATABASE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load support tickets."
        });

      }


      return res.json({
        success: true,
        tickets: data || []
      });


    } catch (error) {

      console.error(
        "ADMIN SUPPORT TICKETS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error while loading support tickets."
      });

    }

  }
);


export default router;

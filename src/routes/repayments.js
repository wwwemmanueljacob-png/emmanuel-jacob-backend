import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
REPAYMENTS ROUTES
JAY C O B FINANCIAL SERVICES
=====================================================
*/

/*
-----------------------------------------------------
GET ALL REPAYMENTS
GET /api/repayments
-----------------------------------------------------
*/

router.get(
  "/api/repayments",
  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("repayments")
        .select("*")
        .order(
          "created_at",
          { ascending: false }
        );


      if (error) {

        console.error(
          "Repayments fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to retrieve repayments",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        repayments:
          data || []
      });


    } catch (error) {

      console.error(
        "Repayments server error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
GET REPAYMENT BY ID
GET /api/repayments/:id
-----------------------------------------------------
*/

router.get(
  "/api/repayments/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        data,
        error
      } = await supabase
        .from("repayments")
        .select("*")
        .eq("id", id)
        .maybeSingle();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to retrieve repayment",
          error:
            error.message
        });

      }


      if (!data) {

        return res.status(404).json({
          success: false,
          message:
            "Repayment not found"
        });

      }


      return res.json({
        success: true,
        repayment:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
CREATE REPAYMENT
POST /api/repayments
-----------------------------------------------------
*/

router.post(
  "/api/repayments",
  async (req, res) => {

    try {

      const {
        loan_id,
        customer_id,
        schedule_id,
        amount,
        payment_method,
        reference_number,
        status,
        payment_date,
        received_by,
        notes
      } = req.body;


      if (
        !loan_id ||
        !customer_id ||
        !amount
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Loan ID, customer ID and amount are required"
        });

      }


      const {
        data,
        error
      } = await supabase
        .from("repayments")
        .insert([
          {
            loan_id:
              loan_id,

            customer_id:
              customer_id,

            schedule_id:
              schedule_id || null,

            amount:
              amount,

            payment_method:
              payment_method || null,

            reference_number:
              reference_number || null,

            status:
              status || "PENDING",

            payment_date:
              payment_date ||
              new Date().toISOString(),

            received_by:
              received_by || null,

            notes:
              notes || null
          }
        ])
        .select("*")
        .single();


      if (error) {

        console.error(
          "Repayment creation error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to create repayment",
          error:
            error.message
        });

      }


      return res.status(201).json({
        success: true,
        message:
          "Repayment created successfully",
        repayment:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
UPDATE REPAYMENT
PUT /api/repayments/:id
-----------------------------------------------------
*/

router.put(
  "/api/repayments/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        loan_id,
        customer_id,
        schedule_id,
        amount,
        payment_method,
        reference_number,
        status,
        payment_date,
        received_by,
        notes
      } = req.body;


      const updates = {};


      if (
        loan_id !== undefined
      ) {
        updates.loan_id =
          loan_id;
      }

      if (
        customer_id !== undefined
      ) {
        updates.customer_id =
          customer_id;
      }

      if (
        schedule_id !== undefined
      ) {
        updates.schedule_id =
          schedule_id;
      }

      if (
        amount !== undefined
      ) {
        updates.amount =
          amount;
      }

      if (
        payment_method !== undefined
      ) {
        updates.payment_method =
          payment_method;
      }

      if (
        reference_number !== undefined
      ) {
        updates.reference_number =
          reference_number;
      }

      if (
        status !== undefined
      ) {
        updates.status =
          status;
      }

      if (
        payment_date !== undefined
      ) {
        updates.payment_date =
          payment_date;
      }

      if (
        received_by !== undefined
      ) {
        updates.received_by =
          received_by;
      }

      if (
        notes !== undefined
      ) {
        updates.notes =
          notes;
      }


      const {
        data,
        error
      } = await supabase
        .from("repayments")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();


      if (error) {

        console.error(
          "Repayment update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to update repayment",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        message:
          "Repayment updated successfully",
        repayment:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
DELETE REPAYMENT
DELETE /api/repayments/:id
-----------------------------------------------------
*/

router.delete(
  "/api/repayments/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        error
      } = await supabase
        .from("repayments")
        .delete()
        .eq("id", id);


      if (error) {

        console.error(
          "Repayment deletion error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to delete repayment",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        message:
          "Repayment deleted successfully"
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


export default router;

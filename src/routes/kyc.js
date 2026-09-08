import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   GET CUSTOMER KYC DOCUMENTS
   GET /api/kyc/customer/:customerId
========================================================= */

router.get(
  "/api/kyc/customer/:customerId",
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
        .from("kyc_documents")
        .select(`
          id,
          created_at,
          customer_id,
          document_type,
          document_number,
          document_url,
          status,
          submitted_at,
          verified_at,
          verified_by,
          rejection_reason,
          notes
        `)
        .eq("customer_id", customerId)
        .order("created_at", {
          ascending: false
        });

      if (error) {
        console.error(
          "KYC DATABASE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load KYC documents."
        });
      }

      return res.json({
        success: true,
        documents: data || []
      });

    } catch (error) {
      console.error(
        "KYC SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error while loading KYC documents."
      });
    }
  }
);

export default router;

import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL KYC DOCUMENTS
========================================= */

router.get("/", async (req, res) => {

  try {

    const { data, error } =
      await supabase
        .from("kyc")
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
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Admin KYC error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to load KYC documents.",

        error:
          error.message

      });

    }


    res.json({

      success: true,

      kyc:
        data || []

    });

  } catch (error) {

    console.error(
      "Admin KYC server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load KYC documents.",

      error:
        error.message

    });

  }

});


/* =========================================
   GET SINGLE KYC DOCUMENT
========================================= */

router.get("/:id", async (req, res) => {

  try {

    const { data, error } =
      await supabase
        .from("kyc")
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
        .eq(
          "id",
          req.params.id
        )
        .single();


    if (error || !data) {

      return res.status(404).json({

        success: false,

        message:
          "KYC document not found.",

        error:
          error?.message || null

      });

    }


    res.json({

      success: true,

      kyc:
        data

    });

  } catch (error) {

    console.error(
      "Single KYC error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load KYC document.",

      error:
        error.message

    });

  }

});


export default router;

import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();
console.log("ADMIN KYC ROUTER LOADED");

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


/* =========================================
   APPROVE KYC DOCUMENT
========================================= */

router.put("/:id/approve", async (req, res) => {

  try {

    const kycId = req.params.id;

    const adminId =
      req.admin?.id || null;


    const {
      data: existingKyc,
      error: findError
    } =
      await supabase
        .from("kyc")
        .select("id, status")
        .eq("id", kycId)
        .single();


    if (findError || !existingKyc) {

      return res.status(404).json({

        success: false,

        message:
          "KYC document not found."

      });

    }


    const {
      data,
      error
    } =
      await supabase
        .from("kyc")
        .update({

          status: "APPROVED",

          verified_at:
            new Date().toISOString(),

          verified_by:
            adminId,

          rejection_reason:
            null

        })
        .eq("id", kycId)
        .select()
        .single();


    if (error) {

      console.error(
        "Approve KYC error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to approve KYC document.",

        error:
          error.message

      });

    }


    res.json({

      success: true,

      message:
        "KYC document approved successfully.",

      kyc:
        data

    });

  } catch (error) {

    console.error(
      "Approve KYC server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to approve KYC document.",

      error:
        error.message

    });

  }

});


/* =========================================
   REJECT KYC DOCUMENT
========================================= */

router.put("/:id/reject", async (req, res) => {

  try {

    const kycId = req.params.id;

    const adminId =
      req.admin?.id || null;


    const rejectionReason =
      req.body?.rejection_reason?.trim();


    if (!rejectionReason) {

      return res.status(400).json({

        success: false,

        message:
          "Rejection reason is required."

      });

    }


    const {
      data: existingKyc,
      error: findError
    } =
      await supabase
        .from("kyc")
        .select("id, status")
        .eq("id", kycId)
        .single();


    if (findError || !existingKyc) {

      return res.status(404).json({

        success: false,

        message:
          "KYC document not found."

      });

    }


    const {
      data,
      error
    } =
      await supabase
        .from("kyc")
        .update({

          status: "REJECTED",

          verified_at:
            new Date().toISOString(),

          verified_by:
            adminId,

          rejection_reason:
            rejectionReason

        })
        .eq("id", kycId)
        .select()
        .single();


    if (error) {

      console.error(
        "Reject KYC error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to reject KYC document.",

        error:
          error.message

      });

    }


    res.json({

      success: true,

      message:
        "KYC document rejected successfully.",

      kyc:
        data

    });

  } catch (error) {

    console.error(
      "Reject KYC server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to reject KYC document.",

      error:
        error.message

    });

  }

});


export default router;

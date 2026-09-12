import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


/* =====================================================
   GET CUSTOMER KYC DOCUMENTS
   GET /api/kyc/customer/:customerId
===================================================== */

router.get(
  "/customer/:customerId",
  async (req, res) => {

    try {

      const customerId =
        Number(req.params.customerId);


      if (!Number.isInteger(customerId)) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid customer ID."

        });

      }


      const { data, error } =
        await supabase

          .from("KYC")

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
            "customer_id",
            customerId
          )

          .order(
            "created_at",
            {
              ascending: false
            }
          );


      if (error) {

        console.error(
          "Customer KYC database error:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load KYC documents."

        });

      }


      return res.json({

        success: true,

        documents:
          data || []

      });

    } catch (error) {

      console.error(
        "Customer KYC server error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Server error while loading KYC documents."

      });

    }

  }
);


/* =====================================================
   SUBMIT CUSTOMER KYC
   POST /api/kyc/customer/:customerId
===================================================== */

router.post(
  "/customer/:customerId",
  async (req, res) => {

    try {

      const customerId =
        Number(req.params.customerId);


      if (!Number.isInteger(customerId)) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid customer ID."

        });

      }


      const {
        document_type,
        document_number,
        document_url
      } = req.body;


      if (!document_type) {

        return res.status(400).json({

          success: false,

          message:
            "Document type is required."

        });

      }


      if (!document_number) {

        return res.status(400).json({

          success: false,

          message:
            "Document number is required."

        });

      }


      if (!document_url) {

        return res.status(400).json({

          success: false,

          message:
            "Document URL is required."

        });

      }


      const { data, error } =
        await supabase

          .from("KYC")

          .insert({

            customer_id:
              customerId,

            document_type:
              document_type.trim(),

            document_number:
              document_number.trim(),

            document_url:
              document_url.trim(),

            status:
              "PENDING",

            submitted_at:
              new Date().toISOString()

          })

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

          .single();


      if (error) {

        console.error(
          "Customer KYC submission error:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to submit KYC document.",

          error:
            error.message

        });

      }


      return res.status(201).json({

        success: true,

        message:
          "KYC document submitted successfully.",

        document:
          data

      });

    } catch (error) {

      console.error(
        "Customer KYC server error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Server error while submitting KYC document.",

        error:
          error.message

      });

    }

  }
);


export default router;

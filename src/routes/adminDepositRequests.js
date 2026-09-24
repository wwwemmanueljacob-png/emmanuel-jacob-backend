import express from "express";

import { supabase } from "../lib/supabase.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();


/* =====================================================
   GET ALL CUSTOMER DEPOSIT REQUESTS
   GET /api/admin/deposit-requests
===================================================== */

router.get(
  "/api/admin/deposit-requests",
  authenticateAdmin,
  async (req, res) => {

    try {

      const { data, error } =
        await supabase
          .from("deposit_requests")
          .select(`
            id,
            created_at,
            customer_id,
            amount,
            payment_method,
            reference_number,
            status,
            description,
            processed_by,
            processed_at,
            rejection_reason
          `)
          .order(
            "created_at",
            {
              ascending: false
            }
          );


      if (error) {

        console.error(
          "ADMIN DEPOSIT REQUESTS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Failed to load deposit requests.",

          error:
            error.message

        });

      }


      return res.json({

        success: true,

        depositRequests:
          data || []

      });


    } catch (error) {

      console.error(
        "ADMIN DEPOSIT REQUESTS SERVER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to load deposit requests.",

        error:
          error.message

      });

    }

  }
);


export default router;

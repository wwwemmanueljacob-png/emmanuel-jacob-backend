import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL ACTIVE LOANS
========================================= */

router.get("/", async (req, res) => {

  try {

    const { data, error } =
      await supabase

        .from("loan_applications")

        .select(`
          id,
          customer_id,
          loan_type,
          amount,
          duration_months,
          purpose,
          status,
          created_at,
          applicant_name,
          phone,
          email,
          residential_address,
          employment_status,
          monthly_income,
          business_name,
          business_address,
          business_type,
          monthly_business_income,
          rejection_reason,
          notes,
          reviewed_at,
          reviewed_by
        `)

        .in(
          "status",
          [
            "APPROVED",
            "ACTIVE",
            "DISBURSED"
          ]
        )

        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Admin active loans error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to load active loans.",

        error:
          error.message

      });

    }


    res.json({

      success: true,

      activeLoans:
        data || []

    });

  } catch (error) {

    console.error(
      "Admin active loans server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load active loans.",

      error:
        error.message

    });

  }

});


/* =========================================
   GET SINGLE ACTIVE LOAN
========================================= */

router.get("/:id", async (req, res) => {

  try {

    const { data, error } =
      await supabase

        .from("loan_applications")

        .select(`
          id,
          customer_id,
          loan_type,
          amount,
          duration_months,
          purpose,
          status,
          created_at,
          applicant_name,
          phone,
          email,
          residential_address,
          employment_status,
          monthly_income,
          business_name,
          business_address,
          business_type,
          monthly_business_income,
          rejection_reason,
          notes,
          reviewed_at,
          reviewed_by
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
          "Active loan not found.",

        error:
          error?.message || null

      });

    }


    res.json({

      success: true,

      activeLoan:
        data

    });

  } catch (error) {

    console.error(
      "Single active loan error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load active loan.",

      error:
        error.message

    });

  }

});


export default router;

import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================
   GET ALL ADMIN STATEMENTS
========================================= */

router.get("/", async (req, res) => {

  try {

    const { data, error } =
      await supabase

        .from("statements")

        .select(`
          id,
          created_at,
          customer_id,
          account_id,
          transaction_id,
          transaction_type,
          reference_number,
          description,
          debit,
          credit,
          balance_after,
          transaction_date
        `)

        .order(
          "transaction_date",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Admin statements error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to load statements.",

        error:
          error.message

      });

    }


    res.json({

      success: true,

      statements:
        data || []

    });

  } catch (error) {

    console.error(
      "Admin statements server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load statements.",

      error:
        error.message

    });

  }

});


/* =========================================
   GET SINGLE STATEMENT
========================================= */

router.get("/:id", async (req, res) => {

  try {

    const { data, error } =
      await supabase

        .from("statements")

        .select(`
          id,
          created_at,
          customer_id,
          account_id,
          transaction_id,
          transaction_type,
          reference_number,
          description,
          debit,
          credit,
          balance_after,
          transaction_date
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
          "Statement not found.",

        error:
          error?.message || null

      });

    }


    res.json({

      success: true,

      statement:
        data

    });

  } catch (error) {

    console.error(
      "Single statement error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Failed to load statement.",

      error:
        error.message

    });

  }

});


export default router;

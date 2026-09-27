import express from "express";
import { supabase } from "../lib/supabase.js";
import {
  notifyCustomer,
  notifyAdmin
} from "../lib/notifications.js";

const router = express.Router();


/* =========================================
   GET ALL ADMIN SAVINGS DEPOSITS
========================================= */

router.get("/", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        payment_method,
        reference_number,
        status,
        description,
        processed_by,
        processed_at
      `)
      .order("created_at", {
        ascending: false
      });


    if (error) {

      console.error(
        "Admin savings deposits error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load savings deposits.",
        error: error.message
      });

    }


    return res.json({
      success: true,
      savings: data || []
    });


  } catch (error) {

    console.error(
      "Admin savings deposits server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load savings deposits.",
      error: error.message
    });

  }
});


/* =========================================
   GET SINGLE SAVINGS DEPOSIT
========================================= */

router.get("/:id", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("deposits")
      .select(`
        id,
        created_at,
        customer_id,
        account_id,
        amount,
        payment_method,
        reference_number,
        status,
        description,
        processed_by,
        processed_at
      `)
      .eq("id", req.params.id)
      .single();


    if (error) {

      console.error(
        "Single savings deposit error:",
        error
      );

      return res.status(404).json({
        success: false,
        message: "Savings deposit not found.",
        error: error.message
      });

    }


    return res.json({
      success: true,
      saving: data
    });


  } catch (error) {

    console.error(
      "Single savings deposit server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load savings deposit.",
      error: error.message
    });

  }
});

/* =========================================
   APPROVE / REJECT SAVINGS DEPOSIT
========================================= */

router.put("/:id/status", async (req, res) => {
  try {

    const depositId =
      Number(req.params.id);

    const {
      status
    } = req.body;


    /* ==============================
       VALIDATE ID
    ============================== */

    if (!Number.isInteger(depositId)) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid savings deposit ID."
      });

    }


    /* ==============================
       VALIDATE STATUS
    ============================== */

    const newStatus =
      String(status || "")
        .trim()
        .toUpperCase();


    if (
      newStatus !== "COMPLETED" &&
      newStatus !== "REJECTED"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Status must be COMPLETED or REJECTED."
      });

    }


    /* ==============================
       FIND DEPOSIT
    ============================== */

    const {
      data: deposit,
      error: depositError
    } = await supabase
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .single();


    if (depositError || !deposit) {

      return res.status(404).json({
        success: false,
        message:
          "Savings deposit not found.",
        error:
          depositError?.message || null
      });

    }


    /* ==============================
       ONLY PENDING DEPOSITS
       CAN BE PROCESSED
    ============================== */

    if (
      String(deposit.status || "")
        .toUpperCase() !== "PENDING"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Only pending savings deposits can be processed."
      });

    }


    /* ==============================
       UPDATE DEPOSIT
    ============================== */

    const {
      data: updatedDeposit,
      error: updateError
    } = await supabase
      .from("deposits")
      .update({

        status:
          newStatus,

        processed_by:
          req.admin?.id || null,

        processed_at:
          new Date().toISOString()

      })
      .eq("id", depositId)
      .select()
      .single();


    if (updateError) {

      console.error(
        "SAVE DEPOSIT STATUS UPDATE ERROR:",
        updateError
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update savings deposit.",
        error:
          updateError.message
      });

    }


        /* ==============================
       SEND NOTIFICATIONS
    ============================== */

    try {

      if (newStatus === "COMPLETED") {

        await notifyCustomer({

          customer_id:
            deposit.customer_id,

          title:
            "Savings Deposit Approved",

          message:
            `Your savings deposit of MWK ${Number(
              deposit.amount || 0
            ).toLocaleString()} has been approved successfully.`,

          type:
            "SAVINGS",

          priority:
            "NORMAL",

          reference_type:
            "SAVINGS_DEPOSIT",

          reference_id:
            depositId,

          created_by:
            req.admin?.id || null

        });


        if (req.admin?.id) {

          await notifyAdmin({

            admin_id:
              req.admin.id,

            title:
              "Savings Deposit Approved",

            message:
              `Savings deposit #${depositId} for customer #${deposit.customer_id}, amount MWK ${Number(
                deposit.amount || 0
              ).toLocaleString()}, was approved.`,

            type:
              "ADMIN_ACTIVITY",

            priority:
              "NORMAL",

            reference_type:
              "SAVINGS_DEPOSIT",

            reference_id:
              depositId,

            created_by:
              req.admin.id

          });

        }

      }


      if (newStatus === "REJECTED") {

        await notifyCustomer({

          customer_id:
            deposit.customer_id,

          title:
            "Savings Deposit Rejected",

          message:
            `Your savings deposit of MWK ${Number(
              deposit.amount || 0
            ).toLocaleString()} has been rejected.`,

          type:
            "SAVINGS",

          priority:
            "NORMAL",

          reference_type:
            "SAVINGS_DEPOSIT",

          reference_id:
            depositId,

          created_by:
            req.admin?.id || null

        });


        if (req.admin?.id) {

          await notifyAdmin({

            admin_id:
              req.admin.id,

            title:
              "Savings Deposit Rejected",

            message:
              `Savings deposit #${depositId} for customer #${deposit.customer_id}, amount MWK ${Number(
                deposit.amount || 0
              ).toLocaleString()}, was rejected.`,

            type:
              "ADMIN_ACTIVITY",

            priority:
              "NORMAL",

            reference_type:
              "SAVINGS_DEPOSIT",

            reference_id:
              depositId,

            created_by:
              req.admin.id

          });

        }

      }

    } catch (notificationError) {

      console.error(
        "SAVINGS NOTIFICATION ERROR:",
        notificationError
      );

      /*
       * IMPORTANT:
       * The savings deposit status has already
       * been successfully updated.
       *
       * A notification failure must NOT undo
       * the financial transaction.
       */

    }


    /* ==============================
       SUCCESS
    ============================== */

    return res.json({

      success: true,

      message:
        newStatus === "COMPLETED"
          ? "Savings deposit approved successfully."
          : "Savings deposit rejected successfully.",

      deposit:
        updatedDeposit

    });

  } catch (error) {

    console.error(
      "ADMIN SAVINGS STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to process savings deposit.",
      error:
        error.message
    });

  }
});


export default router;

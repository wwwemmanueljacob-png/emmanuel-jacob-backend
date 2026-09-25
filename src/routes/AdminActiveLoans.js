import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

import {
  notifyCustomer,
  notifyAdmin
} from "../lib/notifications.js";

const router = express.Router();

/* =========================================
   GET ALL ACTIVE / APPROVED / DISBURSED LOANS
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


/* =========================================
   DISBURSE APPROVED LOAN
========================================= */

router.post(
  "/:id/disburse",
  authenticateAdmin,
  async (req, res) => {

    try {

      const applicationId =
        Number(req.params.id);


      if (!Number.isInteger(applicationId)) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid loan application ID."

        });

      }


      /* =====================================
         1. GET APPROVED APPLICATION
      ===================================== */

      const {
        data: application,
        error: applicationError
      } =
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
            applicant_name
          `)

          .eq(
            "id",
            applicationId
          )

          .single();


      if (applicationError ||
          !application) {

        return res.status(404).json({

          success: false,

          message:
            "Loan application not found."

        });

      }


      /* =====================================
         2. ONLY APPROVED LOANS CAN DISBURSE
      ===================================== */

      const applicationStatus =
        String(
          application.status || ""
        )
        .trim()
        .toUpperCase();


      if (
        applicationStatus !==
        "APPROVED"
      ) {

        return res.status(400).json({

          success: false,

          message:
            `Loan cannot be disbursed because its current status is ${applicationStatus || "UNKNOWN"}.`

        });

      }


      /* =====================================
         3. VALIDATE CUSTOMER
      ===================================== */

      const customerId =
        Number(
          application.customer_id
        );


      if (!Number.isInteger(customerId)) {

        return res.status(400).json({

          success: false,

          message:
            "This loan has no valid customer."

        });

      }


      const {
        data: customer,
        error: customerError
      } =
        await supabase

          .from("customers")

          .select(`
            id,
            full_name,
            balance
          `)

          .eq(
            "id",
            customerId
          )

          .single();


      if (customerError ||
          !customer) {

        return res.status(404).json({

          success: false,

          message:
            "Customer associated with this loan was not found."

        });

      }


      /* =====================================
         4. VALIDATE LOAN AMOUNT
      ===================================== */

      const principal =
        Number(
          application.amount
        );


      if (
        !Number.isFinite(principal) ||
        principal <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid loan amount."

        });

      }


      /* =====================================
         5. FIND CREATED LOAN RECORD
      ===================================== */

      const {
        data: loan,
        error: loanError
      } =
        await supabase

          .from("loans")

          .select(`
            id,
            customer_id,
            loan_amount,
            interest_rate,
            total_amount,
            amount_paid,
            remaining_balance,
            loan_status,
            application_date,
            approval_date,
            due_date,
            approved_by,
            purpose
          `)

          .eq(
            "customer_id",
            customerId
          )

          .eq(
            "loan_amount",
            principal
          )

          .eq(
            "application_date",
            application.created_at
          )

          .limit(1)
          .maybeSingle();


      if (loanError) {

        console.error(
          "Find loan error:",
          loanError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to locate the approved loan record.",

          error:
            loanError.message

        });

      }


      if (!loan) {

        return res.status(404).json({

          success: false,

          message:
            "Approved loan record was not found."

        });

      }


      /* =====================================
         6. PREVENT DOUBLE DISBURSEMENT
      ===================================== */

      const loanStatus =
        String(
          loan.loan_status || ""
        )
        .trim()
        .toUpperCase();


      if (
        [
          "DISBURSED",
          "ACTIVE",
          "COMPLETED"
        ].includes(
          loanStatus
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "This loan has already been disbursed."

        });

      }


      /* =====================================
         7. CALCULATE CUSTOMER BALANCE
      ===================================== */

      const balanceBefore =
        Number(
          customer.balance || 0
        );


      const balanceAfter =
        Number(
          (
            balanceBefore +
            principal
          ).toFixed(2)
        );


      /* =====================================
         8. UPDATE CUSTOMER BALANCE
      ===================================== */

      const {
        error: balanceError
      } =
        await supabase

          .from("customers")

          .update({

            balance:
              balanceAfter

          })

          .eq(
            "id",
            customerId
          );


      if (balanceError) {

        console.error(
          "Customer balance update error:",
          balanceError
        );

        return res.status(500).json({

          success: false,

          message:
            "Failed to update customer balance.",

          error:
            balanceError.message

        });

      }


      /* =====================================
         9. UPDATE LOAN STATUS
      ===================================== */

      const {
        error: updateLoanError
      } =
        await supabase

          .from("loans")

          .update({

            loan_status:
              "DISBURSED"

          })

          .eq(
            "id",
            loan.id
          );


      if (updateLoanError) {

        console.error(
          "Loan status update error:",
          updateLoanError
        );

        return res.status(500).json({

          success: false,

          message:
            "Customer balance was updated, but loan status could not be updated.",

          error:
            updateLoanError.message

        });

      }


      /* =====================================
         10. UPDATE APPLICATION STATUS
      ===================================== */

      const {
        error: applicationUpdateError
      } =
        await supabase

          .from("loan_applications")

          .update({

            status:
              "DISBURSED"

          })

          .eq(
            "id",
            applicationId
          );


      if (applicationUpdateError) {

        console.error(
          "Application status update error:",
          applicationUpdateError
        );

        return res.status(500).json({

          success: false,

          message:
            "Loan was disbursed, but application status could not be updated.",

          error:
            applicationUpdateError.message

        });

      }


      /* =====================================
         11. GENERATE TRANSACTION REFERENCE
      ===================================== */

      const random =
        crypto
          .randomBytes(6)
          .toString("hex")
          .toUpperCase();


      const reference =
        `JCOB-TXN-${Date.now()}-${random}`;


      /* =====================================
         12. CREATE LOAN DISBURSEMENT TRANSACTION
      ===================================== */

      const {
        data: transaction,
        error: transactionError
      } =
        await supabase

          .from("transactions")

          .insert({

            customer_id:
              customerId,

            type:
              "loan_disbursement",

            amount:
              principal,

            description:
              `Loan disbursement for application #${applicationId}`,

            status:
              "completed",

            balance_before:
              balanceBefore,

            balance_after:
              balanceAfter,

            reference_number:
              reference,

            related_loan_id:
              loan.id,

            related_customer_id:
              customerId,

            performed_by:
              req.admin.id

          })

          .select()
          .single();


      if (transactionError) {

        console.error(
          "Loan disbursement transaction error:",
          transactionError
        );

        return res.status(500).json({

          success: false,

          message:
            "Loan was updated, but the disbursement transaction could not be recorded.",

          error:
            transactionError.message

        });

      }


      /* =====================================
         13. CREATE CUSTOMER DISBURSEMENT NOTIFICATION
      ===================================== */

      await notifyCustomer({

        customer_id:
          customerId,

        title:
          "Loan Disbursed",

        message:
          `Your loan of MWK ${principal.toFixed(2)} has been successfully disbursed. Loan #${loan.id} is now active.`,

        type:
          "LOAN_DISBURSEMENT",

        priority:
          "NORMAL",

        sms_required:
          true,

        reference_type:
          "loan",

        reference_id:
          Number(loan.id),

        action:
          "VIEW_LOAN"

      });


      /* =====================================
         14. CREATE ADMIN DISBURSEMENT NOTIFICATION
      ===================================== */

      await notifyAdmin({

        title:
          "Loan Disbursement",

        message:
          `Customer #${customerId} received MWK ${principal.toFixed(2)} for loan #${loan.id}.`,

        type:
          "LOAN_DISBURSEMENT",

        priority:
          "NORMAL",

        reference_type:
          "loan",

        reference_id:
          Number(loan.id),

        action:
          "VIEW_LOAN"

      });


      /* =====================================
         15. SUCCESS
      ===================================== */

      return res.json({

        success:
          true,

        message:
          "Loan successfully disbursed.",

        disbursement: {

          applicationId:
            applicationId,

          loanId:
            loan.id,

          customerId:
            customerId,

          customerName:
            customer.full_name,

          amount:
            principal,

          balanceBefore:
            balanceBefore,

          balanceAfter:
            balanceAfter,

          loanStatus:
            "DISBURSED",

          reference:
            reference,

          transaction:
            transaction

        }

      });

    } catch (error) {

      console.error(
        "Loan disbursement server error:",
        error
      );

      return res.status(500).json({

        success:
          false,

        message:
          "Failed to disburse loan.",

        error:
          error.message

      });

    }

  }
);


export default router;

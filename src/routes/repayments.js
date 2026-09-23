import express from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "./customerAuth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

/*
=====================================================
GENERATE REPAYMENT REFERENCE
=====================================================
*/

function generateRepaymentReference() {

  const random =
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `JCOB-TXN-${Date.now()}-${random}`;

}

/*
=====================================================
JAY C O B FINANCIAL SERVICES
TRANSACTIONS API

Supabase table:

transactions
- id
- created_at
- customer_id
- type
- amount
- description
- status
- balance_before
- balance_after
- reference
- related_loan_id
- related_customer_id
- performed_by
=====================================================
*/


/* =====================================================
   GENERATE TRANSACTION REFERENCE
===================================================== */

function generateReference() {
  const random = crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase();

  return `JCOB-TXN-${Date.now()}-${random}`;
}


/* =====================================================
   ALLOWED TRANSACTION TYPES
===================================================== */

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

router.post(
  "/api/repayments",
  authenticate,
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
CREATE REPAYMENT
POST /api/repayments
*/

router.post(
  "/api/repayments",
  async (req, res) => {

    try {

      const {
  loan_id,
  schedule_id,
  amount,
  payment_method,
  reference_number,
  status,
  payment_date,
  received_by,
  notes
} = req.body;


const customer_id =
  Number(req.customerId);

      /*
      --------------------------------------------------
      VALIDATION
      --------------------------------------------------
      */

      if (
  !loan_id ||
  !customer_id ||
  !schedule_id ||
  !amount
) {

  return res.status(400).json({

    success: false,

      message:
  "Loan ID, customer ID, schedule ID and amount are required"

  });

}


const repaymentAmount =
  Number(
    Number(amount).toFixed(2)
  );


      if (
        !Number.isFinite(
          repaymentAmount
        ) ||
        repaymentAmount <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Repayment amount must be greater than zero"

        });

      }


      /*
      --------------------------------------------------
      GET LOAN
      --------------------------------------------------
      */

      const {
        data: loan,
        error: loanError
      } = await supabase

        .from("loans")

        .select("*")

        .eq("id", loan_id)

        .eq("customer_id", customer_id)

        .maybeSingle();


      if (loanError) {

        console.error(
          "Loan lookup error:",
          loanError
        );

        return res.status(500).json({

          success: false,

          message:
            "Failed to retrieve loan",

          error:
            loanError.message

        });

      }


      if (!loan) {

        return res.status(404).json({

          success: false,

          message:
            "Loan not found for this customer"

        });

      }


      /*
      --------------------------------------------------
      CHECK LOAN BALANCE
      --------------------------------------------------
      */

      const currentRemainingBalance =
        Number(
          loan.remaining_balance
        );


      if (
        !Number.isFinite(
          currentRemainingBalance
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Loan remaining balance is invalid"

        });

      }


      if (
        currentRemainingBalance <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "This loan has already been fully paid"

        });

      }


      if (
        repaymentAmount >
        currentRemainingBalance
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Repayment amount cannot be greater than the remaining loan balance"

        });

      }


      /*
      --------------------------------------------------
      CALCULATE NEW LOAN BALANCE
      --------------------------------------------------
      */

      const currentAmountPaid =
        Number(
          loan.amount_paid || 0
        );


      const newAmountPaid =
        Number(
          (
            currentAmountPaid +
            repaymentAmount
          ).toFixed(2)
        );


      const newRemainingBalance =
        Number(
          (
            currentRemainingBalance -
            repaymentAmount
          ).toFixed(2)
        );


      const finalLoanStatus =
        newRemainingBalance <= 0
          ? "PAID"
          : "ACTIVE";


      const finalPaymentDate =
        payment_date ||
        new Date().toISOString();

      /*
--------------------------------------------------
VALIDATE REPAYMENT SCHEDULE
--------------------------------------------------
*/

const {
  data: schedule,
  error: scheduleLookupError
} = await supabase

  .from("loan_schedules")

  .select("*")

  .eq("id", schedule_id)

  .eq("loan_id", loan_id)

  .eq("customer_id", customer_id)

  .maybeSingle();


if (scheduleLookupError) {

  console.error(
    "Schedule validation error:",
    scheduleLookupError
  );

  return res.status(500).json({

    success: false,

    message:
      "Failed to validate repayment schedule",

    error:
      scheduleLookupError.message

  });

}


if (!schedule) {

  return res.status(404).json({

    success: false,

    message:
      "The selected repayment schedule was not found for this loan."

  });

}


const scheduleRemainingAmount =
  Number(
    schedule.remaining_amount || 0
  );


if (
  !Number.isFinite(
    scheduleRemainingAmount
  )
) {

  return res.status(400).json({

    success: false,

    message:
      "The repayment schedule has an invalid remaining amount."

  });

}


if (
  scheduleRemainingAmount <= 0
) {

  return res.status(400).json({

    success: false,

    message:
      "This repayment schedule has already been fully paid."

  });

}


if (
  repaymentAmount >
  scheduleRemainingAmount
) {

  return res.status(400).json({

    success: false,

    message:
      "Repayment amount cannot be greater than the remaining amount on this schedule."

  });

}
      
 /*
--------------------------------------------------
GENERATE REPAYMENT REFERENCE
--------------------------------------------------
*/

const repaymentReference =
  generateRepaymentReference();


      /*
      --------------------------------------------------
      CREATE REPAYMENT RECORD
      --------------------------------------------------
      */

      const {
        data: repayment,
        error: repaymentError
      } = await supabase

        .from("repayments")

        .insert([{

          loan_id:
            loan_id,

          customer_id:
            customer_id,

          schedule_id:
            schedule_id,

          amount:
            repaymentAmount,

          payment_method:
             payment_method || null,

          reference_number:
             repaymentReference,

          status:
             "COMPLETED",

          payment_date:
            finalPaymentDate,

          received_by:
            "system",

          notes:
            notes || null

        }])

        .select("*")

        .single();


      if (repaymentError) {

  console.error(
    "Repayment creation error:",
    repaymentError
  );

  /*
  --------------------------------------------------
  DUPLICATE REPAYMENT REFERENCE
  --------------------------------------------------
  */

  if (
    repaymentError.code === "23505"
  ) {

    return res.status(409).json({

      success: false,

      message:
        "A repayment with this reference already exists. Please try again."

    });

  }

  return res.status(500).json({

    success: false,

    message:
      "Failed to create repayment record",

    error:
      repaymentError.message

  });

      }


      /*
      --------------------------------------------------
      CREATE LOAN PAYMENT RECORD
      --------------------------------------------------
      */

      const {
        data: loanPayment,
        error: loanPaymentError
      } = await supabase

        .from("loan_payments")

        .insert([{

          loan_id:
            loan_id,

          customer_id:
            customer_id,

          amount:
            repaymentAmount,

          payment_method:
            payment_method || null,

          payment_reference:
            repaymentReference,

          payment_date:
            finalPaymentDate,

          received_by:
            "system",

          notes:
            notes || null

        }])

        .select("*")

        .single();


      if (loanPaymentError) {

        console.error(
          "Loan payment creation error:",
          loanPaymentError
        );

        return res.status(500).json({

          success: false,

          message:
            "Repayment was created but loan payment record failed",

          repayment:
            repayment,

          error:
            loanPaymentError.message

        });

      }


      /*
      --------------------------------------------------
      UPDATE LOAN SCHEDULE
      --------------------------------------------------
      */

      let updatedSchedule = null;


      if (schedule_id) {

        const {

          data: schedule,

          error: scheduleError

        } = await supabase

          .from("loan_schedules")

          .select("*")

          .eq("id", schedule_id)

          .eq("loan_id", loan_id)

          .eq("customer_id", customer_id)

          .maybeSingle();


        if (scheduleError) {

          console.error(
            "Schedule lookup error:",
            scheduleError
          );

          return res.status(500).json({

            success: false,

            message:
              "Failed to retrieve repayment schedule",

            error:
              scheduleError.message

          });

        }


        if (!schedule) {

          return res.status(404).json({

            success: false,

            message:
              "Repayment schedule not found"

          });

        }


        const scheduleAmountPaid =
          Number(
            schedule.amount_paid || 0
          );


        const scheduleRemaining =
          Number(
            schedule.remaining_amount || 0
          );


        const schedulePayment =
          repaymentAmount;


        const newScheduleAmountPaid =
          Number(
            (
              scheduleAmountPaid +
              schedulePayment
            ).toFixed(2)
          );


        const newScheduleRemaining =
          Number(
            (
              scheduleRemaining -
              schedulePayment
            ).toFixed(2)
          );


        const scheduleStatus =
          newScheduleRemaining <= 0
            ? "PAID"
            : "PARTIAL";


        const {
          data: scheduleUpdate,
          error: scheduleUpdateError
        } = await supabase

          .from("loan_schedules")

          .update({

            amount_paid:
              newScheduleAmountPaid,

            remaining_amount:
              newScheduleRemaining,

            status:
              scheduleStatus,

            paid_date:
              newScheduleRemaining <= 0
                ? finalPaymentDate
                : null

          })

          .eq("id", schedule_id)
          .eq("loan_id", loan_id)
          .eq("customer_id", customer_id)

          .select("*")

          .single();


        if (scheduleUpdateError) {

          console.error(
            "Schedule update error:",
            scheduleUpdateError
          );

          return res.status(500).json({

            success: false,

            message:
              "Repayment created but schedule update failed",

            repayment:
              repayment,

            loanPayment:
              loanPayment,

            error:
              scheduleUpdateError.message

          });

        }


        updatedSchedule =
          scheduleUpdate;

      }


      /*
      --------------------------------------------------
      UPDATE LOAN BALANCE
      --------------------------------------------------
      */

      const {

        data: updatedLoan,

        error: loanUpdateError

      } = await supabase

        .from("loans")

        .update({

          amount_paid:
            newAmountPaid,

          remaining_balance:
            newRemainingBalance,

          loan_status:
            finalLoanStatus

        })

        .eq("id", loan_id)

        .eq("customer_id", customer_id)

        .select("*")

        .single();


      if (loanUpdateError) {

        console.error(
          "Loan balance update error:",
          loanUpdateError
        );

        return res.status(500).json({

          success: false,

          message:
            "Repayment was recorded but loan balance update failed",

          repayment:
            repayment,

          loanPayment:
            loanPayment,

          error:
            loanUpdateError.message

        });

      }


      /*
--------------------------------------------------
CREATE LOAN REPAYMENT TRANSACTION
--------------------------------------------------
*/

const {
  data: customer,
  error: customerError
} = await supabase
  .from("customers")
  .select("balance")
  .eq("id", customer_id)
  .maybeSingle();


if (customerError) {

  console.error(
    "Customer balance lookup error:",
    customerError
  );

  return res.status(500).json({

    success: false,

    message:
      "Unable to retrieve customer balance"

  });

}


if (!customer) {

  return res.status(404).json({

    success: false,

    message:
      "Customer not found"

  });

}


const customerBalance =
  Number(
    customer.balance || 0
  );


const {
  data: repaymentTransaction,
  error: repaymentTransactionError
} = await supabase

  .from("transactions")

  .insert({

    customer_id:
      customer_id,

    type:
      "loan_repayment",

    amount:
      repaymentAmount,

    description:
      `Loan repayment for loan #${loan_id}`,

    status:
      "completed",

    balance_before:
      customerBalance,

    balance_after:
      customerBalance,

    reference_number:
      repaymentReference,

    related_loan_id:
      Number(loan_id),

    related_customer_id:
      Number(customer_id),

    performed_by:
      "system"

  })

  .select("*")

  .single();


if (repaymentTransactionError) {

  console.error(
    "Repayment transaction creation error:",
    repaymentTransactionError
  );

  /*
  --------------------------------------------------
  DUPLICATE TRANSACTION REFERENCE
  --------------------------------------------------
  */

  if (
    repaymentTransactionError.code === "23505"
  ) {

    return res.status(409).json({

      success: false,

      message:
        "A transaction with this repayment reference already exists."

    });

  }

  return res.status(500).json({

    success: false,

    message:
      "Repayment recorded, but transaction history could not be created",

    repayment:
      repayment,

    loan:
      updatedLoan

  });

}


      /*
      --------------------------------------------------
      SUCCESS
      --------------------------------------------------
      */

      return res.status(201).json({

        success: true,

        message:
          finalLoanStatus === "PAID"
            ? "Repayment recorded and loan fully paid"
            : "Repayment recorded successfully",

        repayment:
          repayment,

        loanPayment:
          loanPayment,

        schedule:
          updatedSchedule,

        loan:
          updatedLoan

      });


    } catch (error) {

      console.error(
        "Repayment server error:",
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
UPDATE REPAYMENT
PUT /api/repayments/:id
-----------------------------------------------------
*/

router.put(
  "/api/repayments/:id",
  authenticateAdmin,
  async (req, res) => {

    return res.status(403).json({

      success: false,

      message:
        "Repayment editing is disabled. Use a controlled financial adjustment process."

    });

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
  authenticateAdmin,
  async (req, res) {

    return res.status(403).json({

      success: false,

      message:
        "Repayment deletion is disabled. Use a controlled financial adjustment process."

    });

  }
);


export default router;

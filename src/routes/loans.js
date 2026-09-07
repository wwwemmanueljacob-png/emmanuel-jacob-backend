import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=========================================================
POST /api/loans/apply
Create a new loan application
=========================================================
*/

router.post("/api/loans/apply", async (req, res) => {
  try {
    const {
      customer_id,
      loan_type,
      amount,
      duration_months,
      purpose,

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

      interest_rate
    } = req.body;

    /* -----------------------------------------------
       BASIC VALIDATION
    ------------------------------------------------ */

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required."
      });
    }

    if (!loan_type) {
      return res.status(400).json({
        success: false,
        message: "Loan type is required."
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid loan amount is required."
      });
    }

    if (
      !duration_months ||
      Number(duration_months) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid repayment duration is required."
      });
    }

    if (!purpose) {
      return res.status(400).json({
        success: false,
        message: "Loan purpose is required."
      });
    }

    /* -----------------------------------------------
       VERIFY CUSTOMER EXISTS
    ------------------------------------------------ */

    const {
      data: customer,
      error: customerError
    } = await supabase
      .from("customers")
      .select(`
        id,
        full_name,
        phone,
        email,
        residential_address,
        address,
        occupation
      `)
      .eq("id", customer_id)
      .maybeSingle();

    if (customerError) {
      return res.status(500).json({
        success: false,
        message: "Unable to verify customer.",
        error: customerError.message
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account was not found."
      });
    }

    /* -----------------------------------------------
       NORMALIZE LOAN TYPE
    ------------------------------------------------ */

    const normalizedLoanType =
      String(loan_type)
        .trim()
        .toLowerCase();

    if (
      normalizedLoanType !== "personal" &&
      normalizedLoanType !== "business"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Loan type must be personal or business."
      });
    }

    /* -----------------------------------------------
       CHECK FOR EXISTING PENDING APPLICATION
    ------------------------------------------------ */

    const {
      data: existingApplication,
      error: existingError
    } = await supabase
      .from("loan_applications")
      .select("id, status")
      .eq("customer_id", customer_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to check existing applications.",
        error: existingError.message
      });
    }

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending loan application.",
        application_id:
          existingApplication.id
      });
    }

    /* -----------------------------------------------
       PREPARE APPLICATION
    ------------------------------------------------ */

    const application = {
      customer_id: customer.id,

      loan_type:
        normalizedLoanType,

      amount:
        Number(amount),

      duration_months:
        Number(duration_months),

      purpose:
        String(purpose).trim(),

      status:
        "pending",

      applicant_name:
        applicant_name ||
        customer.full_name,

      phone:
        phone ||
        customer.phone,

      email:
        email ||
        customer.email,

      residential_address:
        residential_address ||
        customer.residential_address ||
        customer.address ||
        null,

      employment_status:
        employment_status || null,

      monthly_income:
        monthly_income
          ? Number(monthly_income)
          : null,

      business_name:
        business_name || null,

      business_address:
        business_address || null,

      business_type:
        business_type || null,

      monthly_business_income:
        monthly_business_income
          ? Number(monthly_business_income)
          : null,

      interest_rate:
        interest_rate !== undefined &&
        interest_rate !== null &&
        interest_rate !== ""
          ? Number(interest_rate)
          : null
    };

    /* -----------------------------------------------
       INSERT APPLICATION
    ------------------------------------------------ */

    const {
      data,
      error
    } = await supabase
      .from("loan_applications")
      .insert(application)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to submit loan application.",
        error: error.message
      });
    }

    /* -----------------------------------------------
       SUCCESS
    ------------------------------------------------ */

    return res.status(201).json({
      success: true,
      message:
        "Loan application submitted successfully.",
      application: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message:
        "Server error while submitting loan application.",
      error: error.message
    });

  }
});


/*
=========================================================
GET CUSTOMER LOAN APPLICATIONS
=========================================================

GET
/api/loans/customer/:customerId
=========================================================
*/

router.get(
  "/api/loans/customer/:customerId",
  async (req, res) => {

    try {

      const {
        customerId
      } = req.params;

      const {
        data,
        error
      } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("customer_id", customerId)
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Unable to retrieve loan applications.",
          error: error.message
        });

      }

      return res.json({
        success: true,
        applications: data || []
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message: "Server error.",
        error: error.message
      });

    }

  }
);


export default router;

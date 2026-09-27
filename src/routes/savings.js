import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
 JAY C O B FINANCIAL SERVICES
 SAVINGS ROUTES
=====================================================
*/

/*
GET CUSTOMER SAVINGS
GET /api/savings
*/
router.get("/", async (req, res) => {
  try {
    const customerId = req.user?.id || req.query.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required"
      });
    }

    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Savings route error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load savings",
        error: error.message
      });
    }

    const savings = data || [];

    const totalSavings = savings.reduce((total, item) => {
      return total + Number(
        item.amount || 0
      );
    }, 0);

    res.json({
      success: true,
      total_savings: totalSavings,
      savings
    });

  } catch (error) {
    console.error("Savings server error:", error);

    res.status(500).json({
      success: false,
      message: "Savings service error"
    });
  }
});


export default router;

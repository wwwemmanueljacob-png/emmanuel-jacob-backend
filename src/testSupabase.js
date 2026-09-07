import express from "express";
import { supabase } from "./lib/supabase.js";

const router = express.Router();

router.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Supabase connection failed",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Supabase connection successful",
      database: "Connected",
      test: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Supabase connection failed",
      error: error.message
    });
  }
});

export default router;

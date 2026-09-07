import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

router.get("/test-supabase", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase test error:", error);

      return res.status(500).json({
        success: false,
        message: "Supabase connection failed",
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: "Railway backend is successfully connected to Supabase",
      data,
    });
  } catch (error) {
    console.error("Unexpected Supabase error:", error);

    return res.status(500).json({
      success: false,
      message: "Unexpected Supabase error",
    });
  }
});

export default router;

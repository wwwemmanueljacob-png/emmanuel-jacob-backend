import express from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

/*
=====================================================
CUSTOMER LOGIN
=====================================================
*/

router.post("/api/customers/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number and password are required"
      });
    }

    /*
    Find customer by email OR phone
    */

    let query = supabase
      .from("customers")
      .select("*");

    if (email) {
      query = query.eq("email", email);
    } else {
      query = query.eq("phone", phone);
    }

    const { data: customer, error } = await query.maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to find customer",
        error: error.message
      });
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials"
      });
    }

    /*
    Check account status
    */

    if (
      customer.account_status &&
      customer.account_status.toLowerCase() === "blocked"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support."
      });
    }

    /*
    Check temporary lock
    */

    if (customer.locked_until) {
      const lockedUntil = new Date(customer.locked_until);
      const now = new Date();

      if (lockedUntil > now) {
        return res.status(423).json({
          success: false,
          message: "Account temporarily locked. Please try again later.",
          locked_until: customer.locked_until
        });
      }

      /*
      Lock period has expired.
      Reset failed attempts.
      */

      await supabase
        .from("customers")
        .update({
          failed_attempts: 0,
          locked_until: null
        })
        .eq("id", customer.id);

      customer.failed_attempts = 0;
      customer.locked_until = null;
    }

    /*
    Check password
    */

    const passwordHash = hashPassword(password);

    if (passwordHash !== customer.hash_password) {
      const currentAttempts = Number(customer.failed_attempts || 0);
      const newAttempts = currentAttempts + 1;

      /*
      Lock after 5 failed attempts
      */

      if (newAttempts >= 5) {
        const lockTime = new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString();

        await supabase
          .from("customers")
          .update({
            failed_attempts: newAttempts,
            locked_until: lockTime
          })
          .eq("id", customer.id);

        return res.status(423).json({
          success: false,
          message:
            "Too many failed login attempts. Your account is locked for 15 minutes.",
          failed_attempts: newAttempts,
          locked_until: lockTime
        });
      }

      await supabase
        .from("customers")
        .update({
          failed_attempts: newAttempts
        })
        .eq("id", customer.id);

      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
        failed_attempts: newAttempts,
        attempts_remaining: 5 - newAttempts
      });
    }

    /*
    Successful login
    Reset failed attempts
    */

    await supabase
      .from("customers")
      .update({
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);

    /*
    Generate session token
    */

    const sessionToken = generateSessionToken();

    /*
    Do NOT return password hash
    */

    delete customer.hash_password;

    return res.json({
      success: true,
      message: "Customer login successful",
      session_token: sessionToken,
      customer
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

export default router;

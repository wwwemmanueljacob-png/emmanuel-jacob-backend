import express from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/*
=====================================================
CUSTOMER AUTHENTICATION
JAY C O B FINANCIAL SERVICES
=====================================================
*/

/*
-----------------------------------------------------
HASH PASSWORD
-----------------------------------------------------
*/

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}


/*
-----------------------------------------------------
GENERATE SECURE SESSION TOKEN
-----------------------------------------------------
*/

function generateSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}


/*
-----------------------------------------------------
SAFE CUSTOMER DATA
Never return password hash
-----------------------------------------------------
*/

function safeCustomer(customer) {

  if (!customer) return null;

  const {
    hash_password,
    ...safeData
  } = customer;

  return safeData;
}


/*
=====================================================
CUSTOMER LOGIN
POST /api/customers/login
=====================================================
*/

router.post("/api/customers/login", async (req, res) => {

  try {

    const {
      email,
      phone,
      password
    } = req.body;


    /*
    Validate login fields
    */

    if ((!email && !phone) || !password) {

      return res.status(400).json({

        success: false,

        message:
          "Email or phone number and password are required."

      });

    }


    /*
    Find customer
    */

    let query = supabase
      .from("customers")
      .select("*");


    if (email) {

      query = query.eq(
        "email",
        email.trim().toLowerCase()
      );

    } else {

      query = query.eq(
        "phone",
        phone.trim()
      );

    }


    const {
      data: customer,
      error
    } = await query.maybeSingle();


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Unable to find customer.",

        error:
          error.message

      });

    }


    if (!customer) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid login credentials."

      });

    }


    /*
    Check account status
    */

    const accountStatus =
      String(
        customer.account_status || "active"
      ).toLowerCase();


    if (accountStatus === "blocked") {

      return res.status(403).json({

        success: false,

        message:
          "Your account has been blocked. Please contact support."

      });

    }


    /*
    Check temporary lock
    */

    if (customer.locked_until) {

      const lockedUntil =
        new Date(customer.locked_until);

      const now =
        new Date();


      if (lockedUntil > now) {

        return res.status(423).json({

          success: false,

          message:
            "Account temporarily locked. Please try again later.",

          locked_until:
            customer.locked_until

        });

      }


      /*
      Lock expired
      */

      await supabase
        .from("customers")
        .update({

          failed_attempts: 0,

          locked_until: null,

          updated_at:
            new Date().toISOString()

        })
        .eq("id", customer.id);


      customer.failed_attempts = 0;

      customer.locked_until = null;

    }


    /*
    Verify password
    */

    const passwordHash =
      hashPassword(password);


    if (
      passwordHash !==
      customer.hash_password
    ) {

      const currentAttempts =
        Number(
          customer.failed_attempts || 0
        );


      const newAttempts =
        currentAttempts + 1;


      /*
      Lock after 5 failed attempts
      */

      if (newAttempts >= 5) {

        const lockTime =
          new Date(
            Date.now() +
            15 * 60 * 1000
          ).toISOString();


        await supabase
          .from("customers")
          .update({

            failed_attempts:
              newAttempts,

            locked_until:
              lockTime,

            updated_at:
              new Date().toISOString()

          })
          .eq("id", customer.id);


        return res.status(423).json({

          success: false,

          message:
            "Too many failed login attempts. Your account is locked for 15 minutes.",

          failed_attempts:
            newAttempts,

          locked_until:
            lockTime

        });

      }


      /*
      Save failed attempt
      */

      await supabase
        .from("customers")
        .update({

          failed_attempts:
            newAttempts,

          updated_at:
            new Date().toISOString()

        })
        .eq("id", customer.id);


      return res.status(401).json({

        success: false,

        message:
          "Invalid login credentials.",

        failed_attempts:
          newAttempts,

        attempts_remaining:
          5 - newAttempts

      });

    }


    /*
=====================================================
SUCCESSFUL LOGIN
=====================================================
*/

    const sessionToken =
      generateSessionToken();


    const now =
      new Date();


    /*
    Session lifetime:
    24 hours
    */

    const expiresAt =
      new Date(
        now.getTime() +
        24 * 60 * 60 * 1000
      );


    /*
    Request information
    */

    const ipAddress =
      req.headers["x-forwarded-for"]
        ?.split(",")[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      null;


    const userAgent =
      req.headers["user-agent"] ||
      null;


    /*
    Device information
    */

    const deviceInfo =
      req.body.device_info ||
      null;


    /*
    Save session in Supabase
    */

    const {
      data: session,
      error: sessionError
    } = await supabase
      .from("customer_sessions")
      .insert([{

        customer_id:
          customer.id,

        session_token:
          sessionToken,

        ip_address:
          ipAddress,

        user_agent:
          userAgent,

        device_info:
          deviceInfo,

        expires_at:
          expiresAt.toISOString(),

        last_activity:
          now.toISOString(),

        is_active:
          true,

        logged_out_at:
          null

      }])
      .select(
        `
        id,
        customer_id,
        created_at,
        expires_at,
        last_activity,
        is_active
        `
      )
      .single();


    if (sessionError) {

      return res.status(500).json({

        success: false,

        message:
          "Unable to create customer session.",

        error:
          sessionError.message

      });

    }


    /*
    Reset failed attempts
    */

    const {
      data: updatedCustomer,
      error: updateError
    } = await supabase
      .from("customers")
      .update({

        failed_attempts:
          0,

        locked_until:
          null,

        updated_at:
          now.toISOString()

      })
      .eq("id", customer.id)
      .select("*")
      .single();


    if (updateError) {

      /*
      If customer update fails,
      deactivate the session we just created.
      */

      await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString()

        })
        .eq("id", session.id);


      return res.status(500).json({

        success: false,

        message:
          "Unable to complete customer login.",

        error:
          updateError.message

      });

    }


    return res.json({

      success: true,

      message:
        "Customer login successful.",

      session_token:
        sessionToken,

      expires_at:
        expiresAt.toISOString(),

      customer:
        safeCustomer(updatedCustomer)

    });


  } catch (error) {

    console.error(
      "Customer login error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Server error."

    });

  }

});


/*
=====================================================
CUSTOMER PROFILE
GET /api/auth/profile
=====================================================
*/

router.get(
  "/api/auth/profile",
  async (req, res) => {

    try {

      const authorization =
        req.headers.authorization;


      if (!authorization) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication token is required."

        });

      }


      const parts =
        authorization.split(" ");


      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid authentication format."

        });

      }


      const token =
        parts[1];


      /*
      Find active session
      */

      const {
        data: session,
        error: sessionError
      } = await supabase
        .from("customer_sessions")
        .select(
          `
          id,
          customer_id,
          expires_at,
          last_activity,
          is_active
          `
        )
        .eq(
          "session_token",
          token
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


      if (sessionError) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify session.",

          error:
            sessionError.message

        });

      }


      if (!session) {

        return res.status(401).json({

          success: false,

          message:
            "Your login session is invalid."

        });

      }


      /*
      Check expiration
      */

      const expiresAt =
        new Date(
          session.expires_at
        );


      if (
        expiresAt <= new Date()
      ) {

        await supabase
          .from("customer_sessions")
          .update({

            is_active:
              false,

            logged_out_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            session.id
          );


        return res.status(401).json({

          success: false,

          message:
            "Your login session has expired."

        });

      }


      /*
      Update last activity
      */

      await supabase
        .from("customer_sessions")
        .update({

          last_activity:
            new Date().toISOString()

        })
        .eq(
          "id",
          session.id
        );


      /*
      Get customer
      */

      const {
        data: customer,
        error: customerError
      } = await supabase
        .from("customers")
        .select("*")
        .eq(
          "id",
          session.customer_id
        )
        .maybeSingle();


      if (customerError) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to retrieve customer profile.",

          error:
            customerError.message

        });

      }


      if (!customer) {

        return res.status(404).json({

          success: false,

          message:
            "Customer account not found."

        });

      }


      return res.json({

        success: true,

        customer:
          safeCustomer(customer)

      });


    } catch (error) {

      console.error(
        "Profile error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Server error."

      });

    }

  }
);


/*
=====================================================
CUSTOMER LOGOUT
POST /api/auth/logout
=====================================================
*/

router.post(
  "/api/auth/logout",
  async (req, res) => {

    try {

      const authorization =
        req.headers.authorization;


      if (!authorization) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication token is required."

        });

      }


      const parts =
        authorization.split(" ");


      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid authentication format."

        });

      }


      const token =
        parts[1];


      const {
        data: session,
        error
      } = await supabase
        .from("customer_sessions")
        .select(
          `
          id,
          customer_id
          `
        )
        .eq(
          "session_token",
          token
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


      if (error) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to find session.",

          error:
            error.message

        });

      }


      if (!session) {

        return res.status(401).json({

          success: false,

          message:
            "Session is invalid or already logged out."

        });

      }


      await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString(),

          last_activity:
            new Date().toISOString()

        })
        .eq(
          "id",
          session.id
        );


      return res.json({

        success: true,

        message:
          "Customer logged out successfully."

      });


    } catch (error) {

      console.error(
        "Logout error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Server error."

      });

    }

  }
);



/*
-----------------------------------------------------
GENERATE SECURE SESSION TOKEN
-----------------------------------------------------
*/

function generateSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}


/*
-----------------------------------------------------
SAFE CUSTOMER DATA
Never return password hash
-----------------------------------------------------
*/

function safeCustomer(customer) {

  if (!customer) return null;

  const {
    hash_password,
    ...safeData
  } = customer;

  return safeData;
}


/*
=====================================================
CUSTOMER LOGIN
POST /api/customers/login
=====================================================
*/

router.post("/api/customers/login", async (req, res) => {

  try {

    const {
      email,
      phone,
      password
    } = req.body;


    /*
    Validate login fields
    */

    if ((!email && !phone) || !password) {

      return res.status(400).json({

        success: false,

        message:
          "Email or phone number and password are required."

      });

    }


    /*
    Find customer
    */

    let query = supabase
      .from("customers")
      .select("*");


    if (email) {

      query = query.eq(
        "email",
        email.trim().toLowerCase()
      );

    } else {

      query = query.eq(
        "phone",
        phone.trim()
      );

    }


    const {
      data: customer,
      error
    } = await query.maybeSingle();


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Unable to find customer.",

        error:
          error.message

      });

    }


    if (!customer) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid login credentials."

      });

    }


    /*
    Check account status
    */

    const accountStatus =
      String(
        customer.account_status || "active"
      ).toLowerCase();


    if (accountStatus === "blocked") {

      return res.status(403).json({

        success: false,

        message:
          "Your account has been blocked. Please contact support."

      });

    }


    /*
    Check temporary lock
    */

    if (customer.locked_until) {

      const lockedUntil =
        new Date(customer.locked_until);

      const now =
        new Date();


      if (lockedUntil > now) {

        return res.status(423).json({

          success: false,

          message:
            "Account temporarily locked. Please try again later.",

          locked_until:
            customer.locked_until

        });

      }


      /*
      Lock expired
      */

      await supabase
        .from("customers")
        .update({

          failed_attempts: 0,

          locked_until: null,

          updated_at:
            new Date().toISOString()

        })
        .eq("id", customer.id);


      customer.failed_attempts = 0;

      customer.locked_until = null;

    }


    /*
    Verify password
    */

    const passwordHash =
      hashPassword(password);


    if (
      passwordHash !==
      customer.hash_password
    ) {

      const currentAttempts =
        Number(
          customer.failed_attempts || 0
        );


      const newAttempts =
        currentAttempts + 1;


      /*
      Lock after 5 failed attempts
      */

      if (newAttempts >= 5) {

        const lockTime =
          new Date(
            Date.now() +
            15 * 60 * 1000
          ).toISOString();


        await supabase
          .from("customers")
          .update({

            failed_attempts:
              newAttempts,

            locked_until:
              lockTime,

            updated_at:
              new Date().toISOString()

          })
          .eq("id", customer.id);


        return res.status(423).json({

          success: false,

          message:
            "Too many failed login attempts. Your account is locked for 15 minutes.",

          failed_attempts:
            newAttempts,

          locked_until:
            lockTime

        });

      }


      /*
      Save failed attempt
      */

      await supabase
        .from("customers")
        .update({

          failed_attempts:
            newAttempts,

          updated_at:
            new Date().toISOString()

        })
        .eq("id", customer.id);


      return res.status(401).json({

        success: false,

        message:
          "Invalid login credentials.",

        failed_attempts:
          newAttempts,

        attempts_remaining:
          5 - newAttempts

      });

    }


    /*
=====================================================
SUCCESSFUL LOGIN
=====================================================
*/

    const sessionToken =
      generateSessionToken();


    const now =
      new Date();


    /*
    Session lifetime:
    24 hours
    */

    const expiresAt =
      new Date(
        now.getTime() +
        24 * 60 * 60 * 1000
      );


    /*
    Request information
    */

    const ipAddress =
      req.headers["x-forwarded-for"]
        ?.split(",")[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      null;


    const userAgent =
      req.headers["user-agent"] ||
      null;


    /*
    Device information
    */

    const deviceInfo =
      req.body.device_info ||
      null;


    /*
    Save session in Supabase
    */

    const {
      data: session,
      error: sessionError
    } = await supabase
      .from("customer_sessions")
      .insert([{

        customer_id:
          customer.id,

        session_token:
          sessionToken,

        ip_address:
          ipAddress,

        user_agent:
          userAgent,

        device_info:
          deviceInfo,

        expires_at:
          expiresAt.toISOString(),

        last_activity:
          now.toISOString(),

        is_active:
          true,

        logged_out_at:
          null

      }])
      .select(
        `
        id,
        customer_id,
        created_at,
        expires_at,
        last_activity,
        is_active
        `
      )
      .single();


    if (sessionError) {

      return res.status(500).json({

        success: false,

        message:
          "Unable to create customer session.",

        error:
          sessionError.message

      });

    }


    /*
    Reset failed attempts
    */

    const {
      data: updatedCustomer,
      error: updateError
    } = await supabase
      .from("customers")
      .update({

        failed_attempts:
          0,

        locked_until:
          null,

        updated_at:
          now.toISOString()

      })
      .eq("id", customer.id)
      .select("*")
      .single();


    if (updateError) {

      /*
      If customer update fails,
      deactivate the session we just created.
      */

      await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString()

        })
        .eq("id", session.id);


      return res.status(500).json({

        success: false,

        message:
          "Unable to complete customer login.",

        error:
          updateError.message

      });

    }


    return res.json({

      success: true,

      message:
        "Customer login successful.",

      session_token:
        sessionToken,

      expires_at:
        expiresAt.toISOString(),

      customer:
        safeCustomer(updatedCustomer)

    });


  } catch (error) {

    console.error(
      "Customer login error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Server error."

    });

  }

});


/*
=====================================================
CUSTOMER PROFILE
GET /api/auth/profile
=====================================================
*/

router.get(
  "/api/auth/profile",
  async (req, res) => {

    try {

      const authorization =
        req.headers.authorization;


      if (!authorization) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication token is required."

        });

      }


      const parts =
        authorization.split(" ");


      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid authentication format."

        });

      }


      const token =
        parts[1];


      /*
      Find active session
      */

      const {
        data: session,
        error: sessionError
      } = await supabase
        .from("customer_sessions")
        .select(
          `
          id,
          customer_id,
          expires_at,
          last_activity,
          is_active
          `
        )
        .eq(
          "session_token",
          token
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


      if (sessionError) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify session.",

          error:
            sessionError.message

        });

      }


      if (!session) {

        return res.status(401).json({

          success: false,

          message:
            "Your login session is invalid."

        });

      }


      /*
      Check expiration
      */

      const expiresAt =
        new Date(
          session.expires_at
        );


      if (
        expiresAt <= new Date()
      ) {

        await supabase
          .from("customer_sessions")
          .update({

            is_active:
              false,

            logged_out_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            session.id
          );


        return res.status(401).json({

          success: false,

          message:
            "Your login session has expired."

        });

      }


      /*
      Update last activity
      */

      await supabase
        .from("customer_sessions")
        .update({

          last_activity:
            new Date().toISOString()

        })
        .eq(
          "id",
          session.id
        );


      /*
      Get customer
      */

      const {
        data: customer,
        error: customerError
      } = await supabase
        .from("customers")
        .select("*")
        .eq(
          "id",
          session.customer_id
        )
        .maybeSingle();


      if (customerError) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to retrieve customer profile.",

          error:
            customerError.message

        });

      }


      if (!customer) {

        return res.status(404).json({

          success: false,

          message:
            "Customer account not found."

        });

      }


      return res.json({

        success: true,

        customer:
          safeCustomer(customer)

      });


    } catch (error) {

      console.error(
        "Profile error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Server error."

      });

    }

  }
);


/*
=====================================================
CUSTOMER LOGOUT
POST /api/auth/logout
=====================================================
*/

router.post(
  "/api/auth/logout",
  async (req, res) => {

    try {

      const authorization =
        req.headers.authorization;


      if (!authorization) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication token is required."

        });

      }


      const parts =
        authorization.split(" ");


      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid authentication format."

        });

      }


      const token =
        parts[1];


      const {
        data: session,
        error
      } = await supabase
        .from("customer_sessions")
        .select(
          `
          id,
          customer_id
          `
        )
        .eq(
          "session_token",
          token
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


      if (error) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to find session.",

          error:
            error.message

        });

      }


      if (!session) {

        return res.status(401).json({

          success: false,

          message:
            "Session is invalid or already logged out."

        });

      }


      await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString(),

          last_activity:
            new Date().toISOString()

        })
        .eq(
          "id",
          session.id
        );


      return res.json({

        success: true,

        message:
          "Customer logged out successfully."

      });


    } catch (error) {

      console.error(
        "Logout error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Server error."

      });

    }

  }
);

/*
=====================================================
CUSTOMER AUTHENTICATION MIDDLEWARE
=====================================================
*/

async function authenticate(req, res, next) {

  try {

    /*
    -------------------------------------------------
    GET AUTHORIZATION HEADER
    -------------------------------------------------
    */

    const authorization =
      req.headers.authorization;


    if (!authorization) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication token is required."

      });

    }


    /*
    -------------------------------------------------
    CHECK BEARER FORMAT
    -------------------------------------------------
    */

    const parts =
      authorization.trim().split(/\s+/);


    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      !parts[1]
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid authentication format."

      });

    }


    const token =
      parts[1];


    /*
    -------------------------------------------------
    FIND ACTIVE CUSTOMER SESSION
    -------------------------------------------------
    */

    const {
      data: session,
      error: sessionError
    } = await supabase

      .from("customer_sessions")

      .select(`
        id,
        customer_id,
        expires_at,
        last_activity,
        is_active
      `)

      .eq(
        "session_token",
        token
      )

      .eq(
        "is_active",
        true
      )

      .maybeSingle();


    if (sessionError) {

      console.error(
        "Session lookup error:",
        sessionError
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to verify customer session."

      });

    }


    /*
    -------------------------------------------------
    SESSION NOT FOUND
    -------------------------------------------------
    */

    if (!session) {

      return res.status(401).json({

        success: false,

        message:
          "Your login session is invalid."

      });

    }


    /*
    -------------------------------------------------
    CHECK SESSION EXPIRATION
    -------------------------------------------------
    */

    const expiresAt =
      new Date(
        session.expires_at
      );


    if (
      Number.isNaN(
        expiresAt.getTime()
      ) ||
      expiresAt <= new Date()
    ) {

      await supabase

        .from("customer_sessions")

        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString(),

          last_activity:
            new Date().toISOString()

        })

        .eq(
          "id",
          session.id
        );


      return res.status(401).json({

        success: false,

        message:
          "Your login session has expired."

      });

    }


    /*
    -------------------------------------------------
    GET CUSTOMER ACCOUNT
    -------------------------------------------------
    */

    const {
      data: customer,
      error: customerError
    } = await supabase

      .from("customers")

      .select("*")

      .eq(
        "id",
        session.customer_id
      )

      .maybeSingle();


    if (customerError) {

      console.error(
        "Customer lookup error:",
        customerError
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to retrieve customer account."

      });

    }


    /*
    -------------------------------------------------
    CUSTOMER DOES NOT EXIST
    -------------------------------------------------
    */

    if (!customer) {

      return res.status(401).json({

        success: false,

        message:
          "Customer account no longer exists."

      });

    }


    /*
    -------------------------------------------------
    CHECK ACCOUNT STATUS
    -------------------------------------------------
    */

    const accountStatus =
      String(
        customer.account_status ||
        "active"
      ).toLowerCase();


    if (
      accountStatus === "blocked"
    ) {

      await supabase

        .from("customer_sessions")

        .update({

          is_active:
            false,

          logged_out_at:
            new Date().toISOString(),

          last_activity:
            new Date().toISOString()

        })

        .eq(
          "id",
          session.id
        );


      return res.status(403).json({

        success: false,

        message:
          "Your customer account has been blocked."

      });

    }


    /*
    -------------------------------------------------
    UPDATE LAST ACTIVITY
    -------------------------------------------------
    */

    await supabase

      .from("customer_sessions")

      .update({

        last_activity:
          new Date().toISOString()

      })

      .eq(
        "id",
        session.id
      );


    /*
    -------------------------------------------------
    ATTACH CUSTOMER TO REQUEST
    -------------------------------------------------
    */

    req.customer =
      customer;

    req.customerId =
      customer.id;

    req.session =
      session;

    req.token =
      token;


    /*
    -------------------------------------------------
    CONTINUE TO PROTECTED ROUTE
    -------------------------------------------------
    */

    next();


  } catch (error) {

    console.error(
      "Customer authentication error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Customer authentication failed."

    });

  }

}

export { router, authenticate };
export default router;


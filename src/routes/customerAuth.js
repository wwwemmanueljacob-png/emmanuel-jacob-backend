import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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

router.post(
  "/api/customers/login",
  async (req, res) => {

    try {

      const {
        email,
        phone,
        password
      } = req.body;


      /*
      -------------------------------------------------
      VALIDATE LOGIN FIELDS
      -------------------------------------------------
      */

      if ((!email && !phone) || !password) {

        return res.status(400).json({

          success: false,

          message:
            "Email or phone number and password are required."

        });

      }


      /*
      -------------------------------------------------
      FIND CUSTOMER
      -------------------------------------------------
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

        console.error(
          "Customer lookup error:",
          error
        );

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
      -------------------------------------------------
      CHECK ACCOUNT STATUS
      -------------------------------------------------
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
      -------------------------------------------------
      CHECK TEMPORARY LOCK
      -------------------------------------------------
      */

      if (customer.locked_until) {

        const lockedUntil =
          new Date(
            customer.locked_until
          );

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
        -------------------------------------------------
        LOCK EXPIRED
        -------------------------------------------------
        */

        const {
          error: unlockError
        } = await supabase
          .from("customers")
          .update({

            failed_attempts: 0,

            locked_until: null,

            updated_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            customer.id
          );


        if (unlockError) {

          console.error(
            "Account unlock error:",
            unlockError
          );

        }


        customer.failed_attempts = 0;

        customer.locked_until = null;

      }


      /*
      -------------------------------------------------
      VERIFY PASSWORD
      -------------------------------------------------
      */

      const passwordValid =
        await bcrypt.compare(
          password,
          customer.hash_password
        );


      if (!passwordValid) {

        const currentAttempts =
          Number(
            customer.failed_attempts || 0
          );


        const newAttempts =
          currentAttempts + 1;


        /*
        -------------------------------------------------
        LOCK AFTER 5 FAILED ATTEMPTS
        -------------------------------------------------
        */

        if (newAttempts >= 5) {

          const lockTime =
            new Date(
              Date.now() +
              15 * 60 * 1000
            ).toISOString();


          const {
            error: lockError
          } = await supabase
            .from("customers")
            .update({

              failed_attempts:
                newAttempts,

              locked_until:
                lockTime,

              updated_at:
                new Date().toISOString()

            })
            .eq(
              "id",
              customer.id
            );


          if (lockError) {

            console.error(
              "Account lock update error:",
              lockError
            );

          }


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
        -------------------------------------------------
        SAVE FAILED ATTEMPT
        -------------------------------------------------
        */

        const {
          error: attemptError
        } = await supabase
          .from("customers")
          .update({

            failed_attempts:
              newAttempts,

            updated_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            customer.id
          );


        if (attemptError) {

          console.error(
            "Failed attempt update error:",
            attemptError
          );

        }


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
      =================================================
      SUCCESSFUL LOGIN
      =================================================
      */

      const sessionToken =
        generateSessionToken();


      const now =
        new Date();


      /*
      -------------------------------------------------
      SESSION LIFETIME: 24 HOURS
      -------------------------------------------------
      */

      const expiresAt =
        new Date(
          now.getTime() +
          24 * 60 * 60 * 1000
        );


      /*
      -------------------------------------------------
      REQUEST INFORMATION
      -------------------------------------------------
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
      -------------------------------------------------
      DEVICE INFORMATION
      -------------------------------------------------
      */

      const deviceInfo =
        req.body.device_info ||
        null;


      /*
      -------------------------------------------------
      SAVE SESSION IN SUPABASE
      -------------------------------------------------
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
        .select(`
          id,
          customer_id,
          created_at,
          expires_at,
          last_activity,
          is_active
        `)
        .single();


      if (sessionError) {

        console.error(
          "Session creation error:",
          sessionError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to create customer session.",

          error:
            sessionError.message

        });

      }


      /*
      -------------------------------------------------
      RESET FAILED ATTEMPTS
      -------------------------------------------------
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
        .eq(
          "id",
          customer.id
        )
        .select("*")
        .single();


      if (updateError) {

        console.error(
          "Customer reset error:",
          updateError
        );


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
              new Date().toISOString(),

            last_activity:
              new Date().toISOString()

          })
          .eq(
            "id",
            session.id
          );


        return res.status(500).json({

          success: false,

          message:
            "Unable to complete customer login.",

          error:
            updateError.message

        });

      }


      /*
      -------------------------------------------------
      LOGIN SUCCESS
      -------------------------------------------------
      */

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

  }
);


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
        req.headers.authorization || "";


      if (!authorization) {

        return res.status(401).json({

          success: false,

          message:
            "Authentication token is required."

        });

      }


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
        parts[1].trim();


      /*
      -------------------------------------------------
      FIND ACTIVE SESSION
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
          "Profile session lookup error:",
          sessionError
        );

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
      -------------------------------------------------
      CHECK EXPIRATION
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

        const expirationTime =
          new Date().toISOString();


        const {
          error: expirationError
        } = await supabase
          .from("customer_sessions")
          .update({

            is_active:
              false,

            logged_out_at:
              expirationTime,

            last_activity:
              expirationTime

          })
          .eq(
            "id",
            session.id
          );


        if (expirationError) {

          console.error(
            "Session expiration update error:",
            expirationError
          );

        }


        return res.status(401).json({

          success: false,

          message:
            "Your login session has expired."

        });

      }


      /*
      -------------------------------------------------
      UPDATE LAST ACTIVITY
      -------------------------------------------------
      */

      const {
        error: activityError
      } = await supabase
        .from("customer_sessions")
        .update({

          last_activity:
            new Date().toISOString()

        })
        .eq(
          "id",
          session.id
        );


      if (activityError) {

        console.error(
          "Profile activity update error:",
          activityError
        );

      }


      /*
      -------------------------------------------------
      GET CUSTOMER
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
          "Customer profile lookup error:",
          customerError
        );

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


      /*
      -------------------------------------------------
      RETURN SAFE CUSTOMER
      -------------------------------------------------
      */

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

      /*
      -------------------------------------------------
      GET AUTHORIZATION HEADER
      -------------------------------------------------
      */

      const authorization =
        req.headers.authorization || "";


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
        parts[1].trim();


      /*
      -------------------------------------------------
      FIND ACTIVE SESSION
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
          session_token,
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
          "CUSTOMER LOGOUT SESSION LOOKUP ERROR:",
          sessionError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify logout session.",

          error:
            sessionError.message

        });

      }


      /*
      -------------------------------------------------
      SESSION NOT FOUND
      -------------------------------------------------
      */

      if (!session) {

        console.error(
          "CUSTOMER LOGOUT: Active session not found."
        );

        return res.status(401).json({

          success: false,

          message:
            "Active customer session was not found."

        });

      }


      /*
      -------------------------------------------------
      LOGOUT TIME
      -------------------------------------------------
      */

      const logoutTime =
        new Date().toISOString();


      /*
      -------------------------------------------------
      DEACTIVATE SESSION
      -------------------------------------------------
      */

      const {
        data: updatedSession,
        error: logoutError
      } = await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            logoutTime,

          last_activity:
            logoutTime

        })
        .eq(
          "id",
          session.id
        )
        .select(`
          id,
          customer_id,
          is_active,
          logged_out_at,
          last_activity
        `)
        .maybeSingle();


      /*
      -------------------------------------------------
      CHECK UPDATE ERROR
      -------------------------------------------------
      */

      if (logoutError) {

        console.error(
          "CUSTOMER LOGOUT UPDATE ERROR:",
          logoutError
        );

        return res.status(500).json({

          success: false,

          message:
            "Supabase could not deactivate the customer session.",

          error:
            logoutError.message

        });

      }


      /*
      -------------------------------------------------
      VERIFY THAT A ROW WAS UPDATED
      -------------------------------------------------
      */

      if (!updatedSession) {

        console.error(
          "CUSTOMER LOGOUT FAILED: Supabase updated zero rows.",
          {
            sessionId:
              session.id,

            customerId:
              session.customer_id
          }
        );

        return res.status(500).json({

          success: false,

          message:
            "Logout could not deactivate the session. Check Supabase Row Level Security permissions."

        });

      }


      /*
      -------------------------------------------------
      VERIFY is_active = false
      -------------------------------------------------
      */

      if (
        updatedSession.is_active !== false
      ) {

        console.error(
          "CUSTOMER LOGOUT FAILED: Session is still active.",
          updatedSession
        );

        return res.status(500).json({

          success: false,

          message:
            "Logout verification failed. The session is still active."

        });

      }


      /*
      -------------------------------------------------
      LOG SUCCESS
      -------------------------------------------------
      */

      console.log(
        "CUSTOMER LOGOUT SUCCESS:",
        {
          sessionId:
            updatedSession.id,

          customerId:
            updatedSession.customer_id,

          isActive:
            updatedSession.is_active,

          loggedOutAt:
            updatedSession.logged_out_at
        }
      );


      /*
      -------------------------------------------------
      RETURN SUCCESS
      -------------------------------------------------
      */

      return res.json({

        success: true,

        message:
          "Customer logged out successfully.",

        session:
          updatedSession

      });


    } catch (error) {

      console.error(
        "CUSTOMER LOGOUT SERVER ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Customer logout failed.",

        error:
          error.message

      });

    }

  }
);


/*
=====================================================
CUSTOMER SESSION CHECK
GET /api/auth/session
=====================================================
*/

router.get(
  "/api/auth/session",
  async (req, res) => {

    try {

      const authorization =
        req.headers.authorization || "";

      if (!authorization) {

        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Authentication token is required."
        });

      }

      const parts =
        authorization.trim().split(/\s+/);

      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer" ||
        !parts[1]
      ) {

        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Invalid authentication format."
        });

      }

      const token =
        parts[1].trim();

      /*
      -------------------------------------------------
      FIND ACTIVE SESSION
      -------------------------------------------------
      */

      const {
        data: session,
        error
      } = await supabase
        .from("customer_sessions")
        .select(`
          id,
          customer_id,
          expires_at,
          is_active,
          logged_out_at
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

      if (error) {

        console.error(
          "CUSTOMER SESSION CHECK ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          authenticated: false,
          message:
            "Unable to verify customer session.",
          error:
            error.message
        });

      }

      /*
      -------------------------------------------------
      SESSION DOES NOT EXIST
      -------------------------------------------------
      */

      if (!session) {

        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Customer session is not active."
        });

      }

      /*
      -------------------------------------------------
      CHECK SESSION EXPIRATION
      -------------------------------------------------
      */

      if (
        session.expires_at &&
        new Date(session.expires_at) <= new Date()
      ) {

        await supabase
          .from("customer_sessions")
          .update({
            is_active: false,
            logged_out_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            session.id
          );

        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Customer session has expired."
        });

      }

      /*
      -------------------------------------------------
      SESSION IS VALID
      -------------------------------------------------
      */

      return res.json({

        success: true,

        authenticated: true,

        session: {
          id:
            session.id,

          customer_id:
            session.customer_id,

          expires_at:
            session.expires_at,

          is_active:
            session.is_active
        }

      });

    } catch (error) {

      console.error(
        "CUSTOMER SESSION CHECK SERVER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        authenticated: false,

        message:
          "Customer session verification failed."

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
      req.headers.authorization || "";


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
      parts[1].trim();


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
          "Unable to verify customer session.",

        error:
          sessionError.message

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

      const expirationTime =
        new Date().toISOString();


      const {
        error: expirationError
      } = await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            expirationTime,

          last_activity:
            expirationTime

        })
        .eq(
          "id",
          session.id
        );


      if (expirationError) {

        console.error(
          "Authentication expiration update error:",
          expirationError
        );

      }


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
          "Unable to retrieve customer account.",

        error:
          customerError.message

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

      const blockTime =
        new Date().toISOString();


      const {
        error: blockError
      } = await supabase
        .from("customer_sessions")
        .update({

          is_active:
            false,

          logged_out_at:
            blockTime,

          last_activity:
            blockTime

        })
        .eq(
          "id",
          session.id
        );


      if (blockError) {

        console.error(
          "Blocked session update error:",
          blockError
        );

      }


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

    const {
      error: activityError
    } = await supabase
      .from("customer_sessions")
      .update({

        last_activity:
          new Date().toISOString()

      })
      .eq(
        "id",
        session.id
      );


    if (activityError) {

      console.error(
        "Authentication activity update error:",
        activityError
      );

    }


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
        "Customer authentication failed.",

      error:
        error.message

    });

  }

}


/*
=====================================================
EXPORT ROUTER + AUTHENTICATION MIDDLEWARE
=====================================================
*/

export {
  router,
  authenticate
};

export default router;

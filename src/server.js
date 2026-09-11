import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

import { supabase } from "./lib/supabase.js";

import testSupabaseRouter from "./testSupabase.js";
import customersRouter from "./routes/customers.js";
import customerAuthRouter, {
  authenticate
} from "./routes/customerAuth.js";
import loansRouter from "./routes/loans.js";
import transactionsRouter from "./routes/transactions.js";
import statementsRouter from "./routes/statements.js";
import kycRouter from "./routes/kyc.js";
import supportRouter from "./routes/support.js";
import adminFeesRouter from "./routes/AdminFees.js";
import adminSavingsRouter from "./routes/AdminSavings.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================================
   MIDDLEWARE
========================================= */

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json());

app.use(testSupabaseRouter);
app.use(customersRouter);
app.use(customerAuthRouter);
app.use(loansRouter);
app.use(transactionsRouter);
app.use(statementsRouter);
app.use(kycRouter);
app.use(supportRouter);

app.use("/api/admin/fees", authenticateAdmin, adminFeesRouter);
app.use("/api/admin/savings", authenticateAdmin, adminSavingsRouter);

/* =========================================
   ADMIN CONFIGURATION

   CHANGE THESE USING RAILWAY VARIABLES
========================================= */

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  "admin@jaycobfinancial.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "admin123456";

let recoveredAdminPassword = null;

/* =========================================
   TEMPORARY DATABASE

   IMPORTANT:
   Railway restart/redeploy may reset data.

   Existing system preserved.
========================================= */

const customers = [
  {
    id: "CUST001",
    full_name: "Customer",
    email: "customer@example.com",
    phone: "+265000000000",
    password: "123456",
    status: "Active",
    created_at: new Date().toISOString()
  }
];

const sessions = new Map();

const adminSessions = new Map();

const applications = [];

const payments = [];

const supportMessages = [];

const auditLogs = [];

const followups = [];


/* =========================================
   HELPERS
========================================= */

function createToken() {

  return crypto
    .randomBytes(32)
    .toString("hex");

}


function createId(prefix) {

  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.floor(Math.random() * 100000)
  );

}


function addAuditLog(
  user,
  action,
  status = "SUCCESS"
) {

  const log = {

    id:
      createId("AUDIT"),

    date:
      new Date().toISOString(),

    user,

    action,

    status

  };

  auditLogs.unshift(log);

  return log;

}


/* =========================================
   ADMIN AUTHENTICATION MIDDLEWARE
========================================= */

async function authenticateAdmin(
  req,
  res,
  next
) {

  const authorization =
    req.headers.authorization;

  if (!authorization) {

    return res.status(401).json({

      success: false,

      message:
        "Admin authentication token is required."

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
        "Invalid admin authentication format."

    });

  }

  const token =
    parts[1];


  /* =====================================
     CHECK MEMORY SESSION FIRST
  ===================================== */

  let admin =
    adminSessions.get(token);


  /* =====================================
     IF NOT IN MEMORY, CHECK SUPABASE
  ===================================== */

  if (!admin) {

    try {

      const {
        data: session,
        error: sessionError
      } = await supabase
        .from("admin_sessions")
        .select(`
          id,
          admin_id,
          session_token,
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
          "ADMIN SESSION LOOKUP ERROR:",
          sessionError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify administrator session."

        });

      }


      /* =================================
         SESSION NOT FOUND
      ================================= */

      if (!session) {

        return res.status(401).json({

          success: false,

          message:
            "Admin session is invalid or expired."

        });

      }


      /* =================================
         CHECK SESSION EXPIRATION
      ================================= */

      if (
        session.expires_at &&
        new Date(session.expires_at) <= new Date()
      ) {

        await supabase
          .from("admin_sessions")
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
            "Admin session has expired."

        });

      }


      /* =================================
         LOAD ADMIN FROM SUPABASE
      ================================= */

      const {
        data: adminRecord,
        error: adminError
      } = await supabase
        .from("admins")
        .select(`
          id,
          full_name,
          email,
          role,
          phone,
          photo,
          is_active,
          is_verified,
          auth_user_id
        `)
        .eq(
          "id",
          session.admin_id
        )
        .maybeSingle();


      if (adminError) {

        console.error(
          "ADMIN SESSION PROFILE ERROR:",
          adminError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load administrator account."

        });

      }


      if (
        !adminRecord ||
        adminRecord.is_active === false
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Administrator account is inactive or unavailable."

        });

      }


      /* =================================
         REBUILD ADMIN SESSION IN MEMORY
      ================================= */

      admin = {

        id:
          adminRecord.id,

        name:
          adminRecord.full_name,

        email:
          adminRecord.email,

        role:
          adminRecord.role || "ADMIN",

        phone:
          adminRecord.phone,

        photo:
          adminRecord.photo,

        is_verified:
          adminRecord.is_verified,

        auth_user_id:
          adminRecord.auth_user_id

      };


      adminSessions.set(
        token,
        admin
      );

    } catch (error) {

      console.error(
        "ADMIN SESSION RESTORE ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to restore administrator session."

      });

    }

  }


  /* =====================================
     UPDATE LAST ACTIVITY
  ===================================== */

  try {

    await supabase
      .from("admin_sessions")
      .update({

        last_activity:
          new Date().toISOString()

      })
      .eq(
        "session_token",
        token
      )
      .eq(
        "is_active",
        true
      );

  } catch (error) {

    console.warn(
      "ADMIN SESSION ACTIVITY UPDATE ERROR:",
      error
    );

  }


  req.admin =
    admin;

  req.adminToken =
    token;

  next();

}

/* =========================================
   ADMIN PROFILE
========================================= */

app.get(
  "/api/admin/profile",
  authenticateAdmin,
  async (req, res) => {

    try {

      const admin =
        req.admin;

      return res.json({

        success: true,

        admin: {

          id:
            admin.id,

          full_name:
            admin.full_name ||
            admin.name ||
            "",

          email:
            admin.email ||
            "",

          role:
            admin.role ||
            "Administrator",

          phone:
            admin.phone ||
            "",

          photo:
            admin.photo ||
            "",

          status:
            admin.status ||
            "ACTIVE"

        }

      });

    } catch (error) {

      console.error(
        "Admin profile error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to load administrator profile."

      });

    }

  }
);


/* =========================================
   HOME
========================================= */

app.get("/", (req, res) => {

  res.json({

    success: true,

    message:
      "JAY C O B FINANCIAL SERVICES Backend is running",

    version:
      "3.0.0"

  });

});


/* =========================================
   HEALTH CHECK
========================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      status:
        "OK",

      message:
        "Server is healthy"

    });

  }
);


/* =========================================
   CREATE LOAN APPLICATION
========================================= */

app.post(
  "/api/loans/apply",

  authenticate,

  (req, res) => {

    const {
      loan_type,
      amount,
      duration_months
    } = req.body;

    if (
      !loan_type ||
      !amount ||
      !duration_months
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Loan type, amount and duration are required."

      });

    }

    const loanAmount =
      Number(amount);

    const duration =
      Number(duration_months);

    if (
      isNaN(loanAmount) ||
      loanAmount <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Please enter a valid loan amount."

      });

    }

    if (
      isNaN(duration) ||
      duration <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Please enter a valid loan duration."

      });

    }

    const application = {

      id:
        createId("LOAN"),

      customer_id:
        req.customer.id,

      customer_name:
        req.customer.full_name,

      customer_email:
        req.customer.email,

      loan_type,

      amount:
        loanAmount,

      duration_months:
        duration,

      interest_rate:
        0,

      status:
        "PENDING",

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),

      reviewed_at:
        null,

      reviewed_by:
        null

    };

    applications.push(
      application
    );

    addAuditLog(
      req.customer.email,
      "Created loan application " +
      application.id
    );

    res.status(201).json({

      success: true,

      message:
        "Loan application submitted successfully.",

      application

    });

  }
);


/* =========================================
   GET CUSTOMER APPLICATIONS
========================================= */

app.get(
  "/api/loans/my-applications",

  authenticate,

  (req, res) => {

    const customerApplications =
      applications.filter(

        application =>

          application.customer_id ===
          req.customer.id

      );

    res.json({

      success: true,

      applications:
        customerApplications

    });

  }
);


/* =========================================
   GET SINGLE CUSTOMER APPLICATION
========================================= */

app.get(
  "/api/loans/:id",

  authenticate,

  (req, res) => {

    const application =
      applications.find(

        application =>

          application.id ===
          req.params.id &&

          application.customer_id ===
          req.customer.id

      );

    if (!application) {

      return res.status(404).json({

        success: false,

        message:
          "Loan application not found."

      });

    }

    res.json({

      success: true,

      application

    });

  }
);


/* =========================================
   CUSTOMER PAYMENTS
========================================= */

app.get(
  "/api/payments/my-payments",

  authenticate,

  (req, res) => {

    const customerPayments =
      payments.filter(

        payment =>

          payment.customer_id ===
          req.customer.id

      );

    res.json({

      success: true,

      payments:
        customerPayments

    });

  }
);


/* =========================================
   SEND SUPPORT MESSAGE
========================================= */

app.post(
  "/api/support/send",

  authenticate,

  (req, res) => {

    const {
      subject,
      message
    } = req.body;

    if (!message) {

      return res.status(400).json({

        success: false,

        message:
          "Message is required."

      });

    }

    const supportMessage = {

      id:
        createId("MSG"),

      customer_id:
        req.customer.id,

      name:
        req.customer.full_name,

      email:
        req.customer.email,

      subject:
        subject ||
        "Customer Support",

      message,

      status:
        "NEW",

      created_at:
        new Date().toISOString()

    };

    supportMessages.push(
      supportMessage
    );

    addAuditLog(
      req.customer.email,
      "Sent support message"
    );

    res.status(201).json({

      success: true,

      message:
        "Support message sent successfully.",

      supportMessage

    });

  }
);


/* =========================================
   GET CUSTOMER SUPPORT MESSAGES
========================================= */

app.get(
  "/api/support/my-messages",

  authenticate,

  (req, res) => {

    const messages =
      supportMessages.filter(

        message =>

          message.customer_id ===
          req.customer.id

      );

    res.json({

      success: true,

      messages

    });

  }
);


/* =========================================
   ADMIN API
========================================= */


/* =========================================
   ADMIN LOGIN
   REAL SUPABASE ADMIN
========================================= */

app.post(
  "/api/admin/login",

  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body;

      if (
        !email ||
        !password
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Admin email and password are required."

        });

      }


      /* =====================================
         FIND ADMIN IN SUPABASE
      ===================================== */

      const {
        data: adminRecord,
        error: adminError
      } = await supabase
        .from("admins")
        .select(`
          id,
          full_name,
          email,
          role,
          phone,
          photo,
          is_active,
          is_verified,
          auth_user_id
        `)
        .ilike(
          "email",
          email.trim()
        )
        .maybeSingle();


      if (adminError) {

        console.error(
          "ADMIN LOOKUP ERROR:",
          adminError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify administrator account.",

          error:
            adminError.message

        });

      }


      if (!adminRecord) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid admin email or password."

        });

      }


      /* =====================================
         CHECK ADMIN ACCOUNT STATUS
      ===================================== */

      if (
        adminRecord.is_active === false
      ) {

        return res.status(403).json({

          success: false,

          message:
            "This administrator account is inactive."

        });

      }


      /* =====================================
         CHECK PASSWORD

         The current system continues using
         the Railway ADMIN_PASSWORD variable.
      ===================================== */

      if (
  password !==
  (recoveredAdminPassword || ADMIN_PASSWORD)
) {

        return res.status(401).json({

          success: false,

          message:
            "Invalid admin email or password."

        });

      }


      /* =====================================
         CREATE ADMIN SESSION TOKEN
      ===================================== */

      const token =
        createToken();


      /* =====================================
         STORE REAL SUPABASE ADMIN ID
      ===================================== */

      const admin = {

        id:
          adminRecord.id,

        name:
          adminRecord.full_name,

        email:
          adminRecord.email,

        role:
          adminRecord.role || "ADMIN",

        phone:
          adminRecord.phone,

        photo:
          adminRecord.photo,

        is_verified:
          adminRecord.is_verified,

        auth_user_id:
          adminRecord.auth_user_id

      };


      adminSessions.set(
        token,
        admin
      );


      /* =====================================
   SAVE ADMIN SESSION TO SUPABASE
===================================== */

const now =
  new Date();

const expiresAt =
  new Date(
    now.getTime() +
    (24 * 60 * 60 * 1000)
  );

const ipAddress =
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  "";

const userAgent =
  req.headers["user-agent"] ||
  "";

const deviceInfo =
  userAgent;


const {
  error: sessionError
} = await supabase
  .from("admin_sessions")
  .insert({

    admin_id:
      adminRecord.id,

    session_token:
      token,

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
      true

  });


if(sessionError){

  console.error(
    "ADMIN SESSION SAVE ERROR:",
    sessionError
  );

  adminSessions.delete(
    token
  );

  return res.status(500).json({

    success: false,

    message:
      "Administrator session could not be created.",

    error:
      sessionError.message

  });

}
      
      /* =====================================
         UPDATE LAST LOGIN
      ===================================== */

      await supabase
        .from("admins")
        .update({

          last_login:
            new Date().toISOString(),

          failed_attempts:
            0

        })
        .eq(
          "id",
          adminRecord.id
        );


      /* =====================================
         AUDIT LOG
      ===================================== */

      addAuditLog(
        adminRecord.email,
        "Administrator logged in"
      );


      /* =====================================
         RESPONSE
      ===================================== */

      res.json({

        success: true,

        message:
          "Administrator login successful.",

        token,

        admin

      });

    } catch (error) {

      console.error(
        "ADMIN LOGIN SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Administrator login could not be completed.",

        error:
          error.message

      });

    }

  }
);

/* =========================================
   ADMIN LOGOUT
========================================= */

app.post(
  "/api/admin/logout",

  authenticateAdmin,

  async (req, res) => {

    try {

      /* =====================================
         MARK SUPABASE SESSION AS LOGGED OUT
      ===================================== */

      const { error } =
        await supabase
          .from("admin_sessions")
          .update({

            is_active:
              false,

            logged_out_at:
              new Date().toISOString(),

            last_activity:
              new Date().toISOString()

          })
          .eq(
            "session_token",
            req.adminToken
          );


      if (error) {

        console.error(
          "ADMIN LOGOUT SESSION ERROR:",
          error
        );

      }


      /* =====================================
         REMOVE MEMORY SESSION
      ===================================== */

      adminSessions.delete(
        req.adminToken
      );


      /* =====================================
         AUDIT LOG
      ===================================== */

      addAuditLog(
        req.admin.email,
        "Administrator logged out"
      );


      res.json({

        success: true,

        message:
          "Administrator logged out successfully."

      });

    } catch (error) {

      console.error(
        "ADMIN LOGOUT ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Administrator logout could not be completed."

      });

    }

  }
);


/* =========================================
   GET ALL CUSTOMERS
   REAL SUPABASE DATA
========================================= */

app.get(
  "/api/admin/customers",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("customers")
        .select(`
          id,
          full_name,
          email,
          phone,
          created_at,
          balance,
          address,
          id_number,
          date_of_birth,
          occupation,
          account_number,
          employment_number,
          account_status,
          failed_attempts,
          locked_until,
          role,
          is_verified,
          updated_at,
          residential_address,
          next_of_kin,
          next_of_kin_home_address,
          next_of_kin_phone_number,
          auth_user_id
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {

        console.error(
          "ADMIN CUSTOMERS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load customers from Supabase.",

          error:
            error.message

        });

      }

      res.json({

        success: true,

        customers:
          data || []

      });

    } catch (error) {

      console.error(
        "ADMIN CUSTOMERS SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Customers could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   GET ALL LOAN APPLICATIONS
   REAL SUPABASE DATA
========================================= */

app.get(
  "/api/admin/applications",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
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
          interest_rate,
          reviewed_at,
          reviewed_by,
          rejection_reason,
          notes
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {

        console.error(
          "ADMIN LOAN APPLICATIONS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load loan applications from Supabase.",

          error:
            error.message

        });

      }

      res.json({

        success: true,

        applications:
          data || []

      });

    } catch (error) {

      console.error(
        "ADMIN LOAN APPLICATIONS SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Loan applications could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   GET SINGLE ADMIN APPLICATION
========================================= */

app.get(
  "/api/admin/applications/:id",

  authenticateAdmin,

  (req, res) => {

    const application =
      applications.find(

        application =>

          application.id ===
          req.params.id

      );

    if (!application) {

      return res.status(404).json({

        success: false,

        message:
          "Loan application not found."

      });

    }

    res.json({

      success: true,

      application

    });

  }
);


/* =========================================
   UPDATE LOAN APPLICATION STATUS
   REAL SUPABASE DATA
========================================= */

app.put(
  "/api/admin/applications/:id/status",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        status,
        rejection_reason,
        notes
      } = req.body;

      const allowedStatuses = [
        "PENDING",
        "UNDER REVIEW",
        "APPROVED",
        "REJECTED"
      ];

      if (!status) {

        return res.status(400).json({

          success: false,

          message:
            "Loan status is required."

        });

      }

      const normalizedStatus =
        String(status).trim().toUpperCase();

      if (
        !allowedStatuses.includes(
          normalizedStatus
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid loan status."

        });

      }

      if (
        normalizedStatus === "REJECTED" &&
        !rejection_reason
      ) {

        return res.status(400).json({

          success: false,

          message:
            "A rejection reason is required when rejecting an application."

        });

      }

      /* =====================================
         FIND APPLICATION
      ===================================== */

      const {
        data: existingApplication,
        error: findError
      } = await supabase
        .from("loan_applications")
        .select("*")
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (findError) {

        console.error(
          "FIND LOAN APPLICATION ERROR:",
          findError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to find the loan application.",

          error:
            findError.message

        });

      }

      if (!existingApplication) {

        return res.status(404).json({

          success: false,

          message:
            "Loan application not found."

        });

      }

      const oldStatus =
        existingApplication.status;


      /* =====================================
         UPDATE SUPABASE
      ===================================== */

      const updateData = {

        status:
          normalizedStatus,

        reviewed_at:
          new Date().toISOString(),

        reviewed_by:
  req.admin.id

      };

      if (
        normalizedStatus === "REJECTED"
      ) {

        updateData.rejection_reason =
          rejection_reason || null;

      } else {

        updateData.rejection_reason =
          null;

      }

      if (
        notes !== undefined
      ) {

        updateData.notes =
          notes;

      }

      const {
        data: updatedApplication,
        error: updateError
      } = await supabase
        .from("loan_applications")
        .update(updateData)
        .eq(
          "id",
          req.params.id
        )
        .select()
        .single();

      if (updateError) {

        console.error(
          "UPDATE LOAN APPLICATION ERROR:",
          updateError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to update loan application status.",

          error:
            updateError.message

        });

      }


      /* =====================================
         AUDIT LOG
      ===================================== */

      addAuditLog(
        req.admin.email,
        "Loan application " +
        req.params.id +
        " changed from " +
        oldStatus +
        " to " +
        normalizedStatus
      );


      /* =====================================
         RESPONSE
      ===================================== */

      res.json({

        success: true,

        message:
          "Loan application status updated successfully.",

        application:
          updatedApplication

      });

    } catch (error) {

      console.error(
        "ADMIN LOAN STATUS SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Loan application status could not be updated.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   ADMIN STATISTICS — SUPABASE
========================================= */

app.get(
  "/api/admin/statistics",
  authenticateAdmin,
  async (req, res) => {

    try {

      /*
       * Fetch all rows in batches so statistics
       * are not limited by Supabase's default
       * 1,000-row response limit.
       */
      const fetchAllRows = async (table, columns) => {

        const allRows = [];
        const pageSize = 1000;
        let from = 0;

        while (true) {

          const { data, error } = await supabase
            .from(table)
            .select(columns)
            .range(from, from + pageSize - 1);

          if (error) {
            throw new Error(
              `${table}: ${error.message}`
            );
          }

          if (!data || data.length === 0) {
            break;
          }

          allRows.push(...data);

          if (data.length < pageSize) {
            break;
          }

          from += pageSize;
        }

        return allRows;
      };


      /* =====================================
         LOAD STATISTICS DATA
      ===================================== */

      const [
        customersData,
        adminsData,
        applicationsData,
        loansData,
        schedulesData,
        repaymentsData,
        depositsData,
        withdrawalsData,
        transfersData,
        feesData,
        savingsData,
        interestData
      ] = await Promise.all([

        fetchAllRows(
          "customers",
          "id,created_at,balance,account_status,is_verified,failed_attempts,locked_until"
        ),

        fetchAllRows(
          "admins",
          "id,created_at,is_active,is_verified,failed_attempts,locked_until,last_login"
        ),

        fetchAllRows(
          "loan_applications",
          "id,customer_id,loan_type,amount,status,created_at,interest_rate"
        ),

        fetchAllRows(
          "loans",
          "id,customer_id,created_at,loan_amount,interest_rate,total_amount,amount_paid,remaining_balance,loan_status,application_date,approval_date,due_date"
        ),

        fetchAllRows(
          "loan schedules",
          "id,created_at,loan_id,customer_id,installment_number,due_date,amount_due,amount_paid,remaining_amount,status,paid_date"
        ),

        fetchAllRows(
          "repayments",
          "id,created_at,loan_id,customer_id,amount,status,payment_date"
        ),

        fetchAllRows(
          "deposits",
          "id,created_at,customer_id,amount,status"
        ),

        fetchAllRows(
          "withdrawals",
          "id,created_at,customer_id,amount,status"
        ),

        fetchAllRows(
          "transfers",
          "id,created_at,sender_customer_id,amount,status"
        ),

        fetchAllRows(
          "fees",
          "id,created_at,customer_id,loan_id,amount,status"
        ),

        fetchAllRows(
          "savings",
          "id,created_at,customer_id,amount,transaction_type,status,balance_after"
        ),

        fetchAllRows(
          "interest_records",
          "id,created_at,loan_id,customer_id,interest_amount,status"
        )

      ]);


      /* =====================================
         HELPER FUNCTIONS
      ===================================== */

      const money = (value) =>
        Number(value || 0);


      const normalize = (value) =>
        String(value || "")
          .trim()
          .toLowerCase();


      const isStatus = (row, ...statuses) => {

        const status = normalize(row.status);

        return statuses.some(
          item => status === normalize(item)
        );

      };


      const isLoanStatus = (row, ...statuses) => {

        const status = normalize(row.loan_status);

        return statuses.some(
          item => status === normalize(item)
        );

      };


      const startOfMonth = new Date();

      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);


      const isThisMonth = (date) => {

        if (!date) return false;

        const value = new Date(date);

        return value >= startOfMonth;
      };


      /* =====================================
         CUSTOMER STATISTICS
      ===================================== */

      const totalCustomerBalance =
        customersData.reduce(
          (sum, customer) =>
            sum + money(customer.balance),
          0
        );


      const activeCustomers =
        customersData.filter(
          customer =>
            normalize(customer.account_status) === "active"
        ).length;


      const verifiedCustomers =
        customersData.filter(
          customer => customer.is_verified === true
        ).length;


      const lockedCustomers =
        customersData.filter(
          customer =>
            customer.locked_until &&
            new Date(customer.locked_until) > new Date()
        ).length;


      /* =====================================
         ADMIN STATISTICS
      ===================================== */

      const activeAdmins =
        adminsData.filter(
          admin => admin.is_active === true
        ).length;


      const verifiedAdmins =
        adminsData.filter(
          admin => admin.is_verified === true
        ).length;


      const lockedAdmins =
        adminsData.filter(
          admin =>
            admin.locked_until &&
            new Date(admin.locked_until) > new Date()
        ).length;


      /* =====================================
         LOAN APPLICATION STATISTICS
      ===================================== */

      const pendingApplications =
        applicationsData.filter(
          application =>
            normalize(application.status) === "pending"
        ).length;


      const underReviewApplications =
        applicationsData.filter(
          application =>
            normalize(application.status) === "under review"
        ).length;


      const approvedApplications =
        applicationsData.filter(
          application =>
            normalize(application.status) === "approved"
        ).length;


      const rejectedApplications =
        applicationsData.filter(
          application =>
            normalize(application.status) === "rejected"
        ).length;


      const totalRequested =
        applicationsData.reduce(
          (sum, application) =>
            sum + money(application.amount),
          0
        );


      const approvedRequested =
        applicationsData
          .filter(
            application =>
              normalize(application.status) === "approved"
          )
          .reduce(
            (sum, application) =>
              sum + money(application.amount),
            0
          );


      const personalLoans =
        applicationsData.filter(
          application =>
            normalize(application.loan_type)
              .includes("personal")
        ).length;


      const businessLoans =
        applicationsData.filter(
          application =>
            normalize(application.loan_type)
              .includes("business")
        ).length;


      /* =====================================
         LOAN STATISTICS
      ===================================== */

      const totalLoanAmount =
        loansData.reduce(
          (sum, loan) =>
            sum + money(loan.loan_amount),
          0
        );


      const totalLoanValue =
        loansData.reduce(
          (sum, loan) =>
            sum + money(loan.total_amount),
          0
        );


      const totalAmountPaid =
        loansData.reduce(
          (sum, loan) =>
            sum + money(loan.amount_paid),
          0
        );


      const totalRemainingBalance =
        loansData.reduce(
          (sum, loan) =>
            sum + money(loan.remaining_balance),
          0
        );


      const activeLoans =
        loansData.filter(
          loan =>
            ["active", "approved", "running"]
              .includes(normalize(loan.loan_status))
        ).length;


      const completedLoans =
        loansData.filter(
          loan =>
            ["completed", "paid", "closed"]
              .includes(normalize(loan.loan_status))
        ).length;


      const overdueLoans =
        loansData.filter(loan => {

          if (!loan.due_date) return false;

          const dueDate =
            new Date(loan.due_date);

          return (
            dueDate < new Date() &&
            money(loan.remaining_balance) > 0
          );

        }).length;


      /* =====================================
         LOAN SCHEDULE STATISTICS
      ===================================== */

      const totalScheduledAmount =
        schedulesData.reduce(
          (sum, schedule) =>
            sum + money(schedule.amount_due),
          0
        );


      const totalScheduledPaid =
        schedulesData.reduce(
          (sum, schedule) =>
            sum + money(schedule.amount_paid),
          0
        );


      const totalScheduledRemaining =
        schedulesData.reduce(
          (sum, schedule) =>
            sum + money(schedule.remaining_amount),
          0
        );


      const overdueSchedules =
        schedulesData.filter(schedule => {

          if (!schedule.due_date) return false;

          return (
            new Date(schedule.due_date) < new Date() &&
            money(schedule.remaining_amount) > 0
          );

        }).length;


      /* =====================================
         REPAYMENT STATISTICS
      ===================================== */

      const totalRepayments =
        repaymentsData.length;


      const totalRepaymentAmount =
        repaymentsData.reduce(
          (sum, repayment) =>
            sum + money(repayment.amount),
          0
        );


      const completedRepayments =
        repaymentsData.filter(
          repayment =>
            isStatus(
              repayment,
              "completed",
              "paid",
              "approved",
              "success",
              "successful"
            )
        ).length;


      const completedRepaymentAmount =
        repaymentsData
          .filter(
            repayment =>
              isStatus(
                repayment,
                "completed",
                "paid",
                "approved",
                "success",
                "successful"
              )
          )
          .reduce(
            (sum, repayment) =>
              sum + money(repayment.amount),
            0
          );


      /* =====================================
         DEPOSIT STATISTICS
      ===================================== */

      const totalDeposits =
        depositsData.length;


      const totalDepositAmount =
        depositsData.reduce(
          (sum, deposit) =>
            sum + money(deposit.amount),
          0
        );


      const completedDeposits =
        depositsData.filter(
          deposit =>
            isStatus(
              deposit,
              "completed",
              "approved",
              "success",
              "successful"
            )
        );


      const completedDepositAmount =
        completedDeposits.reduce(
          (sum, deposit) =>
            sum + money(deposit.amount),
          0
        );


      /* =====================================
         WITHDRAWAL STATISTICS
      ===================================== */

      const totalWithdrawals =
        withdrawalsData.length;


      const totalWithdrawalAmount =
        withdrawalsData.reduce(
          (sum, withdrawal) =>
            sum + money(withdrawal.amount),
          0
        );


      const completedWithdrawals =
        withdrawalsData.filter(
          withdrawal =>
            isStatus(
              withdrawal,
              "completed",
              "approved",
              "success",
              "successful"
            )
        );


      const completedWithdrawalAmount =
        completedWithdrawals.reduce(
          (sum, withdrawal) =>
            sum + money(withdrawal.amount),
          0
        );


      /* =====================================
         TRANSFER STATISTICS
      ===================================== */

      const totalTransfers =
        transfersData.length;


      const totalTransferAmount =
        transfersData.reduce(
          (sum, transfer) =>
            sum + money(transfer.amount),
          0
        );


      const completedTransfers =
        transfersData.filter(
          transfer =>
            isStatus(
              transfer,
              "completed",
              "approved",
              "success",
              "successful"
            )
        );


      const completedTransferAmount =
        completedTransfers.reduce(
          (sum, transfer) =>
            sum + money(transfer.amount),
          0
        );


      /* =====================================
         FEES
      ===================================== */

      const totalFees =
        feesData.reduce(
          (sum, fee) =>
            sum + money(fee.amount),
          0
        );


      const paidFees =
        feesData
          .filter(
            fee =>
              isStatus(
                fee,
                "paid",
                "completed",
                "approved",
                "success",
                "successful"
              )
          )
          .reduce(
            (sum, fee) =>
              sum + money(fee.amount),
            0
          );


      /* =====================================
         SAVINGS
      ===================================== */

      const totalSavingsTransactions =
        savingsData.length;


      const totalSavingsAmount =
        savingsData.reduce(
          (sum, saving) =>
            sum + money(saving.amount),
          0
        );


      /* =====================================
         INTEREST
      ===================================== */

      const totalInterestRecords =
        interestData.length;


      const totalInterestAmount =
        interestData.reduce(
          (sum, record) =>
            sum + money(record.interest_amount),
          0
        );


      /* =====================================
         MONTHLY ACTIVITY
      ===================================== */

      const newCustomersThisMonth =
        customersData.filter(
          customer =>
            isThisMonth(customer.created_at)
        ).length;


      const applicationsThisMonth =
        applicationsData.filter(
          application =>
            isThisMonth(application.created_at)
        ).length;


      const loansThisMonth =
        loansData.filter(
          loan =>
            isThisMonth(loan.created_at)
        ).length;


      const repaymentsThisMonth =
        repaymentsData.filter(
          repayment =>
            isThisMonth(
              repayment.payment_date ||
              repayment.created_at
            )
        );


      const repaymentsThisMonthAmount =
        repaymentsThisMonth.reduce(
          (sum, repayment) =>
            sum + money(repayment.amount),
          0
        );


      /* =====================================
         RESPONSE
      ===================================== */

      res.json({

        success: true,

        statistics: {

          /* Customers */

          totalCustomers:
            customersData.length,

          activeCustomers,

          verifiedCustomers,

          lockedCustomers,

          totalCustomerBalance,

          newCustomersThisMonth,


          /* Admins */

          totalAdmins:
            adminsData.length,

          activeAdmins,

          verifiedAdmins,

          lockedAdmins,


          /* Applications */

          totalApplications:
            applicationsData.length,

          pendingApplications,

          underReviewApplications,

          approvedLoans:
            approvedApplications,

          rejectedApplications,

          totalRequested,

          approvedRequested,

          personalLoans,

          businessLoans,

          applicationsThisMonth,


          /* Loans */

          totalLoans:
            loansData.length,

          activeLoans,

          completedLoans,

          overdueLoans,

          totalLoanAmount,

          totalLoanValue,

          totalAmountPaid,

          totalRemainingBalance,

          loansThisMonth,


          /* Loan schedules */

          totalSchedules:
            schedulesData.length,

          totalScheduledAmount,

          totalScheduledPaid,

          totalScheduledRemaining,

          overdueSchedules,


          /* Repayments */

          totalRepayments,

          totalRepaymentAmount,

          completedRepayments,

          completedRepaymentAmount,

          repaymentsThisMonth:
            repaymentsThisMonth.length,

          repaymentsThisMonthAmount,


          /* Deposits */

          totalDeposits,

          totalDepositAmount,

          completedDepositAmount,


          /* Withdrawals */

          totalWithdrawals,

          totalWithdrawalAmount,

          completedWithdrawalAmount,


          /* Transfers */

          totalTransfers,

          totalTransferAmount,

          completedTransferAmount,


          /* Fees */

          totalFees,

          paidFees,


          /* Savings */

          totalSavingsTransactions,

          totalSavingsAmount,


          /* Interest */

          totalInterestRecords,

          totalInterestAmount

        }

      });

    } catch (error) {

      console.error(
        "Admin statistics error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to load admin statistics.",

        error:
          error.message

      });

    }

  }
);

/* =========================================
   CREATE FOLLOW-UP
========================================= */

app.post(
  "/api/admin/followups",

  authenticateAdmin,

  (req, res) => {

    const {
      customer,
      date,
      priority,
      notes
    } = req.body;

    if (
      !customer ||
      !date ||
      !notes
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Customer, date and notes are required."

      });

    }

    const followup = {

      id:
        createId("FOLLOWUP"),

      customer,

      date,

      priority:
        priority || "Normal",

      notes,

      created_by:
        req.admin.email,

      created_at:
        new Date().toISOString()

    };

    followups.unshift(
      followup
    );

    addAuditLog(
      req.admin.email,
      "Created follow-up"
    );

    res.status(201).json({

      success: true,

      message:
        "Follow-up created successfully.",

      followup

    });

  }
);


/* =========================================
   GET FOLLOW-UPS
========================================= */

app.get(
  "/api/admin/followups",

  authenticateAdmin,

  (req, res) => {

    res.json({

      success: true,

      followups

    });

  }
);


/* =========================================
   GET AUDIT LOGS
========================================= */

app.get(
  "/api/admin/audit-logs",

  authenticateAdmin,

  (req, res) => {

    res.json({

      success: true,

      auditLogs

    });

  }
);


/* =========================================
   GET SUPPORT MESSAGES
========================================= */

app.get(
  "/api/admin/support-messages",

  authenticateAdmin,

  (req, res) => {

    res.json({

      success: true,

      messages:
        supportMessages

    });

  }
);


/* =====================================================
   SECURITY
   REAL SUPABASE DATA
===================================================== */


/* =========================================
   SECURITY OVERVIEW
========================================= */

app.get(
  "/api/admin/security/overview",

  authenticateAdmin,

  async (req, res) => {

    try {

      const [
        loginAttemptsResult,
        securityEventsResult,
        activeSessionsResult
      ] = await Promise.all([

        supabase
          .from("login_attempts")
          .select("*", {
            count: "exact",
            head: true
          }),

        supabase
          .from("security_events")
          .select("*", {
            count: "exact",
            head: true
          }),

        supabase
          .from("customer_sessions")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq(
            "is_active",
            true
          )

      ]);

      if (
        loginAttemptsResult.error
      ) {

        console.error(
          "SECURITY LOGIN ATTEMPTS COUNT ERROR:",
          loginAttemptsResult.error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load login attempt statistics.",

          error:
            loginAttemptsResult.error.message

        });

      }

      if (
        securityEventsResult.error
      ) {

        console.error(
          "SECURITY EVENTS COUNT ERROR:",
          securityEventsResult.error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load security event statistics.",

          error:
            securityEventsResult.error.message

        });

      }

      if (
        activeSessionsResult.error
      ) {

        console.error(
          "ACTIVE CUSTOMER SESSIONS COUNT ERROR:",
          activeSessionsResult.error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load active customer session statistics.",

          error:
            activeSessionsResult.error.message

        });

      }

      res.json({

        success: true,

        statistics: {

          failedLogins:
            loginAttemptsResult.count || 0,

          securityEvents:
            securityEventsResult.count || 0,

          activeSessions:
            activeSessionsResult.count || 0

        },

        securityStatus: {

          loginProtection:
            "ACTIVE",

          sessionMonitoring:
            "ACTIVE",

          securityMonitoring:
            "ACTIVE"

        }

      });

    } catch (error) {

      console.error(
        "SECURITY OVERVIEW ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Security overview could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   LOGIN ACTIVITY
========================================= */

app.get(
  "/api/admin/security/login-attempts",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("login_attempts")
        .select("*")
        .limit(100);

      if (error) {

        console.error(
          "LOGIN ACTIVITY ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load login activity.",

          error:
            error.message

        });

      }

      res.json({

        success: true,

        loginAttempts:
          data || []

      });

    } catch (error) {

      console.error(
        "LOGIN ACTIVITY SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Login activity could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   SECURITY EVENTS
========================================= */

app.get(
  "/api/admin/security/events",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("security_events")
        .select("*")
        .limit(100);

      if (error) {

        console.error(
          "SECURITY EVENTS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load security events.",

          error:
            error.message

        });

      }

      res.json({

        success: true,

        securityEvents:
          data || []

      });

    } catch (error) {

      console.error(
        "SECURITY EVENTS SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Security events could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   ACTIVE CUSTOMER SESSIONS
========================================= */

app.get(
  "/api/admin/security/active-sessions",

  authenticateAdmin,

  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("customer_sessions")
        .select("*")
        .eq(
          "is_active",
          true
        )
        .limit(100);

      if (error) {

        console.error(
          "ACTIVE CUSTOMER SESSIONS ERROR:",
          error
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load active customer sessions.",

          error:
            error.message

        });

      }

      res.json({

        success: true,

        activeSessions:
          data || []

      });

    } catch (error) {

      console.error(
        "ACTIVE CUSTOMER SESSIONS SERVER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Active customer sessions could not be loaded.",

        error:
          error.message

      });

    }

  }
);


/* =========================================
   SECURITY - ALL DATA
   Useful for the Admin Dashboard
========================================= */

app.get(
  "/api/admin/security",

  authenticateAdmin,

  async (req, res) => {

    try {

      const [
        loginAttempts,
        securityEvents,
        activeSessions
      ] = await Promise.all([

        supabase
          .from("login_attempts")
          .select("*")
          .limit(100),

        supabase
          .from("security_events")
          .select("*")
          .limit(100),

        supabase
          .from("customer_sessions")
          .select("*")
          .eq(
            "is_active",
            true
          )
          .limit(100)

      ]);

      if (
        loginAttempts.error
      ) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to load login attempts.",

          error:
            loginAttempts.error.message

        });

      }

      if (
        securityEvents.error
      ) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to load security events.",

          error:
            securityEvents.error.message

        });

      }

      if (
        activeSessions.error
      ) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to load active sessions.",

          error:
            activeSessions.error.message

        });

      }

      res.json({

        success: true,

        statistics: {

          failedLogins:
            loginAttempts.data?.length || 0,

          securityEvents:
            securityEvents.data?.length || 0,

          activeSessions:
            activeSessions.data?.length || 0

        },

        loginAttempts:
          loginAttempts.data || [],

        securityEvents:
          securityEvents.data || [],

        activeSessions:
          activeSessions.data || [],

        securityStatus: {

          loginProtection:
            "ACTIVE",

          sessionMonitoring:
            "ACTIVE",

          securityMonitoring:
            "ACTIVE"

        }

      });

    } catch (error) {

      console.error(
        "SECURITY API ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Security system could not be loaded.",

        error:
          error.message

      });

    }

  }
);

/* =========================================
   ADMIN ACCOUNT RECOVERY
   REQUEST RECOVERY OTP
========================================= */

const recoveryRequests = new Map();


app.post(
  "/api/admin/recovery/request",

  async (req, res) => {

    try {

      const {
        email
      } = req.body;


      if (!email) {

        return res.status(400).json({

          success: false,

          message:
            "Administrator email is required."

        });

      }


      const normalizedEmail =
        email.trim().toLowerCase();


      /* =====================================
         FIND ADMIN IN SUPABASE
      ===================================== */

      const {
        data: adminRecord,
        error: adminError
      } = await supabase
        .from("admins")
        .select(`
          id,
          full_name,
          email,
          is_active,
          is_verified,
          auth_user_id
        `)
        .ilike(
          "email",
          normalizedEmail
        )
        .maybeSingle();


      if (adminError) {

        console.error(
          "RECOVERY ADMIN LOOKUP ERROR:",
          adminError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to process account recovery."

        });

      }


      /* =====================================
         DO NOT REVEAL WHETHER EMAIL EXISTS
      ===================================== */

      if (
        !adminRecord ||
        adminRecord.is_active === false
      ) {

        return res.json({

          success: true,

          message:
            "If the administrator account exists, a recovery OTP will be sent."

        });

      }


      /* =====================================
         GENERATE 6-DIGIT OTP
      ===================================== */

      const otp =
        crypto
          .randomInt(
            100000,
            1000000
          )
          .toString();


      const expiresAt =
        Date.now() +
        (10 * 60 * 1000);


      /* =====================================
         STORE OTP TEMPORARILY
      ===================================== */

      recoveryRequests.set(
        normalizedEmail,
        {

          otp,

          adminId:
            adminRecord.id,

          expiresAt,

          attempts:
            0

        }
      );


      /* =====================================
         SECURITY LOG
      ===================================== */

      addAuditLog(
        normalizedEmail,
        "Administrator account recovery requested"
      );


      /* =====================================
         TEMPORARY SERVER LOG
         
         REMOVE THIS WHEN REAL EMAIL
         DELIVERY IS CONNECTED.
      ===================================== */

      console.log(
        "ADMIN RECOVERY OTP:",
        {
          email:
            normalizedEmail,

          otp,

          expiresAt:
            new Date(expiresAt).toISOString()

        }
      );


      /* =====================================
         RESPONSE
      ===================================== */

      return res.json({

        success: true,

        message:
          "Recovery OTP generated successfully."

      });

    } catch (error) {

      console.error(
        "ADMIN RECOVERY REQUEST ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Account recovery could not be completed."

      });

    }

  }
);

/* =========================================
   ADMIN ACCOUNT RECOVERY
   VERIFY RECOVERY OTP
========================================= */

app.post(
  "/api/admin/recovery/verify",

  async (req, res) => {

    try {

      const {
        email,
        otp
      } = req.body;


      if (!email || !otp) {

        return res.status(400).json({

          success: false,

          message:
            "Administrator email and OTP are required."

        });

      }


      const normalizedEmail =
        email.trim().toLowerCase();


      const recovery =
        recoveryRequests.get(
          normalizedEmail
        );


      if (!recovery) {

        return res.status(400).json({

          success: false,

          message:
            "No active recovery request was found."

        });

      }


      /* =====================================
         CHECK OTP EXPIRATION
      ===================================== */

      if (
        Date.now() >
        recovery.expiresAt
      ) {

        recoveryRequests.delete(
          normalizedEmail
        );

        return res.status(400).json({

          success: false,

          message:
            "This recovery OTP has expired. Please request a new OTP."

        });

      }


      /* =====================================
         LIMIT OTP ATTEMPTS
      ===================================== */

      if (
        recovery.attempts >= 5
      ) {

        recoveryRequests.delete(
          normalizedEmail
        );

        return res.status(429).json({

          success: false,

          message:
            "Too many incorrect OTP attempts. Please request a new OTP."

        });

      }


      /* =====================================
         CHECK OTP
      ===================================== */

      if (
        String(otp).trim() !==
        recovery.otp
      ) {

        recovery.attempts += 1;

        return res.status(400).json({

          success: false,

          message:
            "Invalid recovery OTP."

        });

      }


      /* =====================================
         OTP VERIFIED
      ===================================== */

      recovery.verified = true;

      recovery.verifiedAt =
        Date.now();


      /* =====================================
         SECURITY LOG
      ===================================== */

      addAuditLog(
        normalizedEmail,
        "Administrator recovery OTP verified"
      );


      return res.json({

        success: true,

        message:
          "Recovery OTP verified successfully.",

        email:
          normalizedEmail

      });

    } catch (error) {

      console.error(
        "ADMIN RECOVERY OTP VERIFY ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "OTP verification could not be completed."

      });

    }

  }
);

/* =========================================
   ADMIN ACCOUNT RECOVERY
   RESET ADMIN PASSWORD
========================================= */

app.post(
  "/api/admin/recovery/reset-password",

  async (req, res) => {

    try {

      const {
        email,
        otp,
        newPassword
      } = req.body;


      /* =====================================
         VALIDATE INPUT
      ===================================== */

      if (
        !email ||
        !otp ||
        !newPassword
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Email, OTP and new password are required."

        });

      }


      const normalizedEmail =
        email.trim().toLowerCase();


      /* =====================================
         FIND RECOVERY REQUEST
      ===================================== */

      const recovery =
        recoveryRequests.get(
          normalizedEmail
        );


      if (!recovery) {

        return res.status(400).json({

          success: false,

          message:
            "No active recovery request was found. Please request a new OTP."

        });

      }


      /* =====================================
         CHECK OTP EXPIRATION
      ===================================== */

      if (
        Date.now() >
        recovery.expiresAt
      ) {

        recoveryRequests.delete(
          normalizedEmail
        );

        return res.status(400).json({

          success: false,

          message:
            "This recovery OTP has expired. Please request a new OTP."

        });

      }


      /* =====================================
         CHECK OTP
      ===================================== */

      if (
        String(otp).trim() !==
        recovery.otp
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid recovery OTP."

        });

      }


      /* =====================================
         REQUIRE STRONG PASSWORD
      ===================================== */

      if (
        String(newPassword).length < 8
      ) {

        return res.status(400).json({

          success: false,

          message:
            "New password must contain at least 8 characters."

        });

      }


      /* =====================================
         CHECK OTP WAS VERIFIED
      ===================================== */

      if (
        recovery.verified !== true
      ) {

        return res.status(403).json({

          success: false,

          message:
            "Please verify the recovery OTP before resetting the password."

        });

      }


      /* =====================================
         SET NEW PASSWORD
      ===================================== */

      recoveredAdminPassword =
        String(newPassword);


      /* =====================================
         INVALIDATE RECOVERY REQUEST
      ===================================== */

      recoveryRequests.delete(
        normalizedEmail
      );


      /* =====================================
         LOG SECURITY EVENT
      ===================================== */

      addAuditLog(
        normalizedEmail,
        "Administrator password reset successfully"
      );


      /* =====================================
         LOGOUT EXISTING ADMIN SESSIONS
      ===================================== */

      adminSessions.clear();


      /* =====================================
         RESPONSE
      ===================================== */

      return res.json({

        success: true,

        message:
          "Administrator password reset successfully. You can now log in with your new password."

      });

    } catch (error) {

      console.error(
        "ADMIN PASSWORD RESET ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Administrator password reset could not be completed."

      });

    }

  }
);

/* =========================================
   404 HANDLER
========================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      message:
        "Route not found."

    });

  }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
  PORT,

  "0.0.0.0",

  () => {

    console.log(
      `JAY C O B Backend running on port ${PORT}`
    );

  }
);

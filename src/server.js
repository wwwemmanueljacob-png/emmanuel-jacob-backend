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

function authenticateAdmin(
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

  const admin =
    adminSessions.get(token);

  if (!admin) {

    return res.status(401).json({

      success: false,

      message:
        "Admin session is invalid or expired."

    });

  }

  req.admin =
    admin;

  req.adminToken =
    token;

  next();

}


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
========================================= */

app.post(
  "/api/admin/login",

  (req, res) => {

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

    if (
      email.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid admin email or password."

      });

    }

    if (
      password !==
      ADMIN_PASSWORD
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid admin email or password."

      });

    }

    const token =
      createToken();

    const admin = {

      id:
        "ADMIN001",

      name:
        "Administrator",

      email:
        ADMIN_EMAIL,

      role:
        "ADMIN"

    };

    adminSessions.set(
      token,
      admin
    );

    addAuditLog(
      ADMIN_EMAIL,
      "Administrator logged in"
    );

    res.json({

      success: true,

      message:
        "Administrator login successful.",

      token,

      admin

    });

  }
);


/* =========================================
   ADMIN LOGOUT
========================================= */

app.post(
  "/api/admin/logout",

  authenticateAdmin,

  (req, res) => {

    adminSessions.delete(
      req.adminToken
    );

    addAuditLog(
      req.admin.email,
      "Administrator logged out"
    );

    res.json({

      success: true,

      message:
        "Administrator logged out successfully."

    });

  }
);


/* =========================================
   GET ALL CUSTOMERS
========================================= */

app.get(
  "/api/admin/customers",

  authenticateAdmin,

  (req, res) => {

    const safeCustomers =
      customers.map(

        customer => ({

          id:
            customer.id,

          full_name:
            customer.full_name,

          email:
            customer.email,

          phone:
            customer.phone,

          status:
            customer.status,

          created_at:
            customer.created_at

        })

      );

    res.json({

      success: true,

      customers:
        safeCustomers

    });

  }
);


/* =========================================
   GET ALL LOAN APPLICATIONS
========================================= */

app.get(
  "/api/admin/applications",

  authenticateAdmin,

  (req, res) => {

    res.json({

      success: true,

      applications

    });

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
   UPDATE LOAN STATUS
========================================= */

app.put(
  "/api/admin/applications/:id/status",

  authenticateAdmin,

  (req, res) => {

    const {
      status
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
      status.toUpperCase();

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

    const oldStatus =
      application.status;

    application.status =
      normalizedStatus;

    application.updated_at =
      new Date().toISOString();

    application.reviewed_at =
      new Date().toISOString();

    application.reviewed_by =
      req.admin.email;

    addAuditLog(
      req.admin.email,
      "Loan application " +
      application.id +
      " changed from " +
      oldStatus +
      " to " +
      normalizedStatus
    );

    res.json({

      success: true,

      message:
        "Loan application status updated successfully.",

      application

    });

  }
);


/* =========================================
   ADMIN STATISTICS
========================================= */

app.get(
  "/api/admin/statistics",

  authenticateAdmin,

  (req, res) => {

    const pending =
      applications.filter(

        app =>
          app.status ===
          "PENDING"

      ).length;

    const underReview =
      applications.filter(

        app =>
          app.status ===
          "UNDER REVIEW"

      ).length;

    const approved =
      applications.filter(

        app =>
          app.status ===
          "APPROVED"

      ).length;

    const rejected =
      applications.filter(

        app =>
          app.status ===
          "REJECTED"

      ).length;

    const totalRequested =
      applications.reduce(

        (total, application) =>

          total +
          Number(
            application.amount || 0
          ),

        0

      );

    const personalLoans =
      applications.filter(

        app =>

          app.loan_type
            ?.toLowerCase()
            .includes("personal")

      ).length;

    const businessLoans =
      applications.filter(

        app =>

          app.loan_type
            ?.toLowerCase()
            .includes("business")

      ).length;

    res.json({

      success: true,

      statistics: {

        totalCustomers:
          customers.length,

        totalApplications:
          applications.length,

        pendingApplications:
          pending,

        underReviewApplications:
          underReview,

        approvedLoans:
          approved,

        rejectedApplications:
          rejected,

        totalRequested,

        personalLoans,

        businessLoans

      }

    });

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

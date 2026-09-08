import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import testSupabaseRouter from "./testSupabase.js";
import customersRouter from "./routes/customers.js";
import customerAuthRouter from "./routes/customerAuth.js";
import loansRouter from "./routes/loans.js";
import transactionsRouter from "./routes/transactions.js";
import statementsRouter from "./routes/statements.js";
dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================
   MIDDLEWARE
========================================= */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());
app.use(testSupabaseRouter);
app.use(customersRouter);
app.use(customerAuthRouter);
app.use(loansRouter);
app.use(transactionsRouter);
app.use(statementsRouter);

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

   Later we will connect a permanent database.
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

    id: createId("AUDIT"),

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
   CUSTOMER AUTHENTICATION MIDDLEWARE
========================================= */

function authenticate(
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


  const customerId =
    sessions.get(token);


  if (!customerId) {

    return res.status(401).json({

      success: false,

      message:
        "Your login session is invalid or expired."

    });

  }


  const customer =
    customers.find(

      customer =>
        customer.id === customerId

    );


  if (!customer) {

    return res.status(401).json({

      success: false,

      message:
        "Customer account not found."

    });

  }


  req.customer =
    customer;


  req.token =
    token;


  next();

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
    authorization.split(" ");


  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
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
   CUSTOMER REGISTER
========================================= */

app.post(
  "/api/auth/register",
  (req, res) => {

    const {

      full_name,

      email,

      phone,

      password

    } = req.body;


    if (

      !full_name ||

      !email ||

      !password

    ) {

      return res.status(400).json({

        success: false,

        message:
          "Full name, email and password are required."

      });

    }


    const existingCustomer =
      customers.find(

        customer =>

          customer.email
            .toLowerCase() ===

          email
            .toLowerCase()

      );


    if (existingCustomer) {

      return res.status(400).json({

        success: false,

        message:
          "An account with this email already exists."

      });

    }


    const customer = {

      id:
        createId("CUST"),

      full_name,

      email:
        email.toLowerCase(),

      phone:
        phone || "",

      password,

      status:
        "Active",

      created_at:
        new Date().toISOString()

    };


    customers.push(
      customer
    );


    const token =
      createToken();


    sessions.set(

      token,

      customer.id

    );


    addAuditLog(

      customer.email,

      "Customer account created"

    );


    res.status(201).json({

      success: true,

      message:
        "Customer account created successfully.",

      token,

      customer: {

        id:
          customer.id,

        full_name:
          customer.full_name,

        email:
          customer.email,

        phone:
          customer.phone,

        status:
          customer.status

      }

    });

  }
);


/* =========================================
   CUSTOMER LOGIN
========================================= */

app.post(
  "/api/auth/login",
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
          "Email and password are required."

      });

    }


    const customer =
      customers.find(

        customer =>

          customer.email
            .toLowerCase() ===

          email
            .toLowerCase()

      );


    if (!customer) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid email or password."

      });

    }


    if (
      customer.password !==
      password
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid email or password."

      });

    }


    const token =
      createToken();


    sessions.set(

      token,

      customer.id

    );


    addAuditLog(

      customer.email,

      "Customer logged in"

    );


    res.json({

      success: true,

      message:
        "Login successful.",

      token,

      customer: {

        id:
          customer.id,

        full_name:
          customer.full_name,

        email:
          customer.email,

        phone:
          customer.phone,

        status:
          customer.status

      }

    });

  }
);


/* =========================================
   CUSTOMER PROFILE
========================================= */

app.get(
  "/api/auth/profile",

  authenticate,

  (req, res) => {

    res.json({

      success: true,

      customer: {

        id:
          req.customer.id,

        full_name:
          req.customer.full_name,

        email:
          req.customer.email,

        phone:
          req.customer.phone,

        status:
          req.customer.status

      }

    });

  }
);


/* =========================================
   CUSTOMER LOGOUT
========================================= */

app.post(
  "/api/auth/logout",

  authenticate,

  (req, res) => {

    sessions.delete(
      req.token
    );


    addAuditLog(

      req.customer.email,

      "Customer logged out"

    );


    res.json({

      success: true,

      message:
        "Logged out successfully."

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
          Number(application.amount || 0),

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

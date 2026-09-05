import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

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

/* =========================================
   TEMPORARY DATABASE
   NOTE:
   Data resets when Railway redeploys/restarts.
========================================= */

const customers = [
  {
    id: "CUST001",
    full_name: "Customer",
    email: "customer@example.com",
    phone: "+265000000000",
    password: "123456"
  }
];

const sessions = new Map();

const applications = [];

const payments = [];

const supportMessages = [];

/* =========================================
   HELPERS
========================================= */

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createId(prefix) {
  return prefix + "_" +
    Date.now() + "_" +
    Math.floor(Math.random() * 10000);
}

/* =========================================
   AUTHENTICATION MIDDLEWARE
========================================= */

function authenticate(req, res, next) {

  const authorization =
    req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required."
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
      message: "Invalid authentication format."
    });
  }

  const token = parts[1];

  const customerId =
    sessions.get(token);

  if (!customerId) {
    return res.status(401).json({
      success: false,
      message: "Your login session is invalid or expired."
    });
  }

  const customer =
    customers.find(
      customer => customer.id === customerId
    );

  if (!customer) {
    return res.status(401).json({
      success: false,
      message: "Customer account not found."
    });
  }

  req.customer = customer;
  req.token = token;

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
    version: "2.0.0"
  });

});

/* =========================================
   HEALTH CHECK
========================================= */

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    status: "OK",
    message: "Server is healthy"
  });

});

/* =========================================
   CUSTOMER REGISTER
========================================= */

app.post("/api/auth/register", (req, res) => {

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
        customer.email.toLowerCase() ===
        email.toLowerCase()
    );

  if (existingCustomer) {

    return res.status(400).json({
      success: false,
      message:
        "An account with this email already exists."
    });

  }

  const customer = {
    id: createId("CUST"),
    full_name,
    email: email.toLowerCase(),
    phone: phone || "",
    password
  };

  customers.push(customer);

  const token =
    createToken();

  sessions.set(
    token,
    customer.id
  );

  res.status(201).json({
    success: true,
    message:
      "Customer account created successfully.",
    token,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone
    }
  });

});

/* =========================================
   CUSTOMER LOGIN
========================================= */

app.post("/api/auth/login", (req, res) => {

  const {
    email,
    password
  } = req.body;

  if (!email || !password) {

    return res.status(400).json({
      success: false,
      message:
        "Email and password are required."
    });

  }

  const customer =
    customers.find(
      customer =>
        customer.email.toLowerCase() ===
        email.toLowerCase()
    );

  if (!customer) {

    return res.status(401).json({
      success: false,
      message:
        "Invalid email or password."
    });

  }

  if (
    customer.password !== password
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

  res.json({
    success: true,
    message:
      "Login successful.",
    token,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone
    }
  });

});

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
        id: req.customer.id,
        full_name:
          req.customer.full_name,
        email:
          req.customer.email,
        phone:
          req.customer.phone
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

    sessions.delete(req.token);

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

    const application = {
      id:
        createId("LOAN"),

      customer_id:
        req.customer.id,

      loan_type,

      amount:
        Number(amount),

      duration_months:
        Number(duration_months),

      interest_rate: 0,

      status:
        "pending",

      created_at:
        new Date().toISOString()
    };

    applications.push(application);

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
   GET SINGLE APPLICATION
========================================= */

app.get(
  "/api/loans/:id",
  authenticate,
  (req, res) => {

    const application =
      applications.find(
        application =>
          application.id === req.params.id &&
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
        "new",

      created_at:
        new Date().toISOString()

    };

    supportMessages.push(
      supportMessage
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
   404 HANDLER
========================================= */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message:
      "Route not found."
  });

});

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

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Home API route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Emmanuel Jacob Backend is running",
    version: "1.0.0"
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Server is healthy"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

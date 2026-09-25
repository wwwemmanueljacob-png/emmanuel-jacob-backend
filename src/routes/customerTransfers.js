import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";
import {
    notifyCustomer,
    notifyAdmin
} from "../lib/notifications.js";

import { authenticate } from "./customerAuth.js";

const router = express.Router();

export default router;

import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


// ==========================================
// GET ALL FOLLOW-UPS
// ==========================================

router.get(
    "/api/followups",
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("followups")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

            if (error) {
                console.error(
                    "FOLLOW-UPS FETCH ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            return res.json({
                success: true,
                followups: data || []
            });

        } catch (error) {

            console.error(
                "FOLLOW-UPS SERVER ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load follow-ups."
            });

        }

    }
);


// ==========================================
// GET SINGLE FOLLOW-UP
// ==========================================

router.get(
    "/api/followups/:id",
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("followups")
                .select("*")
                .eq("id", req.params.id)
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: "Follow-up not found."
                });
            }

            return res.json({
                success: true,
                followup: data
            });

        } catch (error) {

            console.error(
                "FOLLOW-UP FETCH ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load follow-up."
            });

        }

    }
);


// ==========================================
// CREATE FOLLOW-UP
// ==========================================

router.post(
    "/api/followups",
    async (req, res) => {

        try {

            const {
                customer_id,
                application_id,
                loan_id,
                followup_type,
                reason,
                notes,
                priority,
                status,
                assigned_to,
                due_date,
                next_followup_date
            } = req.body;

            if (!customer_id) {

                return res.status(400).json({
                    success: false,
                    message: "Customer ID is required."
                });

            }

            if (!reason) {

                return res.status(400).json({
                    success: false,
                    message: "Follow-up reason is required."
                });

            }

            const followup = {

                customer_id,

                application_id:
                    application_id || null,

                loan_id:
                    loan_id || null,

                followup_type:
                    followup_type || "Phone Call",

                reason:
                    reason.trim(),

                notes:
                    notes || null,

                priority:
                    priority || "NORMAL",

                status:
                    status || "PENDING",

                assigned_to:
                    assigned_to || null,

                due_date:
                    due_date || null,

                next_followup_date:
                    next_followup_date || null
            };


            const { data, error } = await supabase
                .from("followups")
                .insert([followup])
                .select("*")
                .single();


            if (error) {

                console.error(
                    "FOLLOW-UP CREATE ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });

            }


            return res.status(201).json({

                success: true,

                message:
                    "Follow-up created successfully.",

                followup: data

            });

        } catch (error) {

            console.error(
                "FOLLOW-UP CREATE SERVER ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to create follow-up."
            });

        }

    }
);


// ==========================================
// UPDATE FOLLOW-UP
// ==========================================

router.put(
    "/api/followups/:id",
    async (req, res) => {

        try {

            const {
                followup_type,
                reason,
                notes,
                priority,
                status,
                assigned_to,
                due_date,
                completed_date,
                next_followup_date
            } = req.body;


            const updates = {

                followup_type,
                reason,
                notes,
                priority,
                status,
                assigned_to,
                due_date,
                completed_date,
                next_followup_date,

                updated_at:
                    new Date().toISOString()

            };


            const { data, error } = await supabase
                .from("followups")
                .update(updates)
                .eq("id", req.params.id)
                .select("*")
                .single();


            if (error) {

                console.error(
                    "FOLLOW-UP UPDATE ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });

            }


            return res.json({

                success: true,

                message:
                    "Follow-up updated successfully.",

                followup: data

            });

        } catch (error) {

            console.error(
                "FOLLOW-UP UPDATE SERVER ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to update follow-up."
            });

        }

    }
);


// ==========================================
// DELETE FOLLOW-UP
// ==========================================

router.delete(
    "/api/followups/:id",
    async (req, res) => {

        try {

            const { error } = await supabase
                .from("followups")
                .delete()
                .eq("id", req.params.id);


            if (error) {

                console.error(
                    "FOLLOW-UP DELETE ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });

            }


            return res.json({

                success: true,

                message:
                    "Follow-up deleted successfully."

            });

        } catch (error) {

            console.error(
                "FOLLOW-UP DELETE SERVER ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to delete follow-up."
            });

        }

    }
);


export default router;

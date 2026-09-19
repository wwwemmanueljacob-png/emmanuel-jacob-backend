import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


// ========================================================
// GET ALL LOAN DOCUMENTS
// ========================================================

router.get(
    "/api/loan-documents",
    async (req, res) => {

        try {

const { data, error } = await supabase
    .from("loan_documents")
    .select(`
        *,
        customers (
            id,
            full_name,
            phone,
            email
        )
    `)
    .order("created_at", {
        ascending: false
    });


            if (error) {

                console.error(
                    "LOAN DOCUMENTS FETCH ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message: error.message

                });

            }


            return res.json({

                success: true,

                loanDocuments: data || []

            });

        } catch (error) {

            console.error(
                "LOAN DOCUMENTS SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to load loan documents."

            });

        }

    }
);


// ========================================================
// GET ONE LOAN DOCUMENT
// ========================================================

router.get(
    "/api/loan-documents/:id",
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("loan_documents")
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

                    message:
                        "Loan document not found."

                });

            }


            return res.json({

                success: true,

                loanDocument: data

            });

        } catch (error) {

            console.error(
                "LOAN DOCUMENT FETCH ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to load loan document."

            });

        }

    }
);


// ========================================================
// CREATE LOAN DOCUMENT
// ========================================================

router.post(
    "/api/loan-documents",
    async (req, res) => {

        try {

            const {

                loan_id,

                loan_application_id,

                customer_id,

                document_type,

                document_name,

                document_url,

                status,

                uploaded_at,

                verified_at,

                verified_by,

                rejection_reason,

                notes

            } = req.body;


            if (!customer_id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Customer ID is required."

                });

            }


            if (!document_type) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Document type is required."

                });

            }


            if (!document_name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Document name is required."

                });

            }


            const document = {

                loan_id:
                    loan_id || null,

                loan_application_id:
                    loan_application_id || null,

                customer_id,

                document_type,

                document_name,

                document_url:
                    document_url || null,

                status:
                    status || "PENDING",

                uploaded_at:
                    uploaded_at || new Date().toISOString(),

                verified_at:
                    verified_at || null,

                verified_by:
                    verified_by || null,

                rejection_reason:
                    rejection_reason || null,

                notes:
                    notes || null

            };


            const { data, error } = await supabase
                .from("loan_documents")
                .insert([document])
                .select("*")
                .single();


            if (error) {

                console.error(
                    "LOAN DOCUMENT CREATE ERROR:",
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
                    "Loan document created successfully.",

                loanDocument: data

            });

        } catch (error) {

            console.error(
                "LOAN DOCUMENT CREATE SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to create loan document."

            });

        }

    }
);


// ========================================================
// UPDATE LOAN DOCUMENT
// ========================================================

router.put(
    "/api/loan-documents/:id",
    async (req, res) => {

        try {

            const {

                document_type,

                document_name,

                document_url,

                status,

                verified_at,

                verified_by,

                rejection_reason,

                notes

            } = req.body;


            const updates = {

                document_type,

                document_name,

                document_url,

                status,

                verified_at,

                verified_by,

                rejection_reason,

                notes

            };


            const { data, error } = await supabase
                .from("loan_documents")
                .update(updates)
                .eq("id", req.params.id)
                .select("*")
                .single();


            if (error) {

                console.error(
                    "LOAN DOCUMENT UPDATE ERROR:",
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
                    "Loan document updated successfully.",

                loanDocument: data

            });

        } catch (error) {

            console.error(
                "LOAN DOCUMENT UPDATE SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to update loan document."

            });

        }

    }
);


// ========================================================
// DELETE LOAN DOCUMENT
// ========================================================

router.delete(
    "/api/loan-documents/:id",
    async (req, res) => {

        try {

            const { error } = await supabase
                .from("loan_documents")
                .delete()
                .eq("id", req.params.id);


            if (error) {

                console.error(
                    "LOAN DOCUMENT DELETE ERROR:",
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
                    "Loan document deleted successfully."

            });

        } catch (error) {

            console.error(
                "LOAN DOCUMENT DELETE SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete loan document."

            });

        }

    }
);


export default router;

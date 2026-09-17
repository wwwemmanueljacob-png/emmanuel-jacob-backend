import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


/* =========================================================
   GET ALL LOAN PRODUCTS
========================================================= */

router.get("/", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("loan_products")
                .select("*")
                .order("created_at", {
                    ascending: false
                });


        if (error) {

            console.error(
                "Loan products fetch error:",
                error
            );

            return res.status(500).json({
                error:
                    "Unable to load loan products.",
                details:
                    error.message
            });

        }


        res.json({
            loanProducts:
                data || []
        });


    } catch (error) {

        console.error(
            "Loan products route error:",
            error
        );

        res.status(500).json({
            error:
                "Server error while loading loan products."
        });

    }

});


/* =========================================================
   CREATE LOAN PRODUCT
========================================================= */

router.post("/", async (req, res) => {

    try {

        const {
            product_code,
            name,
            description,
            min_amount,
            max_amount,
            interest_rate,
            interest_type,
            min_duration_months,
            max_duration_months,
            processing_fee,
            processing_fee_type,
            eligibility,
            status
        } = req.body;


        if(!product_code || !name){

            return res.status(400).json({
                error:
                    "Product code and product name are required."
            });

        }


        if(
            Number(min_amount) >
            Number(max_amount)
        ){

            return res.status(400).json({
                error:
                    "Minimum amount cannot exceed maximum amount."
            });

        }


        if(
            Number(min_duration_months) >
            Number(max_duration_months)
        ){

            return res.status(400).json({
                error:
                    "Minimum duration cannot exceed maximum duration."
            });

        }


        const { data, error } =
            await supabase
                .from("loan_products")
                .insert({

    name:
        name.trim(),

    description:
        description || null,

    minimum_amount:
        Number(min_amount),

    maximum_amount:
        Number(max_amount),

    interest_rate:
        Number(interest_rate),

    minimum_duration_months:
        Number(min_duration_months),

    maximum_duration_months:
        Number(max_duration_months),

    processing_fee:
        Number(processing_fee || 0),

    late_payment_fee:
        0,

    is_active:
        status === "ACTIVE"

})

            
                .select()
                .single();


        if(error){

            console.error(
                "Loan product creation error:",
                error
            );

            return res.status(500).json({
                error:
                    "Unable to create loan product.",
                details:
                    error.message
            });

        }


        res.status(201).json({

            message:
                "Loan product created successfully.",

            loanProduct:
                data

        });


    }catch(error){

        console.error(
            "Loan product create route error:",
            error
        );

        res.status(500).json({
            error:
                "Server error while creating loan product."
        });

    }

});

/* =========================================================
   UPDATE LOAN PRODUCT
========================================================= */

router.put("/:id", async (req, res) => {

    try {

        const { id } =
            req.params;


        const {
            name,
            description,
            minimum_amount,
            maximum_amount,
            interest_rate,
            minimum_duration_months,
            maximum_duration_months,
            processing_fee,
            late_payment_fee,
            is_active
        } = req.body;


        if(!id || !name){

            return res.status(400).json({
                error:
                    "Product ID and product name are required."
            });

        }


        if(
            Number(minimum_amount) >
            Number(maximum_amount)
        ){

            return res.status(400).json({
                error:
                    "Minimum amount cannot exceed maximum amount."
            });

        }


        if(
            Number(minimum_duration_months) >
            Number(maximum_duration_months)
        ){

            return res.status(400).json({
                error:
                    "Minimum duration cannot exceed maximum duration."
            });

        }


        const { data, error } =
            await supabase
                .from("loan_products")
                .update({

                    name:
                        name.trim(),

                    description:
                        description || null,

                    minimum_amount:
                        Number(minimum_amount),

                    maximum_amount:
                        Number(maximum_amount),

                    interest_rate:
                        Number(interest_rate),

                    minimum_duration_months:
                        Number(
                            minimum_duration_months
                        ),

                    maximum_duration_months:
                        Number(
                            maximum_duration_months
                        ),

                    processing_fee:
                        Number(
                            processing_fee || 0
                        ),

                    late_payment_fee:
                        Number(
                            late_payment_fee || 0
                        ),

                    is_active:
                        Boolean(is_active),

                    updated_at:
                        new Date().toISOString()

                })
                .eq("id", id)
                .select()
                .single();


        if(error){

            console.error(
                "Loan product update error:",
                error
            );

            return res.status(500).json({
                error:
                    "Unable to update loan product.",
                details:
                    error.message
            });

        }


        res.json({

            message:
                "Loan product updated successfully.",

            loanProduct:
                data

        });


    }catch(error){

        console.error(
            "Loan product update route error:",
            error
        );

        res.status(500).json({
            error:
                "Server error while updating loan product."
        });

    }

});


export default router;

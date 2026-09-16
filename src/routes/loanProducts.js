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

                    product_code:
                        product_code.trim(),

                    name:
                        name.trim(),

                    description:
                        description || null,

                    min_amount:
                        Number(min_amount),

                    max_amount:
                        Number(max_amount),

                    interest_rate:
                        Number(interest_rate),

                    interest_type:
                        interest_type || "FLAT",

                    min_duration_months:
                        Number(min_duration_months),

                    max_duration_months:
                        Number(max_duration_months),

                    processing_fee:
                        Number(processing_fee || 0),

                    processing_fee_type:
                        processing_fee_type || "FIXED",

                    eligibility:
                        eligibility || null,

                    status:
                        status || "ACTIVE"

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


export default router;

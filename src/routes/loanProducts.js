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


export default router;

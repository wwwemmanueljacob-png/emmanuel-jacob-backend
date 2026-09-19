import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/* =========================================================
   REPORTS
========================================================= */

router.get("/api/admin/reports/:type", async (req, res) => {

    try {

        const { type } = req.params;

        let data = [];
        let error = null;

        switch (type) {

            case "loans":

                ({ data, error } = await supabase
                    .from("loans")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "repayments":

                ({ data, error } = await supabase
                    .from("repayments")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "deposits":

                ({ data, error } = await supabase
                    .from("deposits")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "withdrawals":

                ({ data, error } = await supabase
                    .from("withdrawals")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "customers":

                ({ data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "kyc":

                ({ data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "security":

                ({ data, error } = await supabase
                    .from("security_events")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    }));

                break;


            case "financial":

                const [
                    loansResult,
                    repaymentsResult,
                    depositsResult,
                    withdrawalsResult
                ] = await Promise.all([

                    supabase
                        .from("loans")
                        .select("*"),

                    supabase
                        .from("repayments")
                        .select("*"),

                    supabase
                        .from("deposits")
                        .select("*"),

                    supabase
                        .from("withdrawals")
                        .select("*")

                ]);

                data = {
                    loans: loansResult.data || [],
                    repayments: repaymentsResult.data || [],
                    deposits: depositsResult.data || [],
                    withdrawals: withdrawalsResult.data || []
                };

                error =
                    loansResult.error ||
                    repaymentsResult.error ||
                    depositsResult.error ||
                    withdrawalsResult.error;

                break;


            default:

                return res.status(400).json({
                    success: false,
                    message: "Unknown report type."
                });

        }


        if (error) {

            console.error(
                "REPORT ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }


        return res.json({
            success: true,
            reportType: type,
            data
        });

    } catch (error) {

        console.error(
            "REPORT ROUTE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

});


export default router;

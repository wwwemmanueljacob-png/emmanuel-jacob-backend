import express from "express";

import { supabase } from "../lib/supabase.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import {
    notifyCustomer,
    notifyAdmin
} from "../lib/notifications.js";

const router = express.Router();


/*
=========================================================
 APPROVE / REJECT CUSTOMER DEPOSIT REQUEST
=========================================================
*/

router.put(
    "/api/admin/deposit-requests/:id/status",
    authenticateAdmin,
    async (req, res) => {

        try {

            const requestId = req.params.id;

            const {
                status,
                rejection_reason
            } = req.body;


            /*
            -------------------------------------------------
            VALIDATE STATUS
            -------------------------------------------------
            */

            const normalizedStatus =
                String(status || "")
                    .trim()
                    .toUpperCase();


            if (
                normalizedStatus !== "APPROVED" &&
                normalizedStatus !== "REJECTED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Status must be APPROVED or REJECTED."

                });

            }


            /*
            -------------------------------------------------
            REJECTION REASON REQUIRED
            -------------------------------------------------
            */

            if (
                normalizedStatus === "REJECTED" &&
                !String(
                    rejection_reason || ""
                ).trim()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "A rejection reason is required."

                });

            }


            /*
            -------------------------------------------------
            GET DEPOSIT REQUEST
            -------------------------------------------------
            */

            const {
                data: depositRequest,
                error: depositRequestError
            } = await supabase

                .from("deposit_requests")

                .select("*")

                .eq("id", requestId)

                .single();


            if (depositRequestError) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Deposit request not found.",

                    error:
                        depositRequestError.message

                });

            }


            /*
            -------------------------------------------------
            ONLY PENDING REQUESTS CAN BE PROCESSED
            -------------------------------------------------
            */

            if (
                String(
                    depositRequest.status || ""
                ).toUpperCase() !== "PENDING"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This deposit request has already been processed."

                });

            }


            /*
            -------------------------------------------------
            TEMPORARY STATUS UPDATE
            -------------------------------------------------

            For this first backend stage we ONLY update
            the request status.

            Balance, deposits and transactions will be
            connected in the next stage.
            -------------------------------------------------
            */

            const updateData = {

                status: normalizedStatus,

                processed_by:
                    req.admin?.id || null,

                processed_at:
                    new Date().toISOString()

            };


            if (
                normalizedStatus === "REJECTED"
            ) {

                updateData.rejection_reason =
                    String(
                        rejection_reason
                    ).trim();

            }


            const {
                data: updatedRequest,
                error: updateError
            } = await supabase

                .from("deposit_requests")

                .update(updateData)

                .eq("id", requestId)

                .eq("status", "PENDING")

                .select()

                .single();


            if (updateError) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to update deposit request.",

                    error:
                        updateError.message

                });

            }


            return res.json({

                success: true,

                message:
                    `Deposit request ${normalizedStatus.toLowerCase()} successfully.`,

                depositRequest:
                    updatedRequest

            });


        } catch (error) {

            console.error(
                "ADMIN DEPOSIT REQUEST ACTION ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to process deposit request.",

                error:
                    error.message

            });

        }

    }
);


export default router;

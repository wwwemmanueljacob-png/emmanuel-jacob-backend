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
            PROCESS REJECTION
            -------------------------------------------------
            */

            if (normalizedStatus === "REJECTED") {

                const updateData = {

                    status:
                        "REJECTED",

                    processed_by:
                        req.admin?.id || null,

                    processed_at:
                        new Date().toISOString(),

                    rejection_reason:
                        String(
                            rejection_reason
                        ).trim()

                };


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
                            "Unable to reject deposit request.",

                        error:
                            updateError.message

                    });

                }


                return res.json({

                    success: true,

                    message:
                        "Deposit request rejected successfully.",

                    depositRequest:
                        updatedRequest

                });

            }


            /*
            -------------------------------------------------
            APPROVE DEPOSIT REQUEST
            -------------------------------------------------
            */

            const customerId =
                Number(
                    depositRequest.customer_id
                );

            const depositAmount =
                Number(
                    depositRequest.amount
                );


            if (
                !Number.isFinite(customerId) ||
                customerId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid customer ID."

                });

            }


            if (
                !Number.isFinite(depositAmount) ||
                depositAmount <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid deposit amount."

                });

            }


            /*
            -------------------------------------------------
            PROCESS APPROVAL ATOMICALLY
            -------------------------------------------------
            */

            const {
                data: approvalResult,
                error: approvalError
            } = await supabase.rpc(
                "approve_deposit_request",
                {
                    p_request_id:
                        Number(requestId),

                    p_admin_id:
                        String(
                            req.admin?.id || ""
                        )
                }
            );


            if (approvalError) {

                console.error(
                    "APPROVE DEPOSIT REQUEST RPC ERROR:",
                    approvalError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        approvalError.message ||
                        "Unable to approve deposit request.",

                    error:
                        approvalError.message

                });

            }


            if (
                !approvalResult ||
                approvalResult.success !== true
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        approvalResult?.message ||
                        "Unable to approve deposit request."

                });

            }


            /*
            -------------------------------------------------
            GET PROCESSED RESULTS
            -------------------------------------------------
            */

            const deposit =
                approvalResult.deposit;

            const transaction =
                approvalResult.transaction;

            const updatedRequest =
                approvalResult.deposit_request;

            const updatedCustomer =
                approvalResult.customer;


            /*
            -------------------------------------------------
            GET NEW CUSTOMER BALANCE
            -------------------------------------------------
            */

            const newBalance =
                Number(
                    updatedCustomer.balance || 0
                );


            /*
            -------------------------------------------------
            VERIFY FINANCIAL PROCESSING
            -------------------------------------------------
            */

            if (
                !deposit ||
                !transaction ||
                !updatedRequest ||
                !updatedCustomer
            ) {

                console.error(
                    "APPROVE DEPOSIT REQUEST INCOMPLETE RESULT:",
                    approvalResult
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Deposit approval returned an incomplete result."

                });

            }


            /*
            -------------------------------------------------
            CUSTOMER NOTIFICATION
            -------------------------------------------------
            */

            await notifyCustomer({

                customer_id:
                    customerId,

                title:
                    "Deposit Approved",

                message:
                    `Your deposit of MWK ${depositAmount.toFixed(2)} has been approved. Your new account balance is MWK ${newBalance.toFixed(2)}.`,

                type:
                    "DEPOSIT",

                priority:
                    "NORMAL",

                sms_required:
                    true,

                reference_type:
                    "deposit",

                reference_id:
                    Number(
                        deposit.id
                    ),

                action:
                    "VIEW_TRANSACTION"

            });


            /*
            -------------------------------------------------
            ADMIN NOTIFICATION
            -------------------------------------------------
            */

            await notifyAdmin({

                title:
                    "Deposit Approved",

                message:
                    `Customer #${customerId} deposit of MWK ${depositAmount.toFixed(2)} was approved. New balance: MWK ${newBalance.toFixed(2)}.`,

                type:
                    "DEPOSIT",

                priority:
                    "NORMAL",

                reference_type:
                    "deposit",

                reference_id:
                    Number(
                        deposit.id
                    ),

                action:
                    "VIEW_TRANSACTION"

            });


            /*
            -------------------------------------------------
            SUCCESS RESPONSE
            -------------------------------------------------
            */

            return res.json({

                success: true,

                message:
                    "Deposit request approved and processed successfully.",

                depositRequest:
                    updatedRequest,

                deposit:
                    deposit,

                transaction:
                    transaction,

                customer:
                    updatedCustomer

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

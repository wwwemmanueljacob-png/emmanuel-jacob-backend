import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";

import {
    notifyCustomer,
    notifyAdmin
} from "../lib/notifications.js";

import { authenticate } from "./customerAuth.js";

const router = express.Router();


/* =========================================================
   GENERATE TRANSFER REFERENCE
========================================================= */

function generateTransferReference() {

    const random =
        crypto
            .randomBytes(6)
            .toString("hex")
            .toUpperCase();

    return `JCOB-TRF-${Date.now()}-${random}`;
}


/* =========================================================
   CUSTOMER INTERNAL TRANSFER
========================================================= */

router.post(
    "/api/transfers",
    authenticate,
    async (req, res) => {

        try {

            /* -----------------------------------------
               AUTHENTICATED SENDER
            ----------------------------------------- */

            const senderCustomerId =
                req.customer.id;


            /* -----------------------------------------
               REQUEST DATA
            ----------------------------------------- */

            const {
                recipient_account_number,
                amount,
                description
            } = req.body;


            const transferAmount =
                Number(amount);


            /* -----------------------------------------
               VALIDATE RECIPIENT ACCOUNT NUMBER
            ----------------------------------------- */

            if (
                !recipient_account_number ||
                !String(
                    recipient_account_number
                ).trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Recipient account number is required."
                });

            }


            /* -----------------------------------------
               VALIDATE AMOUNT
            ----------------------------------------- */

            if (
                !Number.isFinite(
                    transferAmount
                ) ||
                transferAmount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid transfer amount."
                });

            }


            /* -----------------------------------------
               FIND SENDER
            ----------------------------------------- */

            const {
                data: sender,
                error: senderError
            } =
                await supabase
                    .from("customers")
                    .select(
                        "id, full_name, account_number, balance, account_status"
                    )
                    .eq(
                        "id",
                        senderCustomerId
                    )
                    .maybeSingle();


            if (senderError) {

                throw senderError;

            }


            if (!sender) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Sender account was not found."
                });

            }


            /* -----------------------------------------
               CHECK SENDER STATUS
            ----------------------------------------- */

            if (
                String(
                    sender.account_status || ""
                ).toLowerCase() !== "active"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Your customer account is not active."
                });

            }


            /* -----------------------------------------
               FIND RECIPIENT
            ----------------------------------------- */

            const {
                data: recipient,
                error: recipientError
            } =
                await supabase
                    .from("customers")
                    .select(
                        "id, full_name, account_number, balance, account_status"
                    )
                    .eq(
                        "account_number",
                        String(
                            recipient_account_number
                        ).trim()
                    )
                    .maybeSingle();


            if (recipientError) {

                throw recipientError;

            }


            if (!recipient) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Recipient account was not found."
                });

            }


            /* -----------------------------------------
               PREVENT SELF TRANSFER
            ----------------------------------------- */

            if (
                Number(recipient.id) ===
                Number(sender.id)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "You cannot transfer money to your own account."
                });

            }


            /* -----------------------------------------
               CHECK RECIPIENT STATUS
            ----------------------------------------- */

            if (
                String(
                    recipient.account_status || ""
                ).toLowerCase() !== "active"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Recipient account is not active."
                });

            }


            /* -----------------------------------------
               CHECK SENDER BALANCE
               This is an early check only.

               The RPC performs the authoritative
               balance check while locking the row.
            ----------------------------------------- */

            const senderBalance =
                Number(
                    sender.balance || 0
                );


            if (
                senderBalance <
                transferAmount
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Insufficient available balance."
                });

            }


            /* -----------------------------------------
               GENERATE UNIQUE REFERENCE
            ----------------------------------------- */

            const referenceNumber =
                generateTransferReference();


            /* -----------------------------------------
               PROCESS ATOMIC TRANSFER
            ----------------------------------------- */

            const {
                data: transferResult,
                error: transferError
            } =
                await supabase.rpc(
                    "process_customer_transfer",
                    {
                        p_sender_customer_id:
                            Number(
                                sender.id
                            ),

                        p_recipient_customer_id:
                            Number(
                                recipient.id
                            ),

                        p_amount:
                            transferAmount,

                        p_reference_number:
                            referenceNumber,

                        p_description:
                            description
                                ? String(
                                    description
                                ).trim()
                                : null
                    }
                );


            if (transferError) {

                console.error(
                    "CUSTOMER TRANSFER RPC ERROR:",
                    transferError
                );

                const errorMessage =
                    transferError.message ||
                    "Unable to process transfer.";

                return res.status(400).json({
                    success: false,
                    message:
                        errorMessage
                });

            }


            /* -----------------------------------------
               VERIFY RPC RESULT
            ----------------------------------------- */

            if (
                !transferResult ||
                transferResult.success !== true
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        transferResult?.message ||
                        "Transfer could not be completed."
                });

            }


            /* -----------------------------------------
               CUSTOMER NOTIFICATION — SENDER
            ----------------------------------------- */

            await notifyCustomer({

                customer_id:
                    sender.id,

                title:
                    "Transfer Sent",

                message:
                    `You successfully transferred MWK ${transferAmount.toFixed(2)} to ${recipient.full_name}. Reference: ${referenceNumber}.`,

                type:
                    "TRANSFER",

                priority:
                    "NORMAL",

                sms_required:
                    true,

                reference_type:
                    "TRANSFER",

                reference_id:
                    transferResult
                        .transfer
                        ?.id || null,

                action:
                    "TRANSFER_SENT"

            });


            /* -----------------------------------------
               CUSTOMER NOTIFICATION — RECIPIENT
            ----------------------------------------- */

            await notifyCustomer({

                customer_id:
                    recipient.id,

                title:
                    "Money Received",

                message:
                    `You received MWK ${transferAmount.toFixed(2)} from ${sender.full_name}. Reference: ${referenceNumber}.`,

                type:
                    "TRANSFER",

                priority:
                    "NORMAL",
                
              sms_required:
                    true,

                reference_type:
                    "TRANSFER",

                reference_id:
                    transferResult
                        .transfer
                        ?.id || null,

                action:
                    "TRANSFER_RECEIVED"

            });


            /* -----------------------------------------
               ADMIN NOTIFICATION
            ----------------------------------------- */

            await notifyAdmin({

                title:
                    "Customer Transfer Completed",

                message:
                    `${sender.full_name} transferred MWK ${transferAmount.toFixed(2)} to ${recipient.full_name}. Reference: ${referenceNumber}.`,

                type:
                    "TRANSFER",

                priority:
                    "NORMAL",

                reference_type:
                    "TRANSFER",

                reference_id:
                    transferResult
                        .transfer
                        ?.id || null,

                action:
                    "TRANSFER_COMPLETED"

            });


            /* -----------------------------------------
               SUCCESS RESPONSE
            ----------------------------------------- */

            return res.status(200).json({

                success: true,

                message:
                    "Transfer completed successfully.",

                transfer:
                    transferResult.transfer,

                sender:
                    transferResult.sender,

                recipient:
                    transferResult.recipient,

                sender_transaction:
                    transferResult.sender_transaction,

                recipient_transaction:
                    transferResult.recipient_transaction

            });


        } catch (error) {

            console.error(
                "CUSTOMER TRANSFER ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to process transfer.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   EXPORT ROUTER
========================================================= */

export default router;

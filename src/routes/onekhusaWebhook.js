import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";

const router = express.Router();


/* =========================================================
   ONEKHUSA WEBHOOK
========================================================= */

router.post(
    "/api/payments/onekhusa/webhook",
    express.raw({
        type: "application/json"
    }),
    async (req, res) => {

        try {

            const signature =
                req.headers[
                    "x-onekhusa-webhook-signature"
                ];

            const event =
                req.headers[
                    "x-onekhusa-webhook-event"
                ];

            const secret =
                process.env.ONEKHUSA_WEBHOOK_SECRET;


            /* =====================================================
               SECURITY CHECK
            ===================================================== */

            if (
                !signature ||
                !event ||
                !secret
            ) {

                console.error(
                    "ONEKHUSA WEBHOOK: Missing security information."
                );

                return res.status(401).json({

                    success: false,

                    message:
                        "Webhook authentication information is missing."

                });

            }


            /* =====================================================
               RAW BODY
            ===================================================== */

            const rawBody =
                Buffer.isBuffer(req.body)
                    ? req.body
                    : Buffer.from(
                        req.body || ""
                    );


            /* =====================================================
               HMAC SHA512 VERIFICATION
            ===================================================== */

            const expectedSignature =
                crypto
                    .createHmac(
                        "sha512",
                        secret
                    )
                    .update(rawBody)
                    .digest("hex");


            const receivedBuffer =
                Buffer.from(
                    String(signature).toLowerCase(),
                    "utf8"
                );

            const expectedBuffer =
                Buffer.from(
                    expectedSignature,
                    "utf8"
                );


            if (
                receivedBuffer.length !==
                expectedBuffer.length ||
                !crypto.timingSafeEqual(
                    receivedBuffer,
                    expectedBuffer
                )
            ) {

                console.error(
                    "ONEKHUSA WEBHOOK: Invalid signature."
                );

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid webhook signature."

                });

            }


            /* =====================================================
               PARSE PAYLOAD
            ===================================================== */

            let payload;

            try {

                payload =
                    JSON.parse(
                        rawBody.toString("utf8")
                    );

            } catch (error) {

                console.error(
                    "ONEKHUSA WEBHOOK: Invalid JSON payload."
                );

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid webhook payload."

                });

            }


            /* =====================================================
               ONLY PROCESS SUCCESSFUL PAYMENTS
            ===================================================== */

            if (
                event !== "payment.success" &&
                payload?.TransactionStatusCode !== "S"
            ) {

                console.log(
                    "ONEKHUSA WEBHOOK: Payment not successful."
                );

                return res.status(200).json({

                    success: true,

                    message:
                        "Webhook received but payment was not successful."

                });

            }


            /* =====================================================
               ONEKHUSA PAYMENT DETAILS
            ===================================================== */

            const amount =
                Number(
                    payload?.TransactionAmount
                );

            const referenceNumber =
                String(
                    payload?.TransactionReferenceNumber || ""
                ).trim();

            const sourceReferenceNumber =
                String(
                    payload?.SourceReferenceNumber || ""
                ).trim();

            const sourceAccountName =
                String(
                    payload?.SourceAccountName || ""
                ).trim();

            const sourceInstitution =
                String(
                    payload?.SourceInstitution || ""
                ).trim();

            const description =
                String(
                    payload?.TransactionDescription ||
                    "OneKhusa payment"
                ).trim();


            /* =====================================================
               VALIDATE PAYMENT DATA
            ===================================================== */

            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                !referenceNumber
            ) {

                console.error(
    "ONEKHUSA WEBHOOK PAYMENT DATA:",
    JSON.stringify({
        event,
        amount,
        referenceNumber,
        sourceReferenceNumber,
        transactionStatusCode:
            payload?.TransactionStatusCode,
        payloadKeys:
            Object.keys(payload || {})
    })
);

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid payment information."

                });

            }


            /* =====================================================
               DUPLICATE PAYMENT PROTECTION
            ===================================================== */

            const {
                data: existingTransaction,
                error: existingError
            } = await supabase

                .from("transactions")

                .select("id")

                .eq(
                    "reference_number",
                    referenceNumber
                )

                .maybeSingle();


            if (existingError) {

                console.error(
                    "ONEKHUSA WEBHOOK: Duplicate check failed:",
                    existingError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to verify existing transaction."

                });

            }


            if (existingTransaction) {

                console.log(
                    "ONEKHUSA WEBHOOK: Duplicate payment ignored:",
                    referenceNumber
                );

                return res.status(200).json({

                    success: true,

                    message:
                        "Payment already recorded."

                });

            }


            /* =====================================================
               SAVE TRANSACTION TO SUPABASE
            ===================================================== */

            const transactionDescription =
                `${description} | ${sourceInstitution} | ` +
                `Payer: ${sourceAccountName} | ` +
                `Source Ref: ${sourceReferenceNumber}`;


            const {
                data: transaction,
                error: transactionError
            } = await supabase

                .from("transactions")

                .insert({

                    type:
                        "ONEKHUSA_PAYMENT",

                    amount:
                        amount,

                    description:
                        transactionDescription,

                    status:
                        "SUCCESS",

                    reference_number:
                        referenceNumber

                })

                .select()

                .single();


            if (transactionError) {

                console.error(
                    "ONEKHUSA WEBHOOK: Transaction insert failed:",
                    transactionError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Payment received but could not be recorded."

                });

            }


            /* =====================================================
               SUCCESS LOG
            ===================================================== */

            console.log(
                "ONEKHUSA PAYMENT RECORDED SUCCESSFULLY:",
                {
                    transactionId:
                        transaction?.id,

                    amount,

                    referenceNumber,

                    sourceReferenceNumber,

                    sourceAccountName,

                    sourceInstitution
                }
            );


            /* =====================================================
               RESPONSE
            ===================================================== */

            return res.status(200).json({

                success: true,

                message:
                    "Payment received and recorded successfully.",

                transactionId:
                    transaction?.id

            });

        } catch (error) {

            console.error(
                "ONEKHUSA WEBHOOK ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Webhook processing failed."

            });

        }

    }
);


export default router;

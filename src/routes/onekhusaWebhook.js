import express from "express";
import crypto from "crypto";

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


            const rawBody =
                Buffer.isBuffer(req.body)
                    ? req.body
                    : Buffer.from(
                        req.body || ""
                    );


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


            console.log(
                "ONEKHUSA WEBHOOK RECEIVED:",
                {
                    event,
                    transactionReferenceNumber:
                        payload?.transactionReferenceNumber
                }
            );


            return res.status(200).json({

                success: true,

                message:
                    "Webhook received successfully."

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

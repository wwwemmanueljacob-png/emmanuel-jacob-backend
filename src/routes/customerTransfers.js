import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";
import {
    notifyCustomer,
    notifyAdmin
} from "../lib/notifications.js";

import { authenticate } from "./customerAuth.js";

const router = express.Router();

function generateTransferReference() {
    const random = crypto
        .randomBytes(6)
        .toString("hex")
        .toUpperCase();

    return `JCOB-TRF-${Date.now()}-${random}`;
}

router.post(
    "/api/transfers",
    authenticate,
    async (req, res) => {
        try {
            const senderCustomerId =
                req.customer.id;

            const {
                recipient_account_number,
                amount,
                description
            } = req.body;

            const transferAmount =
                Number(amount);

            if (
                !recipient_account_number ||
                !recipient_account_number.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Recipient account number is required."
                });
            }

            if (
                !Number.isFinite(transferAmount) ||
                transferAmount <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Enter a valid transfer amount."
                });
            }

            const { data: sender, error: senderError } =
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

            const { data: recipient, error: recipientError } =
                await supabase
                    .from("customers")
                    .select(
                        "id, full_name, account_number, balance, account_status"
                    )
                    .eq(
                        "account_number",
                        recipient_account_number.trim()
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

            return res.json({
                success: true,
                message:
                    "Transfer details validated successfully.",
                transfer: {
                    reference_number:
                        generateTransferReference(),
                    sender: {
                        id: sender.id,
                        full_name:
                            sender.full_name,
                        account_number:
                            sender.account_number,
                        balance:
                            Number(sender.balance || 0)
                    },
                    recipient: {
                        id: recipient.id,
                        full_name:
                            recipient.full_name,
                        account_number:
                            recipient.account_number
                    },
                    amount:
                        transferAmount,
                    description:
                        description || null
                }
            });

        } catch (error) {
            console.error(
                "CUSTOMER TRANSFER VALIDATION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to validate transfer.",
                error:
                    error.message
            });
        }
    }
);

export default router;

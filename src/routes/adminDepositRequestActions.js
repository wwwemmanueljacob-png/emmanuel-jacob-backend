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
PROCESS DEPOSIT REQUEST
-------------------------------------------------
*/

if (normalizedStatus === "REJECTED") {

    const updateData = {

        status: "REJECTED",

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
GET CUSTOMER
-------------------------------------------------
*/

const {
    data: customer,
    error: customerError
} = await supabase

    .from("customers")

    .select(
        "id, balance, account_status"
    )

    .eq("id", customerId)

    .single();


if (
    customerError ||
    !customer
) {

    return res.status(404).json({

        success: false,

        message:
            "Customer not found."

    });

}


/*
-------------------------------------------------
CALCULATE NEW BALANCE
-------------------------------------------------
*/

const currentBalance =
    Number(
        customer.balance || 0
    );

const newBalance =
    currentBalance +
    depositAmount;


/*
-------------------------------------------------
CREATE DEPOSIT
-------------------------------------------------
*/

const {
    data: deposit,
    error: depositError
} = await supabase

    .from("deposits")

    .insert({

        customer_id:
            customerId,

        account_id:
            null,

        amount:
            depositAmount,

        payment_method:
            depositRequest.payment_method,

        reference_number:
            depositRequest.reference_number,

        status:
            "COMPLETED",

        description:
            depositRequest.description ||
            "Customer deposit request",

        processed_by:
            req.admin?.id || null,

        processed_at:
            new Date().toISOString()

    })

    .select()

    .single();


if (depositError) {

    console.error(
        "APPROVED DEPOSIT CREATE ERROR:",
        depositError
    );

    return res.status(500).json({

        success: false,

        message:
            "Deposit request approved, but deposit could not be recorded.",

        error:
            depositError.message

    });

}


/*
-------------------------------------------------
UPDATE CUSTOMER BALANCE
-------------------------------------------------
*/

const {
    data: updatedCustomer,
    error: balanceError
} = await supabase

    .from("customers")

    .update({

        balance:
            newBalance,

        updated_at:
            new Date().toISOString()

    })

    .eq("id", customerId)

    .select(
        "id, balance"
    )

    .single();


if (balanceError) {

    console.error(
        "APPROVED DEPOSIT BALANCE ERROR:",
        balanceError
    );

    return res.status(500).json({

        success: false,

        message:
            "Deposit was recorded, but customer balance could not be updated.",

        error:
            balanceError.message

    });

}


/*
-------------------------------------------------
CREATE DEPOSIT TRANSACTION
-------------------------------------------------
*/

const {
    data: transaction,
    error: transactionError
} = await supabase

    .from("transactions")

    .insert({

        customer_id:
            customerId,

        type:
            "deposit",

        amount:
            depositAmount,

        description:
            `Deposit via ${depositRequest.payment_method}`,

        status:
            "completed",

        balance_before:
            currentBalance,

        balance_after:
            newBalance,

        reference_number:
            depositRequest.reference_number,

        performed_by:
            req.admin?.id || null

    })

    .select()

    .single();


if (transactionError) {

    console.error(
        "APPROVED DEPOSIT TRANSACTION ERROR:",
        transactionError
    );

    return res.status(500).json({

        success: false,

        message:
            "Deposit and balance were processed, but transaction recording failed.",

        error:
            transactionError.message

    });

}


/*
-------------------------------------------------
MARK REQUEST APPROVED
-------------------------------------------------
*/

const {
    data: updatedRequest,
    error: updateError
} = await supabase

    .from("deposit_requests")

    .update({

        status:
            "APPROVED",

        processed_by:
            req.admin?.id || null,

        processed_at:
            new Date().toISOString()

    })

    .eq("id", requestId)

    .eq("status", "PENDING")

    .select()

    .single();


if (updateError) {

    return res.status(500).json({

        success: false,

        message:
            "Deposit was processed, but the request status could not be updated.",

        error:
            updateError.message

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

    reference_type:
        "deposit",

    reference_id:
        Number(deposit.id),

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
        Number(deposit.id),

    action:
        "VIEW_TRANSACTION"

});


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

import express from "express";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "./customerAuth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { createNotification } from "../lib/notifications.js";

const router = express.Router();


/* =========================================================
   GET ALL NOTIFICATIONS
   Admin notification center
========================================================= */

router.get("/api/notifications", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("notifications")
                .select("*")
                .order("created_at", {
                    ascending: false
                });


        if(error){

            console.error(
                "NOTIFICATIONS GET ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }


        return res.json({

            success: true,

            notifications:
                data || []

        });

    }catch(error){

        console.error(
            "NOTIFICATIONS ROUTE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


/* =========================================================
   GET CUSTOMER NOTIFICATIONS
   SECURED BY CUSTOMER SESSION
========================================================= */

router.get(
    "/api/notifications/customer/:customerId",
    authenticate,
    async (req, res) => {

        try {

            /*
            -------------------------------------------------
            USE THE AUTHENTICATED CUSTOMER ID
            -------------------------------------------------
            */

            const authenticatedCustomerId =
                req.customerId;


            /*
            -------------------------------------------------
            OPTIONAL URL CUSTOMER ID CHECK
            -------------------------------------------------
            */

            const requestedCustomerId =
                Number(
                    req.params.customerId
                );

            const actualCustomerId =
                Number(
                    authenticatedCustomerId
                );


            /*
            -------------------------------------------------
            PREVENT ACCESS TO ANOTHER CUSTOMER'S
            NOTIFICATIONS
            -------------------------------------------------
            */

            if (
                !Number.isInteger(
                    requestedCustomerId
                ) ||
                requestedCustomerId !==
                    actualCustomerId
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not authorized to view these notifications."

                });

            }


            /*
            -------------------------------------------------
            GET ONLY AUTHENTICATED CUSTOMER NOTIFICATIONS
            -------------------------------------------------
            */

            const {
                data,
                error
            } = await supabase
                .from("notifications")
                .select("*")
                .eq(
                    "customer_id",
                    actualCustomerId
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (error) {

                console.error(
                    "CUSTOMER NOTIFICATIONS ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }


            /*
            -------------------------------------------------
            SUCCESS
            -------------------------------------------------
            */

            return res.json({

                success: true,

                notifications:
                    data || []

            });


        } catch (error) {

            console.error(
                "CUSTOMER NOTIFICATIONS ROUTE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   GET ADMIN NOTIFICATIONS
========================================================= */

router.get(
    "/api/notifications/admin/:adminId",
    authenticateAdmin,
    async (req, res) => {

        try {

            const authenticatedAdminId =
    Number(req.admin.id);

const requestedAdminId =
    Number(req.params.adminId);

if (
    !Number.isInteger(requestedAdminId) ||
    requestedAdminId !== authenticatedAdminId
) {
    return res.status(403).json({
        success: false,
        message:
            "You are not authorized to view these notifications."
    });
}


            const { data, error } =
                await supabase
                    .from("notifications")
                    .select("*")
                    .eq("admin_id", authenticatedAdminId)
                    .order("created_at", {
                        ascending: false
                    });


            if(error){

                console.error(
                    "ADMIN NOTIFICATIONS ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }


            return res.json({

                success: true,

                notifications:
                    data || []

            });

        }catch(error){

            console.error(
                "ADMIN NOTIFICATIONS ROUTE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   CREATE NOTIFICATION
========================================================= */

router.post(
    "/api/notifications",
    authenticateAdmin,
    async (req, res) => {

    try {

        const {

            customer_id,

            admin_id,

            title,

            message,

            type,

            is_read,

            priority,

            sms_required,

            sms_status,

            sms_sent_at,

            sms_error,

            reference_type,

            reference_id,

            action,

            created_by,

            expires_at

        } = req.body;


        if(!title){

            return res.status(400).json({

                success: false,

                message:
                    "Notification title is required."

            });

        }


        if(!message){

            return res.status(400).json({

                success: false,

                message:
                    "Notification message is required."

            });

        }


        const result =
    await createNotification({

        customer_id,

        admin_id,

        title,

        message,

        type: type || "GENERAL",

        is_read: is_read ?? false,

        priority: priority || "NORMAL",

        sms_required: sms_required ?? false,

        sms_status:

            sms_status ||

            (
                sms_required
                ? "PENDING"
                : "NOT_REQUIRED"
            ),

        sms_sent_at,

        sms_error,

        reference_type,

        reference_id,

        action,

        created_by,

        expires_at

    });


        if(!result.success){

    return res.status(500).json({
        success:false,
        message:
            result.error ||
            "Failed to create notification."
    });

        }


        return res.status(201).json({

            success: true,

            notification:
    result.notification

        });

    }catch(error){

        console.error(
            "NOTIFICATION CREATE ROUTE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


/* =========================================================
   MARK NOTIFICATION AS READ
========================================================= */

router.put(
    "/api/notifications/:id/read",
    authenticate,
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const authenticatedCustomerId =
    Number(req.customerId);

const { data: notification, error: findError } =
    await supabase
        .from("notifications")
        .select("*")
        .eq("id", id)
        .single();

if (findError || !notification) {

    return res.status(404).json({

        success: false,

        message:
            "Notification not found."

    });

}

if (
    Number(notification.customer_id) !==
    authenticatedCustomerId
) {

    return res.status(403).json({

        success: false,

        message:
            "You are not authorized to update this notification."

    });

}

const { data, error } =
    await supabase
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("id", id)
        .select()
        .single();


            if(error){

                return res.status(404).json({

                    success: false,

                    message:
                        error.message

                });

            }


            return res.json({

                success: true,

                notification:
                    data

            });

        }catch(error){

            console.error(
                "MARK NOTIFICATION READ ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   UPDATE NOTIFICATION
========================================================= */

router.put(
    "/api/notifications/:id",
    authenticateAdmin,
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const allowedFields = [

                "customer_id",

                "admin_id",

                "title",

                "message",

                "type",

                "is_read",

                "priority",

                "sms_required",

                "sms_status",

                "sms_sent_at",

                "sms_error",

                "reference_type",

                "reference_id",

                "action",

                "created_by",

                "expires_at"

            ];


            const updates = {};


            for(
                const field
                of allowedFields
            ){

                if(
                    req.body[field]
                    !== undefined
                ){

                    updates[field] =
                        req.body[field];

                }

            }


            if(
                Object.keys(updates)
                    .length === 0
            ){

                return res.status(400).json({

                    success: false,

                    message:
                        "No notification changes supplied."

                });

            }


            const { data, error } =
                await supabase
                    .from("notifications")
                    .update(updates)
                    .eq("id", id)
                    .select()
                    .single();


            if(error){

                console.error(
                    "NOTIFICATION UPDATE ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }


            return res.json({

                success: true,

                notification:
                    data

            });

        }catch(error){

            console.error(
                "NOTIFICATION UPDATE ROUTE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   DELETE NOTIFICATION
========================================================= */

router.delete(
    "/api/notifications/:id",
    authenticateAdmin,
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const { error } =
                await supabase
                    .from("notifications")
                    .delete()
                    .eq("id", id);


            if(error){

                console.error(
                    "NOTIFICATION DELETE ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        error.message

                });

            }


            return res.json({

                success: true,

                message:
                    "Notification deleted successfully."

            });

        }catch(error){

            console.error(
                "NOTIFICATION DELETE ROUTE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


export default router;

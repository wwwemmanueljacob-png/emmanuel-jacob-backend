import { supabase } from "./supabase.js";
import { createNotification } from "./lib/Notifications.js";


/* =========================================================
   CENTRAL NOTIFICATION ENGINE

   This function creates one notification record.

   It does NOT send SMS yet.
   SMS will be connected later.
========================================================= */

export async function createNotification({

    customer_id = null,

    admin_id = null,

    title,

    message,

    type = "GENERAL",

    is_read = false,

    priority = "NORMAL",

    sms_required = false,

    sms_status = null,

    sms_sent_at = null,

    sms_error = null,

    reference_type = null,

    reference_id = null,

    action = null,

    created_by = null,

    expires_at = null

} = {}){


    try {


        /* =================================================
           VALIDATION
        ================================================= */

        if(!title){

            throw new Error(
                "Notification title is required."
            );

        }


        if(!message){

            throw new Error(
                "Notification message is required."
            );

        }


        /* =================================================
           DETERMINE SMS STATUS
        ================================================= */

        const finalSmsStatus =
            sms_status ||
            (
                sms_required
                ? "PENDING"
                : "NOT_REQUIRED"
            );


        /* =================================================
           BUILD NOTIFICATION
        ================================================= */

        const notification = {

            customer_id,

            admin_id,

            title,

            message,

            type,

            is_read,

            priority,

            sms_required,

            sms_status:
                finalSmsStatus,

            sms_sent_at,

            sms_error,

            reference_type,

            reference_id,

            action,

            created_by,

            expires_at

        };


        /* =================================================
           SAVE TO SUPABASE
        ================================================= */

        const { data, error } =
            await supabase
                .from("notifications")
                .insert(notification)
                .select()
                .single();


        if(error){

            console.error(
                "CREATE NOTIFICATION ERROR:",
                error
            );

            throw error;

        }


        console.log(
            "NOTIFICATION CREATED:",
            data.id
        );


        return {

            success: true,

            notification: data

        };


    }catch(error){


        console.error(
            "NOTIFICATION ENGINE ERROR:",
            error
        );


        return {

            success: false,

            error:
                error.message ||
                "Failed to create notification."

        };

    }

}


/* =========================================================
   CUSTOMER NOTIFICATION
========================================================= */

export async function notifyCustomer({

    customer_id,

    title,

    message,

    type = "GENERAL",

    priority = "NORMAL",

    sms_required = false,

    reference_type = null,

    reference_id = null,

    action = null,

    created_by = null,

    expires_at = null

} = {}){


    return createNotification({

        customer_id,

        title,

        message,

        type,

        priority,

        sms_required,

        reference_type,

        reference_id,

        action,

        created_by,

        expires_at

    });

}


/* =========================================================
   ADMIN NOTIFICATION
========================================================= */

export async function notifyAdmin({

    admin_id,

    title,

    message,

    type = "ADMIN_ACTIVITY",

    priority = "NORMAL",

    reference_type = null,

    reference_id = null,

    action = null,

    created_by = null,

    expires_at = null

} = {}){


    return createNotification({

        admin_id,

        title,

        message,

        type,

        priority,

        sms_required: false,

        reference_type,

        reference_id,

        action,

        created_by,

        expires_at

    });

}


/* =========================================================
   SYSTEM NOTIFICATION
========================================================= */

export async function notifySystem({

    title,

    message,

    type = "SYSTEM",

    priority = "NORMAL",

    sms_required = false,

    action = null,

    created_by = null,

    expires_at = null

} = {}){


    return createNotification({

        title,

        message,

        type,

        priority,

        sms_required,

        action,

        created_by,

        expires_at

    });

          }

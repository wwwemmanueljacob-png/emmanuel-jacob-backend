/* =====================================================
   JAY C O B FINANCIAL SERVICES
   SMS SERVICE FOUNDATION
===================================================== */

import { supabase } from "../lib/supabase.js";


/* =====================================================
   SMS CONFIGURATION
===================================================== */

const SMS_PROVIDER =
    process.env.SMS_PROVIDER || "TUMASEND";

const SMS_ENABLED =
    String(
        process.env.SMS_ENABLED || "false"
    ).toLowerCase() === "true";


/* =====================================================
   NORMALIZE PHONE NUMBER
===================================================== */

function normalizePhoneNumber(phone) {

    if (!phone) {
        return null;
    }

    let value =
        String(phone).trim();

    /* Malawi local format:
       0999123456
       0888123456
    */

    if (
        value.startsWith("0") &&
        value.length >= 10
    ) {

        value =
            "+265" +
            value.substring(1);

    }

    /* Already international */

    if (
        value.startsWith("265") &&
        !value.startsWith("+")
    ) {

        value =
            "+" + value;

    }

    return value;
}


/* =====================================================
   SEND SMS
===================================================== */

export async function sendSMS({

    phone,
    message

} = {}) {

    try {

        if (!phone) {

            throw new Error(
                "SMS recipient phone number is required."
            );

        }

        if (!message) {

            throw new Error(
                "SMS message is required."
            );

        }


        const normalizedPhone =
            normalizePhoneNumber(
                phone
            );


        /* =============================================
           SMS DISABLED
           Safe mode while provider is being configured.
        ============================================= */

        if (!SMS_ENABLED) {

            console.log(
                "SMS SERVICE DISABLED.",
                {
                    provider:
                        SMS_PROVIDER,

                    phone:
                        normalizedPhone,

                    message
                }
            );


            return {

                success: true,

                sent: false,

                disabled: true,

                provider:
                    SMS_PROVIDER,

                phone:
                    normalizedPhone

            };

        }


        /* =============================================
           PROVIDER NOT CONNECTED YET
        ============================================= */

        if (
            SMS_PROVIDER ===
            "TUMASEND"
        ) {

            throw new Error(
                "TumaSend SMS provider is not configured yet."
            );

        }


        throw new Error(
            "Unsupported SMS provider."
        );


    } catch (error) {

        console.error(
            "SMS SERVICE ERROR:",
            error
        );


        return {

            success: false,

            sent: false,

            error:
                error.message ||
                "Unable to send SMS."

        };

    }

}


/* =====================================================
   QUEUE CUSTOMER SMS
===================================================== */

export async function queueCustomerSMS({

    customer_id,
    message,
    reference_type = null,
    reference_id = null

} = {}) {

    try {

        if (!customer_id) {

            throw new Error(
                "Customer ID is required."
            );

        }


        if (!message) {

            throw new Error(
                "SMS message is required."
            );

        }


        const {
            data: customer,
            error: customerError
        } =
            await supabase
                .from("customers")
                .select(
                    "id, phone, full_name"
                )
                .eq(
                    "id",
                    customer_id
                )
                .maybeSingle();


        if (customerError) {

            throw customerError;

        }


        if (!customer) {

            throw new Error(
                "Customer not found."
            );

        }


        const phone =
            normalizePhoneNumber(
                customer.phone
            );


        if (!phone) {

            throw new Error(
                "Customer does not have a valid phone number."
            );

        }


        const result =
            await sendSMS({

                phone,

                message

            });


        return {

    success:
        result.success,

    sent:
        result.sent || false,

    disabled:
        result.disabled || false,

    customer_id:
        customer.id,

    phone,

    reference_type,

    reference_id,

    provider:
        SMS_PROVIDER,

    error:
        result.error || null

};


    } catch (error) {

        console.error(
            "QUEUE CUSTOMER SMS ERROR:",
            error
        );


        return {

            success: false,

            sent: false,

            customer_id,

            error:
                error.message ||
                "Unable to queue customer SMS."

        };

    }

}


/* =====================================================
   EXPORT PHONE NORMALIZER
===================================================== */

export {
    normalizePhoneNumber
};

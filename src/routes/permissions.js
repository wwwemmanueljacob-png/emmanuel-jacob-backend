import express from "express";
import { supabase } from "../lib/supabase.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { requirePermission } from "../middleware/permissions.js";

const router = express.Router();

/*
=================================================
JAY C O B FINANCIAL SERVICES
ADMIN PERMISSIONS ROUTES
=================================================
*/

/*
=================================================
GET ALL PERMISSIONS
=================================================
*/

router.get(
    "/api/admin/permissions",

    authenticateAdmin,

    requirePermission("permissions.view"),

    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("permissions")
                .select(`
                    id,
                    permission_key,
                    module,
                    action,
                    description,
                    is_active,
                    created_at
                `)
                .order(
                    "module",
                    {
                        ascending: true
                    }
                )
                .order(
                    "permission_key",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "ADMIN PERMISSIONS ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load permissions.",
                    error:
                        error.message
                });

            }


            return res.json({

                success: true,

                permissions:
                    data || []

            });

        } catch (error) {

            console.error(
                "ADMIN PERMISSIONS SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Permissions could not be loaded.",

                error:
                    error.message

            });

        }

    }
);


export default router;

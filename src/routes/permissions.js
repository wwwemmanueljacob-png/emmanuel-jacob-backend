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

/*
=================================================
GET PERMISSIONS FOR A ROLE
=================================================
*/

router.get(
    "/api/admin/permissions/role/:role",

    authenticateAdmin,

    requirePermission("permissions.view"),

    async (req, res) => {

        try {

            const role = req.params.role;

            if (!role) {

                return res.status(400).json({
                    success: false,
                    message: "Role is required."
                });

            }


            const {
                data,
                error
            } = await supabase
                .from("role_permissions")
                .select(`
                    id,
                    role,
                    permission_id,
                    permissions (
                        id,
                        permission_key,
                        module,
                        action,
                        description,
                        is_active
                    )
                `)
                .eq(
                    "role",
                    role
                )
                .order(
                    "permission_id",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "ROLE PERMISSIONS ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load role permissions.",
                    error:
                        error.message
                });

            }


            return res.json({

                success: true,

                role: role,

                permissions:
                    data || []

            });

        } catch (error) {

            console.error(
                "ROLE PERMISSIONS SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Role permissions could not be loaded.",

                error:
                    error.message

            });

        }

    }
);

/*
=================================================
GET ALL ADMINISTRATORS
=================================================
*/

router.get(
    "/api/admin/permissions/admins",

    authenticateAdmin,

    requirePermission("permissions.view"),

    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("admins")
                .select(`
                    id,
                    full_name,
                    email,
                    role,
                    phone,
                    photo,
                    is_active,
                    is_verified,
                    created_at,
                    last_login
                `)
                .order(
                    "full_name",
                    {
                        ascending: true
                    }
                );


            if (error) {

                console.error(
                    "ADMIN PERMISSIONS ADMINS ERROR:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load administrators.",
                    error:
                        error.message
                });

            }


            return res.json({

                success: true,

                admins:
                    data || []

            });

        } catch (error) {

            console.error(
                "ADMIN PERMISSIONS ADMINS SERVER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Administrators could not be loaded.",

                error:
                    error.message

            });

        }

    }
);


export default router;

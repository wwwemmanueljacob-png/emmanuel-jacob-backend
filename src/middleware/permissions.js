import { supabase } from "../lib/supabase.js";

/*
=================================================
JAY C O B FINANCIAL SERVICES
ADMIN PERMISSION MIDDLEWARE
=================================================

Usage:

router.get(
    "/example",
    authenticateAdmin,
    requirePermission("customers.view"),
    handler
);

The admin must first pass authenticateAdmin().
That middleware provides req.admin.
This middleware then checks:

1. Direct admin permission
2. Role-based permission
3. Permission is active

=================================================
*/

export function requirePermission(permissionKey) {

    return async function permissionMiddleware(
        req,
        res,
        next
    ) {

        try {

            /* =========================================
               CHECK AUTHENTICATED ADMIN
            ========================================= */

            if (!req.admin) {

                return res.status(401).json({
                    success: false,
                    message: "Admin authentication required"
                });

            }


            /* =========================================
               CHECK PERMISSION KEY
            ========================================= */

            if (!permissionKey) {

                return res.status(500).json({
                    success: false,
                    message: "Permission key is required"
                });

            }


            /* =========================================
               FIND PERMISSION
            ========================================= */

            const {
                data: permission,
                error: permissionError
            } = await supabase
                .from("permissions")
                .select("id, permission_key, is_active")
                .eq(
                    "permission_key",
                    permissionKey
                )
                .maybeSingle();


            if (permissionError) {

                console.error(
                    "Permission lookup error:",
                    permissionError
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to verify permission"
                });

            }


            /* =========================================
               PERMISSION DOES NOT EXIST
            ========================================= */

            if (!permission) {

                return res.status(403).json({
                    success: false,
                    message:
                        `Permission '${permissionKey}' does not exist`
                });

            }


            /* =========================================
               PERMISSION DISABLED
            ========================================= */

            if (!permission.is_active) {

                return res.status(403).json({
                    success: false,
                    message:
                        "This permission is currently disabled"
                });

            }


            /* =========================================
               CHECK DIRECT ADMIN PERMISSION
            ========================================= */

            const {
    data: directPermission,
    error: directError
} = await supabase
    .from("admin_permissions")
    .select("id")
    .eq(
        "admin_id",
        req.admin.id
    )
    .eq(
        "permission",
        permissionKey
    )
    .maybeSingle();


            if (directError) {

                console.error(
                    "Direct permission lookup error:",
                    directError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to verify admin permission"
                });

            }


            if (directPermission) {

                req.permission = permissionKey;
                req.permissionSource = "ADMIN";

                return next();

            }


            /* =========================================
               CHECK ROLE-BASED PERMISSION
            ========================================= */

            const adminRole =
                req.admin.role;

            if (!adminRole) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Admin role is not configured"
                });

            }


            const {
                data: rolePermission,
                error: roleError
            } = await supabase
                .from("role_permissions")
                .select("id")
                .eq(
                    "role",
                    adminRole
                )
                .eq(
                    "permission_id",
                    permission.id
                )
                .maybeSingle();


            if (roleError) {

                console.error(
                    "Role permission lookup error:",
                    roleError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to verify role permission"
                });

            }


            /* =========================================
               PERMISSION GRANTED
            ========================================= */

            if (rolePermission) {

                req.permission = permissionKey;
                req.permissionSource = "ROLE";

                return next();

            }


            /* =========================================
               PERMISSION DENIED
            ========================================= */

            console.warn(
                `PERMISSION DENIED: ${req.admin.email} ` +
                `(${adminRole}) -> ${permissionKey}`
            );

            return res.status(403).json({

                success: false,

                message:
                    "You do not have permission to perform this action",

                permission:
                    permissionKey

            });

        } catch (error) {

            console.error(
                "Permission middleware error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Permission verification failed"
            });

        }

    };

}

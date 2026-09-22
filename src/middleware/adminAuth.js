import { supabase } from "../lib/supabase.js";


/* =========================================
   ADMIN SESSIONS
========================================= */

export const adminSessions =
  new Map();
/* =========================================
   ADMIN AUTHENTICATION MIDDLEWARE
========================================= */

export async function authenticateAdmin(
  req,
  res,
  next
) {

  const authorization =
    req.headers.authorization;

  if (!authorization) {

    return res.status(401).json({

      success: false,

      message:
        "Admin authentication token is required."

    });

  }

  const parts =
    authorization.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer" ||
    !parts[1]
  ) {

    return res.status(401).json({

      success: false,

      message:
        "Invalid admin authentication format."

    });

  }

  const token =
    parts[1];


  /* =====================================
     CHECK MEMORY SESSION FIRST
  ===================================== */

  let admin =
    adminSessions.get(token);


  /* =====================================
     IF NOT IN MEMORY, CHECK SUPABASE
  ===================================== */

  if (!admin) {

    try {

      const {
        data: sessions,
        error: sessionError
      } = await supabase
        .from("admin_sessions")
        .select(`
          id,
          admin_id,
          session_token,
          expires_at,
          last_activity,
          is_active
        `)
        .eq(
          "session_token",
          token
        )
        .eq(
          "is_active",
          true
        )
        .limit(1);


      if (sessionError) {

        console.error(
          "ADMIN SESSION LOOKUP ERROR:",
          sessionError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to verify administrator session."

        });

      }


      /* =================================
         SESSION NOT FOUND
      ================================= */

      const sessionRecord =
        sessions?.[0] || null;


      if (!sessionRecord) {

        return res.status(401).json({

          success: false,

          message:
            "Admin session is invalid or expired."

        });

      }


      /* =================================
         CHECK SESSION EXPIRATION
      ================================= */

      if (
        sessionRecord.expires_at &&
        new Date(sessionRecord.expires_at) <= new Date()
      ) {

        await supabase
          .from("admin_sessions")
          .update({

            is_active:
              false,

            logged_out_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            sessionRecord.id
          );

        return res.status(401).json({

          success: false,

          message:
            "Admin session has expired."

        });

      }


      /* =================================
         LOAD ADMIN FROM SUPABASE
      ================================= */

      const {
        data: adminRecord,
        error: adminError
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
          auth_user_id
        `)
        .eq(
          "id",
          sessionRecord.admin_id
        )
        .maybeSingle();


      if (adminError) {

        console.error(
          "ADMIN SESSION PROFILE ERROR:",
          adminError
        );

        return res.status(500).json({

          success: false,

          message:
            "Unable to load administrator account."

        });

      }


      if (
        !adminRecord ||
        adminRecord.is_active === false
      ) {

        return res.status(401).json({

          success: false,

          message:
            "Administrator account is inactive or unavailable."

        });

      }


      /* =================================
         REBUILD ADMIN SESSION IN MEMORY
      ================================= */

      admin = {

        id:
          adminRecord.id,

        name:
          adminRecord.full_name,

        email:
          adminRecord.email,

        role:
          adminRecord.role || "ADMIN",

        phone:
          adminRecord.phone,

        photo:
          adminRecord.photo,

        is_verified:
          adminRecord.is_verified,

        auth_user_id:
          adminRecord.auth_user_id

      };


      adminSessions.set(
        token,
        admin
      );

    } catch (error) {

      console.error(
        "ADMIN SESSION RESTORE ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to restore administrator session."

      });

    }

  }


  /* =====================================
     UPDATE LAST ACTIVITY
  ===================================== */

  try {

    await supabase
      .from("admin_sessions")
      .update({

        last_activity:
          new Date().toISOString()

      })
      .eq(
        "session_token",
        token
      )
      .eq(
        "is_active",
        true
      );

  } catch (error) {

    console.warn(
      "ADMIN SESSION ACTIVITY UPDATE ERROR:",
      error
    );

  }


  req.admin =
    admin;

  req.adminToken =
    token;

  next();

           }


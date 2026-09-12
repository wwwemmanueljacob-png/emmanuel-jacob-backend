import bcrypt from "bcryptjs";
import express from "express";
import multer from "multer";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

function generateSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

/*
=====================================================
CUSTOMERS ROUTES
JAY C O B FINANCIAL SERVICES
=====================================================
*/

/*
-----------------------------------------------------
HELPER: HASH PASSWORD
-----------------------------------------------------
*/
async function hashPassword(password) {

  return await bcrypt.hash(
    password,
    12
  );

}

/*
-----------------------------------------------------
GENERATE CUSTOMER ACCOUNT NUMBER
-----------------------------------------------------
*/
function generateAccountNumber() {

  const random =
    Math.floor(
      10000000 +
      Math.random() * 90000000
    );

  return `JCOB${random}`;
}

/*
-----------------------------------------------------
CREATE CUSTOMER
POST /api/customers/register
-----------------------------------------------------
*/
router.post(
  "/api/customers/register",
  upload.single("kyc_file"),
  async (req, res) => {

    try {

      const {
        full_name,
        email,
        phone,
        password,
        address,
        id_number,
        date_of_birth,
        occupation,
        employment_number,
        residential_address,
        next_of_kin,
        next_of_kin_home_address,
        next_of_kin_phone_number,
        kyc_type,
        kyc_number
      } = req.body;

      const kyc_file = req.file;


      /*
      -----------------------------------------------------
      BASIC CUSTOMER VALIDATION
      -----------------------------------------------------
      */

      if (
        !full_name ||
        !email ||
        !phone ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Full name, email, phone and password are required"
        });

      }


      /*
      -----------------------------------------------------
      KYC VALIDATION
      -----------------------------------------------------
      */

      if (!kyc_type) {

        return res.status(400).json({
          success: false,
          message:
            "KYC document type is required"
        });

      }


      if (!kyc_number) {

        return res.status(400).json({
          success: false,
          message:
            "KYC document number is required"
        });

      }


      if (!kyc_file) {

        return res.status(400).json({
          success: false,
          message:
            "KYC document file is required"
        });

      }


      /*
      -----------------------------------------------------
      CHECK WHETHER EMAIL ALREADY EXISTS
      -----------------------------------------------------
      */

      const {
        data: existingEmail,
        error: emailError
      } = await supabase
        .from("customers")
        .select("id")
        .eq("email", email)
        .maybeSingle();


      if (emailError) {

        return res.status(500).json({
          success: false,
          message:
            "Unable to check customer email",
          error:
            emailError.message
        });

      }


      if (existingEmail) {

        return res.status(409).json({
          success: false,
          message:
            "A customer with this email already exists"
        });

      }


      /*
      -----------------------------------------------------
      CHECK WHETHER PHONE ALREADY EXISTS
      -----------------------------------------------------
      */

      const {
        data: existingPhone,
        error: phoneError
      } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();


      if (phoneError) {

        return res.status(500).json({
          success: false,
          message:
            "Unable to check customer phone",
          error:
            phoneError.message
        });

      }


      if (existingPhone) {

        return res.status(409).json({
          success: false,
          message:
            "A customer with this phone number already exists"
        });

      }


      /*
      -----------------------------------------------------
      CREATE CUSTOMER ACCOUNT
      -----------------------------------------------------
      */

      const account_number =
        generateAccountNumber();

      const hash_password =
        await hashPassword(password);


      const {
        data,
        error
      } = await supabase
        .from("customers")
        .insert([
          {
            full_name,
            email,
            phone,
            hash_password,
            balance: 0,
            address:
              address || null,
            id_number:
              id_number || null,
            date_of_birth:
              date_of_birth || null,
            occupation:
              occupation || null,
            account_number,
            employment_number:
              employment_number || null,
            account_status:
              "active",
            failed_attempts:
              0,
            locked_until:
              null,
            role:
              "customer",
            is_verified:
              false,
            residential_address:
              residential_address || null,
            next_of_kin:
              next_of_kin || null,
            next_of_kin_home_address:
              next_of_kin_home_address || null,
            next_of_kin_phone_number:
              next_of_kin_phone_number || null
          }
        ])
        .select(
          `
          id,
          full_name,
          email,
          phone,
          balance,
          address,
          id_number,
          date_of_birth,
          occupation,
          account_number,
          employment_number,
          account_status,
          role,
          is_verified,
          residential_address,
          next_of_kin,
          next_of_kin_home_address,
          next_of_kin_phone_number,
          created_at,
          updated_at
          `
        )
        .single();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Customer registration failed",
          error:
            error.message
        });

      }


      /*
      -----------------------------------------------------
      UPLOAD KYC DOCUMENT
      -----------------------------------------------------
      */

      const fileExtension =
        kyc_file.originalname.includes(".")
          ? kyc_file.originalname
              .split(".")
              .pop()
          : "bin";


      const filePath =
        `${data.id}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;


      const {
        error: uploadError
      } = await supabase.storage
        .from("kyc-documents")
        .upload(
          filePath,
          kyc_file.buffer,
          {
            contentType:
              kyc_file.mimetype,
            upsert:
              false
          }
        );


      if (uploadError) {

        console.error(
          "KYC upload error:",
          uploadError
        );

        return res.status(500).json({
          success: false,
          message:
            "Customer created, but KYC document upload failed",
          error:
            uploadError.message
        });

      }


      /*
      -----------------------------------------------------
      CREATE KYC RECORD
      -----------------------------------------------------
      */

      const {
        error: kycError
      } = await supabase
        .from("KYC")
        .insert([
          {
            customer_id:
              data.id,

            document_type:
              kyc_type,

            document_number:
              kyc_number,

            document_url:
              filePath,

            status:
              "PENDING",

            submitted_at:
              new Date().toISOString()
          }
        ]);


      if (kycError) {

        console.error(
          "KYC database error:",
          kycError
        );

        return res.status(500).json({
          success: false,
          message:
            "Customer created, but KYC record could not be saved",
          error:
            kycError.message
        });

      }


      /*
      -----------------------------------------------------
      CUSTOMER + KYC CREATED SUCCESSFULLY
      -----------------------------------------------------
      */

            /*
      -----------------------------------------------------
      CREATE CUSTOMER SESSION
      -----------------------------------------------------
      */

      const sessionToken =
        generateSessionToken();

      const now =
        new Date();

      const expiresAt =
        new Date(
          now.getTime() +
          24 * 60 * 60 * 1000
        );

      const ipAddress =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        null;

      const userAgent =
        req.headers["user-agent"] ||
        null;

      const deviceInfo =
        req.headers["sec-ch-ua"] ||
        userAgent ||
        null;


      const {
        error: sessionError
      } = await supabase
        .from("customer_sessions")
        .insert([
          {
            customer_id:
              data.id,

            session_token:
              sessionToken,

            ip_address:
              ipAddress,

            user_agent:
              userAgent,

            device_info:
              deviceInfo,

            expires_at:
              expiresAt.toISOString(),

            last_activity:
              now.toISOString(),

            is_active:
              true,

            logged_out_at:
              null
          }
        ]);


      if (sessionError) {

        console.error(
          "Customer session error:",
          sessionError
        );

        return res.status(500).json({
          success: false,
          message:
            "Customer and KYC created, but customer session could not be created",
          error:
            sessionError.message
        });

      }
      
      return res.status(201).json({
  success: true,
  message:
    "Customer registered successfully",
  session_token:
    sessionToken,
  expires_at:
    expiresAt.toISOString(),
  customer:
    data
});


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
GET CUSTOMER BY ID
GET /api/customers/:id
-----------------------------------------------------
*/
router.get(
  "/api/customers/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        data,
        error
      } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to retrieve customer",
          error:
            error.message
        });

      }


      if (!data) {

        return res.status(404).json({
          success: false,
          message:
            "Customer not found"
        });

      }


      return res.json({
        success: true,
        customer:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
GET CUSTOMER BY ACCOUNT NUMBER
GET /api/customers/account/:accountNumber
-----------------------------------------------------
*/
router.get(
  "/api/customers/account/:accountNumber",
  async (req, res) => {

    try {

      const {
        accountNumber
      } = req.params;


      const {
        data,
        error
      } = await supabase
        .from("customers")
        .select("*")
        .eq(
          "account_number",
          accountNumber
        )
        .maybeSingle();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to retrieve customer",
          error:
            error.message
        });

      }


      if (!data) {

        return res.status(404).json({
          success: false,
          message:
            "Customer not found"
        });

      }


      return res.json({
        success: true,
        customer:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
UPDATE CUSTOMER PROFILE
PUT /api/customers/:id
-----------------------------------------------------
*/
router.put(
  "/api/customers/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const allowedFields = [
        "full_name",
        "phone",
        "address",
        "id_number",
        "date_of_birth",
        "occupation",
        "employment_number",
        "residential_address",
        "next_of_kin",
        "next_of_kin_home_address",
        "next_of_kin_phone_number"
      ];


      const updates = {};


      for (
        const field
        of allowedFields
      ) {

        if (
          req.body[field] !==
          undefined
        ) {

          updates[field] =
            req.body[field];

        }

      }


      updates.updated_at =
        new Date().toISOString();


      const {
        data,
        error
      } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Customer update failed",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        message:
          "Customer profile updated successfully",
        customer:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
ADMIN: GET ALL CUSTOMERS
GET /api/customers
-----------------------------------------------------
*/
router.get(
  "/api/customers",
  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase
        .from("customers")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          balance,
          address,
          id_number,
          date_of_birth,
          occupation,
          account_number,
          employment_number,
          account_status,
          failed_attempts,
          locked_until,
          role,
          is_verified,
          residential_address,
          next_of_kin,
          next_of_kin_home_address,
          next_of_kin_phone_number,
          auth_user_id,
          created_at,
          updated_at
          `
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to retrieve customers",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        count:
          data.length,
        customers:
          data
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


/*
-----------------------------------------------------
DELETE CUSTOMER
DELETE /api/customers/:id
-----------------------------------------------------
*/
router.delete(
  "/api/customers/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        error
      } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);


      if (error) {

        return res.status(500).json({
          success: false,
          message:
            "Customer deletion failed",
          error:
            error.message
        });

      }


      return res.json({
        success: true,
        message:
          "Customer deleted successfully"
      });


    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
        error:
          error.message
      });

    }

  }
);


export default router;

import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();


/* =========================================================
   GET SYSTEM SETTINGS
========================================================= */

router.get("/api/settings", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("system_settings")
                .select("*")
                .order("id", {
                    ascending: true
                });


        if(error){

            console.error(
                "SYSTEM SETTINGS GET ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }


        return res.json({

            success: true,

            settings:
                data || []

        });


    } catch(error){

        console.error(
            "SYSTEM SETTINGS ROUTE ERROR:",
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
   CREATE SYSTEM SETTING
========================================================= */

router.post("/api/settings", async (req, res) => {

    try {

        const {
            setting_key,
            setting_value,
            description
        } = req.body;


        if(!setting_key){

            return res.status(400).json({

                success: false,

                message:
                    "Setting key is required."

            });

        }


        const { data, error } =
            await supabase
                .from("system_settings")
                .insert({

                    setting_key,

                    setting_value:
                        setting_value || null,

                    description:
                        description || null

                })
                .select()
                .single();


        if(error){

            console.error(
                "SYSTEM SETTING CREATE ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }


        return res.status(201).json({

            success: true,

            setting:
                data

        });


    } catch(error){

        console.error(
            "SYSTEM SETTING CREATE ROUTE ERROR:",
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
   UPDATE SYSTEM SETTING
========================================================= */

router.put("/api/settings/:id", async (req, res) => {

    try {

        const { id } =
            req.params;


        const {
            setting_key,
            setting_value,
            description
        } = req.body;


        const { data, error } =
            await supabase
                .from("system_settings")
                .update({

                    setting_key,

                    setting_value,

                    description

                })
                .eq("id", id)
                .select()
                .single();


        if(error){

            console.error(
                "SYSTEM SETTING UPDATE ERROR:",
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

            setting:
                data

        });


    } catch(error){

        console.error(
            "SYSTEM SETTING UPDATE ROUTE ERROR:",
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
   DELETE SYSTEM SETTING
========================================================= */

router.delete("/api/settings/:id", async (req, res) => {

    try {

        const { id } =
            req.params;


        const { error } =
            await supabase
                .from("system_settings")
                .delete()
                .eq("id", id);


        if(error){

            console.error(
                "SYSTEM SETTING DELETE ERROR:",
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
                "System setting deleted successfully."

        });


    } catch(error){

        console.error(
            "SYSTEM SETTING DELETE ROUTE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


export default router;

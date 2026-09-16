import express from "express";
import multer from "multer";

import { requirePermission } from "#middlewares/permissions.middleware.js";
import * as clinicController from "./clinic.controller.js";

const clinicSettingRoutes = express.Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (String(file.mimetype || "").startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image files are allowed"));
  },
});

clinicSettingRoutes.post("/logo", requirePermission("clinic-setting", "edit"), imageUpload.single("logo"), clinicController.uploadClinicLogo);
clinicSettingRoutes.post("/:id/logo", requirePermission("clinic-setting", "edit"), imageUpload.single("logo"), clinicController.uploadClinicLogo);
clinicSettingRoutes.delete("/:id/logo/remove", requirePermission("clinic-setting", "edit"), clinicController.removeClinicLogo);
clinicSettingRoutes.get("/:id", requirePermission("clinic-setting", "view"), clinicController.getClinicDetails);
clinicSettingRoutes.post("/:id", requirePermission("clinic-setting", "edit"), clinicController.getClinicDetails);

export default clinicSettingRoutes;

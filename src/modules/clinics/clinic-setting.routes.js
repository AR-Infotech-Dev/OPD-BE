import express from "express";
import { uploadImages } from "#shared/utils/files.js";

import { requirePermission } from "#middlewares/permissions.middleware.js";
import * as clinicController from "./clinic.controller.js";

const clinicSettingRoutes = express.Router();

clinicSettingRoutes.post("/logo", requirePermission("clinic-settings", "edit"), uploadImages("clinic_logo"), clinicController.uploadClinicLogo);
clinicSettingRoutes.post("/:id/logo", requirePermission("clinic-settings", "edit"), uploadImages("clinic_logo"), clinicController.uploadClinicLogo);
clinicSettingRoutes.delete("/:id/logo/remove", requirePermission("clinic-settings", "edit"), clinicController.removeClinicLogo);

clinicSettingRoutes.get("/:id", requirePermission("clinic-settings", "view"), clinicController.getClinicDetails);
clinicSettingRoutes.post("/:id", requirePermission("clinic-settings", "edit"), clinicController.getClinicDetails);

export default clinicSettingRoutes;

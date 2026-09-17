import express from "express";
import * as clinicController from "./clinic.controller.js";
import { requirePermission } from "#middlewares/permissions.middleware.js";
import { uploadImages } from "#shared/utils/files.js";

const clinicRoutes = express.Router();


clinicRoutes.post("/", requirePermission(['clinics'], "view"), clinicController.list);
clinicRoutes.post("/delete", requirePermission(['clinics'], "delete"), clinicController.changeStatus);
clinicRoutes.post("/mail-config/test", requirePermission(['clinics'], "edit"), clinicController.testMailConfig);
clinicRoutes.post("/db-config/test", requirePermission(['clinics'], "edit"), clinicController.testDBConfig);

clinicRoutes.post("/logo", requirePermission(['clinics'], "create"), uploadImages("clinic_logo"), clinicController.uploadClinicLogo);
clinicRoutes.post("/:id/logo", requirePermission(['clinics'], "edit"), clinicController.uploadClinicLogo);
clinicRoutes.delete("/:id/logo/remove", requirePermission(['clinics'], "edit"), clinicController.removeClinicLogo);

clinicRoutes.put("/create", requirePermission(['clinics'], "create"), clinicController.getClinicDetails);
clinicRoutes.get("/clinic-setting/:id", requirePermission(['clinic-setting'], "view"), clinicController.getClinicDetails);
clinicRoutes.post("/clinic-setting/:id", requirePermission(['clinic-setting'], "edit"), clinicController.getClinicDetails);
clinicRoutes.get("/:id", requirePermission(['clinics'], "view"), clinicController.getClinicDetails);
clinicRoutes.post("/:id", requirePermission(['clinics'], "edit"), clinicController.getClinicDetails);
clinicRoutes.get("/:id/export-db", requirePermission("clinics", "view"), clinicController.exportClinicDb);
clinicRoutes.get("/getClinic/:id", clinicController.getClinicDetails);

export default clinicRoutes;

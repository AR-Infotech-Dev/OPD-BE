import express from "express";
import multer from "multer";
import * as clinicController from "./clinic.controller.js";
import { requirePermission } from "#middlewares/permissions.middleware.js";

const clinicRoutes = express.Router();
const logoUpload = multer({
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

clinicRoutes.post("/", requirePermission(['clinics'], "view"), clinicController.list);
clinicRoutes.post("/delete", requirePermission([ 'clinics'], "delete"), clinicController.changeStatus);
clinicRoutes.post("/mail-config/test", requirePermission(['clinics'], "edit"), clinicController.testMailConfig);
clinicRoutes.post("/db-config/test", requirePermission([ 'clinics'], "edit"), clinicController.testDBConfig);
clinicRoutes.post("/logo", requirePermission([ 'clinics'], "create"), logoUpload.single("logo"), clinicController.uploadClinicLogo);
clinicRoutes.post("/:id/logo", requirePermission(['clinics'], "edit"), logoUpload.single("logo"), clinicController.uploadClinicLogo);
clinicRoutes.delete("/:id/logo/remove", requirePermission([ 'clinics'], "edit"), clinicController.removeClinicLogo);
clinicRoutes.post("/:id/signature", requirePermission(['clinics'], "edit"), signatureUpload.single("signature"), clinicController.uploadClinicSignature);
clinicRoutes.delete("/:id/signature/remove", requirePermission(['clinics'], "edit"), clinicController.removeClinicSignature);
clinicRoutes.post("/:id/happy-client-logos", requirePermission(['clinics'], "edit"), logoUpload.array("logos", 5), clinicController.uploadHappyClientLogos);
clinicRoutes.delete("/:id/happy-client-logos/remove", requirePermission(['clinics'], "edit"), clinicController.removeHappyClientLogos);
clinicRoutes.put("/create", requirePermission(['clinics'], "create"), clinicController.getClinicDetails);
clinicRoutes.get("/clinic-setting/:id", requirePermission(['clinic-setting'], "view"), clinicController.getClinicDetails);
clinicRoutes.post("/clinic-setting/:id", requirePermission(['clinic-setting'], "edit"), clinicController.getClinicDetails);
clinicRoutes.get("/:id", requirePermission(['clinics'], "view"), clinicController.getClinicDetails);
clinicRoutes.post("/:id", requirePermission(['clinics'], "edit"), clinicController.getClinicDetails);
clinicRoutes.get("/:id/export-db", requirePermission("clinics", "view"), clinicController.exportClinicDb);
clinicRoutes.get("/getClinic/:id", clinicController.getClinicDetails);

export default clinicRoutes;

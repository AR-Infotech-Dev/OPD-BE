import express from "express";

import systemRoutes from "#modules/system/system.routes.js";
import loginRoutes from "#modules/auth/auth.routes.js";
import usersRoutes from "#modules/users/users.routes.js";
import menuRoutes from "#modules/menus/menus.routes.js";
import dashboardRoutes from "#modules/dashboard/dashboard.routes.js";
import notificationRoutes from "#modules/notifications/notifications.routes.js";
import categoryRoutes from "#modules/categories/categories.routes.js";
import companyRoutes from "#modules/company/company.routes.js";
import companySettingRoutes from "#modules/company/company-setting.routes.js";
import clinicSettingRoutes from "#modules/clinics/clinic-setting.routes.js";
import moduleAccessRoutes from "#modules/module-access/module-access.routes.js";
import bootstrapRoutes from "#modules/bootstrap/bootstrap.routes.js";
import userroleRoutes from "#modules/userrole/userrole.routes.js";
import medicineRoutes from "#modules/medicine-master/medicine.routes.js";
import { verifyToken } from "#middlewares/auth.middleware.js"
import appointmentRoutes from "#modules/appointment/appointment.routes.js";

import patientsRoutes from "#modules/patients/patients.routes.js";
import doctorsRoutes from "#modules/doctors/doctors.routes.js";

const router = express.Router();
router.use('/', loginRoutes);
router.use('/', bootstrapRoutes);
router.use('/users', verifyToken, usersRoutes);
router.use('/system', verifyToken, systemRoutes);
router.use('/menus', verifyToken, menuRoutes);
router.use('/categories', verifyToken, categoryRoutes);
router.use('/companies', verifyToken, companyRoutes);
router.use('/company-setting', verifyToken, companySettingRoutes);
router.use('/clinic-setting', verifyToken, clinicSettingRoutes);
router.use('/permissions', verifyToken, moduleAccessRoutes);
router.use("/notifications", verifyToken, notificationRoutes);
router.use("/dashboard", verifyToken, dashboardRoutes);
router.use('/user-roles', verifyToken, userroleRoutes);
router.use('/medicine-master', verifyToken, medicineRoutes);

router.use('/patients', verifyToken, patientsRoutes);
router.use('/doctors', verifyToken, doctorsRoutes);

router.use("/appointments", verifyToken, appointmentRoutes);
export default router;

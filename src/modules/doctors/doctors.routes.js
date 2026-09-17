import express from 'express';
import * as doctorController from './doctors.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';
const doctorsRoutes = express.Router();

doctorsRoutes.post('/', requirePermission(['doctors'], 'view'), doctorController.list);
// ONLY ON SIDE TENANT-DB / MAIN-DB
doctorsRoutes.post('/delete', requirePermission(['doctors'], 'delete'), doctorController.changeStatus);

doctorsRoutes.put('/create', requirePermission(['doctors'], 'create'), doctorController.getDoctorDetails);
doctorsRoutes.get('/:id', requirePermission(['doctors'], 'view'), doctorController.getDoctorDetails);
doctorsRoutes.post('/:id', requirePermission(['doctors'], 'edit'), doctorController.getDoctorDetails);

// doctorsRoutes.post('/delete/:id', doctorController.changeStatus);

export default doctorsRoutes;

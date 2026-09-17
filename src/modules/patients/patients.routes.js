import express from 'express';
import * as patientController from './patients.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';
const patientsRoutes = express.Router();

patientsRoutes.post('/', requirePermission(['patients'], 'view'), patientController.list);
// ONLY ON SIDE TENANT-DB / MAIN-DB
patientsRoutes.post('/delete', requirePermission(['patients'], 'delete'), patientController.changeStatus);

patientsRoutes.put('/create', requirePermission(['patients'], 'create'), patientController.getPatientDetails);
patientsRoutes.get('/:id', requirePermission(['patients'], 'view'), patientController.getPatientDetails);
patientsRoutes.post('/:id', requirePermission(['patients'], 'edit'), patientController.getPatientDetails);

// patientsRoutes.post('/delete/:id', patientController.changeStatus);

export default patientsRoutes;

import express from 'express';
import * as medicineController from './medicine.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';
const medicineRoutes = express.Router();

medicineRoutes.post('/', requirePermission(['admin', 'medicine'], 'view'), medicineController.list);
// ONLY ON SIDE TENANT-DB / MAIN-DB
medicineRoutes.post('/delete', requirePermission(['admin', 'medicine'], 'delete'), medicineController.changeStatus);

// USED FOR BOTH SIDE WITH TENANT-SYNC

medicineRoutes.put('/create', requirePermission(['admin', 'medicine'], 'create'), medicineController.getMedicineDetails);
medicineRoutes.get('/:id', requirePermission(['admin', 'medicine'], 'view'), medicineController.getMedicineDetails);
medicineRoutes.post('/:id', requirePermission(['admin', 'medicine'], 'edit'), medicineController.getMedicineDetails);

// medicinesRoutes.post('/delete/:id', medicineController.changeStatus);

export default medicineRoutes;

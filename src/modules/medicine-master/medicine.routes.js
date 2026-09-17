import express from 'express';
import * as medicineController from './medicine.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';
const medicinesRoutes = express.Router();

medicinesRoutes.post('/', requirePermission(['admin', 'users'], 'view'), medicineController.list);
// ONLY ON SIDE TENANT-DB / MAIN-DB
medicinesRoutes.post('/delete', requirePermission(['admin', 'users'], 'delete'), medicineController.changeStatus);

// USED FOR BOTH SIDE WITH TENANT-SYNC


// medicinesRoutes.get('/profile', medicineController.getProfile);
// medicinesRoutes.post('/profile', medicineController.updateProfile);
// medicinesRoutes.post('/profile/change-password', medicineController.changeProfilePassword);
medicinesRoutes.put('/create', requirePermission(['admin', 'users'], 'create'), medicineController.getAdminDetails);
medicinesRoutes.get('/:id', requirePermission(['admin', 'users'], 'view'), medicineController.getAdminDetails);
medicinesRoutes.post('/:id', requirePermission(['admin', 'users'], 'edit'), medicineController.getAdminDetails);

// medicinesRoutes.post('/delete/:id', medicineController.changeStatus);

export default medicinesRoutes;

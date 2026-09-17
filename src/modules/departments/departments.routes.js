import express from 'express';
import * as departmentController from './departments.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';

const departmentsRoutes = express.Router();

departmentsRoutes.post('/', requirePermission(['admin', 'departments'], 'view'), departmentController.list);
// ONLY ON SIDE TENANT-DB / MAIN-DB
departmentsRoutes.post('/delete', requirePermission(['admin', 'departments'], 'delete'), departmentController.changeStatus);

// USED FOR BOTH SIDE WITH TENANT-SYNC


departmentsRoutes.put('/create', requirePermission(['admin', 'departments'], 'create'), departmentController.getDepartmentDetails);
departmentsRoutes.get('/:id', requirePermission(['admin', 'departments'], 'view'), departmentController.getDepartmentDetails);
departmentsRoutes.post('/:id', requirePermission(['admin', 'departments'], 'edit'), departmentController.getDepartmentDetails);

// departmentsRoutes.post('/delete/:id', departmentController.changeStatus);

export default departmentsRoutes;

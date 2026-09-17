import express from 'express';
import * as userController from './users.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';
const usersRoutes = express.Router();

usersRoutes.post('/', requirePermission([  'users'], 'view'), userController.list);
usersRoutes.post('/delete', requirePermission([  'users'], 'delete'), userController.changeStatus);
usersRoutes.post('/status', userController.updateStatus);
usersRoutes.get('/profile', userController.getProfile);
usersRoutes.post('/profile', userController.updateProfile);
usersRoutes.post('/profile/change-password', userController.changeProfilePassword);
usersRoutes.put('/create', requirePermission([  'users'], 'create'), userController.getAdminDetails);
usersRoutes.get('/:id', requirePermission([  'users'], 'view'), userController.getAdminDetails);
usersRoutes.post('/:id', requirePermission([  'users'], 'edit'), userController.getAdminDetails);


export default usersRoutes;

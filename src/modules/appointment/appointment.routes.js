import express from "express";

import * as appointmentController from "./appointment.controller.js";

import { requirePermission } from "#middlewares/permissions.middleware.js";

const appointmentsRoutes = express.Router();
appointmentsRoutes.post( "/", requirePermission(["admin", "appointment"], "view"), appointmentController.list );
appointmentsRoutes.post( "/create", requirePermission(["admin", "appointment"], "create"), appointmentController.createAppointment );
appointmentsRoutes.post( "/today", requirePermission(["admin", "appointment"], "view"), appointmentController.getTodayAppointments );
appointmentsRoutes.post( "/doctor-queue", requirePermission(["admin", "appointment"], "view"), appointmentController.getDoctorQueue );
appointmentsRoutes.post( "/change-status", requirePermission(["admin", "appointment"], "edit"), appointmentController.changeStatus );
appointmentsRoutes.get( "/:id", requirePermission(["admin", "appointment"], "view"), appointmentController.getAppointmentDetails );
appointmentsRoutes.put( "/:id", requirePermission(["admin", "appointment"], "edit"), appointmentController.updateAppointment );
appointmentsRoutes.post( "/:id/check-in", requirePermission(["admin", "appointment"], "edit"), appointmentController.checkIn );
appointmentsRoutes.delete( "/:id", requirePermission(["admin", "appointment"], "delete"), appointmentController.deleteAppointment );

export default appointmentsRoutes;
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const CLINIC_ASSET_ROOT = path.resolve(__dirname, "../../../public/images/clinic");
export const getClinicAssetDir = (clinicId) => path.join(CLINIC_ASSET_ROOT, String(Number(clinicId)));

export const clinicValidationRules = {
    clinic_id: { label: "Clinic ID", type: "number" },
    clinic_name: { label: "Clinic Name", required: true },
    clinic_code: { label: "Clinic Code", required: false },
    clinic_registration_no: { label: "Clinic registration no", required: false },
    clinic_phone: { label: "Phone no", required: false },
    clinic_email: { label: "Email", type: "email" },
    address: { label: "Clinic Address" },
    country: { label: "Country", },
    state: { label: "State", },
    city: { label: "City", },
    zip: { label: "Zip" },
    pincode: { label: "Pincode" },
    working_days: { label: "Working days" },
    clinic_open_time: { label: "Clinic open time" },
    clinic_close_time: { label: "Clinic close time" },
    weekly_off_day: { label: "Weekly off day" },
    default_slot_duration: { label: "default slot duration" },
    appointment_prefix: { label: "Appointment prefix" },
    appointment_padding: { label: "Appointment padding" },
    patient_prefix: { label: "Patient preifix" },
    patient_padding: { label: "Patient padding" },
    token_reset: { label: "Token reset" },
    max_walk_in_per_doctor: { label: "Max walk in" },
    allow_overbooking: { label: "Allow overbooking" },
    prescription_footer: { label: "Prescription footer" },
    clinic_logo: { label: "Clinic Logo" },
    created_by: { label: "Created By", type: "number" },
    modified_by: { label: "Modified By", type: "number" },

    status: { label: "Status" },
};

export const ensureClinicAssetDir = (clinic_id) => {
    const directory = getClinicAssetDir(clinic_id);
    fs.mkdirSync(directory, { recursive: true });
    return directory;
};
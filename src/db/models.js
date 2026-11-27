import mongoose from 'mongoose'

mongoose.set('autoIndex', false)

const PharmacySchema = new mongoose.Schema({
    _id: { type: String },
    license_number: { type: String, required: true },
    name: { type: String, required: true },
    operator: { type: String, default: null },
    nif: { type: String, default: null },
    street: { type: String, default: null },
    postal_code: { type: String, default: null },
    locality: { type: String, default: null },
    parish: { type: String, default: null },
    municipality: { type: String, default: null },
    municipality_code: { type: String, default: null },
    district: { type: String, default: null },
    district_code: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    license_status: { type: String, default: null },
    home_delivery: { type: Boolean, default: null },
    internet_sales: { type: Boolean, default: null },
    website: { type: String, default: null },
    technical_director: { type: String, default: null },
    active: { type: Boolean, default: true },
    synced_at: { type: Date, default: Date.now }
}, { collection: 'pharmacies' })

const ShiftSchema = new mongoose.Schema({
    shift_day: { type: String, required: true },
    municipality_code: { type: String, required: true },
    municipality: { type: String, default: null },
    district: { type: String, default: null },
    district_code: { type: String, default: null },
    source_municipality_id: { type: Number, default: null },
    pharmacy_id: { type: String, default: null },
    name: { type: String, required: true },
    street: { type: String, default: null },
    town: { type: String, default: null },
    shift: { type: String, default: null },
    shift_start: { type: String, required: true },
    shift_end: { type: String, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    synced_at: { type: Date, default: Date.now }
}, { collection: 'shifts' })

const SyncStateSchema = new mongoose.Schema({
    _id: { type: String },
    catalog_last_success: { type: Date, default: null },
    catalog_last_attempt: { type: Date, default: null },
    catalog_last_error: { type: String, default: null },
    catalog_count: { type: Number, default: 0 },
    coords_pending: { type: Number, default: 0 },
    coords_filled: { type: Number, default: 0 },
    service_last_success: { type: Date, default: null },
    service_last_attempt: { type: Date, default: null },
    service_last_error: { type: String, default: null },
    service_municipalities_ok: { type: Number, default: 0 },
    service_municipalities_failed: { type: Number, default: 0 },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'sync_state' })

export const Pharmacy = mongoose.model('Pharmacy', PharmacySchema)
export const Shift = mongoose.model('Shift', ShiftSchema)
export const SyncState = mongoose.model('SyncState', SyncStateSchema)

export const SYNC_ID = 'farmacias'

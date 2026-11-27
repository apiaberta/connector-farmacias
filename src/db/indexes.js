import { Pharmacy, Shift, SyncState } from './models.js'

export const INDEXES = {
    pharmacies: [
        {
            keys: { license_number: 1 },
            options: { unique: true, name: 'license_number_1' }
        },
        {
            keys: { municipality_code: 1, name: 1 },
            options: { name: 'municipality_code_1_name_1' }
        },
        {
            keys: { district_code: 1, municipality_code: 1 },
            options: { name: 'district_code_1_municipality_code_1' }
        },
        {
            keys: { name: 1 },
            options: { name: 'name_1' }
        },
        {
            keys: { active: 1, municipality_code: 1 },
            options: { name: 'active_1_municipality_code_1' }
        }
    ],
    shifts: [
        {
            keys: { shift_day: 1, municipality_code: 1, name: 1, street: 1 },
            options: { unique: true, name: 'shift_day_muni_name_street_1' }
        },
        {
            keys: { shift_day: 1, district_code: 1 },
            options: { name: 'shift_day_1_district_code_1' }
        },
        {
            keys: { pharmacy_id: 1, shift_day: 1 },
            options: { name: 'pharmacy_id_1_shift_day_1' }
        }
    ],
    sync_state: [
        {
            keys: { updated_at: -1 },
            options: { name: 'updated_at_-1' }
        }
    ]
}

const MODEL_BY_COLLECTION = {
    pharmacies: () => Pharmacy,
    shifts: () => Shift,
    sync_state: () => SyncState
}

export async function ensureIndexes (models = {}) {
    const created = []
    for (const [collection, specs] of Object.entries(INDEXES)) {
        const Model = models[collection] ?? MODEL_BY_COLLECTION[collection]()
        for (const spec of specs) {
            const name = await Model.collection.createIndex(spec.keys, spec.options)
            created.push({ collection, name })
        }
    }
    return created
}

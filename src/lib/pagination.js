import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../config.js'

export function parsePageLimit (query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE)
    let limit = parseInt(query.limit, 10)
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
    if (limit > MAX_LIMIT) limit = MAX_LIMIT
    return { page, limit, skip: (page - 1) * limit }
}

export function paginationMeta (page, limit, total) {
    return {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit)
    }
}

export function envelope (data, { page, limit, total }) {
    return {
        data,
        meta: paginationMeta(page, limit, total)
    }
}

const FARM_PREFIX = /^(farmacia|farmácia)\s+/i

export function stripAccents (text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeText (text) {
    return stripAccents(text)
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function normalizeName (text) {
    return normalizeText(String(text ?? '').replace(FARM_PREFIX, ''))
}

export function normalizeStreet (text) {
    return normalizeText(text)
        .replace(/\b(rua|av|avenida|r|praceta|praca|largo|travessa|estrada|lugar)\b/g, ' ')
        .replace(/\b(n|no|nr|num|numero)\b/g, ' ')
        .replace(/\bsn\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const VOWEL_CLASS = {
    a: '[aàáâãä]',
    e: '[eèéêë]',
    i: '[iìíîï]',
    o: '[oòóôõö]',
    u: '[uùúûü]',
    c: '[cç]'
}

export function accentInsensitiveRegex (text) {
    const plain = stripAccents(text).trim()
    const pattern = [...plain].map(ch => {
        const cls = VOWEL_CLASS[ch.toLowerCase()]
        return cls ?? ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
    }).join('')
    return new RegExp(pattern, 'i')
}

export function escapeRegex (text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

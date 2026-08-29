#!/usr/bin/env node
/**
 * Locale Validation Script
 * 
 * Ensures en.json and es.json have:
 * 1. Identical key structures (same keys in both files)
 * 2. The same ICU placeholders and rich-text tags in each message
 * 3. Keys at the same line numbers (for easier diff/review)
 * 
 * Run this before commits to catch missing/extra translations.
 * 
 * Usage: node scripts/validate-locales.js
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

/**
 * Get all keys from a JSON object with their paths
 */
function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/**
 * Get line numbers for each key in a JSON file
 */
function getKeyLineNumbers(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const keyLines = new Map();

    let currentPath = [];
    let bracketStack = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Track opening braces
        if (trimmed.includes('{')) {
            const keyMatch = trimmed.match(/"([^"]+)"\s*:\s*\{/);
            if (keyMatch) {
                currentPath.push(keyMatch[1]);
            }
            bracketStack.push('{');
        }

        // Track key-value pairs (non-object values)
        const kvMatch = trimmed.match(/"([^"]+)"\s*:\s*(?!"?\{)(.+)/);
        if (kvMatch) {
            const key = kvMatch[1];
            const fullPath = currentPath.length > 0
                ? `${currentPath.join('.')}.${key}`
                : key;
            keyLines.set(fullPath, lineNum);
        }

        // Track closing braces
        if (trimmed.includes('}')) {
            bracketStack.pop();
            if (currentPath.length > 0) {
                currentPath.pop();
            }
        }
    });

    return keyLines;
}

/**
 * Get the ICU argument names and rich-text tags a message interpolates.
 *
 * These have to match across locales. next-intl never throws on a mismatch —
 * it falls back to rendering the key path, so `Hola {nombre}` translated from
 * `Hello {name}` puts the literal text "projects.greeting" on screen instead of
 * a greeting. Key parity alone cannot see that; the keys are identical.
 *
 * Only depth-1 braces name an argument. The inner braces of a plural are option
 * bodies: in `{count, plural, one {# nota} other {# notas}}` the argument is
 * `count`, not `one` or `other`.
 */
function getInterpolations(message) {
    // Arguments are a set: a locale may legitimately use {name} once where
    // English uses it twice. Tags are counted, because dropping one of three
    // <kbd> wrappers is a translation bug, not a phrasing choice.
    const args = new Set();
    const tags = new Map();
    if (typeof message !== 'string') return { args, tags };

    let depth = 0;
    for (let i = 0; i < message.length; i++) {
        const char = message[i];

        // ICU quotes a literal brace: '{' is text, not an argument.
        if (char === "'" && (message[i + 1] === '{' || message[i + 1] === '}')) {
            i += 1;
            continue;
        }

        if (char === '}') {
            depth = Math.max(0, depth - 1);
            continue;
        }
        if (char !== '{') continue;

        depth += 1;
        if (depth !== 1) continue;

        const name = message.slice(i + 1).match(/^\s*([A-Za-z0-9_]+)/);
        if (name) args.add(`{${name[1]}}`);
    }

    for (const [, tag] of message.matchAll(/<([A-Za-z][A-Za-z0-9]*)>/g)) {
        tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }

    return { args, tags };
}

/**
 * Compare what each locale interpolates, key by key
 */
function compareInterpolations(en, es, commonKeys) {
    const read = (source, key) => key.split('.').reduce((node, part) => node?.[part], source);
    const mismatches = [];

    for (const key of commonKeys) {
        const inEn = getInterpolations(read(en, key));
        const inEs = getInterpolations(read(es, key));

        const missing = [...inEn.args].filter((name) => !inEs.args.has(name));
        const extra = [...inEs.args].filter((name) => !inEn.args.has(name));

        for (const tag of new Set([...inEn.tags.keys(), ...inEs.tags.keys()])) {
            const enCount = inEn.tags.get(tag) ?? 0;
            const esCount = inEs.tags.get(tag) ?? 0;
            if (enCount === esCount) continue;
            const label = `<${tag}>`;
            if (esCount === 0) missing.push(label);
            else if (enCount === 0) extra.push(label);
            else missing.push(`${label} ×${enCount} (es.json has ×${esCount})`);
        }

        if (missing.length > 0 || extra.length > 0) {
            mismatches.push({ key, missing, extra });
        }
    }

    return mismatches;
}

/**
 * Compare line numbers between two locale files
 */
function compareLineNumbers(enPath, esPath, enKeys, esKeys) {
    const enLines = getKeyLineNumbers(enPath);
    const esLines = getKeyLineNumbers(esPath);

    const mismatches = [];

    // Only check keys that exist in both
    const commonKeys = enKeys.filter(k => esKeys.includes(k));

    for (const key of commonKeys) {
        const enLine = enLines.get(key);
        const esLine = esLines.get(key);

        if (enLine && esLine && enLine !== esLine) {
            mismatches.push({
                key,
                enLine,
                esLine
            });
        }
    }

    return mismatches;
}

function validateLocales() {
    console.log('🔍 Validating locale files...\n');

    // Load locale files
    const enPath = path.join(MESSAGES_DIR, 'en.json');
    const esPath = path.join(MESSAGES_DIR, 'es.json');

    let en, es;
    try {
        en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
    } catch (error) {
        console.error('❌ Error reading locale files:', error.message);
        process.exit(1);
    }

    // Get all keys
    const enKeys = getKeys(en).sort();
    const esKeys = getKeys(es).sort();

    // Find key differences
    const missingInEs = enKeys.filter(k => !esKeys.includes(k));
    const extraInEs = esKeys.filter(k => !enKeys.includes(k));

    // Find line number mismatches
    const lineMismatches = compareLineNumbers(enPath, esPath, enKeys, esKeys);

    // Find placeholder / rich-tag mismatches
    const commonKeys = enKeys.filter(k => esKeys.includes(k));
    const interpolationMismatches = compareInterpolations(en, es, commonKeys);

    // Report results
    console.log(`📊 Key counts:`);
    console.log(`   English (en.json): ${enKeys.length} keys`);
    console.log(`   Spanish (es.json): ${esKeys.length} keys\n`);

    let hasErrors = false;

    if (missingInEs.length > 0) {
        hasErrors = true;
        console.log(`❌ Missing in es.json (${missingInEs.length} keys):`);
        missingInEs.forEach(k => console.log(`   - ${k}`));
        console.log('');
    }

    if (extraInEs.length > 0) {
        hasErrors = true;
        console.log(`❌ Extra in es.json (${extraInEs.length} keys):`);
        extraInEs.forEach(k => console.log(`   + ${k}`));
        console.log('');
    }

    if (interpolationMismatches.length > 0) {
        hasErrors = true;
        console.log(`❌ Placeholder mismatches (${interpolationMismatches.length} keys):`);
        console.log(`   Both locales must interpolate the same values and tags, or`);
        console.log(`   next-intl drops the whole string and renders the key path.\n`);
        interpolationMismatches.forEach(({ key, missing, extra }) => {
            const parts = [];
            if (missing.length > 0) parts.push(`missing in es.json: ${missing.join(' ')}`);
            if (extra.length > 0) parts.push(`not in en.json: ${extra.join(' ')}`);
            console.log(`   "${key}": ${parts.join(', ')}`);
        });
        console.log('');
    }

    if (lineMismatches.length > 0) {
        hasErrors = true;
        console.log(`❌ Line number mismatches (${lineMismatches.length} keys):`);
        console.log(`   Keys should be at the same line number in both files for easier review.\n`);
        lineMismatches.slice(0, 10).forEach(({ key, enLine, esLine }) => {
            console.log(`   "${key}": en.json L${enLine} ≠ es.json L${esLine}`);
        });
        if (lineMismatches.length > 10) {
            console.log(`   ... and ${lineMismatches.length - 10} more`);
        }
        console.log('');
    }

    if (hasErrors) {
        console.log('💡 Fix these issues before building!\n');
        console.log('   Tips:');
        console.log('   1. Add missing keys to BOTH en.json AND es.json');
        console.log('   2. Keep every {placeholder} and <tag> identical across locales');
        console.log('   3. Ensure keys are in the same order/line in both files');
        console.log('   4. Run: npm run validate:locales');
        console.log('   5. Build only when validation passes\n');
        process.exit(1);
    }

    console.log('✅ All locale files are synchronized!\n');
    process.exit(0);
}

validateLocales();

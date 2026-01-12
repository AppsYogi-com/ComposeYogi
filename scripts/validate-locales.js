#!/usr/bin/env node
/**
 * Locale Validation Script
 * 
 * Ensures en.json and es.json have:
 * 1. Identical key structures (same keys in both files)
 * 2. Keys at the same line numbers (for easier diff/review)
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
        console.log('   2. Ensure keys are in the same order/line in both files');
        console.log('   3. Run: npm run validate:locales');
        console.log('   4. Build only when validation passes\n');
        process.exit(1);
    }

    console.log('✅ All locale files are synchronized!\n');
    process.exit(0);
}

validateLocales();

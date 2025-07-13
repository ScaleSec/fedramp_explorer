const fs = require('fs');
const path = require('path');

// All control enhancements that are referenced but may be missing
const referencedEnhancements = [
    'ac-17.1', 'ac-2.4', 'ac-2.7', 'ac-3.10', 'ac-6.9', 'au-13.1', 'au-13.2', 
    'ca-2.1', 'ca-3.5', 'ca-6.1', 'ca-6.2', 'cm-2.2', 'cm-5.1', 'cm-7.9', 
    'cm-8.2', 'cm-8.7', 'cp-2.7', 'ir-4.5', 'ma-4.1', 'mp-4.2', 'sa-8.1', 
    'sa-8.10', 'sa-8.12', 'sa-8.13', 'sa-8.14', 'sa-8.18', 'sa-8.3', 'sa-8.4', 
    'sc-7.15', 'sc-7.9', 'si-10.1', 'si-3.8', 'si-4.12', 'si-4.22', 'si-4.5', 'si-7.8'
];

const baselines = ['high', 'moderate', 'low', 'li-saas'];
const baselineNames = {
    'high': 'HIGH',
    'moderate': 'MODERATE', 
    'low': 'LOW',
    'li-saas': 'LI-SaaS'
};

// Function to find which control references a given enhancement
function findReferringControl(enhancement, baseline) {
    const contentDir = path.join(__dirname, '..', 'content', baseline);
    const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
        const filePath = path.join(contentDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Look for references to this enhancement
        const patterns = [
            new RegExp(`\\[([^\\]]+)\\]\\(\\.\\.\/${enhancement}\\/\\)`, 'g'),
            new RegExp(`\\[([^\\]]+)\\]\\(\\.\\.\/${enhancement.replace('.', '\\.')}\/\\)`, 'g')
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(content)) {
                return file.replace('.md', '');
            }
        }
    }
    
    // Default fallback - try to infer from enhancement ID
    const baseControl = enhancement.split('.')[0];
    return baseControl;
}

// Function to create redirect page content
function createRedirectContent(enhancement, baseline, referringControl) {
    const baselineUpper = baselineNames[baseline];
    const enhancementUpper = enhancement.toUpperCase();
    const csfUrl = `https://csf.tools/reference/nist-sp-800-53/r5/${enhancement.replace('.', '/')}/`;
    
    return `---
title: "Control ${enhancementUpper} - Not Included"
control_id: "${enhancement}"
layout: "redirect"
---

This control (${enhancementUpper}) is not included in the ${baselineUpper} baseline.

You can view this control's details at [CSF.tools](${csfUrl}).

[← Back to ${referringControl.toUpperCase()}](../${referringControl}/)
`;
}

// Main function to create missing redirect pages
function createMissingRedirects() {
    let created = 0;
    let skipped = 0;

    for (const baseline of baselines) {
        console.log(`\nProcessing ${baseline} baseline...`);
        
        for (const enhancement of referencedEnhancements) {
            const filePath = path.join(__dirname, '..', 'content', baseline, `${enhancement}.md`);
            
            // Check if file already exists
            if (fs.existsSync(filePath)) {
                console.log(`  ✓ ${enhancement} already exists`);
                skipped++;
                continue;
            }
            
            // Find the referring control
            const referringControl = findReferringControl(enhancement, baseline);
            
            // Create the redirect content
            const content = createRedirectContent(enhancement, baseline, referringControl);
            
            // Write the file
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  + Created ${enhancement} (refers from ${referringControl})`);
            created++;
        }
    }
    
    console.log(`\n✅ Summary:`);
    console.log(`   Created: ${created} redirect pages`);
    console.log(`   Skipped: ${skipped} existing pages`);
    console.log(`   Total processed: ${created + skipped} files`);
}

// Run the script
if (require.main === module) {
    createMissingRedirects();
}

module.exports = { createMissingRedirects, findReferringControl, createRedirectContent };
const fs = require('fs');
const path = require('path');

const baselines = ['high', 'moderate', 'low', 'li-saas'];

function generateCorrectCsfUrl(controlId) {
    const parts = controlId.split('.');
    if (parts.length === 2) {
        const familyAndNumber = parts[0]; // e.g., "ca-6" or "ac-3"
        const enhancement = parts[1]; // e.g., "1" or "10"
        
        const familyParts = familyAndNumber.split('-');
        const family = familyParts[0]; // e.g., "ca" or "ac"
        const number = familyParts[1]; // e.g., "6" or "3"
        
        return `https://csf.tools/reference/nist-sp-800-53/r5/${family}/${family}-${number}/${family}-${number}-${enhancement}/`;
    }
    return null;
}

function updateFile(filePath, controlId) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const correctUrl = generateCorrectCsfUrl(controlId);
        if (!correctUrl) {
            console.log(`Skipping ${controlId} - unable to determine correct URL pattern`);
            return false;
        }
        
        // Pattern 1: ca-6/1/ -> ca/ca-6/ca-6-1/
        const pattern1 = controlId.split('.').join('/');
        const incorrectPattern1 = `https://csf.tools/reference/nist-sp-800-53/r5/${pattern1}/`;
        
        // Pattern 2: ca-3/10/ -> ca/ca-3/ca-3-10/  
        const family = controlId.split('-')[0];
        const baseControl = controlId.split('.')[0];
        const enhancement = controlId.split('.')[1];
        const incorrectPattern2 = `https://csf.tools/reference/nist-sp-800-53/r5/${baseControl}/${enhancement}/`;
        
        let updated = false;
        
        if (content.includes(incorrectPattern1)) {
            content = content.replace(incorrectPattern1, correctUrl);
            updated = true;
            console.log(`  Fixed pattern1 in ${path.basename(filePath)}: ${incorrectPattern1} -> ${correctUrl}`);
        }
        
        if (content.includes(incorrectPattern2)) {
            content = content.replace(incorrectPattern2, correctUrl);
            updated = true;
            console.log(`  Fixed pattern2 in ${path.basename(filePath)}: ${incorrectPattern2} -> ${correctUrl}`);
        }
        
        if (updated) {
            fs.writeFileSync(filePath, content);
            return true;
        } else {
            // Check if it already has the correct pattern
            if (content.includes(correctUrl)) {
                console.log(`  ${path.basename(filePath)} already has correct URL`);
            } else {
                console.log(`  ${path.basename(filePath)} - no matching patterns found`);
            }
            return false;
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

function processBaseline(baseline) {
    const contentDir = path.join(__dirname, '..', 'content', baseline);
    
    if (!fs.existsSync(contentDir)) {
        console.log(`Directory ${contentDir} does not exist, skipping...`);
        return;
    }
    
    const files = fs.readdirSync(contentDir)
        .filter(file => file.match(/^[a-z]{2}-\d+\.\d+\.md$/))
        .filter(file => {
            const filePath = path.join(contentDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            return content.includes('csf.tools');
        });
    
    console.log(`\n${baseline.toUpperCase()} baseline (${files.length} enhancement files with CSF.tools links):`);
    
    let updatedCount = 0;
    
    files.forEach(file => {
        const controlId = file.replace('.md', '');
        const filePath = path.join(contentDir, file);
        
        if (updateFile(filePath, controlId)) {
            updatedCount++;
        }
    });
    
    console.log(`Updated ${updatedCount} files in ${baseline} baseline`);
    return updatedCount;
}

console.log('Fixing CSF.tools URLs for enhancement redirects...\n');

let totalUpdated = 0;

baselines.forEach(baseline => {
    totalUpdated += processBaseline(baseline) || 0;
});

console.log(`\nCompleted! Updated ${totalUpdated} files total across all baselines.`);
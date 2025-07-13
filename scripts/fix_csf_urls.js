const fs = require('fs');
const path = require('path');

const baselines = ['high', 'moderate', 'low', 'li-saas'];

function fixCsfUrl(enhancement) {
    const parts = enhancement.split('-');
    if (parts.length === 3) {
        const family = parts[0];
        const controlNum = parts[1];
        const enhancementNum = parts[2];
        
        return `https://csf.tools/reference/nist-sp-800-53/r5/${family}/${family}-${controlNum}/${family}-${controlNum}-${enhancementNum}/`;
    }
    return null;
}

function updateFile(filePath, enhancement) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const correctUrl = fixCsfUrl(enhancement);
        if (!correctUrl) {
            console.log(`Skipping ${enhancement} - unable to determine correct URL pattern`);
            return false;
        }
        
        const incorrectPattern1 = new RegExp(`https://csf\\.tools/reference/nist-sp-800-53/r5/${enhancement.replace('.', '-').replace('-', '/')}/`, 'g');
        const incorrectPattern2 = new RegExp(`https://csf\\.tools/reference/nist-sp-800-53/r5/${enhancement.replace('.', '/')}/`, 'g');
        
        let updated = false;
        
        if (incorrectPattern1.test(content)) {
            content = content.replace(incorrectPattern1, correctUrl);
            updated = true;
        }
        
        if (incorrectPattern2.test(content)) {
            content = content.replace(incorrectPattern2, correctUrl);
            updated = true;
        }
        
        if (updated) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
            return true;
        }
        
        return false;
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
    
    console.log(`\nProcessing ${baseline.toUpperCase()} baseline (${files.length} enhancement files with CSF.tools links):`);
    
    let updatedCount = 0;
    
    files.forEach(file => {
        const enhancement = file.replace('.md', '');
        const filePath = path.join(contentDir, file);
        
        if (updateFile(filePath, enhancement)) {
            updatedCount++;
        }
    });
    
    console.log(`Updated ${updatedCount} files in ${baseline} baseline`);
}

console.log('Fixing CSF.tools URLs for enhancement redirects...\n');

let totalUpdated = 0;

baselines.forEach(baseline => {
    processBaseline(baseline);
});

console.log('\nCSF.tools URL fix completed!');
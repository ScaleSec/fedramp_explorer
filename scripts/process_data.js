const fs = require('fs');
const path = require('path');

const baselines = ['HIGH', 'MODERATE', 'LOW', 'LI-SaaS'];
const searchIndexMap = new Map();

function buildProse(builder, part) {
    if (part.prose) {
        builder.push(part.prose);
    }
    if (part.parts) {
        part.parts.forEach(subPart => buildProse(builder, subPart));
    }
}

function extractText(part) {
    const texts = [];
    if (part.prose) {
        texts.push(part.prose);
    }
    if (part.parts) {
        part.parts.forEach(p => texts.push(...extractText(p)));
    }
    return texts;
}

function getLabel(part) {
    if (!part.props) return '';
    const labelProp = part.props.find(p => p.name === 'label');
    return labelProp ? labelProp.value.replace(/[.()]/g, '') : '';
}

// Process baselines, ensuring the highest baseline overwrites lower ones in the search map
['LI-SaaS', 'LOW', 'MODERATE', 'HIGH'].forEach(baseline => {
    const inPath = path.join('data', `FedRAMP_rev5_${baseline}-baseline-resolved-profile_catalog.json`);
    const outPath = path.join('data', `${baseline.toLowerCase()}.json`);

    console.log(`Processing ${inPath} -> ${outPath}`);

    const rawData = fs.readFileSync(inPath);
    const catalog = JSON.parse(rawData);

    const simpleControls = [];

    catalog.catalog.groups.forEach(group => {
        if (group.controls) {
            group.controls.forEach(control => {
                const paramMap = {};
                if (control.params) {
                    control.params.forEach(p => {
                        paramMap[p.id] = p;
                    });
                }

                const fedrampDefinedParams = [];
                const paramRegex = /{{ insert: param, (.*?) }}/g;

                function findParamsInParts(parts, parentLabels) {
                    if (!parts) return;
                    parts.forEach(part => {
                        const currentLabel = getLabel(part);
                        const newLabels = currentLabel ? [...parentLabels, currentLabel] : parentLabels;

                        if (part.prose) {
                            let match;
                            while ((match = paramRegex.exec(part.prose)) !== null) {
                                const paramId = match[1];
                                const paramData = paramMap[paramId];

                                if (paramData && (paramData.constraints || paramData.select)) {
                                    const outlineId = `${control.id.toUpperCase()} (${newLabels.join(')(')})`;
                                    let value = '';
                                    if (paramData.constraints) {
                                        value = `[${paramData.constraints.map(c => c.description).join(', ')}]`;
                                    } else if (paramData.select) {
                                        value = `[Selection: ${paramData.select.choice.join(', ')}]`;
                                    }
                                    const guideline = paramData.guidelines ? paramData.guidelines.map(g => g.prose).join(' ') : '';
                                    fedrampDefinedParams.push({
                                        outlineId: outlineId,
                                        value: value,
                                        guideline: guideline
                                    });
                                }
                            }
                        }
                        if (part.parts) {
                            findParamsInParts(part.parts, newLabels);
                        }
                    });
                }
                
                const statementPart = (control.parts || []).find(p => p.name === 'statement');
                if (statementPart) {
                    findParamsInParts(statementPart.parts, []);
                }

                const relatedControls = control.links ? control.links.filter(l => l.rel === 'related').map(l => l.href.substring(1)) : [];

                const isEnhancement = control.props ? control.props.some(p => p.name === 'kind' && p.value === 'enhancement') : false;

                simpleControls.push({
                    id: control.id,
                    title: control.title,
                    parts: control.parts,
                    params: paramMap,
                    fedramp_params: fedrampDefinedParams, // Add the new array
                    related: relatedControls,
                    family: group.title,
                    enhancement: isEnhancement,
                });

                // Upsert the record in our search index map.
                // This ensures the version from the highest baseline is kept.
                const allProse = (control.parts || []).flatMap(p => extractText(p)).join(' ');
                searchIndexMap.set(control.id, {
                    id: control.id,
                    title: control.title,
                    url: `/${baseline.toLowerCase()}/${control.id}/`,
                    content: allProse
                });

                // Generate content file for this specific control and baseline
                const contentDir = path.join('content', baseline.toLowerCase());
                if (!fs.existsSync(contentDir)) {
                    fs.mkdirSync(contentDir, { recursive: true });
                }
                const filePath = path.join(contentDir, `${control.id}.md`);
                const frontMatter = `---
title: "${control.title}"
control_id: "${control.id}"
---
`;
                fs.writeFileSync(filePath, frontMatter);

                if (control.id === 'sc-13') {
                    console.log(`\n--- DEBUG: Indexing content for sc-13 from ${baseline} baseline ---`);
                    console.log(allProse);
                    console.log(`--- END DEBUG ---\n`);
                }
            });
        }
    });

    fs.writeFileSync(outPath, JSON.stringify({ "controls": simpleControls }, null, 2));
});

// After the loop, write the search index to the static directory
const searchIndex = Array.from(searchIndexMap.values());
const staticDir = 'static';
if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir);
}
fs.writeFileSync(path.join(staticDir, 'search.json'), JSON.stringify(searchIndex, null, 2));
console.log(`Generated search index at ${path.join(staticDir, 'search.json')}`);

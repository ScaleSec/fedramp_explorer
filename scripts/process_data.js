const fs = require('fs');
const path = require('path');

const baselines = ['HIGH', 'MODERATE', 'LOW', 'LI-SaaS'];
const searchIndexMap = new Map();

function buildProse(builder, part, availableControls, missingControls, paramMap) {
    if (part.prose) {
        // Expand parameter references and convert markdown links
        let prose = expandParameterReferences(part.prose, paramMap);
        prose = convertMarkdownLinks(prose, availableControls, missingControls);
        builder.push(prose);
    }
    if (part.parts) {
        part.parts.forEach(subPart => buildProse(builder, subPart, availableControls, missingControls, paramMap));
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

function expandParameterReferences(text, paramMap) {
    if (!text || !paramMap) return text;
    
    // Find parameter references like {{ insert: param, ca-03_odp.02 }}
    const paramRegex = /{{ insert: param, (.*?) }}/g;
    
    return text.replace(paramRegex, (match, paramId) => {
        const paramData = paramMap[paramId];
        
        if (!paramData) {
            // If parameter not found, make it organization-defined based on the ID
            const baseId = paramId.replace(/_odp\.?\d*$/, '').replace(/[-_]/g, ' ');
            
            // Special handling for common parameter patterns
            if (paramId.includes('type') || paramId.includes('agreement')) {
                return `[Assignment: organization-defined type of agreement]`;
            } else if (paramId.includes('frequency') || paramId.includes('time')) {
                return `[Assignment: organization-defined frequency]`;
            } else if (paramId.includes('personnel') || paramId.includes('roles')) {
                return `[Assignment: organization-defined personnel or roles]`;
            } else {
                return `[Assignment: organization-defined ${baseId}]`;
            }
        }
        
        if (paramData.constraints) {
            // Parameter has predefined constraints/values
            return `[${paramData.constraints.map(c => c.description).join(', ')}]`;
        } else if (paramData.select) {
            // Parameter has selection choices - recursively expand any nested parameter references
            const expandedChoices = paramData.select.choice.map(choice => 
                expandParameterReferences(choice, paramMap)
            );
            return `[Selection: ${expandedChoices.join(', ')}]`;
        } else if (paramData.guidelines) {
            // Parameter has guidelines - make it an organization-defined assignment
            const guideline = paramData.guidelines.map(g => g.prose).join(' ');
            return `[Assignment: organization-defined ${guideline.toLowerCase()}]`;
        } else {
            // Default to organization-defined assignment
            return `[Assignment: organization-defined ${paramId.replace(/_odp\.?\d*$/, '').replace(/[-_]/g, ' ')}]`;
        }
    });
}

function convertMarkdownLinks(text, availableControls = new Set(), missingControls = new Set()) {
    // This regex finds markdown links like [AC-2](#ac-2), [AC-3(2)](#ac-3(2)), or [CA-6.1](#ca-6.1)
    // and captures the link text (e.g., "AC-2") and the control ID (e.g., "ac-2", "ca-6.1").
    const controlLinkRegex = /\[([^\]]+)\]\(#([a-z]{2}-\d+(?:\.\d+|\(\d+\))?)\)/gi;
    
    // The replacement function converts the link to a relative URL.
    // e.g., from /high/ac-1/, a link to ac-2 becomes ../ac-2/
    return text.replace(controlLinkRegex, (match, linkText, controlId) => {
        const normalizedControlId = controlId.toLowerCase();
        
        if (availableControls.has(normalizedControlId)) {
            // Control exists, create normal link
            return `[${linkText}](../${normalizedControlId}/)`;
        } else {
            // Control doesn't exist, but we'll create a redirect page for it
            missingControls.add(normalizedControlId);
            return `[${linkText}](../${normalizedControlId}/)`;
        }
    });
}

// Recursively processes control parts to convert markdown links in prose
function processPartsForLinks(parts) {
    if (!parts) return;
    parts.forEach(part => {
        if (part.prose) {
            part.prose = convertMarkdownLinks(part.prose);
        }
        if (part.parts) {
            processPartsForLinks(part.parts);
        }
    });
}

// Process baselines, ensuring the highest baseline overwrites lower ones in the search map
['LI-SaaS', 'LOW', 'MODERATE', 'HIGH'].forEach(baseline => {
    const inPath = path.join('data', `FedRAMP_rev5_${baseline}-baseline-resolved-profile_catalog.json`);
    const outPath = path.join('data', `${baseline.toLowerCase()}.json`);

    console.log(`Processing ${inPath} -> ${outPath}`);

    const rawData = fs.readFileSync(inPath);
    const catalog = JSON.parse(rawData);

    const simpleControls = [];
    const availableControls = new Set();
    const missingControls = new Set();

    // First pass: collect all available control IDs
    function collectControlIds(ctrl, parentId = null) {
        availableControls.add(ctrl.id.toLowerCase());
        if (ctrl.controls) {
            ctrl.controls.forEach(nestedControl => {
                collectControlIds(nestedControl, ctrl.id);
            });
        }
    }

    catalog.catalog.groups.forEach(group => {
        if (group.controls) {
            group.controls.forEach(control => {
                collectControlIds(control);
            });
        }
    });

    // Second pass: process controls and create content files
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

                // Recursively process all parts to convert markdown links
                processPartsForLinks(control.parts);


                function processControl(ctrl, parentId = null) {
                    const ctrlParamMap = {};
                    if (ctrl.params) {
                        ctrl.params.forEach(p => {
                            ctrlParamMap[p.id] = p;
                        });
                    }

                    const ctrlFedrampDefinedParams = [];
                    const ctrlParamRegex = /{{ insert: param, (.*?) }}/g;

                    function findParamsInCtrlParts(parts, parentLabels) {
                        if (!parts) return;
                        parts.forEach(part => {
                            const currentLabel = getLabel(part);
                            const newLabels = currentLabel ? [...parentLabels, currentLabel] : parentLabels;

                            if (part.prose) {
                                let match;
                                while ((match = ctrlParamRegex.exec(part.prose)) !== null) {
                                    const paramId = match[1];
                                    const paramData = ctrlParamMap[paramId];

                                    if (paramData && (paramData.constraints || paramData.select)) {
                                        const outlineId = `${ctrl.id.toUpperCase()} (${newLabels.join(')(')})`;
                                        let value = '';
                                        if (paramData.constraints) {
                                            value = `[${paramData.constraints.map(c => c.description).join(', ')}]`;
                                        } else if (paramData.select) {
                                            value = `[Selection: ${paramData.select.choice.join(', ')}]`;
                                        }
                                        const guideline = paramData.guidelines ? paramData.guidelines.map(g => g.prose).join(' ') : '';
                                        ctrlFedrampDefinedParams.push({
                                            outlineId: outlineId,
                                            value: value,
                                            guideline: guideline
                                        });
                                    }
                                }
                            }
                            if (part.parts) {
                                findParamsInCtrlParts(part.parts, newLabels);
                            }
                        });
                    }
                    
                    const ctrlStatementPart = (ctrl.parts || []).find(p => p.name === 'statement');
                    if (ctrlStatementPart) {
                        findParamsInCtrlParts(ctrlStatementPart.parts, []);
                    }

                    processPartsForLinks(ctrl.parts);

                    const ctrlRelatedControls = ctrl.links ? ctrl.links.filter(l => l.rel === 'related').map(l => l.href.substring(1)) : [];
                    const ctrlIsEnhancement = ctrl.class === 'SP800-53-enhancement';

                    simpleControls.push({
                        id: ctrl.id,
                        title: ctrl.title,
                        parts: ctrl.parts,
                        params: ctrlParamMap,
                        fedramp_params: ctrlFedrampDefinedParams,
                        related: ctrlRelatedControls,
                        family: group.title,
                        enhancement: ctrlIsEnhancement,
                        base_control: parentId
                    });

                    // Upsert the record in our search index map.
                    const ctrlAllProse = (ctrl.parts || []).flatMap(p => extractText(p)).join(' ');
                    searchIndexMap.set(ctrl.id, {
                        id: ctrl.id,
                        title: ctrl.title,
                        url: `/${baseline.toLowerCase()}/${ctrl.id}/`,
                        content: ctrlAllProse
                    });

                    // Generate content file for this specific control and baseline
                    const contentDir = path.join('content', baseline.toLowerCase());
                    if (!fs.existsSync(contentDir)) {
                        fs.mkdirSync(contentDir, { recursive: true });
                    }
                    const filePath = path.join(contentDir, `${ctrl.id}.md`);
                    const frontMatter = `---
title: "${ctrl.title}"
control_id: "${ctrl.id}"
${ctrlIsEnhancement ? `base_control: "${parentId || ctrl.id.split('.')[0]}"
enhancement: true` : ''}
---
`;
                    // Build the prose from all parts of the control
                    const proseBuilder = [];
                    if (ctrl.parts) {
                        ctrl.parts.forEach(part => buildProse(proseBuilder, part, availableControls, missingControls, ctrlParamMap));
                    }
                    let prose = proseBuilder.join('\n\n');

                    fs.writeFileSync(filePath, `${frontMatter}\n${prose}`);

                    if (ctrl.id === 'sc-13') {
                        console.log(`\n--- DEBUG: Indexing content for sc-13 from ${baseline} baseline ---`);
                        console.log(ctrlAllProse);
                        console.log(`--- END DEBUG ---\n`);
                    }

                    // Process nested enhancement controls
                    if (ctrl.controls) {
                        ctrl.controls.forEach(nestedControl => {
                            processControl(nestedControl, ctrl.id);
                        });
                    }
                }

                // Process the base control
                processControl(control);
            });
        }
    });

    // Create redirect pages for missing controls
    missingControls.forEach(missingControlId => {
        const contentDir = path.join('content', baseline.toLowerCase());
        const filePath = path.join(contentDir, `${missingControlId}.md`);
        
        // Convert control ID to CSF.tools URL format
        const parts = missingControlId.split(/[-\.]/);
        const family = parts[0]; // e.g., "ca"
        const controlNum = parts[1]; // e.g., "6"
        const enhancementNum = parts[2]; // e.g., "1" (if exists)
        
        let csfUrl = `https://csf.tools/reference/nist-sp-800-53/r5/${family}/${family}-${controlNum}`;
        if (enhancementNum) {
            csfUrl += `/${family}-${controlNum}-${enhancementNum}`;
        }
        
        const frontMatter = `---
title: "Control ${missingControlId.toUpperCase()} - Not Included"
control_id: "${missingControlId}"
layout: "redirect"
---`;
        
        const content = `
This control (${missingControlId.toUpperCase()}) is not included in the ${baseline} baseline.

You can view this control's details at [CSF.tools](${csfUrl}).

[← Back to ${baseline} Controls](../)
`;
        
        fs.writeFileSync(filePath, `${frontMatter}\n${content}`);
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

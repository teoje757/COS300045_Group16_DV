/**
 * Q4: Stacked Bar Chart - Fine Detection Methods by Jurisdiction
 * 
 * DATA GOVERNANCE:
 * - Source: Q4_Camera_vs_police_fines_by_jurisdiction.csv
 * - Data represents aggregated, anonymized traffic enforcement statistics
 * - No personal identifiable information (PII) included
 * - Data used with proper consent for academic research purposes
 * - Storage: Local CSV file, version controlled in Git
 * - Lineage: Sourced from government open data portals (2024)
 * - Security: Public data, no encryption required
 * - Compliance: Follows Australian Privacy Principles (APP)
 * 
 * METADATA:
 * - JURISDICTION: Australian state/territory code (categorical)
 * - Camera issued fines: Count of camera-detected violations (numeric, ≥0)
 * - Police issued fines: Count of police-issued violations (numeric, ≥0)
 * - Total: Sum of camera + police fines (derived field)
 * 
 * BIG IDEA:
 * "Camera-based enforcement dominates in high-population states,
 *  revealing Australia's shift toward automated traffic monitoring."
 */

let allData = [];
let filteredData = [];
let svg, chartGroup, xScale, yScale, colorScale;
let tooltip;
let initialized = false;
let stackMode = 'absolute'; // 'absolute' or 'proportional'
let animationComplete = false;

// Configuration
const config = {
    margin: { top: 40, right: 60, bottom: 80, left: 100 },
    height: 500
};

// Colors for detection methods (categorical color scheme)
const colors = {
    'camera': '#FFAEB4',  // Watermelon - Camera issued fines
    'police': '#BEDEDA'   // Mint - Police issued fines
};

// Stack keys in order (bottom to top)
const stackKeys = ['camera', 'police'];

// Load and process data
async function loadData() {
    try {
        const csvData = await d3.csv('data/Q4_Camera_vs_police_fines_by_jurisdiction.csv');
        
        // Transform data for d3.stack() - keys must match stackKeys array
        allData = csvData.map(d => ({
            jurisdiction: d.JURISDICTION,
            camera: +d['Camera issued fines'] || 0,  // Ensure numeric, default to 0
            police: +d['Police issued fines'] || 0,
            total: (+d['Camera issued fines'] || 0) + (+d['Police issued fines'] || 0)
        }));

        // Sort by total fines descending (storytelling: biggest impact first)
        allData.sort((a, b) => b.total - a.total);
        filteredData = [...allData];

        console.log('Q4 Data loaded:', allData);
        setupFilters();
        setupStackModeToggle();
        createChart();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Setup stack mode toggle (absolute vs proportional)
function setupStackModeToggle() {
    // Create toggle buttons in the controls
    const controlsHeader = document.querySelector('.controls-header');
    
    // Check if toggle already exists
    if (document.getElementById('stack-mode-toggle')) return;
    
    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'stack-mode-toggle';
    toggleContainer.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-left: auto;';
    
    toggleContainer.innerHTML = `
        <button class="stack-mode-btn active" data-mode="absolute">Absolute</button>
        <button class="stack-mode-btn" data-mode="proportional">Proportional</button>
    `;
    
    controlsHeader.appendChild(toggleContainer);
    
    // Add event listeners
    document.querySelectorAll('.stack-mode-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering the filter toggle
            stackMode = this.dataset.mode;
            document.querySelectorAll('.stack-mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            createChart();
        });
    });
}

// Setup filter controls
function setupFilters() {
    if (initialized) return;
    initialized = true;

    // Toggle filters
    const toggleArrow = document.getElementById('toggle-filters');
    const filtersContent = document.getElementById('filters-content');
    const controlsHeader = document.querySelector('.controls-header');
    
    controlsHeader.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isHidden = window.getComputedStyle(filtersContent).display === 'none';
        
        if (isHidden) {
            filtersContent.style.display = 'grid';
            toggleArrow.classList.add('open');
        } else {
            filtersContent.style.display = 'none';
            toggleArrow.classList.remove('open');
        }
    });

    // Jurisdiction checkboxes
    const checkboxes = document.querySelectorAll('.checkbox-label input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Select/Deselect all
    document.getElementById('select-all').addEventListener('click', (e) => {
        e.preventDefault();
        checkboxes.forEach(cb => cb.checked = true);
        applyFilters();
    });

    document.getElementById('deselect-all').addEventListener('click', (e) => {
        e.preventDefault();
        checkboxes.forEach(cb => cb.checked = false);
        applyFilters();
    });
}

function applyFilters() {
    // Get selected jurisdictions
    const selectedJurisdictions = Array.from(
        document.querySelectorAll('.checkbox-label input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    // Filter data
    if (selectedJurisdictions.length === 0) {
        filteredData = [];
    } else {
        filteredData = allData.filter(d => selectedJurisdictions.includes(d.jurisdiction));
    }

    // Recreate chart with filtered data
    createChart();
    // Remove: renderInsightTiles(filteredData);
}

// Create the stacked bar chart
function createChart() {
    // Clear any existing chart
    d3.select('#chart').selectAll('*').remove();

    if (filteredData.length === 0) {
        d3.select('#chart')
            .append('div')
            .style('text-align', 'center')
            .style('padding', '40px')
            .style('color', '#6b7280')
            .text('No jurisdictions selected. Please select at least one jurisdiction from the filters.');
        // Move renderInsightTiles here, after legend (which is empty in this case)
        renderInsightTiles(filteredData);
        return;
    }

    // Get container width
    const container = document.getElementById('chart');
    
    // Ensure container is properly sized
    if (!container.clientWidth || container.clientWidth < 100) {
        // If container not ready, wait a bit and retry
        console.log('Container not ready, retrying...');
        setTimeout(createChart, 50);
        return;
    }
    
    const containerWidth = container.clientWidth;
    const width = containerWidth - config.margin.left - config.margin.right;
    const height = config.height - config.margin.top - config.margin.bottom;

    // Create SVG with proper viewBox
    const svgWidth = containerWidth;
    const svgHeight = config.height;
    
    svg = d3.select('#chart')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    chartGroup = svg.append('g')
        .attr('transform', `translate(${config.margin.left}, ${config.margin.top})`);

    // Create scales
    xScale = d3.scaleBand()
        .domain(filteredData.map(d => d.jurisdiction))
        .range([0, width])
        .padding(0.3);

    // Y-scale depends on stack mode
    let maxTotal;
    if (stackMode === 'proportional') {
        // Proportional: always 0-100%
        maxTotal = 100;
    } else {
        // Absolute: use actual max total
        maxTotal = d3.max(filteredData, d => d.total);
    }
    
    yScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.1])  // 10% buffer for labels
        .range([height, 0]);

    // Add axes
    const xAxis = chartGroup.append('g')
        .attr('class', 'x-axis axis')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    const yAxisFormat = stackMode === 'proportional' ? d => d + '%' : d => d3.format('.2s')(d);
    const yAxis = chartGroup.append('g')
        .attr('class', 'y-axis axis')
        .call(d3.axisLeft(yScale)
            .ticks(8)
            .tickFormat(yAxisFormat)
        );

    // Y-axis label
    const yAxisLabel = stackMode === 'proportional' 
        ? 'Percentage of Total Fines (%)' 
        : 'Number of Fines';
    
    chartGroup.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -60)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#4a5568')
        .style('font-weight', '500')
        .text(yAxisLabel);

    // X-axis label
    chartGroup.append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#4a5568')
        .style('font-weight', '500')
        .text('Jurisdiction');

    // Create tooltip
    tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip');

    // Draw stacked bars using d3.stack()
    drawStackedBars(width, height);

    // Create legend
    createLegend();

    // Now render insight tiles after legend is rendered and DOM is ready
    renderInsightTiles(filteredData);

    // Add click handler to SVG to reset selection when clicking empty space
    svg.on('click', function(event) {
        // Clicking empty space resets to show all data
        if (event.target.tagName === 'svg') {
            resetAllFilters();
        }
    });
}

function resetAllFilters() {
    // Reset jurisdiction checkboxes
    document.querySelectorAll('.checkbox-label input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    applyFilters();
}

/**
 * drawStackedBars - Creates stacked bar chart using d3.stack()
 * Supports both absolute and proportional (100%) modes
 */
function drawStackedBars(width, height) {
    // Prepare data for proportional mode if needed
    let dataForStack = filteredData;
    
    if (stackMode === 'proportional') {
        // Convert to percentages
        dataForStack = filteredData.map(d => ({
            jurisdiction: d.jurisdiction,
            camera: d.total > 0 ? (d.camera / d.total) * 100 : 0,
            police: d.total > 0 ? (d.police / d.total) * 100 : 0,
            // Keep original values for tooltips and label calculations
            _cameraAbs: d.camera,
            _policeAbs: d.police,
            _total: d.total
        }));
    } else {
        // In absolute mode, also store metadata for label calculations
        dataForStack = filteredData.map(d => ({
            jurisdiction: d.jurisdiction,
            camera: d.camera,
            police: d.police,
            total: d.total,
            _cameraAbs: d.camera,
            _policeAbs: d.police,
            _total: d.total
        }));
    }
    
    // Create stack generator - THIS IS THE REQUIRED d3.stack() USAGE
    const stack = d3.stack()
        .keys(stackKeys)  // ['camera', 'police'] - bottom to top order
        .order(d3.stackOrderNone)  // Maintain order as specified in keys
        .offset(d3.stackOffsetNone);  // No offset, zero baseline

    // Generate stacked data
    const series = stack(dataForStack);
    
    console.log('Stacked series:', series);  // For debugging
    
    // Reset animation flag
    animationComplete = false;
    
    // Create bar groups for each detection method (camera, police)
    const groups = chartGroup.selectAll('.stack-layer')
        .data(series)
        .join('g')
        .attr('class', d => `stack-layer layer-${d.key}`)
        .attr('fill', d => colors[d.key]);
    
    // Create rectangles for each jurisdiction within each layer
    const rects = groups.selectAll('rect')
        .data(d => d, d => d.data.jurisdiction)
        .join('rect')
            .attr('class', 'bar-segment')
            .attr('x', d => xScale(d.data.jurisdiction))
            .attr('width', xScale.bandwidth())
            .style('cursor', 'pointer')
            // Start from bottom for animation
            .attr('y', height)
            .attr('height', 0)
            // Add interactivity
            .on('mouseover', function(event, d) {
                d3.select(this).style('filter', 'brightness(1.1)');
                const key = d3.select(this.parentNode).datum().key;
                showTooltip(event, d.data, key);
            })
            .on('mouseout', function() {
                d3.select(this).style('filter', 'none');
                hideTooltip();
            })
            .on('click', function(event) {
                event.stopPropagation();
                // Focus on this detection method
                const key = d3.select(this.parentNode).datum().key;
                filterByDetectionMethod(key);
            });
    
    // Animate bars growing from bottom to their positions
    rects
        .transition()
        .duration(800)
        .delay((d, i) => i * 80)
        .ease(d3.easeCubicOut)
        .attr('y', d => yScale(d[1]))  // d[1] is the top of the stack segment
        .attr('height', d => yScale(d[0]) - yScale(d[1]))  // d[0] is the bottom
        .on('end', function(d, i) {
            // Set flag when last bar finishes
            if (i === dataForStack.length - 1) {
                animationComplete = true;
            }
        });
    
    // Add value labels on top of each stack
    chartGroup.selectAll('.total-label').remove();  // Clear old labels
    
    chartGroup.selectAll('.total-label')
        .data(dataForStack)
        .join('text')
            .attr('class', 'total-label')
            .attr('x', d => xScale(d.jurisdiction) + xScale.bandwidth() / 2)
            .attr('y', d => {
                if (stackMode === 'proportional') {
                    return yScale(100) - 5;
                } else {
                    const total = d.total || (d.camera + d.police);
                    return yScale(total) - 5;
                }
            })
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .style('fill', '#374151')
            .style('opacity', 0)
            .text(d => {
                if (stackMode === 'proportional') {
                    return '100%';
                } else {
                    const total = d.total || (d.camera + d.police);
                    return d3.format('.2s')(total);
                }
            })
            .transition()
            .duration(600)
            .delay((d, i) => i * 80 + 800)
            .style('opacity', 1)
            .on('end', function(d, i) {
                // After animation completes, update labels to show correct formatting
                if (i === dataForStack.length - 1) {
                    setTimeout(() => updateTotalLabels(), 100);
                }
            });
    
    // Add hover effects to bar groups
    const barGroups = chartGroup.selectAll('.bar-group-hover')
        .data(dataForStack)
        .join('g')
            .attr('class', 'bar-group-hover')
            .attr('transform', d => `translate(${xScale(d.jurisdiction)}, 0)`)
            .style('pointer-events', 'none')
            .on('mouseenter', function(event, d) {
                // Highlight this jurisdiction's bars
                d3.selectAll(`.bar-segment`)
                    .filter(barD => barD.data.jurisdiction !== d.jurisdiction)
                    .transition()
                    .duration(200)
                    .style('opacity', 0.4);
            })
            .on('mouseleave', function() {
                // Reset all bars
                d3.selectAll(`.bar-segment`)
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });
}

function showTooltip(event, data, key) {
    // Extract values - handle both absolute and proportional modes
    const isProportional = stackMode === 'proportional';
    const cameraValue = isProportional ? data._cameraAbs : data.camera;
    const policeValue = isProportional ? data._policeAbs : data.police;
    const totalValue = isProportional ? data._total : data.total || (data.camera + data.police);
    
    const value = key === 'camera' ? cameraValue : policeValue;
    const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
    
    const methodLabel = key === 'camera' ? 'Camera issued fines' : 'Police issued fines';
    const color = colors[key];
    
    tooltip.html(`
        <div class="tooltip-title">${data.jurisdiction}</div>
        <div class="tooltip-item">
            <div class="tooltip-color" style="background: ${color}"></div>
            <span>${methodLabel}: <span class="tooltip-value">${d3.format(',')(value)}</span> (${percentage}%)</span>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2);">
            <strong>Total: ${d3.format(',')(totalValue)}</strong>
        </div>
    `)
    .style('left', (event.pageX + 15) + 'px')
    .style('top', (event.pageY - 10) + 'px')
    .classed('visible', true);
}

function hideTooltip() {
    tooltip.classed('visible', false);
}

function filterByDetectionMethod(key) {
    if (!animationComplete) return;  // Prevent clicks during animation
    
    // This could filter data or highlight - for now, just show in console
    console.log(`Filtering by detection method: ${key}`);
    
    // You could implement actual filtering here if needed
    // For now, we'll just provide visual feedback via the tooltip
}

function createLegend() {
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();

    const methods = [
        { key: 'camera', label: 'Camera issued fines' },
        { key: 'police', label: 'Police issued fines' }
    ];

    methods.forEach(method => {
        const item = legend.append('div')
            .attr('class', 'legend-item')
            .style('cursor', 'pointer')
            .on('click', function() {
                if (!animationComplete) return; // Prevent clicks during animation
                
                // Toggle visibility of this detection method
                const layers = chartGroup.selectAll(`.layer-${method.key}`);
                const isCurrentlyVisible = layers.style('opacity') !== '0';
                
                if (isCurrentlyVisible) {
                    // Hide this layer
                    layers.transition().duration(300).style('opacity', 0);
                    d3.select(this).classed('inactive', true);
                } else {
                    // Show this layer
                    layers.transition().duration(300).style('opacity', 1);
                    d3.select(this).classed('inactive', false);
                }
                
                // Update total labels based on what's visible
                setTimeout(() => updateTotalLabels(), 350);
            });

        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', colors[method.key]);

        item.append('span')
            .attr('class', 'legend-text')
            .text(method.label);
    });
}

// Update total labels based on visible layers
function updateTotalLabels() {
    const cameraVisible = chartGroup.selectAll('.layer-camera').style('opacity') !== '0';
    const policeVisible = chartGroup.selectAll('.layer-police').style('opacity') !== '0';
    
    chartGroup.selectAll('.total-label')
        .transition()
        .duration(300)
        .text(function() {
            const d = d3.select(this).datum();
            
            if (stackMode === 'proportional') {
                // In proportional mode, show percentage of visible components
                if (cameraVisible && policeVisible) {
                    return '100%';
                } else if (cameraVisible) {
                    const cameraPct = d._total > 0 ? (d._cameraAbs / d._total * 100) : 0;
                    // Hide .0 decimals
                    return (cameraPct % 1 === 0 ? cameraPct.toFixed(0) : cameraPct.toFixed(1)) + '%';
                } else if (policeVisible) {
                    const policePct = d._total > 0 ? (d._policeAbs / d._total * 100) : 0;
                    // Hide .0 decimals
                    return (policePct % 1 === 0 ? policePct.toFixed(0) : policePct.toFixed(1)) + '%';
                } else {
                    return '';
                }
            } else {
                // In absolute mode, show sum of visible components
                let total = 0;
                if (cameraVisible) total += d.camera;
                if (policeVisible) total += d.police;
                return total > 0 ? d3.format('.2s')(total) : '';
            }
        })
        .attr('y', function() {
            const d = d3.select(this).datum();
            
            // Calculate the top position based on visible layers
            if (stackMode === 'proportional') {
                // In proportional mode, find the highest visible segment top
                let maxY = 0;
                
                if (cameraVisible && policeVisible) {
                    // Both visible - top is always 100%
                    maxY = 100;
                } else if (cameraVisible && !policeVisible) {
                    // Only camera visible - find camera segment top
                    const cameraPct = d._total > 0 ? (d._cameraAbs / d._total * 100) : 0;
                    maxY = cameraPct;
                } else if (policeVisible && !cameraVisible) {
                    // Only police visible - police segment top is always 100%
                    maxY = 100;
                } else {
                    maxY = 0;
                }
                
                return yScale(maxY) - 5;
            } else {
                // In absolute mode, find the highest visible segment top
                let maxY = 0;
                
                if (cameraVisible && policeVisible) {
                    // Both visible - top is total of both
                    maxY = d.camera + d.police;
                } else if (cameraVisible && !policeVisible) {
                    // Only camera visible - top is camera value
                    maxY = d.camera;
                } else if (policeVisible && !cameraVisible) {
                    // Only police visible - top is total (police segment goes to full height)
                    maxY = d.camera + d.police;
                } else {
                    maxY = 0;
                }
                
                return yScale(maxY) - 5;
            }
        });
}

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (filteredData.length > 0) {
            createChart();
        }
    }, 250);
});

// Add click handler to document to reset selection when clicking outside
document.addEventListener('click', (event) => {
    // Check if click is on a bar or legend
    const isBar = event.target.classList.contains('bar-segment');
    const isLegend = event.target.closest('#legend');
    
    if (!isBar && !isLegend) {
        resetSelection();
    }
});

// Add ESC key handler to reset selection
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        resetSelection();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
        setTimeout(loadData, 100);
    });
});

// Backup initialization on full load
window.addEventListener('load', () => {
    if (!allData || allData.length === 0) {
        requestAnimationFrame(() => {
            setTimeout(loadData, 50);
        });
    }
});

// --- INSIGHT TILES COMPONENT ---
let insightTilesFadeTimeout = null;
function renderInsightTiles(data) {
    let container = document.getElementById('insight-tiles');
    if (!container) {
        setTimeout(() => renderInsightTiles(data), 100);
        return;
    }

    // Fade out old tiles
    if (insightTilesFadeTimeout) clearTimeout(insightTilesFadeTimeout);
    container.classList.remove('insight-fade-in');
    container.classList.add('insight-fade-out');

    insightTilesFadeTimeout = setTimeout(() => {
        // --- DATA LOGIC ---
        // 1. Top Jurisdiction
        let topJur = null;
        let topJurTotal = 0;
        if (data.length > 0) {
            topJur = data.reduce((a, b) => (a.total > b.total ? a : b));
            topJurTotal = topJur.total;
        }

        // 2. Camera vs Police Balance (percentages, all selected)
        let totalCamera = 0, totalPolice = 0, totalAll = 0;
        data.forEach(d => {
            totalCamera += d.camera;
            totalPolice += d.police;
            totalAll += d.total;
        });
        let pctCamera = totalAll > 0 ? (totalCamera / totalAll * 100) : 0;
        let pctPolice = totalAll > 0 ? (totalPolice / totalAll * 100) : 0;

        // 3. Distribution Pattern: count states with >25% police fines
        const policeHeavyStates = data.filter(d => d.total > 0 && (d.police / d.total) > 0.25);
        const policeHeavyCount = policeHeavyStates.length;

        // 4. High-Level Trend Summary (narrative, not numbers)
        let trendSummary = '';
        if (data.length === 0) {
            trendSummary = 'No data selected.';
        } else if (pctPolice > 70 && policeHeavyCount === data.length) {
            trendSummary = 'Enforcement is broadly uniform across Australia, but dominated by police rather than automated cameras in the current selection.';
        } else if (pctCamera > 70) {
            trendSummary = 'Automated camera enforcement dominates in the current selection.';
        } else if (policeHeavyCount > 1 && pctPolice > 60) {
            trendSummary = 'Most jurisdictions rely on police for enforcement, with little camera presence.';
        } else if (pctCamera > 40 && pctCamera < 60) {
            trendSummary = 'Enforcement is balanced between cameras and police.';
        } else {
            trendSummary = 'Enforcement patterns are mixed across selected jurisdictions.';
        }

        // --- ICONS (SVG, monochrome/pastel, minimal) ---
        const icons = {
            trophy: `<svg width="32" height="32" fill="none" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#f7b731" fill-opacity="0.12"/><path d="M16 21c3.314 0 6-2.686 6-6V8H10v7c0 3.314 2.686 6 6 6Zm0 0v3m-4 0h8" stroke="#f7b731" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            camera: `<svg width="32" height="32" fill="none" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#FFAEB4" fill-opacity="0.13"/><rect x="8" y="12" width="16" height="10" rx="3" stroke="#FFAEB4" stroke-width="1.6"/><circle cx="16" cy="17" r="3" stroke="#FFAEB4" stroke-width="1.6"/><rect x="13" y="9" width="6" height="3" rx="1.5" stroke="#FFAEB4" stroke-width="1.6"/></svg>`,
            police: `<svg width="32" height="32" fill="none" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#BEDEDA" fill-opacity="0.13"/><path d="M16 8l7 4v3c0 5.523-3.134 10-7 10s-7-4.477-7-10v-3l7-4Z" stroke="#BEDEDA" stroke-width="1.6"/><circle cx="16" cy="17" r="2" stroke="#BEDEDA" stroke-width="1.6"/></svg>`,
            trend: `<svg width="32" height="32" fill="none" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#4a5f7f" fill-opacity="0.10"/><path d="M8 20l5-5 4 4 7-7" stroke="#4a5f7f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="20" r="1.5" fill="#4a5f7f"/><circle cx="13" cy="15" r="1.5" fill="#4a5f7f"/><circle cx="17" cy="19" r="1.5" fill="#4a5f7f"/><circle cx="24" cy="12" r="1.5" fill="#4a5f7f"/></svg>`
        };

        // --- HTML ---
        container.innerHTML = `
            <div class="insight-tile">
                <div class="insight-icon trophy">${icons.trophy}</div>
                <div class="insight-title-row">
                    <span class="insight-title">Top Jurisdiction</span>
                </div>
                <div class="insight-value">${topJur ? topJur.jurisdiction : '—'}</div>
                <div class="insight-desc">${topJur ? d3.format('.2s')(topJurTotal) + ' total fines' : ''}</div>
                <div class="insight-desc" style="font-size:0.97rem;color:#6B7280;margin-top:4px;">Highest enforcement volume</div>
            </div>
            <div class="insight-tile">
                <div class="insight-icon camera">${icons.camera}</div>
                <div class="insight-title-row">
                    <span class="insight-dot camera"></span>
                    <span class="insight-dot police"></span>
                    <span class="insight-title">Camera vs Police Balance</span>
                </div>
                <div class="insight-value camera" style="font-size:1.1rem;">
                    Camera: ${isNaN(pctCamera) ? '—' : pctCamera.toFixed(1) + '%'}<br>
                    Police: ${isNaN(pctPolice) ? '—' : pctPolice.toFixed(1) + '%'
                }</div>
                <div class="insight-desc" style="font-size:0.97rem;color:#6B7280;margin-top:4px;">
                    Enforcement is police-heavy among selected data
                </div>
            </div>
            <div class="insight-tile">
                <div class="insight-icon police">${icons.police}</div>
                <div class="insight-title-row">
                    <span class="insight-dot police"></span>
                    <span class="insight-title">Distribution Pattern</span>
                </div>
                <div class="insight-value police">${policeHeavyCount} state${policeHeavyCount === 1 ? '' : 's'}</div>
                <div class="insight-desc">${policeHeavyCount === 1
                    ? 'with >25% police fines'
                    : 'with >25% police fines'
                }</div>
                <div class="insight-desc" style="font-size:0.97rem;color:#6B7280;margin-top:4px;">
                    Police enforcement is high across nearly all jurisdictions
                </div>
            </div>
            <div class="insight-tile">
                <div class="insight-icon trend">${icons.trend}</div>
                <div class="insight-title-row">
                    <span class="insight-title">High-Level Trend Summary</span>
                </div>
                <div class="insight-desc" style="font-size:1.05rem;font-weight:500;">
                    ${trendSummary}
                </div>
            </div>
        `;

        // Fade in new tiles
        container.classList.remove('insight-fade-out');
        // Force reflow for transition
        void container.offsetWidth;
        container.classList.add('insight-fade-in');
    }, 150);
}

/**
 * Q3: Jurisdiction Comparison - Mobile Phone Enforcement Rates
 * Horizontal Bar Chart (Sorted Descending)
 * 
 * DATA GOVERNANCE:
 * - Source: Q3_Fines_per_10k_by_jurisdiction.csv
 * - Data represents aggregated, anonymized traffic enforcement statistics
 * - No personal identifiable information (PII) included
 * - Data used with proper consent for academic research purposes
 * - Storage: Local CSV file, version controlled in Git
 * - Lineage: Sourced from government open data portals (2010-2024)
 * - Security: Public data, no encryption required
 * - Compliance: Follows Australian Privacy Principles (APP)
 * 
 * METADATA:
 * - YEAR: Calendar year (numeric, 2010-2024)
 * - JURISDICTION: Australian state/territory code (categorical: NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
 * - Sum(FINES): Total count of mobile phone fines issued (numeric, ≥0)
 * - Licenses: Number of driver licenses in jurisdiction (numeric, >0)
 * - Fines per 10K: Enforcement rate per 10,000 licenses (derived: FINES/Licenses * 10000)
 * 
 * BIG IDEA:
 * "ACT leads Australia in mobile phone enforcement intensity,
 *  revealing stark regional differences in detection capability and policy priorities."
 * 
 * NARRATIVE ARC:
 * - Context: Mobile phone use while driving is a major road safety issue
 * - Conflict: Enforcement rates vary 10x across jurisdictions
 * - Insight: Technology investment and policy focus drive the disparity
 */

// Configuration
const config = {
    margin: { top: 40, right: 80, bottom: 60, left: 120 },
    height: 600
};

// Color scheme for jurisdictions - simple professional colors with good contrast
const colorScale = {
    'NSW': '#1e3a8a',      // Deep blue
    'VIC': '#f59e0b',      // Amber
    'QLD': '#10b981',      // Green
    'WA': '#ef4444',       // Red
    'SA': '#8b5cf6',       // Purple
    'TAS': '#06b6d4',      // Cyan
    'ACT': '#ec4899',      // Pink
    'NT': '#6b7280'        // Gray
};

// State management
let data = [];
let filteredData = [];
let activeJurisdictions = new Set(Object.keys(colorScale));
let yearRange = { start: 2010, end: 2024 };
let isAnimating = false;
let isFirstRender = true;

// Scales and axes
let xScale, yScale, svg, tooltip, chartGroup;

// Track if already initialized
let initialized = false;

// Initialize the visualization
function init() {
    if (initialized) {
        console.log('Already initialized, skipping...');
        return;
    }
    initialized = true;
    console.log('Initializing visualization...');
    createTooltip();
    loadData();
    setupEventListeners();
}

// Create tooltip element
function createTooltip() {
    tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

// Load and parse data
function loadData() {
    // Try different path variations
    const possiblePaths = [
        'data/Q3_Fines_per_10k_by_jurisdiction.csv',
        '../data/Q3_Fines_per_10k_by_jurisdiction.csv',
        './data/Q3_Fines_per_10k_by_jurisdiction.csv'
    ];

    let currentPathIndex = 0;

    function tryLoadData() {
        const path = possiblePaths[currentPathIndex];
        console.log('Trying to load data from:', path);

        d3.csv(path).then(rawData => {
            console.log('Data loaded successfully:', rawData.length, 'rows');
            
            if (rawData.length === 0) {
                throw new Error('CSV file is empty');
            }

            // Parse the data
            data = rawData.map(d => ({
                year: +d.YEAR,
                jurisdiction: d.JURISDICTION,
                fines: +d['Sum(FINES)'],
                licenses: +d.Licenses,
                finesPer10k: +d['Fines per 10K']
            }));

            console.log('Parsed data:', data.length, 'records');
            console.log('Sample data:', data[0]);

            // Initial filter
            filterData();
            updateDynamicTitle();
            createChart();
            createLegend();
        }).catch(error => {
            console.error('Error loading data from', path, ':', error);
            currentPathIndex++;
            
            if (currentPathIndex < possiblePaths.length) {
                tryLoadData();
            } else {
                d3.select('#chart').html(`
                    <div style="padding: 40px; text-align: center;">
                        <h3 style="color: #d62728;">Error Loading Data</h3>
                        <p style="color: #666; margin: 20px 0;">Could not load the CSV file. Please check:</p>
                        <ul style="text-align: left; max-width: 500px; margin: 0 auto; color: #666;">
                            <li>File exists at: <code>data/Q3_Fines_per_10k_by_jurisdiction.csv</code></li>
                            <li>File path is correct relative to q3.html</li>
                            <li>Browser console for detailed error messages</li>
                        </ul>
                        <p style="margin-top: 20px; color: #999;">Error: ${error.message}</p>
                    </div>
                `);
            }
        });
    }

    tryLoadData();
}

// Filter data based on current selections
function filterData() {
    filteredData = data.filter(d => 
        activeJurisdictions.has(d.jurisdiction) &&
        d.year >= yearRange.start &&
        d.year <= yearRange.end
    );
}

// Create the chart
function createChart() {
    // Clear existing chart and stop any ongoing transitions
    d3.select('#chart').selectAll('*').interrupt().remove();

    if (!filteredData || filteredData.length === 0) {
        d3.select('#chart').html('<p style="text-align: center; padding: 40px; color: #999;">No data to display. Try adjusting the filters.</p>');
        return;
    }

    // Calculate dimensions - fully responsive
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

    console.log('Creating chart with dimensions:', width, 'x', height, 'containerWidth:', containerWidth);

    // Create SVG - responsive with proper viewBox
    const svgWidth = containerWidth;
    const svgHeight = config.height;
    
    svg = d3.select('#chart')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMinYMid meet')
        .style('display', 'block')
        .style('max-width', '100%');

    chartGroup = svg.append('g')
        .attr('transform', `translate(${config.margin.left},${config.margin.top})`);

    // Group and aggregate data by jurisdiction
    const isSingleYear = yearRange.start === yearRange.end;
    const jurisdictionData = Array.from(
        d3.group(filteredData, d => d.jurisdiction),
        ([jurisdiction, values]) => {
            const avgValue = isSingleYear && values.length === 1 
                ? values[0].finesPer10k 
                : d3.mean(values, d => d.finesPer10k);
            
            return {
                jurisdiction,
                avgFinesPer10k: avgValue || 0,
                totalFines: d3.sum(values, d => d.fines),
                dataPoints: values.length,
                yearRange: `${d3.min(values, d => d.year)}-${d3.max(values, d => d.year)}`,
                isSingleYear: isSingleYear
            };
        }
    ).sort((a, b) => b.avgFinesPer10k - a.avgFinesPer10k);

    console.log('Aggregated data:', jurisdictionData);

    // Create scales for horizontal bar chart
    const maxValue = d3.max(jurisdictionData, d => d.avgFinesPer10k) || 100;

    xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.15])
        .range([0, width]);

    yScale = d3.scaleBand()
        .domain(jurisdictionData.map(d => d.jurisdiction))
        .range([0, height])
        .padding(0.3);

    // Add grid
    chartGroup.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.3)
        .call(d3.axisBottom(xScale)
            .tickSize(height)
            .tickFormat('')
        );

    // Add X axis - fewer ticks on small screens
    const tickCount = containerWidth < 480 ? 5 : (containerWidth < 768 ? 7 : 10);
    chartGroup.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(tickCount));

    // Add Y axis
    chartGroup.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(yScale));

    // Add axis labels
    const xAxisLabel = isSingleYear 
        ? 'Fines per 10,000 Licenses' 
        : 'Average Fines per 10,000 Licenses';
    
    chartGroup.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .style('font-size', '14px')
        .style('fill', '#666')
        .style('font-weight', 'bold')
        .text(xAxisLabel);

    chartGroup.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -55)
        .style('font-size', '14px')
        .style('fill', '#666')
        .style('font-weight', 'bold')
        .text('Jurisdiction');

    // Draw bars
    drawBars(jurisdictionData);
    
    // Add annotation for highest value (storytelling: highlight the outlier)
    if (jurisdictionData.length > 0 && jurisdictionData.length > 1) {
        const highest = jurisdictionData[0];  // Already sorted descending
        const annotationY = yScale(highest.jurisdiction) + yScale.bandwidth() / 2;
        
        const annotation = chartGroup.append('g')
            .attr('class', 'annotation')
            .style('opacity', 0);
        
        // Position annotation above the bar instead of to the right
        annotation.append('text')
            .attr('x', xScale(highest.avgFinesPer10k / 2))
            .attr('y', annotationY - yScale.bandwidth() - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#2c3e50')
            .style('font-weight', '600')
            .text(`↑ Highest: ${highest.jurisdiction} (${highest.avgFinesPer10k.toFixed(1)})`);
        
        // Fade in annotation after bars animate
        annotation
            .transition()
            .delay(1500)
            .duration(800)
            .style('opacity', 0.8);
    }
}

// Draw horizontal bars
function drawBars(jurisdictionData) {
    const maxValue = d3.max(jurisdictionData, d => d.avgFinesPer10k);

    const bars = chartGroup.selectAll('.bar')
        .data(jurisdictionData)
        .enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('data-jurisdiction', d => d.jurisdiction);

    // Main bar - simple and clean
    const mainBars = bars.append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.jurisdiction))
        .attr('height', yScale.bandwidth())
        .attr('width', isFirstRender ? 0 : d => xScale(d.avgFinesPer10k))
        .attr('fill', d => colorScale[d.jurisdiction])
        .attr('rx', 4)
        .attr('ry', 4)
        .style('cursor', 'pointer')
        .style('opacity', 0.85);

    // Animate bars only on first render
    if (isFirstRender) {
        isAnimating = true;
        mainBars
            .transition()
            .duration(1000)
            .delay((d, i) => i * 80)
            .ease(d3.easeCubicOut)
            .attr('width', d => xScale(d.avgFinesPer10k))
            .on('end', function(d, i) {
                // Force final width to ensure it reaches exactly the right position
                d3.select(this).attr('width', xScale(d.avgFinesPer10k));
                // Clear animation flag when last bar finishes
                if (i === jurisdictionData.length - 1) {
                    isAnimating = false;
                    isFirstRender = false;
                }
            });
    } else {
        // No animation on subsequent renders - instant display
        isAnimating = false;
    }

    // Add value labels at the end of bars
    bars.append('text')
        .attr('class', 'value-label')
        .attr('x', d => xScale(d.avgFinesPer10k) + 8)
        .attr('y', d => yScale(d.jurisdiction) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', '#374151')
        .style('opacity', 0)
        .text(d => d.isSingleYear ? Math.round(d.avgFinesPer10k) : d.avgFinesPer10k.toFixed(1))
        .transition()
        .duration(600)
        .delay((d, i) => i * 80 + 1000)
        .style('opacity', 1);



    // Interactive features
    bars.on('mouseover', function(event, d) {
        const currentBar = d3.select(this);
        
        // Highlight this bar
        currentBar.select('.bar')
            .transition()
            .duration(200)
            .style('opacity', 1)
            .attr('height', yScale.bandwidth() * 1.15)
            .attr('y', yScale(d.jurisdiction) - yScale.bandwidth() * 0.075);
        
        currentBar.select('.bar-shine')
            .transition()
            .duration(200)
            .attr('height', yScale.bandwidth() * 1.15)
            .attr('y', yScale(d.jurisdiction) - yScale.bandwidth() * 0.075);

        // Dim other bars
        bars.filter(bar => bar.jurisdiction !== d.jurisdiction)
            .selectAll('.bar, .bar-shine')
            .transition()
            .duration(200)
            .style('opacity', 0.3);

        showTooltip(event, d);
    })
    .on('mouseout', function(event, d) {
        // Reset all bars
        bars.selectAll('.bar')
            .transition()
            .duration(200)
            .style('opacity', 0.95)
            .attr('height', yScale.bandwidth())
            .attr('y', bar => yScale(bar.jurisdiction));

        bars.selectAll('.bar-shine')
            .transition()
            .duration(200)
            .attr('height', yScale.bandwidth())
            .attr('y', bar => yScale(bar.jurisdiction));

        hideTooltip();
    })
    .on('click', function(event, d) {
        // Focus on this jurisdiction only
        event.stopPropagation();
        if (isAnimating) return; // Prevent clicks during animation
        focusJurisdiction(d.jurisdiction);
    });
}

// Show tooltip
function showTooltip(event, d) {
    tooltip.transition()
        .duration(200)
        .style('opacity', 0.95);
    
    const isSingleYear = yearRange.start === yearRange.end;
    const finesLabel = isSingleYear ? 'Fines per 10K:' : 'Avg Fines per 10K:';
    
    tooltip.html(`
        <strong style="font-size: 16px; color: ${colorScale[d.jurisdiction]}">${d.jurisdiction}</strong><br/>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            <strong>${finesLabel}</strong> ${d.avgFinesPer10k.toFixed(1)}<br/>
            <strong>Total Fines:</strong> ${d.totalFines.toLocaleString()}<br/>
            <strong>Year Range:</strong> ${d.yearRange}
        </div>
    `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
}

// Hide tooltip
function hideTooltip() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

// Create legend
function createLegend() {
    const legendContainer = d3.select('#legend');
    legendContainer.selectAll('*').remove();

    Object.entries(colorScale).forEach(([jurisdiction, color]) => {
        const item = legendContainer.append('div')
            .attr('class', 'legend-item')
            .classed('inactive', !activeJurisdictions.has(jurisdiction))
            .style('cursor', 'pointer')
            .on('click', (event) => {
                event.stopPropagation();
                if (isAnimating) return; // Prevent clicks during animation
                focusJurisdiction(jurisdiction);
            });

        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', color);

        item.append('span')
            .attr('class', 'legend-label')
            .text(jurisdiction);
    });
}

// Focus on a single jurisdiction (show only this one)
function focusJurisdiction(jurisdiction) {
    // Uncheck all jurisdictions
    const allCheckboxes = document.querySelectorAll('.jurisdiction-checkbox input');
    allCheckboxes.forEach(cb => {
        cb.checked = false;
    });
    
    // Check only the selected jurisdiction
    const targetCheckbox = document.querySelector(`.jurisdiction-checkbox input[data-jurisdiction="${jurisdiction}"]`);
    if (targetCheckbox) {
        targetCheckbox.checked = true;
    }
    
    // Update active jurisdictions set
    activeJurisdictions.clear();
    activeJurisdictions.add(jurisdiction);
    
    // Update the chart
    updateChart();
}

// Reset selection to show all jurisdictions
function resetSelection() {
    if (isAnimating) return; // Prevent reset during animation
    
    // Check all jurisdictions
    const allCheckboxes = document.querySelectorAll('.jurisdiction-checkbox input');
    allCheckboxes.forEach(cb => {
        cb.checked = true;
    });
    
    // Update active jurisdictions set
    activeJurisdictions = new Set(Object.keys(colorScale));
    
    // Update the chart
    updateChart();
}

// Toggle jurisdiction visibility
function toggleJurisdiction(jurisdiction) {
    const checkbox = document.querySelector(`.jurisdiction-checkbox input[data-jurisdiction="${jurisdiction}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    }
}

// Update chart with current filters
function updateChart() {
    filterData();
    updateDynamicTitle();
    createChart();
    createLegend();
}

// Update dynamic title based on current filters
function updateDynamicTitle() {
    const titleElement = document.getElementById('dynamic-title');
    const subtitleElement = document.getElementById('dynamic-subtitle');
    
    // Year range text
    const yearText = yearRange.start === yearRange.end 
        ? `${yearRange.start}` 
        : `${yearRange.start}-${yearRange.end}`;
    
    // Jurisdiction text
    const numJurisdictions = activeJurisdictions.size;
    const totalJurisdictions = Object.keys(colorScale).length;
    
    let jurisdictionText = '';
    if (numJurisdictions === 0) {
        jurisdictionText = 'No jurisdictions selected';
    } else if (numJurisdictions === totalJurisdictions) {
        jurisdictionText = 'All jurisdictions';
    } else if (numJurisdictions === 1) {
        jurisdictionText = Array.from(activeJurisdictions)[0];
    } else if (numJurisdictions <= 3) {
        jurisdictionText = Array.from(activeJurisdictions).join(', ');
    } else {
        jurisdictionText = `${numJurisdictions} jurisdictions`;
    }
    
    // Update title without year range
    titleElement.textContent = `Fines per 10,000 Driver Licenses by Jurisdiction`;
    
    // Update subtitle with jurisdiction and year range
    subtitleElement.textContent = `${jurisdictionText} • ${yearText}`;
}

// Setup event listeners
function setupEventListeners() {
    // Jurisdiction checkboxes - prevent click from bubbling to document
    document.querySelectorAll('.jurisdiction-checkbox').forEach(label => {
        label.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
    
    // Jurisdiction checkboxes
    document.querySelectorAll('.jurisdiction-checkbox input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const jurisdiction = e.target.dataset.jurisdiction;
            console.log('Checkbox changed:', jurisdiction, 'checked:', e.target.checked);
            if (e.target.checked) {
                activeJurisdictions.add(jurisdiction);
            } else {
                activeJurisdictions.delete(jurisdiction);
            }
            console.log('Active jurisdictions:', Array.from(activeJurisdictions));
            updateChart();
        });
    });

    // Select all button
    document.getElementById('select-all').addEventListener('click', (e) => {
        e.stopPropagation();
        activeJurisdictions = new Set(Object.keys(colorScale));
        document.querySelectorAll('.jurisdiction-checkbox input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        updateChart();
    });

    // Deselect all button
    document.getElementById('deselect-all').addEventListener('click', (e) => {
        e.stopPropagation();
        activeJurisdictions.clear();
        document.querySelectorAll('.jurisdiction-checkbox input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateChart();
    });

    // Toggle filters visibility
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
            console.log('Showing filters');
        } else {
            filtersContent.style.display = 'none';
            toggleArrow.classList.remove('open');
            console.log('Hiding filters');
        }
    });

    // Year filter - auto apply on change
    const applyYearFilter = () => {
        const startYear = parseInt(document.getElementById('year-start').value);
        const endYear = parseInt(document.getElementById('year-end').value);

        if (startYear > endYear) {
            alert('Start year must be less than or equal to end year');
            return;
        }

        yearRange.start = startYear;
        yearRange.end = endYear;
        updateChart();
    };

    document.getElementById('year-start').addEventListener('change', applyYearFilter);
    document.getElementById('year-end').addEventListener('change', applyYearFilter);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
        setTimeout(init, 100);
    });
});

// Also initialize on load as backup
window.addEventListener('load', () => {
    if (!data || data.length === 0) {
        requestAnimationFrame(() => {
            setTimeout(init, 50);
        });
    }
});

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (data.length > 0) {
            updateChart();
        }
    }, 250);
});

// Add click handler to document to reset selection when clicking outside
document.addEventListener('click', (event) => {
    // Check if click is on a bar or legend
    const isBar = event.target.classList.contains('bar');
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

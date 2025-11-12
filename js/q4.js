// Q4: Stacked Bar Chart - Fine Detection Methods by Jurisdiction
// Data: Camera vs Police issued fines

let allData = [];
let filteredData = [];
let svg, chartGroup, xScale, yScale, colorScale;
let tooltip;
let initialized = false;
let activeState = { camera: true, police: true };
let animationComplete = false;

// Configuration
const config = {
    margin: { top: 40, right: 60, bottom: 80, left: 100 },
    height: 500
};

// Colors for detection methods
const colors = {
    'Camera issued fines': '#3498db',  // Blue
    'Police issued fines': '#f59e0b'   // Amber
};

// Load and process data
async function loadData() {
    try {
        const csvData = await d3.csv('data/Q4_Camera_vs_police_fines_by_jurisdiction.csv');
        
        // Transform data for stacked bar chart
        allData = csvData.map(d => ({
            jurisdiction: d.JURISDICTION,
            camera: +d['Camera issued fines'],
            police: +d['Police issued fines'],
            total: +d['Camera issued fines'] + +d['Police issued fines']
        }));

        // Sort by total fines descending
        allData.sort((a, b) => b.total - a.total);
        filteredData = [...allData];

        console.log('Q4 Data loaded:', allData);
        setupFilters();
        createChart();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Setup filter controls
function setupFilters() {
    if (initialized) return;
    initialized = true;

    // Toggle filters
    const toggleBtn = document.getElementById('toggle-filters');
    const filtersContent = document.getElementById('filters-content');
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isHidden = window.getComputedStyle(filtersContent).display === 'none';
        
        if (isHidden) {
            filtersContent.style.display = 'grid';
            toggleBtn.textContent = 'Hide ▼';
        } else {
            filtersContent.style.display = 'none';
            toggleBtn.textContent = 'Show ▶';
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

    const maxTotal = d3.max(filteredData, d => d.total);
    yScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.1])
        .range([height, 0]);

    // Add axes
    const xAxis = chartGroup.append('g')
        .attr('class', 'x-axis axis')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    const yAxis = chartGroup.append('g')
        .attr('class', 'y-axis axis')
        .call(d3.axisLeft(yScale)
            .ticks(8)
            .tickFormat(d => d3.format('.2s')(d))
        );

    // Y-axis label
    chartGroup.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -60)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#4a5568')
        .style('font-weight', '500')
        .text('Number of Fines');

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

    // Draw stacked bars
    drawStackedBars(width, height);

    // Create legend
    createLegend();
    
    // Add click handler to SVG to reset selection when clicking empty space
    svg.on('click', function(event) {
        resetSelection();
    });
}

function resetSelection() {
    // Show all segments
    activeState.camera = true;
    activeState.police = true;
    
    // Update legend appearance
    d3.selectAll('.legend-item').classed('inactive', false);
    
    // Update bars
    updateBars(activeState);
    
    // Re-enable interactions after reset completes
    setTimeout(() => {
        animationComplete = true;
    }, 300);
}

function drawStackedBars(width, height) {
    // Minimum visible height (in pixels) for very small segments
    const minVisibleHeight = 3;
    
    // Reset animation flag
    animationComplete = false;
    
    // Create bar groups
    const barGroups = chartGroup.selectAll('.bar-group')
        .data(filteredData)
        .enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${xScale(d.jurisdiction)}, 0)`);

    // Camera bars (bottom segment) - calculate final positions first
    const cameraBars = barGroups.append('rect')
        .attr('class', 'bar-segment camera-segment')
        .attr('x', 0)
        .attr('width', xScale.bandwidth())
        .attr('fill', colors['Camera issued fines'])
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).style('filter', 'brightness(1.1)');
            showTooltip(event, d, 'Camera issued fines', d.camera);
        })
        .on('mouseout', function() {
            d3.select(this).style('filter', 'none');
            hideTooltip();
        })
        .on('click', function(event) {
            event.stopPropagation();
            // Only allow clicks after animation completes
            if (!animationComplete) return;
            focusSegmentType('camera');
        });
    
    // Set initial position at bottom
    cameraBars
        .attr('y', height)
        .attr('height', 0);
    
    // Animate to final position
    cameraBars
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .ease(d3.easeCubicOut)
        .attr('y', d => {
            const calculatedHeight = height - yScale(d.camera);
            if (d.camera > 0 && calculatedHeight < minVisibleHeight) {
                return height - minVisibleHeight;
            }
            return yScale(d.camera);
        })
        .attr('height', d => {
            if (d.camera === 0) return 0;
            const calculatedHeight = height - yScale(d.camera);
            return Math.max(calculatedHeight, minVisibleHeight);
        });

    // Police bars (top segment)
    const policeBars = barGroups.append('rect')
        .attr('class', 'bar-segment police-segment')
        .attr('x', 0)
        .attr('width', xScale.bandwidth())
        .attr('fill', colors['Police issued fines'])
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).style('filter', 'brightness(1.1)');
            showTooltip(event, d, 'Police issued fines', d.police);
        })
        .on('mouseout', function() {
            d3.select(this).style('filter', 'none');
            hideTooltip();
        })
        .on('click', function(event) {
            event.stopPropagation();
            // Only allow clicks after animation completes
            if (!animationComplete) return;
            focusSegmentType('police');
        });
    
    // Set initial position at bottom
    policeBars
        .attr('y', height)
        .attr('height', 0);
    
    // Animate to final position
    policeBars
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100 + 500)
        .ease(d3.easeCubicOut)
        .attr('y', d => yScale(d.total))
        .attr('height', d => {
            if (d.police === 0) return 0;
            const calculatedHeight = yScale(d.camera) - yScale(d.total);
            return Math.max(calculatedHeight, minVisibleHeight);
        })
        .on('end', function(d, i) {
            // Set flag when last bar finishes animating
            if (i === filteredData.length - 1) {
                animationComplete = true;
            }
        });

    // Add total value labels on top
    barGroups.append('text')
        .attr('class', 'value-label total-label')
        .attr('x', xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.total) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', '#374151')
        .style('opacity', 0)
        .text(d => d3.format('.2s')(d.total))
        .transition()
        .duration(600)
        .delay((d, i) => i * 100 + 1500)
        .style('opacity', 1);

    // Add interactive hover effects
    barGroups
        .on('mouseover', function(event, d) {
            const currentGroup = d3.select(this);
            
            // Brighten current bars
            currentGroup.selectAll('.bar-segment')
                .transition()
                .duration(200)
                .style('filter', 'brightness(1.15)');
            
            // Scale up the group slightly
            currentGroup
                .transition()
                .duration(200)
                .attr('transform', `translate(${xScale(d.jurisdiction)}, -5)`);
            
            // Make value label bigger and bolder
            currentGroup.select('.total-label')
                .transition()
                .duration(200)
                .style('font-size', '16px')
                .style('font-weight', '700');
            
            // Dim other bar groups
            barGroups.filter(bar => bar.jurisdiction !== d.jurisdiction)
                .transition()
                .duration(200)
                .style('opacity', 0.4);
        })
        .on('mouseout', function(event, d) {
            const currentGroup = d3.select(this);
            
            // Reset brightness
            currentGroup.selectAll('.bar-segment')
                .transition()
                .duration(200)
                .style('filter', 'none');
            
            // Reset position
            currentGroup
                .transition()
                .duration(200)
                .attr('transform', `translate(${xScale(d.jurisdiction)}, 0)`);
            
            // Reset label size
            currentGroup.select('.total-label')
                .transition()
                .duration(200)
                .style('font-size', '14px')
                .style('font-weight', '600');
            
            // Reset all opacities
            barGroups
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
}

function showTooltip(event, d, method, value) {
    const percentage = ((value / d.total) * 100).toFixed(1);
    
    tooltip.html(`
        <div class="tooltip-title">${d.jurisdiction}</div>
        <div class="tooltip-item">
            <div class="tooltip-color" style="background: ${colors[method]}"></div>
            <span>${method}: <span class="tooltip-value">${d3.format(',')(value)}</span> (${percentage}%)</span>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2);">
            <strong>Total: ${d3.format(',')(d.total)}</strong>
        </div>
    `)
    .style('left', (event.pageX + 15) + 'px')
    .style('top', (event.pageY - 10) + 'px')
    .classed('visible', true);
}

function hideTooltip() {
    tooltip.classed('visible', false);
}

function focusSegmentType(type) {
    // Show only this type (turn off the other)
    activeState.camera = (type === 'camera');
    activeState.police = (type === 'police');
    
    // Update legend appearance
    d3.selectAll('.legend-item').each(function() {
        const item = d3.select(this);
        const text = item.select('.legend-text').text();
        if (text === 'Camera issued fines') {
            item.classed('inactive', !activeState.camera);
        } else if (text === 'Police issued fines') {
            item.classed('inactive', !activeState.police);
        }
    });
    
    // Update bars
    updateBars(activeState);
    
    // Re-enable interactions after transition completes
    setTimeout(() => {
        animationComplete = true;
    }, 300);
}

function createLegend() {
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();

    const methods = ['Camera issued fines', 'Police issued fines'];

    methods.forEach(method => {
        const item = legend.append('div')
            .attr('class', 'legend-item')
            .style('cursor', 'pointer')
            .on('click', function(event) {
                event.stopPropagation();
                // Only allow clicks after animation completes
                if (!animationComplete) return;
                const key = method === 'Camera issued fines' ? 'camera' : 'police';
                focusSegmentType(key);
            });

        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', colors[method]);

        item.append('span')
            .attr('class', 'legend-text')
            .text(method);
    });
}

function updateBars(activeState) {
    // Force bars to complete their animation immediately
    d3.selectAll('.camera-segment').interrupt();
    d3.selectAll('.police-segment').interrupt();
    
    // Get the height scale for recalculating positions
    const minVisibleHeight = 3;
    
    // Update camera bars - recalculate and set to final position
    d3.selectAll('.camera-segment')
        .each(function(d) {
            const elem = d3.select(this);
            const calculatedHeight = yScale.range()[0] - yScale(d.camera);
            const finalY = d.camera > 0 && calculatedHeight < minVisibleHeight 
                ? yScale.range()[0] - minVisibleHeight 
                : yScale(d.camera);
            const finalHeight = d.camera === 0 ? 0 : Math.max(calculatedHeight, minVisibleHeight);
            
            // Force to final position immediately, then animate opacity
            elem.attr('y', finalY)
                .attr('height', finalHeight)
                .transition()
                .duration(300)
                .style('opacity', activeState.camera ? 1 : 0);
        });
    
    // Update police bars - recalculate and set to final position
    d3.selectAll('.police-segment')
        .each(function(d) {
            const elem = d3.select(this);
            const calculatedHeight = yScale(d.camera) - yScale(d.total);
            const finalY = yScale(d.total);
            const finalHeight = d.police === 0 ? 0 : Math.max(calculatedHeight, minVisibleHeight);
            
            // Force to final position immediately, then animate opacity
            elem.attr('y', finalY)
                .attr('height', finalHeight)
                .transition()
                .duration(300)
                .style('opacity', activeState.police ? 1 : 0);
        });
    
    // Update value labels based on what's visible
    d3.selectAll('.total-label')
        .transition()
        .duration(300)
        .style('opacity', (activeState.camera || activeState.police) ? 1 : 0)
        .text(function() {
            const barGroup = d3.select(this.parentNode);
            const data = barGroup.datum();
            
            // Calculate visible total
            let visibleTotal = 0;
            if (activeState.camera && activeState.police) {
                visibleTotal = data.total;
            } else if (activeState.camera) {
                visibleTotal = data.camera;
            } else if (activeState.police) {
                visibleTotal = data.police;
            }
            
            return visibleTotal > 0 ? d3.format('.2s')(visibleTotal) : '';
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

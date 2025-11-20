/**
 * Q2: Multi-Series Line Chart (All Jurisdictions)
 * DATA GOVERNANCE NOTE:
 * - Data source: Q2_Annual_fines_by_jurisdiction.csv
 * - PII compliance: Aggregated public data only
 * - GDPR/APP/CCPA compliant
 */


// Load and parse data
async function loadData() {
    // Try different path variations (relative to HTML)
    const possiblePaths = [
        'data/Q2_Annual_fines_by_jurisdiction.csv',
        './data/Q2_Annual_fines_by_jurisdiction.csv',
        '../data/Q2_Annual_fines_by_jurisdiction.csv'
    ];

    let current = 0;

    while (current < possiblePaths.length) {
        const path = possiblePaths[current];
        console.log('Trying to load Q2 data from:', path);
        try {
            const raw = await d3.csv(path);
            if (!Array.isArray(raw) || raw.length === 0) {
                throw new Error('CSV loaded but empty');
            }

            // raw is in wide format: YEAR, ACT, NSW, NT, QLD, SA, TAS, VIC, WA
            // convert to long format: { date, jurisdiction, value }
            const headerCols = Object.keys(raw[0]);
            // determine jurisdiction columns (exclude YEAR)
            const jidCols = headerCols.filter(h => h.toUpperCase() !== 'YEAR');

            const long = [];
            raw.forEach(row => {
                const yearVal = row.YEAR || row.Year || row.year;
                const date = new Date(+yearVal, 0, 1);
                jidCols.forEach(j => {
                    const rawValue = row[j];
                    const value = (rawValue === '' || rawValue == null) ? null : +rawValue;
                    long.push({ date, jurisdiction: j, value });
                });
            });

            console.log('Q2 parsed rows (long):', long.length);
            return long;
        } catch (err) {
            console.warn('Failed to load Q2 from', path, err.message || err);
            current++;
        }
    }

    throw new Error('Could not load Q2 CSV. Expected at data/Q2_Annual_fines_by_jurisdiction.csv');
}

// Color palette for multiple jurisdictions (8 discriminable colors)
const COLOR_PALETTE = [
    '#FFC900', 
    '#54ADD4', 
    '#FFAEB4', 
    '#E14C70', 
    '#C49EE8', 
    '#81BC00', 
    '#BEDEDA', 
    '#E9EF63'  
];

/**
 * Main function to create the multi-series chart
 */
async function createChart() {
    const chartDiv = document.getElementById('chart');
    chartDiv.innerHTML = '<div class="loading">Loading data...</div>';

    try {
        // Load and parse CSV data (converts wide -> long)
        const data = await loadData();

        // Get unique jurisdictions
        const jurisdictions = Array.from(new Set(data.map(d => d.jurisdiction))).sort();

        if (jurisdictions.length === 0) {
            throw new Error('No jurisdictions found in dataset');
        }

        // Create color scale
        const colorScale = d3.scaleOrdinal()
            .domain(jurisdictions)
            .range(COLOR_PALETTE);

        // Set up dimensions (increase right margin and height for label space and readability)
        const margin = {top: 40, right: 160, bottom: 50, left: 70};
        const containerWidth = chartDiv.clientWidth;
        const width = containerWidth - margin.left - margin.right;
        // Increase vertical space so lines are less squeezed
        const baseSvgHeight = 760;
        const height = baseSvgHeight - margin.top - margin.bottom;

        // Clear loading message
        chartDiv.innerHTML = '';

        // Create SVG
        const svg = d3.select('#chart')
            .append('svg')
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom)
            .attr('viewBox', `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        // Add horizontal padding to spread year points slightly apart
        const dates = d3.extent(data, d => d.date);
        const padMs = 1000 * 60 * 60 * 24 * 180; // ~180 days padding on each end
        const x = d3.scaleTime()
            .domain([new Date(dates[0].getTime() - padMs), new Date(dates[1].getTime() + padMs)])
            .range([0, width]);

        // Y scale with increased padding to space values vertically
        const numericValues = data.map(d => d.value).filter(v => v != null && !isNaN(v));
        const yExtent = d3.extent(numericValues);
        const defaultMin = (yExtent && yExtent[0] != null) ? yExtent[0] : 0;
        const defaultMax = (yExtent && yExtent[1] != null) ? yExtent[1] : 1;
        const yPadding = (defaultMax - defaultMin) * 0.18; // larger padding
        // Prevent the lower bound from going too far negative; cap at -20000
        const lowerBound = Math.max(defaultMin - yPadding, -20000);
        const upperBound = defaultMax + yPadding;
        const y = d3.scaleLinear()
            .domain([lowerBound, upperBound])
            .range([height, 0])
            .nice();

        // Add grid lines
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat('')
            );

        // Add X axis
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(8));

        // Add Y axis
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));

        // Line generator
        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);

        // Group data by jurisdiction
        const nested = d3.group(data, d => d.jurisdiction);

        // Active jurisdictions state (all active by default)
        let activeJurisdictions = new Set(jurisdictions);

        // Draw plain multi-series lines (no staggered animation)
        const linePaths = svg.selectAll('.line-path')
            .data(Array.from(nested))
            .join('path')
            .attr('class', 'line')
            .attr('data-jurisdiction', d => d[0])
            .attr('d', d => line(d[1]))
            .style('stroke', d => colorScale(d[0]))
            .style('stroke-width', 2.5)
            .style('stroke-linejoin', 'round')
            .style('stroke-linecap', 'round')
            .style('fill', 'none')
            .style('opacity', d => activeJurisdictions.has(d[0]) ? 0.9 : 0.08);

        // Add point markers for each data point (hidden by default, shown on hover)
        const pointsGroup = svg.append('g').attr('class', 'points-group');
        Array.from(nested).forEach(([jurisdiction, values]) => {
            pointsGroup.selectAll(`.point-${jurisdiction}`)
                .data(values)
                .join('circle')
                .attr('class', `point point-${jurisdiction}`)
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d.value))
                .attr('r', 2.5)
                .style('fill', colorScale(jurisdiction))
                .style('opacity', 0.0);
        });

        // Create checkbox controls inside filters content (jurisdiction-grid)
        const controlsContainer = d3.select('#jurisdiction-grid');
        controlsContainer.selectAll('*').remove();
        jurisdictions.forEach(j => {
            const label = controlsContainer.append('label')
                .attr('class', 'jurisdiction-checkbox');

            label.append('input')
                .attr('type', 'checkbox')
                .attr('data-jurisdiction', j)
                .attr('id', `check-${j}`)
                .property('checked', true)
                .on('change', function(e) {
                    if (this.checked) activeJurisdictions.add(j); else activeJurisdictions.delete(j);
                    updateVisibility();
                    // update legend appearance
                    d3.selectAll('#legend .legend-item').classed('inactive', d => !activeJurisdictions.has(d));
                });

            label.append('span')
                .attr('class', `checkbox-custom`)
                .style('color', colorScale(j));

            label.append('span')
                .attr('class', 'jurisdiction-label')
                .text(j);
        });

        // Create HTML legend (matches q3/q4) and sync with checkboxes
        const legendContainer = d3.select('#legend');
        legendContainer.selectAll('*').remove();

        const legendItems = legendContainer.selectAll('.legend-item')
            .data(jurisdictions)
            .join('div')
            .attr('class', 'legend-item')
            .on('click', function(event, j) {
                if (activeJurisdictions.has(j)) activeJurisdictions.delete(j);
                else activeJurisdictions.add(j);

                // sync checkbox
                const cb = document.getElementById(`check-${j}`);
                if (cb) cb.checked = activeJurisdictions.has(j);

                updateVisibility();
                legendContainer.selectAll('.legend-item').classed('inactive', d => !activeJurisdictions.has(d));
            });

        legendItems.append('div')
            .attr('class', 'legend-color')
            .style('background', d => colorScale(d));

        legendItems.append('span')
            .attr('class', 'legend-label')
            .text(d => d);

        // initialize legend appearance
        legendContainer.selectAll('.legend-item').classed('inactive', d => !activeJurisdictions.has(d));

        /**
         * Update line visibility based on active jurisdictions
         */
        function updateVisibility() {
            svg.selectAll('.line')
                .transition()
                .duration(300)
                .style('opacity', d => activeJurisdictions.has(d[0]) ? 0.9 : 0.08);
        }
        // Wire up the controls header toggle (show/hide filters) for q2
        const controlsHeader = document.getElementById('q2-controls-header');
        const filtersContent = document.getElementById('filters-content');
        const toggleArrow = document.getElementById('toggle-filters');
        if (controlsHeader && filtersContent && toggleArrow) {
            controlsHeader.addEventListener('click', () => {
                const isOpen = filtersContent.style.display === 'block';
                if (isOpen) {
                    filtersContent.style.display = 'none';
                    toggleArrow.classList.remove('open');
                } else {
                    filtersContent.style.display = 'block';
                    toggleArrow.classList.add('open');
                }
            });
        }

        // Create tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip');

        // Add hover interaction to lines
        svg.selectAll('.line')
            .on('mouseenter', function(event, d) {
                const jurisdiction = d[0];

                // Highlight current line, dim others
                svg.selectAll('.line')
                    .transition()
                    .duration(200)
                    .style('opacity', datum => datum[0] === jurisdiction ? 1 : 0.15)
                    .classed('line-hover', datum => datum[0] === jurisdiction);
            })
            .on('mouseleave', function() {
                // Reset to normal state
                svg.selectAll('.line')
                    .transition()
                    .duration(200)
                    .style('opacity', 0.9)
                    .classed('line-hover', false);

                d3.selectAll('.tooltip').style('opacity', 0);
            })
            .on('mousemove', function(event, d) {
                const jurisdiction = d[0];

                const [mouseX] = d3.pointer(event);
                const x0 = x.invert(mouseX);
                
                // Find nearest data point
                const jurisdictionData = d[1];
                const point = jurisdictionData.reduce((prev, curr) => 
                    Math.abs(curr.date - x0) < Math.abs(prev.date - x0) ? curr : prev
                );

                // Format date
                const formatDate = d3.timeFormat('%Y');

                // Update tooltip
                tooltip.html(`
                    <div class="tooltip-date">${formatDate(point.date)}</div>
                    <div class="tooltip-value">
                        <span class="tooltip-color" style="background: ${colorScale(jurisdiction)}"></span>
                        <span>${jurisdiction}: ${point.value != null ? point.value.toLocaleString() : 'N/A'}</span>
                    </div>
                `)
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 40) + 'px')
                .style('opacity', 1);
            });

    } catch (error) {
        console.error('Error loading or processing data:', error);
        chartDiv.innerHTML = `
            <div class="error">
                <strong>Error loading data:</strong><br>
                ${error.message}<br><br>
                Please ensure the CSV file is located at: <code>data/Q2_Annual_fines_by_jurisdiction.csv</code><br>
                Expected columns: YEAR, ACT, NSW, NT, QLD, SA, TAS, VIC, WA
            </div>
        `;
    }
}

// Initialize chart when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createChart);
} else {
    createChart();
}

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        d3.select('#chart').selectAll('*').remove();
        d3.select('#controls').selectAll('*').remove();
        d3.selectAll('.tooltip').remove();
        createChart();
    }, 250);
});
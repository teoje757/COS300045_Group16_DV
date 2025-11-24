/**
 * Q1: Simple Two-Line Comparison Chart
 * DATA GOVERNANCE NOTE:
 * - Data source: Q1_Annual_fines_for_mobile_phone_use.csv
 * - PII compliance: Aggregated public data only
 * - GDPR/APP/CCPA compliant
 */

// Configuration
// Load and parse data
async function loadData() {
    // Try different path variations (relative to the HTML file)
    const possiblePaths = [
        'data/Q1_Annual_fines_for_mobile_phone_use.csv',
        './data/Q1_Annual_fines_for_mobile_phone_use.csv',
        '../data/Q1_Annual_fines_for_mobile_phone_use.csv'
    ];

    let current = 0;

    while (current < possiblePaths.length) {
        const path = possiblePaths[current];
        console.log('Trying to load data from:', path);
        try {
            const raw = await d3.csv(path);
            if (Array.isArray(raw)) {
                console.log('Data loaded successfully from', path, '- rows:', raw.length);
                return raw;
            }
        } catch (err) {
            console.warn('Failed to load from', path, err);
        }
        current++;
    }

    throw new Error('Could not load CSV. Expected at: data/Q1_Annual_fines_for_mobile_phone_use.csv (or similar relative paths).');
}
// Color palette for the two detection methods
const COLORS = {
    primary: '#81BC00',  
    secondary: '#C49EE8'  
};

/**
 * Main function to create the chart
 */
async function createChart() {
    const chartDiv = document.getElementById('chart');
    chartDiv.innerHTML = '<div class="loading">Loading data...</div>';

    try {
        // Load and parse CSV data (tries multiple relative paths, like q3.js)
        const rawData = await loadData();
        
        // Parse and prepare data
        // Expected CSV columns: Year, Police issued fines, Camera issued fines
        const parsed = rawData.map(d => {
            const yearRaw = d.YEAR || d.Year || d.year;
            const policeRaw = d['Police issued fines'] ?? d.Police ?? d.police;
            const cameraRaw = d['Camera issued fines'] ?? d.Camera ?? d.camera;

            const police = (policeRaw === '' || policeRaw == null) ? null : +policeRaw;
            const camera = (cameraRaw === '' || cameraRaw == null) ? null : +cameraRaw;

            return {
                date: new Date(+yearRaw, 0, 1),
                police,
                camera
            };
        })
        // Filter out rows without a valid date
        .filter(d => !isNaN(d.date));

        if (!parsed || parsed.length === 0) {
            throw new Error('Parsed CSV is empty or missing Year values');
        }

        // Sort by date
        parsed.sort((a, b) => a.date - b.date);

        console.log('Parsed CSV sample rows:', parsed.slice(0, 6));

        // Transform into a flat array of points for two series: Police and Camera
        const seriesNames = ['Police', 'Camera'];
        const compiled = [];
        parsed.forEach(d => {
            if (d.police != null) compiled.push({ date: d.date, method: 'Police', value: d.police });
            if (d.camera != null) compiled.push({ date: d.date, method: 'Camera', value: d.camera });
        });

        // Group by method for line drawing
        const nested = d3.group(compiled, p => p.method);

        // Set up dimensions
        const margin = {top: 40, right: 80, bottom: 50, left: 60};
        const containerWidth = chartDiv.clientWidth;
        const width = containerWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

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
        const x = d3.scaleTime()
            .domain(d3.extent(parsed, d => d.date))
            .range([0, width]);

        // Y scale with padding across both series
        const yExtent = d3.extent(compiled, d => d.value);
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 1;
        const y = d3.scaleLinear()
            .domain([ (yExtent[0] || 0) - yPadding, (yExtent[1] || 0) + yPadding ])
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
            .call(d3.axisBottom(x).ticks(6));

        // Add Y axis
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));

        // Color mapping for the two detection methods
        const colorMap = {
            'Police': COLORS.primary,
            'Camera': COLORS.secondary
        };

        // Line generator
        const line = d3.line()
            .x(d => x(d.date))
            .defined(d => d.value != null)
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);

        // Draw lines for each method (Police, Camera)
        svg.selectAll('.line-path')
            .data(Array.from(nested))
            .join('path')
            .attr('class', 'line')
            .attr('d', d => line(d[1]))
            .style('stroke', d => colorMap[d[0]])
            .style('opacity', 0)
            .style('fill', 'none')
            .style('stroke-width', 2.5)
            .transition()
            .duration(1000)
            .style('opacity', 1);

        // Add direct labels at end of lines
        svg.selectAll('.direct-label')
            .data(Array.from(nested))
            .join('text')
            .attr('class', 'direct-label')
            .attr('x', width + 10)
            .attr('y', d => y(d[1][d[1].length - 1].value))
            .attr('dy', '0.35em')
            .style('fill', d => colorMap[d[0]])
            .text(d => d[0])
            .style('opacity', 0)
            .transition()
            .delay(1000)
            .duration(500)
            .style('opacity', 1);

        // Create HTML legend (matches q3/q4 style) and filter controls
        const methods = Array.from(nested.keys());
        const activeMethods = new Set(methods);

        function updateVisibility() {
            svg.selectAll('.line')
                .transition()
                .duration(200)
                .style('opacity', dd => activeMethods.has(dd[0]) ? 1 : 0.08);

            svg.selectAll('.direct-label')
                .transition()
                .duration(200)
                .style('opacity', dd => activeMethods.has(dd[0]) ? 1 : 0.15);

            // update legend/in-control appearance
            d3.selectAll('#legend .legend-item')
                .classed('inactive', d => !activeMethods.has(d));
        }

        function createLegend() {
            const legendContainer = d3.select('#legend');
            legendContainer.selectAll('*').remove();

            const items = legendContainer.selectAll('.legend-item')
                .data(methods)
                .join('div')
                .attr('class', 'legend-item')
                .on('click', function(event, m) {
                    // toggle
                    if (activeMethods.has(m)) activeMethods.delete(m);
                    else activeMethods.add(m);

                    // sync checkbox if present
                    const cb = document.querySelector(`input[data-method="${m}"]`);
                    if (cb) cb.checked = activeMethods.has(m);

                    updateVisibility();
                });

            items.append('div')
                .attr('class', 'legend-color')
                .style('background', d => colorMap[d]);

            items.append('span')
                .attr('class', 'legend-label')
                .text(d => d);

            // initialize control checkboxes (if present)
            document.querySelectorAll('input[data-method]').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const m = e.target.dataset.method;
                    if (e.target.checked) activeMethods.add(m); else activeMethods.delete(m);
                    updateVisibility();
                    // update legend appearance
                    d3.selectAll('#legend .legend-item').classed('inactive', d => !activeMethods.has(d));
                });
            });
        }

        createLegend();

        // Highlight the peak points for both Police and Camera-issued fines (if present)
        function placePeakMarker(seriesName, className, labelPrefix) {
            const sData = nested.get(seriesName);
            if (!sData || sData.length === 0) return;
            const peak = sData.reduce((max, d) => (max == null || d.value > max.value) ? d : max, null);
            if (!peak || peak.value == null) return;

            const cx = x(peak.date);
            const cy = y(peak.value);

            svg.append('circle')
                .attr('class', className)
                .attr('cx', cx)
                .attr('cy', cy)
                .attr('r', 5)
                .style('fill', colorMap[seriesName])
                .style('stroke', '#ffffff')
                .style('stroke-width', 1.5)
                .style('opacity', 0)
                .transition()
                .delay(1200)
                .duration(400)
                .style('opacity', 1);

            // Choose label side: prefer right, but if too close to edge place left
            const labelOffsetX = (cx > width - 120) ? -8 - 120 : 8;
            const anchor = (labelOffsetX < 0) ? 'end' : 'start';

            svg.append('text')
                .attr('class', `${className}-label`)
                .attr('x', cx + labelOffsetX)
                .attr('y', cy - 8)
                .attr('text-anchor', anchor)
                .text(`${labelPrefix}: ${peak.value.toLocaleString()}`)
                .style('fill', colorMap[seriesName])
                .style('font-weight', '600')
                .style('font-size', '12px')
                .style('opacity', 0)
                .transition()
                .delay(1200)
                .duration(400)
                .style('opacity', 1);
        }

        placePeakMarker('Police', 'police-peak', 'Peak');
        placePeakMarker('Camera', 'camera-peak', 'Peak');

        // Wire up the controls header toggle (show/hide filters) for q1
        const controlsHeader = document.getElementById('q1-controls-header');
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

        // Create focus elements for interaction
        const focus = svg.append('g')
            .style('display', 'none');

        // Add circles for each method
        focus.selectAll('circle')
            .data(Array.from(nested.keys()))
            .join('circle')
            .attr('r', 5)
            .attr('fill', d => colorMap[d]);

        // Add interaction overlay
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', () => {
                focus.style('display', null);
                tooltip.style('opacity', 1);
            })
            .on('mouseout', () => {
                focus.style('display', 'none');
                tooltip.style('opacity', 0);
            })
            .on('mousemove', function(event) {
                const [mouseX] = d3.pointer(event);
                const x0 = x.invert(mouseX);
                
                // Find nearest data points for both methods
                const dataByMethod = Array.from(nested);
                const points = dataByMethod.map(([method, methodData]) => {
                    if (!methodData || methodData.length === 0) return null;
                    return methodData.reduce((prev, curr) => 
                        Math.abs(curr.date - x0) < Math.abs(prev.date - x0) ? curr : prev
                    );
                }).filter(d => d != null);

                // Update focus circles
                focus.selectAll('circle')
                    .data(Array.from(nested.keys()).filter(k => nested.get(k).length > 0))
                    .attr('cx', (m, i) => {
                        const p = points.find(pt => pt.method === m);
                        return p ? x(p.date) : -10; // move off-canvas if no point
                    })
                    .attr('cy', (m, i) => {
                        const p = points.find(pt => pt.method === m);
                        return p ? y(p.value) : -10;
                    });

                // Update tooltip
                const formatDate = d3.timeFormat('%Y');
                const tooltipDate = points.length > 0 ? formatDate(points[0].date) : formatDate(x0);
                const tooltipContent = `
                    <div class="tooltip-date">${tooltipDate}</div>
                    ${points.map(point => `
                        <div class="tooltip-value">
                            <span class="tooltip-color" style="background: ${colorMap[point.method]}"></span>
                            <span>${point.method}: ${point.value.toLocaleString()}</span>
                        </div>
                    `).join('')}
                `;

                tooltip.html(tooltipContent)
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 50) + 'px');
            });

    } catch (error) {
        console.error('Error loading or processing data:', error);
        chartDiv.innerHTML = `
            <div class="error">
                <strong>Error loading data:</strong><br>
                ${error.message}<br><br>
                Please ensure the CSV file is located at: <code>data/Q1_Annual_fines_for_mobile_phone_use.csv</code><br>
                Expected columns: Year, Police issued fines, Camera issued fines
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
        d3.selectAll('.tooltip').remove();
        createChart();
    }, 250);
});
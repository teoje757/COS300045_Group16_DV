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

        // --- Year slider sync logic ---
        const yearExtent = d3.extent(parsed, d => d.date.getFullYear());
        const minYear = yearExtent[0];
        const maxYear = yearExtent[1];

        // Set dropdown slider min/max/value
        const dropdownSlider = document.getElementById('dropdown-year-slider');
        const dropdownYearValue = document.getElementById('dropdown-year-value');
        if (dropdownSlider && dropdownYearValue) {
            dropdownSlider.min = minYear;
            dropdownSlider.max = maxYear;
            dropdownSlider.value = maxYear;
            dropdownYearValue.textContent = maxYear;
        }

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
        const margin = {top: 40, right: 80, bottom: 70, left: 120};
        const containerWidth = chartDiv.clientWidth;
        const width = containerWidth - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

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

        // Add X axis label
        svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', width / 2)
            .attr('y', height + 45)
            .style('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('font-weight', '500')
            .style('fill', '#666')
            .text('Year');

        // Add Y axis
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y));

        // Add Y axis label
        svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -85)
            .style('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('font-weight', '500')
            .style('fill', '#666')
            .text('Number of Fines');

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

        // Area generator for shaded regions
        const area = d3.area()
            .x(d => x(d.date))
            .defined(d => d.value != null)
            .y0(height)
            .y1(d => y(d.value))
            .curve(d3.curveMonotoneX);

        // Draw shaded areas with smooth rising animation
        const areaGroup = svg.append('g').attr('class', 'areas');
        
        areaGroup.selectAll('.area-path')
            .data(Array.from(nested))
            .join('path')
            .attr('class', 'area')
            .attr('d', d => area(d[1]))
            .style('fill', d => colorMap[d[0]])
            .style('opacity', 0)
            .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.08))')
            .attr('transform', `translate(0,${height}) scale(1,0)`)
            .transition()
            .delay((d, i) => i * 150)
            .duration(600)
            .ease(d3.easeCubicOut)
            .attr('transform', `translate(0,0) scale(1,1)`)
            .style('opacity', 0.2);

        // Draw lines with progressive stroke animation
        const lineGroup = svg.append('g').attr('class', 'lines');
        
        lineGroup.selectAll('.line-path')
            .data(Array.from(nested))
            .join('path')
            .attr('class', 'line')
            .attr('d', d => line(d[1]))
            .style('stroke', d => colorMap[d[0]])
            .style('fill', 'none')
            .style('stroke-width', 3)
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round')
            .each(function(d, i) {
                const path = d3.select(this);
                const totalLength = this.getTotalLength();
                
                path
                    .style('stroke-dasharray', totalLength + ' ' + totalLength)
                    .style('stroke-dashoffset', totalLength)
                    .style('opacity', 1)
                    .transition()
                    .delay(400 + i * 150)
                    .duration(1200)
                    .ease(d3.easeCubicInOut)
                    .style('stroke-dashoffset', 0);
            });

        // Add all data point circles with cascading animation
        const pointsGroup = svg.append('g').attr('class', 'points');
        
        Array.from(nested).forEach(([method, data], seriesIdx) => {
            pointsGroup.selectAll(`.point-${method}`)
                .data(data)
                .join('circle')
                .attr('class', `point point-${method}`)
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d.value))
                .attr('r', 0)
                .style('fill', colorMap[method])
                .style('stroke', '#ffffff')
                .style('stroke-width', 2)
                .style('opacity', 0)
                .style('cursor', 'pointer')
                .style('filter', 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.15))')
                .transition()
                .delay((d, i) => 1200 + seriesIdx * 100 + i * 60)
                .duration(500)
                .ease(d3.easeBackOut.overshoot(2))
                .attr('r', 4.5)
                .style('opacity', 1)
                .selection()
                .on('mouseenter', function() {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('r', 7)
                        .style('stroke-width', 3)
                        .style('filter', 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))');
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('r', 4.5)
                        .style('stroke-width', 2)
                        .style('filter', 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.15))');
                });
        });

        // Add direct labels at end of lines
        svg.selectAll('.direct-label')
            .data(Array.from(nested))
            .join('text')
            .attr('class', d => 'direct-label direct-label-' + d[0])
            .attr('x', width + 10)
            .attr('y', d => y(d[1][d[1].length - 1].value))
            .attr('dy', '0.35em')
            .style('fill', d => colorMap[d[0]])
            .style('font-weight', '600')
            .style('font-size', '14px')
            .text(d => d[0])
            .style('opacity', 0)
            .transition()
            .delay(1600)
            .duration(500)
            .ease(d3.easeCubicOut)
            .style('opacity', 1);

        // Create HTML legend (matches q3/q4 style) and filter controls
        const methods = Array.from(nested.keys());
        const activeMethods = new Set(methods);

        function updateVisibility() {
            svg.selectAll('.area')
                .transition()
                .duration(200)
                .style('opacity', dd => activeMethods.has(dd[0]) ? 0.2 : 0);

            svg.selectAll('.line')
                .transition()
                .duration(200)
                .style('opacity', dd => activeMethods.has(dd[0]) ? 1 : 0);

            svg.selectAll('.point')
                .transition()
                .duration(200)
                .style('opacity', function() {
                    const classes = d3.select(this).attr('class');
                    const method = classes.includes('Police') ? 'Police' : 'Camera';
                    return activeMethods.has(method) ? 1 : 0;
                })
                .attr('r', function() {
                    const classes = d3.select(this).attr('class');
                    const method = classes.includes('Police') ? 'Police' : 'Camera';
                    return activeMethods.has(method) ? 4.5 : 0;
                });

            // Only show Camera label if selected year >= 2020
            const yearSlider = document.getElementById('year-slider');
            let selectedYear = yearSlider ? +yearSlider.value : null;
            svg.selectAll('.direct-label-Police')
                .transition()
                .duration(200)
                .style('opacity', dd => activeMethods.has(dd[0]) ? 1 : 0);
            svg.selectAll('.direct-label-Camera')
                .transition()
                .duration(200)
                .style('opacity', dd => (activeMethods.has(dd[0]) && selectedYear >= 2020) ? 1 : 0);

            // Hide/show peak markers and labels
            svg.selectAll('circle[data-method]')
                .transition()
                .duration(200)
                .style('opacity', function() {
                    const method = d3.select(this).attr('data-method');
                    return activeMethods.has(method) ? 1 : 0;
                })
                .attr('r', function() {
                    const method = d3.select(this).attr('data-method');
                    return activeMethods.has(method) ? 6 : 0;
                });

            svg.selectAll('text[data-method]')
                .transition()
                .duration(200)
                .style('opacity', function() {
                    const method = d3.select(this).attr('data-method');
                    return activeMethods.has(method) ? 1 : 0;
                });

            // update legend/in-control appearance
            d3.selectAll('#legend .legend-item')
                .classed('inactive', d => !activeMethods.has(d));
        }

        function createLegend() {
            const legendContainer = d3.select('#legend');
            legendContainer.selectAll('*').remove();
            // Change to column layout so slider is below buttons
            legendContainer
                .style('display', 'flex')
                .style('flex-direction', 'column')
                .style('align-items', 'flex-start')
                .style('gap', '12px');

            // Legend items row (buttons)
            const legendRow = legendContainer.append('div')
                .style('display', 'flex')
                .style('flex-direction', 'row')
                .style('align-items', 'center')
                .style('gap', '12px')
                .style('width', '100%');

            const items = legendRow.selectAll('.legend-item')
                .data(methods)
                .join('div')
                .attr('class', 'legend-item')
                .style('display', 'flex')
                .style('align-items', 'center')
                .on('click', function(event, m) {
                    // Prevent toggling off the last active method
                    if (activeMethods.has(m)) {
                        if (activeMethods.size > 1) {
                            activeMethods.delete(m);
                        } else {
                            // Do nothing if only one is left
                            return;
                        }
                    } else {
                        activeMethods.add(m);
                    }
                    // sync checkbox if present
                    const cb = document.querySelector(`input[data-method="${m}"]`);
                    if (cb) cb.checked = activeMethods.has(m);
                    updateVisibility();
                });

            items.append('div')
                .attr('class', 'legend-color')
                .style('background', d => colorMap[d])
                .style('width', '18px')
                .style('height', '18px')
                .style('margin-right', '8px')
                .style('border-radius', '4px');

            items.append('span')
                .attr('class', 'legend-label')
                .text(d => d);

            // Calculate percent stops for slider gradient
            const yearExtent = d3.extent(parsed, d => d.date.getFullYear());
            const minYear = yearExtent[0];
            const maxYear = yearExtent[1];
            const cameraStartYear = 2020;
            const cameraEndYear = maxYear;
            const totalYears = maxYear - minYear;
            const cameraStartPercent = ((cameraStartYear - minYear) / totalYears) * 100;
            const cameraEndPercent = ((cameraEndYear - minYear) / totalYears) * 100;

            // Year slider container (now below legendRow)
            const sliderContainer = legendContainer.append('div')
                .style('margin', '20px 0 0 0')
                .style('width', '100%')
                .style('padding', '0 10px')
                .style('display', 'block');
            
            sliderContainer.append('div')
                .style('font-size', '12px')
                .style('font-weight', '600')
                .style('color', '#666')
                .style('margin-bottom', '8px')
                .text('Filter by Year Range');

            // Create gradient for slider track
            const gradientId = 'year-slider-gradient';
            const sliderSvg = sliderContainer.append('svg')
                .attr('width', '100%')
                .attr('height', '40')
                .style('overflow', 'visible');

            const defs = sliderSvg.append('defs');
            const gradient = defs.append('linearGradient')
                .attr('id', gradientId)
                .attr('x1', '0%')
                .attr('x2', '100%');

            // Green up to 2020, purple from 2020 onwards
            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', COLORS.primary);
            gradient.append('stop')
                .attr('offset', `${cameraStartPercent}%`)
                .attr('stop-color', COLORS.primary);
            gradient.append('stop')
                .attr('offset', `${cameraStartPercent}%`)
                .attr('stop-color', COLORS.secondary);
            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', COLORS.secondary);
            
            // Create range slider
            const sliderWrapper = sliderContainer.append('div')
                .style('position', 'relative')
                .style('width', '100%');
            
            const sliderInput = sliderWrapper.append('input')
                .attr('type', 'range')
                .attr('min', minYear)
                .attr('max', maxYear)
                .attr('value', maxYear)
                .attr('id', 'year-slider')
                .style('width', '100%')
                .style('height', '8px')
                .style('border-radius', '4px')
                .style('background', `url(#${gradientId})`)
                .style('outline', 'none')
                .style('cursor', 'pointer')
                .style('-webkit-appearance', 'none')
                .style('appearance', 'none');
            
            // Add custom styling for the slider thumb
            const style = document.createElement('style');
            style.textContent = `
                #year-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #fff;
                    border: 2px solid #666;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                #year-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #fff;
                    border: 2px solid #666;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                #year-slider::-webkit-slider-runnable-track {
                    background: linear-gradient(to right, ${COLORS.primary} 0%, ${COLORS.primary} ${cameraStartPercent}%, ${COLORS.secondary} ${cameraStartPercent}%, ${COLORS.secondary} 100%);
                    height: 8px;
                    border-radius: 4px;
                }
                #year-slider::-moz-range-track {
                    background: linear-gradient(to right, ${COLORS.primary} 0%, ${COLORS.primary} ${cameraStartPercent}%, ${COLORS.secondary} ${cameraStartPercent}%, ${COLORS.secondary} 100%);
                    height: 8px;
                    border-radius: 4px;
                }
            `;
            document.head.appendChild(style);
            
            // Year display labels
            const yearLabelsDiv = sliderWrapper.append('div')
                .style('display', 'flex')
                .style('justify-content', 'space-between')
                .style('margin-top', '8px')
                .style('font-size', '11px')
                .style('color', '#999');
            
            yearLabelsDiv.append('span').text(minYear);
            const currentYearLabel = yearLabelsDiv.append('span')
                .style('font-weight', '600')
                .style('color', '#666')
                .text(`Selected: ${maxYear}`);
            yearLabelsDiv.append('span').text(maxYear);
            
            // Store current year filter
            let selectedYear = maxYear;

            // Update visualization on slider change
            function updateYearSliders(val) {
                // Update both sliders and chart
                selectedYear = +val;
                currentYearLabel.text(`Selected: ${selectedYear}`);
                if (dropdownSlider && dropdownYearValue) {
                    dropdownSlider.value = selectedYear;
                    dropdownYearValue.textContent = selectedYear;
                }
                filterByYear(selectedYear);
                updateVisibility(); // Ensure annotation visibility updates with year
            }

            sliderInput.on('input', function() {
                updateYearSliders(this.value);
            });

            // Dropdown slider event
            if (dropdownSlider && dropdownYearValue) {
                dropdownSlider.addEventListener('input', function() {
                    updateYearSliders(this.value);
                });
            }

            function filterByYear(year) {
                const selectedDate = new Date(year, 11, 31); // End of selected year
                
                // Update all visual elements
                svg.selectAll('.area')
                    .each(function(d) {
                        const method = d[0];
                        if (!activeMethods.has(method)) return;
                        
                        const filteredData = d[1].filter(pt => pt.date <= selectedDate);
                        const areaGen = d3.area()
                            .x(pt => x(pt.date))
                            .y0(height)
                            .y1(pt => y(pt.value))
                            .curve(d3.curveMonotoneX);
                        
                        d3.select(this)
                            .transition()
                            .duration(300)
                            .attr('d', areaGen(filteredData));
                    });
                
                svg.selectAll('.line')
                    .each(function(d) {
                        const method = d[0];
                        if (!activeMethods.has(method)) return;
                        
                        const filteredData = d[1].filter(pt => pt.date <= selectedDate);
                        const lineGen = d3.line()
                            .x(pt => x(pt.date))
                            .y(pt => y(pt.value))
                            .curve(d3.curveMonotoneX);
                        
                        d3.select(this)
                            .transition()
                            .duration(300)
                            .attr('d', lineGen(filteredData));
                    });
                
                svg.selectAll('.point')
                    .transition()
                    .duration(300)
                    .style('opacity', function(d) {
                        const classes = d3.select(this).attr('class');
                        const method = classes.includes('Police') ? 'Police' : 'Camera';
                        return (activeMethods.has(method) && d.date <= selectedDate) ? 1 : 0;
                    });
                
                // Hide/show peak markers based on year
                svg.selectAll('circle[data-method]')
                    .transition()
                    .duration(300)
                    .style('opacity', function() {
                        const method = d3.select(this).attr('data-method');
                        const peakYear = nested.get(method)
                            .reduce((max, d) => (max == null || d.value > max.value) ? d : max, null)
                            .date.getFullYear();
                        return (activeMethods.has(method) && peakYear <= year) ? 1 : 0;
                    });
                
                svg.selectAll('text[data-method]')
                    .transition()
                    .duration(300)
                    .style('opacity', function() {
                        const method = d3.select(this).attr('data-method');
                        const peakYear = nested.get(method)
                            .reduce((max, d) => (max == null || d.value > max.value) ? d : max, null)
                            .date.getFullYear();
                        return (activeMethods.has(method) && peakYear <= year) ? 1 : 0;
                    });
            
                // Update annotation visibility after filtering by year
                updateAnnotationVisibility(year);
            }

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

        // Store peak information for display
        const peakData = [];

        // Highlight the peak points for both Police and Camera-issued fines (if present)
        function placePeakMarker(seriesName, className, labelPrefix) {
            const sData = nested.get(seriesName);
            if (!sData || sData.length === 0) return;
            const peak = sData.reduce((max, d) => (max == null || d.value > max.value) ? d : max, null);
            if (!peak || peak.value == null) return;

            const cx = x(peak.date);
            const cy = y(peak.value);
            const peakYear = peak.date.getFullYear();
            
            // Store peak info for the insights section
            peakData.push({
                method: seriesName,
                year: peakYear,
                value: peak.value,
                color: colorMap[seriesName]
            });

            // Add peak marker circle
            svg.append('circle')
                .attr('class', className)
                .attr('data-method', seriesName)
                .attr('cx', cx)
                .attr('cy', cy)
                .attr('r', 0)
                .style('fill', colorMap[seriesName])
                .style('stroke', '#ffffff')
                .style('stroke-width', 2.5)
                .style('opacity', 0)
                .style('cursor', 'pointer')
                .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.2))')
                .on('mouseenter', function(event) {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .ease(d3.easeBackOut)
                        .attr('r', 10)
                        .style('filter', 'drop-shadow(0px 3px 8px rgba(0, 0, 0, 0.3))');
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .ease(d3.easeBackIn)
                        .attr('r', 7)
                        .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.2))');
                })
                .transition()
                .delay(1800)
                .duration(600)
                .ease(d3.easeBackOut.overshoot(2.5))
                .attr('r', 7)
                .style('opacity', 1);

            // Choose label side: for Camera (high values) place above, for Police place to side
            let labelX, labelY, anchor;
            if (seriesName === 'Camera') {
                // Place label above the dot for Camera
                labelX = cx;
                labelY = cy - 20;
                anchor = 'middle';
            } else {
                // Original logic for Police
                const labelOffsetX = (cx > width - 120) ? -8 - 120 : 8;
                anchor = (labelOffsetX < 0) ? 'end' : 'start';
                labelX = cx + labelOffsetX;
                labelY = cy - 8;
            }

            svg.append('text')
                .attr('class', `${className}-label`)
                .attr('data-method', seriesName)
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', anchor)
                .text(`${labelPrefix}: ${peak.value.toLocaleString()}`)
                .style('fill', colorMap[seriesName])
                .style('font-weight', '600')
                .style('font-size', '13px')
                .style('opacity', 0)
                .transition()
                .delay(2100)
                .duration(500)
                .ease(d3.easeCubicOut)
                .style('opacity', 0.95);
        }

        placePeakMarker('Police', 'police-peak', 'Peak');
        placePeakMarker('Camera', 'camera-peak', 'Peak');

        // Populate peak information section
        const peakContainer = document.getElementById('peak-info-container');
        if (peakContainer && peakData.length > 0) {
            // Clear existing content first
            peakContainer.innerHTML = '';
            
            peakData.forEach(peak => {
                const explanation = peak.method === 'Police'
                    ? 'Increased on-road enforcement and stricter penalties for mobile phone violations led to peak police-issued fines during this period.'
                    : 'Expansion of mobile phone detection camera network across major highways resulted in highest recorded camera-detected violations.';
                
                const peakCard = document.createElement('div');
                peakCard.className = 'insight-item';
                peakCard.style.borderLeft = `4px solid ${peak.color}`;
                peakCard.style.paddingLeft = '16px';
                peakCard.style.marginBottom = '16px';
                peakCard.innerHTML = `
                    <div style="font-size: 16px; font-weight: 700; color: ${peak.color}; margin-bottom: 8px;">
                        ${peak.method} Enforcement Peak
                    </div>
                    <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                        ${explanation}
                    </div>
                    <div style="font-size: 13px; color: #999;">
                        <strong>Year:</strong> ${peak.year} • <strong>Fines:</strong> ${peak.value.toLocaleString()}
                    </div>
                `;
                peakContainer.appendChild(peakCard);
            });
        }

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

        /** --- Data Story & Timeline Content --- **/
        const DATA_STORY = {
            intro: `This chart shows how mobile phone fines have been detected in recent years, either by police officers on the road or by automated cameras. It reveals how new technology and changing enforcement priorities have shaped driver behaviour and the number of fines issued.`,
            why: [
                {
                    year: 2020,
                    title: "2020: Cameras Introduced",
                    text: "Mobile phone detection cameras were introduced, allowing automated enforcement for the first time. Many drivers were caught unaware."
                },
                {
                    year: 2021,
                    title: "2021: Camera Rollout Expands",
                    text: "The camera network expanded to more locations, increasing the reach of automated enforcement."
                },
                {
                    year: 2022,
                    title: "2022: Peak Camera Fines",
                    text: "Cameras now covered most major roads. This year saw the highest number of camera detected fines as public awareness caught up."
                },
                {
                    year: 2023,
                    title: "2023–24: Fines Stabilise",
                    text: "Drivers became more aware of cameras, and the number of fines stabilised as behaviour adjusted."
                }
            ],
            policeDecline: "As cameras took over much of the enforcement work, police resources shifted to other priorities. Fewer officers were needed for mobile phone patrols, so police issued fines dropped sharply after 2020.",
            conclusion: "The introduction of automated cameras in 2020 changed the landscape of mobile phone enforcement, leading to a sharp rise in camera fines, a drop in police issued fines, and a new era of road safety monitoring."
        };

        /** --- Data Story Section --- **/
        function renderDataStory() {
            const section = document.getElementById('data-story-section');
            const content = document.getElementById('data-story-content');
            if (!section || !content) return;
            content.innerHTML = `
                <div style="margin-bottom:12px;">${DATA_STORY.intro}</div>
                <ul style="margin:0 0 12px 0;padding-left:20px;">
                    <li><b>2020:</b> ${DATA_STORY.why[0].text.replace(/-/g, ' ')}</li>
                    <li><b>2022:</b> ${DATA_STORY.why[2].text.replace(/-/g, ' ')}</li>
                    <li><b>Police detections drop:</b> ${DATA_STORY.policeDecline.replace(/-/g, ' ')}</li>
                </ul>
                <div style="margin-top:10px;color:#4b3a7a;font-weight:bold;">${DATA_STORY.conclusion.replace(/-/g, ' ')}</div>
            `;
            section.style.display = 'block';
            section.animate([{opacity:0,transform:'translateY(30px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,easing:'ease',fill:'forwards'});
        }

        // --- UI/UX Enhancements ---
        renderDataStory();

        // Add floating chart annotations
        addFloatingAnnotations(svg, x, y, width, height);

        /** --- Floating Chart Annotations --- **/
        function addFloatingAnnotations(svg, x, y, width, height) {
            // Cameras launched here (2020) - keep as floating annotation on chart
            const anno2020 = {
                year: 2020,
                text: "Cameras launched here",
                color: "#C49EE8",
                yOffset: -60
            };
            const x2020 = x(new Date(2020, 0, 1));
            const y2020 = y.range()[1] + anno2020.yOffset;
            svg.append('line')
                .attr('class', 'anno-camera')
                .attr('x1', x2020)
                .attr('y1', y(0))
                .attr('x2', x2020)
                .attr('y2', y2020 + 18)
                .attr('stroke', anno2020.color)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '3,2')
                .style('opacity', 0.95);
            svg.append('rect')
                .attr('class', 'anno-camera')
                .attr('x', x2020 - 90)
                .attr('y', y2020 - 18)
                .attr('width', 180)
                .attr('height', 32)
                .attr('rx', 10)
                .style('fill', '#fff')
                .style('stroke', anno2020.color)
                .style('stroke-width', 1.5)
                .style('opacity', 0.95)
                .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.07))');
            svg.append('text')
                .attr('class', 'anno-camera')
                .attr('x', x2020)
                .attr('y', y2020 + 3)
                .attr('text-anchor', 'middle')
                .attr('font-size', '13px')
                .attr('font-weight', '600')
                .attr('fill', anno2020.color)
                .attr('opacity', 0.95)
                .text(anno2020.text);

            // Police detections drop as cameras take over - leader line above the 2020-2024 police line segment
            const annoPolice = {
                text: "Police detections drop as cameras take over",
                color: "#81BC00"
            };
            const policeData = svg.data()[0]?.filter
                ? svg.data()[0].filter(d => d.method === 'Police')
                : null;
            let yPolice2020, yPolice2024;
            if (policeData && policeData.length) {
                const d2020 = policeData.find(d => d.date.getFullYear() === 2020);
                const d2024 = policeData.find(d => d.date.getFullYear() === 2024);
                yPolice2020 = d2020 ? y(d2020.value) : y(0);
                yPolice2024 = d2024 ? y(d2024.value) : y(0);
            } else {
                yPolice2020 = yPolice2024 = y(0);
            }
            const yLeader = Math.min(yPolice2020, yPolice2024) - 70;
            const xStart = x(new Date(2020, 0, 1));
            const xEnd = x(new Date(2024, 0, 1));
            svg.append('line')
                .attr('class', 'anno-police')
                .attr('x1', xStart)
                .attr('y1', yLeader)
                .attr('x2', xEnd)
                .attr('y2', yLeader)
                .attr('stroke', annoPolice.color)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '3,2')
                .style('opacity', 0.95);
            const xMid = (xStart + xEnd) / 2;
            const boxWidth = 220, boxHeight = 44;
            svg.append('rect')
                .attr('class', 'anno-police')
                .attr('x', xMid - boxWidth / 2)
                .attr('y', yLeader - boxHeight - 8)
                .attr('width', boxWidth)
                .attr('height', boxHeight)
                .attr('rx', 14)
                .style('fill', '#fff')
                .style('stroke', annoPolice.color)
                .style('stroke-width', 1.5)
                .style('opacity', 0.95)
                .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.07))');
            // Vertically and horizontally center the two lines of text in the box
            svg.append('text')
                .attr('class', 'anno-police')
                .attr('x', xMid)
                .attr('y', yLeader - boxHeight / 2 - 14)
                .attr('text-anchor', 'middle')
                .attr('font-size', '13px')
                .attr('font-weight', '600')
                .attr('fill', annoPolice.color)
                .attr('opacity', 0.95)
                .selectAll('tspan')
                .data(["Police detections drop as", "cameras take over"])
                .enter()
                .append('tspan')
                .attr('x', xMid)
                .attr('dy', (d, i) => i === 0 ? 0 : 18)
                .text(d => d)
                .attr('font-size', '13px')
                .attr('font-weight', '600');
        }

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
        d3.selectAll('.peak-info-box').remove();
        createChart();
    }, 250);


// ======================================================
// NAVIGATION AUTO-DETECTION
// ======================================================
document.addEventListener('DOMContentLoaded', function() {
    // Get current page filename
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    
    // Remove all active classes
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current page
    const activeItem = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
});
});
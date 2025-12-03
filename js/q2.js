// --- Q2 Responsive Multi-Chart Layout ---
// DATA GOVERNANCE NOTE: Aggregated public data only

// VIC should be green (#81BC00), TAS should be light blue (#BEDEDA)
const COLOR_PALETTE = [
    '#FFC900', // WA
    '#54ADD4', // NSW
    '#FFAEB4', // NT
    '#E14C70', // QLD
    '#C49EE8', // SA
    '#BEDEDA', // TAS
    '#81BC00', // VIC
    '#E9EF63' // ACT
];

const mainJids = ['NSW', 'QLD', 'VIC'];
const smallJids = ['WA', 'SA', 'TAS', 'NT', 'ACT'];

// --- Utility: Load CSV and reshape to long format ---
async function loadData() {
    const paths = [
        'data/Q2_Annual_fines_by_jurisdiction.csv',
        './data/Q2_Annual_fines_by_jurisdiction.csv',
        '../data/Q2_Annual_fines_by_jurisdiction.csv'
    ];
    for (let path of paths) {
        try {
            const raw = await d3.csv(path);
            if (!raw || !raw.length) continue;
            const headerCols = Object.keys(raw[0]);
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
            return long;
        } catch (e) { continue; }
    }
    throw new Error('Could not load Q2 CSV.');
}

// --- Color scale for jurisdictions ---
function getColorScale(jurisdictions) {
    return d3.scaleOrdinal().domain(jurisdictions).range(COLOR_PALETTE);
}

// --- Margins for charts (tuned for no clipping) ---
function getMargins(type = 'main') {
    return type === 'main'
        ? { top: 36, right: 140, bottom: 48, left: 64 } // extra right for labels/tooltip
        : { top: 32, right: 24, bottom: 36, left: 48 }; // more top for label
}

// --- ClipPath utility ---
function createClipPath(svg, width, height, id) {
    svg.append('clipPath')
        .attr('id', id)
        .append('rect')
        .attr('width', width)
        .attr('height', height);
}

// --- Tooltip utility ---
function createTooltip() {
    let tooltip = d3.select("#q2-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body")
            .append("div")
            .attr("id", "q2-tooltip")
            .attr("class", "q2-tooltip")
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("background", "#23272f")
            .style("border", "1px solid #23272f")
            .style("border-radius", "10px")
            .style("padding", "14px 18px 10px 18px")
            .style("font-size", "15px")
            .style("color", "#fff")
            .style("box-shadow", "0 4px 16px rgba(0,0,0,0.18)")
            .style("opacity", 0)
            .style("z-index", 1000)
            .style("min-width", "160px");
    }
    return tooltip;
}

// --- Main Chart Rendering (NSW/QLD/VIC) ---
function renderMainChart(svg, data, colorScale, width, height, margin, activeJurisdictions) {
    // Visualisation principle: Responsive, unclipped, direct labels, no chart junk, highlight on hover

    // Filter data for active jurisdictions
    const filteredData = data.filter(d => activeJurisdictions.includes(d.jurisdiction));
    const nested = d3.groups(filteredData, d => d.jurisdiction);

    // X/Y scales
    const x = d3.scaleTime()
        .domain(d3.extent(filteredData, d => d.date))
        .range([0, width]);
    const y = d3.scaleLinear()
        .domain([
            d3.min(filteredData, d => d.value),
            d3.max(filteredData, d => d.value)
        ]).nice()
        .range([height, 0]);

    // Axes (minimal gridlines, no chart junk)
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat('%Y')))
        .call(g => g.selectAll(".domain").attr("stroke-width", 1.2));
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(7).tickSize(-width).tickFormat(d3.format("~s")))
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.18));

    // Axis labels
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .attr('text-anchor', 'middle')
        .text('Year');
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 18)
        .attr('text-anchor', 'middle')
        .text('Annual Fines (Count)');

    // ClipPath for all chart elements
    createClipPath(svg, width, height, 'main-clip');

    // Area generator (for shaded region under line)
    const area = d3.area()
        .defined(d => d.value != null)
        .x(d => x(d.date))
        .y0(y.range()[0])
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const line = d3.line()
        .defined(d => d.value != null)
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    // --- Hover/Highlight logic ---
    const tooltip = createTooltip();

    // Draw shaded areas with animation
    const areaGroup = svg.append('g').attr('clip-path', 'url(#main-clip)');
    areaGroup.selectAll('.main-area')
        .data(nested, d => d[0])
        .join(
            enter => enter.append('path')
                .attr('class', d => `main-area area-${d[0]}`)
                .attr('fill', d => colorScale(d[0]))
                .attr('opacity', 0.18)
                .attr('d', d => area(d[1]))
                .attr('transform', 'scale(1,0)')
                .transition()
                .duration(900)
                .ease(d3.easeCubicOut)
                .attr('transform', 'scale(1,1)'),
            update => update
                .transition().duration(500)
                .attr('d', d => area(d[1]))
                .attr('fill', d => colorScale(d[0])),
            exit => exit.remove()
        );

    // Draw lines with animation
    const lineGroup = svg.append('g').attr('clip-path', 'url(#main-clip)');
    lineGroup.selectAll('.main-line')
        .data(nested, d => d[0])
        .join(
            enter => {
                const path = enter.append('path')
                    .attr('class', d => `main-line line-${d[0]}`)
                    .attr('fill', 'none')
                    .attr('stroke', d => colorScale(d[0]))
                    .attr('stroke-width', 2.5)
                    .attr('opacity', 0.7)
                    .attr('d', d => line(d[1]))
                    .on('mouseenter', function(event, d) {
                        d3.selectAll('.main-line').attr('opacity', 0.15);
                        d3.select(this).attr('opacity', 1).attr('stroke-width', 4);
                    })
                    .on('mouseleave', function(event, d) {
                        d3.selectAll('.main-line').attr('opacity', 0.7).attr('stroke-width', 2.5);
                    });
                // Animate line drawing
                path.each(function(d) {
                    const totalLength = this.getTotalLength();
                    d3.select(this)
                        .attr('stroke-dasharray', totalLength + ' ' + totalLength)
                        .attr('stroke-dashoffset', totalLength)
                        .transition()
                        .duration(1200)
                        .ease(d3.easeCubicInOut)
                        .attr('stroke-dashoffset', 0);
                });
                return path;
            },
            update => update
                .transition().duration(500)
                .attr('d', d => line(d[1]))
                .attr('stroke', d => colorScale(d[0])),
            exit => exit.remove()
        );

    // Draw points with animation
    const pointsGroup = svg.append('g').attr('clip-path', 'url(#main-clip)');
    pointsGroup.selectAll('.main-point')
        .data(filteredData, d => d.jurisdiction + d.date)
        .join(
            enter => enter.append('circle')
                .attr('class', d => `main-point point-${d.jurisdiction}`)
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d.value))
                .attr('r', 0)
                .attr('fill', d => colorScale(d.jurisdiction))
                .attr('opacity', 0.85)
                .on('mouseenter', function(event, d) {
                    d3.selectAll('.main-line').attr('opacity', 0.15);
                    d3.select(`.line-${d.jurisdiction}`).attr('opacity', 1).attr('stroke-width', 4);
                    // Q1-style tooltip: show all active series for this year
                    const year = d.date.getFullYear();
                    const yearData = filteredData.filter(e => e.date.getFullYear() === year && activeJurisdictions.includes(e.jurisdiction));
                    let html = `<div style='font-size:16px;font-weight:700;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:2px;'>${year}</div>`;
                    yearData.forEach(e => {
                        html += `<div style='display:flex;align-items:center;margin-bottom:2px;'>` +
                            `<span style='display:inline-block;width:12px;height:12px;border-radius:50%;background:${colorScale(e.jurisdiction)};margin-right:8px;'></span>` +
                            `<span style='font-weight:600;'>${e.jurisdiction}:</span> <span style='margin-left:4px;'>${d3.format(",")(e.value)}</span>` +
                            `</div>`;
                    });
                    tooltip.transition().duration(120).style('opacity', 1);
                    tooltip.html(html)
                        .style('left', (event.pageX + 16) + 'px')
                        .style('top', (event.pageY - 32) + 'px');
                    d3.select(this).attr('r', 7);
                })
                .on('mouseleave', function(event, d) {
                    d3.selectAll('.main-line').attr('opacity', 0.7).attr('stroke-width', 2.5);
                    tooltip.transition().duration(200).style('opacity', 0);
                    d3.select(this).attr('r', 4.5);
                })
                .transition()
                .delay((d, i) => 400 + i * 10)
                .duration(400)
                .attr('r', 4.5),
            update => update
                .transition().duration(500)
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d.value))
                .attr('fill', d => colorScale(d.jurisdiction)),
            exit => exit.remove()
        );

    // --- Direct labels (right edge, never clipped) ---
    nested.forEach(([j, arr]) => {
        const last = arr[arr.length - 1];
        svg.append('text')
            .attr('class', 'direct-label')
            .attr('x', x(last.date) + 12)
            .attr('y', y(last.value))
            .attr('dy', '0.35em')
            .attr('fill', colorScale(j))
            .attr('font-weight', 700)
            .attr('font-size', 15)
            .style('paint-order', 'stroke')
            .style('stroke', '#fff')
            .style('stroke-width', 4)
            .style('stroke-opacity', 0.8)
            .text(j);
    });

    // --- Annotation: Peak point (storytelling) ---
    const maxPoint = filteredData.reduce((a, b) => (a.value > b.value ? a : b));
    svg.append('circle')
        .attr('cx', x(maxPoint.date))
        .attr('cy', y(maxPoint.value))
        .attr('r', 8)
        .attr('fill', colorScale(maxPoint.jurisdiction))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 0.85);
    svg.append('text')
        .attr('x', x(maxPoint.date) + 18)
        .attr('y', y(maxPoint.value) - 18)
        .attr('class', 'annotation-label')
        .attr('fill', colorScale(maxPoint.jurisdiction))
        .attr('font-size', 13)
        .attr('font-weight', 700)
        .text(`Peak: ${maxPoint.jurisdiction} (${maxPoint.date.getFullYear()})`);
}

// --- Small Multiples Chart Rendering (WA/SA/TAS/NT/ACT) ---
function renderSmallMultiple(svg, data, color, width, height, margin, jid) {
    // Visualisation principle: minimalist, responsive, no overflow, direct label, tooltip

    // X/Y scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);
    const y = d3.scaleLinear()
        .domain([
            d3.min(data, d => d.value),
            d3.max(data, d => d.value)
        ]).nice()
        .range([height, 0]);

    // Axes (minimal, no chart junk)
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%Y')))
        .call(g => g.selectAll(".domain").attr("stroke-width", 1.2));
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(d3.format("~s")))
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.13));

    // Title (direct label, top-middle)
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top + 18)
        .attr('text-anchor', 'middle')
        .attr('class', 'axis-label')
        .attr('font-size', 15)
        .attr('font-weight', 'bold')
        .text(jid);

    // ClipPath
    createClipPath(svg, width, height, `clip-${jid}`);

    // Area generator (for shaded region under line)
    const area = d3.area()
        .defined(d => d.value != null)
        .x(d => x(d.date))
        .y0(y.range()[0])
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const line = d3.line()
        .defined(d => d.value != null)
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    // Draw shaded area with animation
    svg.append('g')
        .attr('clip-path', `url(#clip-${jid})`)
        .append('path')
        .datum(data)
        .attr('class', 'area')
        .attr('fill', color)
        .attr('opacity', 0.18)
        .attr('d', area)
        .attr('transform', 'scale(1,0)')
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr('transform', 'scale(1,1)');

    // Draw line with animation
    const linePath = svg.append('g')
        .attr('clip-path', `url(#clip-${jid})`)
        .append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line)
        .attr('stroke', color)
        .attr('fill', 'none')
        .attr('stroke-width', 2.2)
        .attr('opacity', 0.8);
    linePath.each(function(d) {
        const totalLength = this.getTotalLength();
        d3.select(this)
            .attr('stroke-dasharray', totalLength + ' ' + totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .attr('stroke-dashoffset', 0);
    });

    // Dots + tooltip, animated
    const tooltip = createTooltip();
    svg.append('g')
        .attr('clip-path', `url(#clip-${jid})`)
        .selectAll('.point')
        .data(data)
        .join('circle')
        .attr('class', 'point')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.value))
        .attr('r', 0)
        .attr('fill', color)
        .attr('opacity', 0.85)
        .on('mouseenter', function(event, d) {
            d3.select(this).attr('r', 7);
            // Q1-style tooltip: show year and value for this state
            let html = `<div style='font-size:16px;font-weight:700;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:2px;'>${d.date.getFullYear()}</div>`;
            html += `<div style='display:flex;align-items:center;margin-bottom:2px;'>` +
                `<span style='display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:8px;'></span>` +
                `<span style='font-weight:600;'>${jid}:</span> <span style='margin-left:4px;'>${d3.format(",")(d.value)}</span>` +
                `</div>`;
            tooltip.transition().duration(120).style('opacity', 1);
            tooltip.html(html)
                .style('left', (event.pageX + 16) + 'px')
                .style('top', (event.pageY - 32) + 'px');
        })
        .on('mouseleave', function(event, d) {
            d3.select(this).attr('r', 4);
            tooltip.transition().duration(200).style('opacity', 0);
        })
        .transition()
        .delay((d, i) => 400 + i * 10)
        .duration(400)
        .attr('r', 4);
}

// --- Jurisdiction Toggle UI (checkboxes) ---
function renderJurisdictionToggles(jurisdictions, active, onChange) {
    const grid = document.getElementById('jurisdiction-grid');
    grid.innerHTML = '';
    jurisdictions.forEach(jid => {
        const label = document.createElement('label');
        label.className = 'jurisdiction-toggle-label';
        label.style.marginRight = '18px';
        label.style.fontWeight = '600';
        label.style.color = '#222';
        label.style.display = 'inline-flex';
        label.style.alignItems = 'center';
        label.style.cursor = 'pointer';

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = active.includes(jid);
        box.value = jid;
        box.style.marginRight = '7px';
        box.addEventListener('change', () => {
            onChange(jid, box.checked);
        });

        // Color swatch
        const swatch = document.createElement('span');
        swatch.style.display = 'inline-block';
        swatch.style.width = '16px';
        swatch.style.height = '16px';
        swatch.style.background = COLOR_PALETTE[mainJids.indexOf(jid)];
        swatch.style.borderRadius = '4px';
        swatch.style.marginRight = '7px';

        label.appendChild(box);
        label.appendChild(swatch);
        label.appendChild(document.createTextNode(jid));
        grid.appendChild(label);
    });
}

// --- Main Render Function ---
async function render() {
    // --- Layout containers ---
    const chartDiv = document.getElementById('chart');
    chartDiv.innerHTML = '';

    // (Header removed; handled in HTML. Only section titles remain below.)

    // --- Jurisdiction toggles state ---
    if (!window.q2ActiveJids) window.q2ActiveJids = [...mainJids];
    const activeJids = window.q2ActiveJids;

    // Load data
    const data = await loadData();
    const jurisdictions = Array.from(new Set(data.map(d => d.jurisdiction))).sort();
    const colorScale = getColorScale(jurisdictions);

    // --- Section: Major States ---
    let majorSection = document.getElementById('q2-major-section');
    if (!majorSection) {
        majorSection = document.createElement('section');
        majorSection.id = 'q2-major-section';
        // Use beige background same as .visualization-container (beige: #FCFAF9)
        majorSection.style.background = '#FCFAF9';
        majorSection.style.borderRadius = '10px';
        majorSection.style.boxShadow = '0 1px 8px rgba(0,0,0,0.04)';
        majorSection.style.padding = '18px 12px 12px 12px';
        majorSection.style.marginBottom = '0px';
        chartDiv.appendChild(majorSection);
    } else {
        majorSection.innerHTML = '';
        // Ensure background is correct if section is reused
        majorSection.style.background = '#FCFAF9';
    }

    // --- Major States Title ---
    let majorTitle = document.createElement('h3');
    majorTitle.textContent = 'Major States: NSW, QLD and VIC';
    majorTitle.style.margin = '0 0 8px 0';
    majorTitle.style.fontWeight = '700';
    majorTitle.style.fontSize = '1.25rem';
    majorTitle.style.color = '#2a3a4d';
    majorSection.appendChild(majorTitle);

    // --- Caption below heading, centered ---
    let mainCaption = document.createElement('div');
    mainCaption.textContent = 'These three states are shown together because they have the largest populations and the most fines. Their numbers are much higher mainly due to more people, more cars, and more cameras.';
    mainCaption.style.fontSize = '1rem';
    mainCaption.style.color = '#444';
    mainCaption.style.margin = '0 0 12px 0';
    mainCaption.style.textAlign = 'center';
    majorSection.appendChild(mainCaption);

    // --- Responsive sizing ---
    const containerWidth = chartDiv.clientWidth || 900;
    const mainMargin = getMargins('main');
    const mainWidth = Math.max(340, containerWidth - mainMargin.left - mainMargin.right);
    const mainHeight = 340;

    // --- Main chart SVG ---
    let mainChartDiv = document.createElement('div');
    mainChartDiv.style.width = '100%';
    mainChartDiv.style.margin = '0';
    // Center the SVG horizontally
    mainChartDiv.style.display = 'flex';
    mainChartDiv.style.justifyContent = 'center';
    majorSection.appendChild(mainChartDiv);
    const mainSvg = d3.select(mainChartDiv)
        .append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0 ${mainWidth + mainMargin.left + mainMargin.right} ${mainHeight + mainMargin.top + mainMargin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('display', 'block')
        .style('max-width', '100%')
        .append('g')
        .attr('transform', `translate(${mainMargin.left},${mainMargin.top})`);

    // --- Legend-based filter for major states (like Q1) ---
    let legendDiv = document.createElement('div');
    legendDiv.id = 'q2-legend';
    legendDiv.style.display = 'flex';
    legendDiv.style.alignItems = 'center';
    legendDiv.style.justifyContent = 'center';
    legendDiv.style.gap = '14px';
    legendDiv.style.margin = '18px 0 0 0';


    // Legend logic (always use correct color order, no duplicate)
    legendDiv.innerHTML = '';
    const legendColors = { 'NSW': '#54ADD4', 'QLD': '#E14C70', 'VIC': '#81BC00' };
    mainJids.forEach(jid => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.cursor = 'pointer';
        item.style.opacity = activeJids.includes(jid) ? '1' : '0.4';
        item.style.transition = 'opacity 0.2s';
        // Color swatch
        const swatch = document.createElement('span');
        swatch.style.display = 'inline-block';
        swatch.style.width = '18px';
        swatch.style.height = '18px';
        swatch.style.background = legendColors[jid];
        swatch.style.borderRadius = '4px';
        swatch.style.marginRight = '8px';
        item.appendChild(swatch);
        // Label
        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = jid;
        label.style.fontWeight = '600';
        label.style.fontSize = '15px';
        label.style.color = '#2a3a4d';
        item.appendChild(label);
        // Click to toggle
        item.onclick = () => {
            if (activeJids.includes(jid)) {
                if (activeJids.length > 1) {
                    activeJids.splice(activeJids.indexOf(jid), 1);
                }
            } else {
                activeJids.push(jid);
            }
            window.q2ActiveJids = activeJids;
            render();
        };
        legendDiv.appendChild(item);
    });

    // Attach legend below chart, slider is in HTML
    majorSection.appendChild(legendDiv);


    // Initial render: show all years
    renderMainChart(
        mainSvg,
        data.filter(d => mainJids.includes(d.jurisdiction)),
        colorScale,
        mainWidth,
        mainHeight,
        mainMargin,
        activeJids
    );

    // --- Section: Other States and Territories ---
    let otherSection = document.getElementById('q2-other-section');
    if (!otherSection) {
        otherSection = document.createElement('section');
        otherSection.id = 'q2-other-section';
        otherSection.style.background = '#f7fafd';
        otherSection.style.borderRadius = '10px';
        otherSection.style.boxShadow = '0 1px 8px rgba(0,0,0,0.03)';
        otherSection.style.padding = '18px 12px 12px 12px';
        otherSection.style.marginTop = '18px';
        chartDiv.appendChild(otherSection);
    } else {
        otherSection.innerHTML = '';
    }

    // --- Other States Title ---
    let otherTitle = document.createElement('h3');
    otherTitle.textContent = 'Other States and Territories';
    otherTitle.style.margin = '0 0 8px 0';
    otherTitle.style.fontWeight = '700';
    otherTitle.style.fontSize = '1.15rem';
    otherTitle.style.color = '#2a3a4d';
    otherSection.appendChild(otherTitle);

    // --- Small multiples caption ---
    let smallCaption = document.createElement('div');
    smallCaption.textContent = 'These charts show the rest of the country, with each state or territory on its own scale so you can see the differences more clearly.';
    smallCaption.style.fontSize = '0.98rem';
    smallCaption.style.color = '#444';
    smallCaption.style.margin = '0 0 10px 0';
    smallCaption.style.textAlign = 'center';
    otherSection.appendChild(smallCaption);

    // --- Small multiples grid ---
    let gridDiv = document.createElement('div');
    gridDiv.id = 'small-multiples-container';
    gridDiv.className = 'small-multiples-container';
    gridDiv.style.display = 'grid';
    gridDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
    gridDiv.style.gap = '22px 22px';
    gridDiv.style.justifyItems = 'stretch';
    gridDiv.style.alignItems = 'stretch';
    gridDiv.style.margin = '0 auto';
    gridDiv.style.maxWidth = '1100px';
    gridDiv.style.width = '100%';
    otherSection.appendChild(gridDiv);

    // --- Responsive grid: 2–3 per row, fill card ---
    const smallMargin = getMargins('small');
    // Small multiples fill their card, height is larger for visibility
    const smallWidth = 400; // SVG viewBox width (not CSS width)
    const smallHeight = 260; // SVG viewBox height (not CSS height)

    smallJids.forEach(jid => {
        const smDiv = document.createElement('div');
        smDiv.className = 'small-multiple-cell';
        smDiv.style.background = '#fff';
        smDiv.style.borderRadius = '8px';
        smDiv.style.boxShadow = '0 1px 6px rgba(0,0,0,0.03)';
        smDiv.style.padding = '8px 8px 2px 8px';
        smDiv.style.display = 'flex';
        smDiv.style.flexDirection = 'column';
        smDiv.style.alignItems = 'stretch';
        smDiv.style.justifyContent = 'center';
        smDiv.style.width = '100%';
        smDiv.style.height = '100%';
        gridDiv.appendChild(smDiv);
        const svg = d3.select(smDiv)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${smallWidth + smallMargin.left + smallMargin.right} ${smallHeight + smallMargin.top + smallMargin.bottom}`)
            .attr('preserveAspectRatio', 'none')
            .style('display', 'block')
            .style('width', '100%')
            .style('height', '220px')
            .style('max-width', '100%')
            .append('g')
            .attr('transform', `translate(${smallMargin.left},${smallMargin.top})`);
        renderSmallMultiple(
            svg,
            data.filter(d => d.jurisdiction === jid),
            colorScale(jid),
            smallWidth,
            smallHeight,
            smallMargin,
            jid
        );
    });

}


// --- Redraw on resize ---
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 200);
});

// --- Initial render ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
} else {
    render();
}

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
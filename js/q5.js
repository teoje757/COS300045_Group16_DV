const svg = d3.select("#heatmap");
const tooltip = d3.select("#heatmap-tooltip");
const legendContainer = d3.select("#legend-scale");
const annotationsEl = d3.select("#annotation-list");

const startSelect = document.getElementById("start-year");
const endSelect = document.getElementById("end-year");
const focusSelect = document.getElementById("focus-jurisdiction");
const deltaToggle = document.getElementById("delta-toggle");
const resetBtn = document.getElementById("reset-btn");

const margin = { top: 20, right: 20, bottom: 80, left: 120 };
const width = 960;
const height = 560;
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const xAxisGroup = chart.append("g").attr("transform", `translate(0,${chartHeight})`);
const yAxisGroup = chart.append("g");
const cellsGroup = chart.append("g");

chart
    .append("text")
    .attr("class", "axis-label")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 60)
    .attr("text-anchor", "middle")
    .text("Jurisdiction (ordered west → east)");

chart
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -chartHeight / 2)
    .attr("y", -90)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Year");

const xScale = d3.scaleBand().paddingInner(0.1).paddingOuter(0.05);
const yScale = d3.scaleBand().padding(0.08);

// Colour-blind-safe palettes per brief (Viridis for magnitude, PRGn for change)
const colorScale = d3.scaleSequential(d3.interpolateViridis);
const divergingScale = d3.scaleDiverging(d3.interpolatePRGn);

// Ordered categories (west → east) keep spatial reasoning consistent
const jurisdictionOrder = ["WA", "NT", "SA", "QLD", "NSW", "ACT", "VIC", "TAS"];
let dataset = [];
let valueLookup = new Map();
let years = [];
let finesExtent = [0, 1];
let deltaExtent = [1, -1];

const formatter = d3.format(",d");
const deltaFormatter = d3.format("+,.0f");

function populateSelect(select, options) {
    select.innerHTML = options.map((opt) => `<option value="${opt}">${opt}</option>`).join("");
}

function populateControls() {
    populateSelect(startSelect, years);
    populateSelect(endSelect, years);

    startSelect.value = String(years[0]);
    endSelect.value = String(years[years.length - 1]);

    focusSelect.innerHTML =
        '<option value="ALL">All states</option>' +
        jurisdictionOrder.map((jur) => `<option value="${jur}">${jur}</option>`).join("");
}

function filterData() {
    const startYear = Number(startSelect.value);
    const endYear = Number(endSelect.value);
    if (startYear > endYear) {
        [startSelect.value, endSelect.value] = [endYear, startYear].map(String);
    }

    return dataset.filter(
        (d) => d.year >= Number(startSelect.value) && d.year <= Number(endSelect.value)
    );
}

function getDelta(year, jurisdiction) {
    const currentKey = `${year}-${jurisdiction}`;
    const prevKey = `${year - 1}-${jurisdiction}`;
    if (!valueLookup.has(currentKey) || !valueLookup.has(prevKey)) return undefined;
    return valueLookup.get(currentKey) - valueLookup.get(prevKey);
}

function updateScales(filtered) {
    const filteredYears = Array.from(new Set(filtered.map((d) => d.year))).sort((a, b) => b - a);
    yScale.domain(filteredYears).range([0, chartHeight]);
    xScale.domain(jurisdictionOrder).range([0, chartWidth]);
}

function updateLegend(isDelta) {
    legendContainer.html("");

    const stops = isDelta ? [-1, -0.5, 0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    const scale = isDelta ? divergingScale : colorScale;
    const domain = scale.domain();
    const values = stops.map((s, i) => {
        if (isDelta) {
            const [min, mid, max] = domain;
            return i === stops.length - 1
                ? max
                : min + ((max - min) * (s + 1)) / 2; // map -1..1 to domain
        }
        return domain[0] + (domain[1] - domain[0]) * s;
    });

    const gradient = legendContainer
        .append("div")
        .attr("class", "legend-bar")
        .style(
            "background",
            `linear-gradient(90deg, ${values
                .map((v) => scale(v))
                .join(",")})`
        );

    const stopsRow = legendContainer.append("div").attr("class", "legend-stops");
    values.forEach((val, idx) => {
        stopsRow.append("span").text(isDelta ? deltaFormatter(val) : formatter(val));
    });

    legendContainer
        .append("p")
        .attr("class", "legend-caption")
        .text(isDelta ? "Purple = decline, Green = increase" : "Light = few fines, Dark = many fines");
}

function updateAnnotations(filtered) {
    const focus = focusSelect.value;
    const relevant = filtered.filter((d) => (focus === "ALL" ? true : d.jurisdiction === focus));
    const topCells = relevant
        .map((d) => ({
            ...d,
            delta: getDelta(d.year, d.jurisdiction)
        }))
        .sort((a, b) => b.fines - a.fines)
        .slice(0, 3);

    annotationsEl.html("");
    if (!topCells.length) {
        annotationsEl.append("li").text("No data for the selected filters.");
        return;
    }

    topCells.forEach((cell) => {
        const narrative =
            cell.delta === undefined
                ? "first available year"
                : cell.delta > 0
                ? "still climbing"
                : cell.delta < 0
                ? "cooling after spike"
                : "holding steady";
        annotationsEl
            .append("li")
            .text(
                `${cell.jurisdiction} ${cell.year}: ${formatter(cell.fines)} fines ${cell.delta !== undefined ? `(${deltaFormatter(cell.delta)} vs ${cell.year - 1})` : ""} — ${narrative}`
            );
    });
}

function updateChart() {
    const filtered = filterData();
    updateScales(filtered);

    const isDelta = deltaToggle.checked;
    const scale = isDelta ? divergingScale : colorScale;

    xAxisGroup
        .transition()
        .duration(500)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "translate(0,5)")
        .style("text-anchor", "middle");

    yAxisGroup.transition().duration(500).call(d3.axisLeft(yScale).tickFormat(d3.format("d")));

    const focus = focusSelect.value;

    const cells = cellsGroup.selectAll("rect.cell").data(filtered, (d) => `${d.year}-${d.jurisdiction}`);

    cells
        .join(
            (enter) =>
                enter
                    .append("rect")
                    .attr("class", "cell")
                    .attr("x", (d) => xScale(d.jurisdiction))
                    .attr("y", (d) => yScale(d.year))
                    .attr("width", xScale.bandwidth())
                    .attr("height", yScale.bandwidth())
                    .attr("rx", 4)
                    .attr("ry", 4)
                    .attr("fill", "#f0f4fb")
                    .attr("opacity", 0)
                    .call((enterSel) =>
                        enterSel
                            .transition()
                            .duration(600)
                            .attr("opacity", 1)
                    ),
            (update) =>
                update.call((updateSel) =>
                    updateSel
                        .transition()
                        .duration(600)
                        .attr("x", (d) => xScale(d.jurisdiction))
                        .attr("y", (d) => yScale(d.year))
                        .attr("width", xScale.bandwidth())
                        .attr("height", yScale.bandwidth())
                ),
            (exit) =>
                exit.call((exitSel) =>
                    exitSel
                        .transition()
                        .duration(300)
                        .attr("opacity", 0)
                        .remove()
                )
        )
        .attr("stroke-width", (d) => (focus === d.jurisdiction ? 2 : 1))
        .attr("stroke", (d) => (focus === d.jurisdiction ? "#0f6ed6" : "rgba(32,42,56,0.15)"))
        .transition()
        .duration(600)
        .attr("fill", (d) => {
            const key = `${d.year}-${d.jurisdiction}`;
            const val = isDelta ? getDelta(d.year, d.jurisdiction) : valueLookup.get(key);
            if (val === undefined) return "#dfe6ef";
            return scale(val);
        })
        .attr("opacity", (d) => (focus === "ALL" || focus === d.jurisdiction ? 1 : 0.35));

    cellsGroup
        .selectAll("rect.cell")
        .on("mousemove", (event, d) => {
            const key = `${d.year}-${d.jurisdiction}`;
            const value = valueLookup.get(key);
            const delta = getDelta(d.year, d.jurisdiction);
            tooltip
                .style("opacity", 1)
                .style("left", `${event.pageX + 15}px`)
                .style("top", `${event.pageY - 15}px`)
                .html(
                    `<strong>${d.jurisdiction} · ${d.year}</strong><br>` +
                        `${formatter(value)} fines` +
                        (delta !== undefined ? `<br>${deltaFormatter(delta)} vs ${d.year - 1}` : "")
                );
        })
        .on("mouseleave", () => tooltip.style("opacity", 0));

    updateLegend(isDelta);
    updateAnnotations(filtered);
}

function attachEvents() {
    // Filters provide user agency (year, jurisdiction) without exposing row-level data
    [startSelect, endSelect, focusSelect].forEach((el) =>
        el.addEventListener("change", () => updateChart())
    );
    deltaToggle.addEventListener("change", () => updateChart());
    resetBtn.addEventListener("click", () => {
        startSelect.value = String(years[0]);
        endSelect.value = String(years[years.length - 1]);
        focusSelect.value = "ALL";
        deltaToggle.checked = false;
        updateChart();
    });
}

d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", (d) => ({
    year: +d.YEAR,
    jurisdiction: d.JURISDICTION,
    fines: +d.FINES
})).then((data) => {
    dataset = data.sort((a, b) => d3.ascending(a.year, b.year));
    years = Array.from(new Set(dataset.map((d) => d.year))).sort((a, b) => a - b);
    finesExtent = d3.extent(dataset, (d) => d.fines);
    valueLookup = new Map(dataset.map((d) => [`${d.year}-${d.jurisdiction}`, d.fines]));

    const deltas = dataset
        .map((d) => getDelta(d.year, d.jurisdiction))
        .filter((v) => Number.isFinite(v));
    deltaExtent = d3.extent(deltas.length ? deltas : [0, 1]);

    colorScale.domain(finesExtent);
    divergingScale.domain([deltaExtent[0], 0, deltaExtent[1]]);

    populateControls();
    attachEvents();
    updateChart();
}).catch((error) => {
    console.error("Failed to load CSV", error);
    annotationsEl.html("<li>Unable to load data. Please check the CSV path.</li>");
});


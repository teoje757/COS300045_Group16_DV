const svg = d3.select("#heatmap");
const tooltip = d3.select("#heatmap-tooltip");
const legendContainer = d3.select("#legend-scale");
const annotationsEl = d3.select("#annotation-list");

const mapSvg = d3.select("#aus-map");
const mapTooltip = d3.select("#map-tooltip");
const mapLegend = d3.select("#map-legend");
const mapAnnotation = d3.select("#map-annotation");

const startSelect = document.getElementById("start-year");
const endSelect = document.getElementById("end-year");
const focusSelect = document.getElementById("focus-jurisdiction");
const deltaToggle = document.getElementById("delta-toggle");
const resetBtn = document.getElementById("reset-btn");
const mapYearSlider = document.getElementById("map-year-range");
const mapYearLabel = document.getElementById("map-year-label");

const margin = { top: 20, right: 20, bottom: 80, left: 120 };
const width = 960;
const height = 560;
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

svg.attr("viewBox", `0 0 ${width} ${height}`);
mapSvg.attr("viewBox", "0 0 960 520");

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
const mapColorScale = d3.scaleSequential(d3.interpolateViridis);
const mapProjection = d3.geoMercator();
const mapPath = d3.geoPath(mapProjection);

// Ordered categories (west → east) keep spatial reasoning consistent
const jurisdictionOrder = ["WA", "NT", "SA", "QLD", "NSW", "ACT", "VIC", "TAS"];
let dataset = [];
let valueLookup = new Map();
let years = [];
let finesExtent = [0, 1];
let deltaExtent = [1, -1];
let mapYear = 2024;
const AUS_GEOJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            id: "WA",
            properties: { name: "Western Australia" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [112, -35],
                        [113.5, -34.5],
                        [115, -31.5],
                        [116.5, -30.5],
                        [119, -28.5],
                        [121, -26],
                        [123, -24],
                        [124, -22],
                        [124, -19],
                        [122, -18],
                        [120, -16],
                        [118, -17.5],
                        [117, -21],
                        [115, -24],
                        [113.5, -27],
                        [112.5, -30],
                        [112, -33],
                        [112, -35]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "NT",
            properties: { name: "Northern Territory" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [129, -26],
                        [137, -26],
                        [138, -23],
                        [137.5, -18],
                        [135, -14],
                        [132, -12],
                        [129, -13],
                        [129, -26]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "SA",
            properties: { name: "South Australia" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [129, -37.5],
                        [140.5, -37.5],
                        [140.5, -35],
                        [138, -34],
                        [137, -32],
                        [135, -31],
                        [133, -32],
                        [131.5, -34],
                        [129, -35],
                        [129, -37.5]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "QLD",
            properties: { name: "Queensland" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [138, -28.5],
                        [141, -28.5],
                        [146, -29],
                        [152, -25],
                        [153.5, -22],
                        [152.5, -19],
                        [150, -14],
                        [147, -12],
                        [143, -11],
                        [141, -13],
                        [139.5, -17],
                        [138, -22],
                        [138, -28.5]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "NSW",
            properties: { name: "New South Wales" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [141, -37],
                        [151, -37],
                        [152.5, -34],
                        [151.5, -31],
                        [150, -29],
                        [147, -29.2],
                        [144, -33],
                        [141, -34],
                        [141, -37]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "ACT",
            properties: { name: "Australian Capital Territory" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [148.7, -35.5],
                        [149.3, -35.5],
                        [149.3, -35],
                        [148.7, -35],
                        [148.7, -35.5]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "VIC",
            properties: { name: "Victoria" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [141, -39],
                        [149, -39],
                        [150, -38],
                        [147, -36],
                        [144, -36.5],
                        [142, -38],
                        [141, -39]
                    ]
                ]
            }
        },
        {
            type: "Feature",
            id: "TAS",
            properties: { name: "Tasmania" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [144, -44.5],
                        [148, -44.5],
                        [149, -42],
                        [147, -41],
                        [145, -42],
                        [144, -44.5]
                    ]
                ]
            }
        }
    ]
};

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
    mapYearSlider.min = years[0];
    mapYearSlider.max = years[years.length - 1];
    mapYearSlider.value = mapYear = years[years.length - 1];
    mapYearLabel.textContent = mapYear;

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

function getYearData(year) {
    return dataset.filter((d) => d.year === year).reduce((map, curr) => {
        map.set(curr.jurisdiction, curr.fines);
        return map;
    }, new Map());
}

function drawMap() {
    const mapFeatures = AUS_GEOJSON.features;
    mapProjection.fitSize([900, 450], AUS_GEOJSON);
    mapSvg
        .selectAll("path.state")
        .data(mapFeatures, (d) => d.id)
        .join("path")
        .attr("class", "state")
        .attr("d", mapPath)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.2)
        .on("mousemove", (event, d) => {
            const yearData = getYearData(mapYear);
            const value = yearData.get(d.id);
            mapTooltip
                .style("opacity", 1)
                .style("left", `${event.pageX + 15}px`)
                .style("top", `${event.pageY - 10}px`)
                .html(
                    `<strong>${d.properties.STATE_NAME || d.properties.name}</strong><br>${mapYear}: ${
                        value !== undefined ? formatter(value) : "No data"
                    } fines`
                );
        })
        .on("mouseleave", () => mapTooltip.style("opacity", 0));
}

function updateMap() {
    const mapFeatures = AUS_GEOJSON.features;
    const yearData = getYearData(mapYear);
    mapYearLabel.textContent = mapYear;
    mapColorScale.domain(finesExtent);

    mapSvg
        .selectAll("path.state")
        .transition()
        .duration(600)
        .attr("fill", (d) => {
            const value = yearData.get(d.id);
            return value !== undefined ? mapColorScale(value) : "#dfe6ef";
        });

    const topJurisdiction = jurisdictionOrder
        .map((code) => ({ code, value: yearData.get(code) }))
        .filter((d) => d.value !== undefined)
        .sort((a, b) => b.value - a.value)[0];

    if (topJurisdiction) {
        mapAnnotation.textContent = `${topJurisdiction.code} holds the lead in ${mapYear} with ${formatter(
            topJurisdiction.value
        )} fines (camera surge phase).`;
    } else {
        mapAnnotation.textContent = "No data for selected year.";
    }

    updateMapLegend();
}

function updateMapLegend() {
    mapLegend.html("");
    mapLegend.append("span").text(formatter(finesExtent[0]));
    mapLegend.append("div").attr("class", "map-legend-bar");
    mapLegend.append("span").text(formatter(finesExtent[1]));
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
    mapYearSlider.addEventListener("input", (event) => {
        mapYear = Number(event.target.value);
        updateMap();
    });
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
}))
    .then((data) => {
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
        mapColorScale.domain(finesExtent);

        populateControls();
        attachEvents();
        drawMap();
        updateMap();
        updateChart();
    })
    .catch((error) => {
        console.error("Failed to load Q5 CSV", error);
        annotationsEl.html("<li>Unable to load data. Please check the CSV path.</li>");
        mapAnnotation.textContent = "Map unavailable — CSV failed to load.";
    });


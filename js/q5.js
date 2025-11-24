const svg = d3.select("#heatmap");
const tooltip = d3.select("#heatmap-tooltip");
const legendContainer = d3.select("#legend-scale");
const annotationsEl = d3.select("#annotation-list");
const mapLegendContainer = d3.select("#map-legend");

// Global state
let currentYear = 2008;
let isPlaying = false;
let playInterval;
let colorScale;
let svg;
let dataMap = {};

// Dimensions
const w = 1100; // Increased from 850 to match card width
const h = 700;

// Projection
const projection = d3.geo.mercator()
    .center([132, -28])
    .translate([w / 2, h / 2])
    .scale(1000);

const path = d3.geo.path().projection(projection);

// Tooltip
const tooltip = d3.select("#tooltip");

// Correct mapping: GeoJSON → CSV jurisdiction codes
const geoToCsv = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT"
};

// ======================================================
// LOAD CSV
// ======================================================
d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", function (error, csvData) {

// Colour-blind-safe palettes per brief (Viridis for magnitude, PRGn for change)
const colorScale = d3.scaleSequential(d3.interpolateViridis);
const divergingScale = d3.scaleDiverging(d3.interpolatePRGn);
const mapColorScale = d3.scaleSequential(d3.interpolateYlOrRd);

// Ordered categories (west → east) keep spatial reasoning consistent
const jurisdictionOrder = ["WA", "NT", "SA", "QLD", "NSW", "ACT", "VIC", "TAS"];
let dataset = [];
let valueLookup = new Map();
let years = [];
let finesExtent = [0, 1];
let deltaExtent = [1, -1];
let geojsonData = null;
let mapInstance = null;
let choroplethLayer = null;
let heatLayer = null;

const formatter = d3.format(",d");
const deltaFormatter = d3.format("+,.0f");

const jurisdictionMeta = {
    WA: { name: "Western Australia", lat: -31.95, lng: 115.86 },
    NT: { name: "Northern Territory", lat: -12.46, lng: 130.84 },
    SA: { name: "South Australia", lat: -34.93, lng: 138.6 },
    QLD: { name: "Queensland", lat: -27.47, lng: 153.02 },
    NSW: { name: "New South Wales", lat: -33.86, lng: 151.21 },
    ACT: { name: "Australian Capital Territory", lat: -35.28, lng: 149.13 },
    VIC: { name: "Victoria", lat: -37.81, lng: 144.96 },
    TAS: { name: "Tasmania", lat: -42.88, lng: 147.33 }
};

const stateNameMap = {
    WA: "Western Australia",
    NT: "Northern Territory",
    SA: "South Australia",
    QLD: "Queensland",
    NSW: "New South Wales",
    ACT: "Australian Capital Territory",
    VIC: "Victoria",
    TAS: "Tasmania"
};

const geoNameToCode = Object.fromEntries(Object.entries(stateNameMap).map(([code, name]) => [name, code]));
const geoJsonUrl =
    "https://raw.githubusercontent.com/rowanhogan/australian-states/master/states.geojson";

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

    // Build lookup map: dataMap[year][jurisdiction] = fines
    csvData.forEach(d => {
        const year = +d.YEAR;
        const state = d.JURISDICTION.trim();
        const value = +d.FINES;

        if (!dataMap[year]) dataMap[year] = {};
        dataMap[year][state] = value;
    });

    const allValues = csvData.map(d => +d.FINES);
    const maxValue = d3.max(allValues);

    // Color scale
    colorScale = d3.scale.linear()
        .domain([0, maxValue])
        .range(["#ffffcc", "#800026"])
        .interpolate(d3.interpolateHcl);

    // Create SVG
    svg = d3.select("#svganchor")
        .append("svg")
        .attr("width", w)
        .attr("height", h);

    // Lookup helper
    function getValue(stateCode, year) {
        if (!stateCode) return 0;
        if (dataMap[year] && dataMap[year][stateCode] !== undefined) {
            return dataMap[year][stateCode];
        }
        return 0;
    }

    // ======================================================
    // UPDATE MAP COLOURS
    // ======================================================
    function updateMap(year) {
        currentYear = year;
        document.getElementById("yearDisplay").textContent = year;
        document.getElementById("yearSlider").value = year;

        svg.selectAll(".state-path")
            .transition()
            .duration(300)
            .attr("fill", function (d) {
                const rawName = d.properties.STATE_NAME || d.properties.STE_NAME16;
                const stateCode = geoToCsv[rawName];
                const value = getValue(stateCode, year);
                return colorScale(value);
            });
    }

    // Make updateMap accessible globally for controls
    window.updateMap = updateMap;

    // ======================================================
    // LOAD GEOJSON
    // ======================================================
    d3.json("https://raw.githubusercontent.com/tonywr71/GeoJson-Data/master/australian-states.json",
        function (geoError, json) {

            if (geoError) {
                console.error("Error loading GeoJSON:", geoError);
                document.getElementById("loading").innerHTML = "Error loading map data.";
                return;
            }

            document.getElementById("loading").style.display = "none";

            // --------------------------------------------------
            // DRAW STATES
            // --------------------------------------------------
            svg.selectAll("path")
                .data(json.features)
                .enter()
                .append("path")
                .attr("class", "state-path")
                .attr("d", path)
                .attr("fill", function (d) {
                    const rawName = d.properties.STATE_NAME || d.properties.STE_NAME16;
                    const stateCode = geoToCsv[rawName];
                    const value = getValue(stateCode, currentYear);
                    return colorScale(value);
                })
                .on("mouseover", function (d) {
                    const rawName = d.properties.STATE_NAME || d.properties.STE_NAME16;
                    const stateCode = geoToCsv[rawName];
                    const value = getValue(stateCode, currentYear);

                    tooltip.style("opacity", 1)
                        .html(`<strong>${rawName}</strong><br>Year: ${currentYear}<br>Fines: ${value.toLocaleString()}`);
                })
                .on("mousemove", () => {
                    tooltip.style("left", (d3.event.pageX + 10) + "px")
                        .style("top", (d3.event.pageY - 28) + "px");
                })
                .on("mouseout", () => tooltip.style("opacity", 0));

            // --------------------------------------------------
            // STATE LABELS
            // --------------------------------------------------
            svg.selectAll(".state-label")
                .data(json.features)
                .enter()
                .append("text")
                .attr("class", "state-label")
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .attr("transform", d => "translate(" + path.centroid(d) + ")")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("fill", "#333")
                .text(d => {
                    const rawName = d.properties.STATE_NAME || d.properties.STE_NAME16;
                    return geoToCsv[rawName];
                });

            // --------------------------------------------------
            // LEGEND BELOW SLIDER
            // --------------------------------------------------
            const legendSvg = d3.select("#legendContainer")
                .append("svg")
                .attr("width", 320)
                .attr("height", 60);

            const defs = legendSvg.append("defs");
            const gradient = defs.append("linearGradient")
                .attr("id", "legend-gradient");

            gradient.selectAll("stop")
                .data(colorScale.range())
                .enter()
                .append("stop")
                .attr("offset", (d, i) => i / (colorScale.range().length - 1))
                .attr("stop-color", d => d);

            const legend = legendSvg.append("g")
                .attr("transform", "translate(10, 10)");

            legend.append("rect")
                .attr("width", 300)
                .attr("height", 20)
                .style("fill", "url(#legend-gradient)")
                .style("stroke", "#333");

            const legendScale = d3.scale.linear()
                .domain([0, maxValue])
                .range([0, 300]);

            const legendAxis = d3.svg.axis()
                .scale(legendScale)
                .orient("bottom")
                .ticks(5)
                .tickFormat(d3.format(".2s"));

            legend.append("g")
                .attr("transform", "translate(0, 20)")
                .call(legendAxis);

            // ======================================================
            // SLIDER + PLAY CONTROLS
            // ======================================================
            document.getElementById("yearSlider").addEventListener("input", function () {
                if (isPlaying) stopPlay();
                updateMap(+this.value);
            });

            function startPlay() {
                isPlaying = true;
                document.getElementById("playBtn").textContent = "Pause";

                playInterval = setInterval(() => {
                    if (currentYear < 2024) {
                        updateMap(currentYear + 1);
                    } else {
                        updateMap(2008);
                    }
                }, 1000);
            }

            function stopPlay() {
                isPlaying = false;
                document.getElementById("playBtn").textContent = "Play";
                clearInterval(playInterval);
            }

            document.getElementById("playBtn").addEventListener("click", () => {
                isPlaying ? stopPlay() : startPlay();
            });

            document.getElementById("resetBtn").addEventListener("click", () => {
                stopPlay();
                updateMap(2008);
            });
        }
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

function aggregateByJurisdiction(records) {
    const totals = {};
    records.forEach((d) => {
        if (!Number.isFinite(d.fines)) return;
        totals[d.jurisdiction] = (totals[d.jurisdiction] || 0) + d.fines;
    });
    return totals;
}

function initLeaflet() {
    if (mapInstance || !document.getElementById("australia-map")) return;
    mapInstance = L.map("australia-map", {
        scrollWheelZoom: false,
        minZoom: 3,
        maxZoom: 8
    }).setView([-25.3, 133.77], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19
    }).addTo(mapInstance);
}

function updateMapLegendRange(min, max) {
    if (!mapLegendContainer.node()) return;
    mapLegendContainer.html("");

    const steps = 5;
    const values = d3.range(steps).map((i) => min + ((max - min) * i) / (steps - 1));

    mapLegendContainer
        .append("div")
        .attr("class", "legend-bar")
        .style(
            "background",
            `linear-gradient(90deg, ${values.map((v) => mapColorScale(v || 0)).join(",")})`
        );

    const stopsRow = mapLegendContainer.append("div").attr("class", "legend-stops");
    values.forEach((val) => {
        stopsRow.append("span").text(formatter(Math.max(val, 0)));
    });

    mapLegendContainer
        .append("p")
        .attr("class", "legend-caption")
        .text("Choropleth: darker fill = more fines (current filters)");
}

function updateHeatLayer(points) {
    if (!mapInstance) return;
    if (!heatLayer) {
        heatLayer = L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 8,
            minOpacity: 0.35
        }).addTo(mapInstance);
    } else {
        heatLayer.setLatLngs(points);
    }
}

function updateMapLayers(filtered) {
    if (!mapInstance || !geojsonData) return;
    const totals = aggregateByJurisdiction(filtered);
    const values = Object.values(totals).filter((v) => Number.isFinite(v) && v > 0);
    const min = values.length ? d3.min(values) : 0;
    const max = values.length ? d3.max(values) : 1;
    mapColorScale.domain([min || 0, max || 1]);

    if (choroplethLayer) {
        choroplethLayer.remove();
    }

    choroplethLayer = L.geoJSON(geojsonData, {
        style: (feature) => {
            const code = geoNameToCode[feature.properties && feature.properties.STATE_NAME];
            const value = totals[code] || 0;
            return {
                weight: 1,
                color: "#ffffff",
                fillColor: value ? mapColorScale(value) : "#e8eef7",
                fillOpacity: value ? 0.85 : 0.35
            };
        },
        onEachFeature: (feature, layer) => {
            const code = geoNameToCode[feature.properties && feature.properties.STATE_NAME];
            if (!code) return;
            const value = totals[code] || 0;
            const label = jurisdictionMeta[code]?.name || code;
            layer.bindTooltip(
                `<strong>${label}</strong><br>${formatter(value)} fines (filtered range)`
            );
            layer.on({
                mouseover: () => {
                    layer.setStyle({ weight: 2, color: "#0f6ed6" });
                },
                mouseout: () => {
                    choroplethLayer.resetStyle(layer);
                }
            });
        }
    }).addTo(mapInstance);

    const heatPoints = Object.entries(jurisdictionMeta)
        .map(([code, meta]) => {
            const value = totals[code];
            if (!value) return null;
            const intensity = max ? value / max : 0;
            return [meta.lat, meta.lng, intensity];
        })
        .filter(Boolean);

    updateHeatLayer(heatPoints);
    updateMapLegendRange(min || 0, max || 1);
}

async function loadGeoJSON() {
    const response = await fetch(geoJsonUrl);
    if (!response.ok) {
        throw new Error("Failed to load Australia GeoJSON");
    }
    return response.json();
}

function updateMapFromChart(filtered) {
    try {
        updateMapLayers(filtered);
    } catch (error) {
        console.error("Failed to update map layers", error);
    }
}

function bootstrapChart() {
    updateChart();
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
    updateMapFromChart(filtered);
}

async function bootstrap() {
    try {
        const [data, geojson] = await Promise.all([
            d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", (d) => ({
                year: +d.YEAR,
                jurisdiction: d.JURISDICTION,
                fines: +d.FINES
            })),
            loadGeoJSON()
        ]);

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

        geojsonData = geojson;
        initLeaflet();
        populateControls();
        attachEvents();
        bootstrapChart();
    } catch (error) {
        console.error("Failed to initialise Q5 view", error);
        annotationsEl.html("<li>Unable to load data or map resources.</li>");
    }
}

bootstrap();

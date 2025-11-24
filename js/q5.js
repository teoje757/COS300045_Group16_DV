const svg = d3.select("#heatmap");
const tooltip = d3.select("#heatmap-tooltip");
const legendContainer = d3.select("#legend-scale");
const annotationsEl = d3.select("#annotation-list");
const mapLegendContainer = d3.select("#map-legend");

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

// Updated state name mapping with better coverage
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

// Function to normalize state names from different GeoJSON sources
function normalizeStateName(name) {
    const nameMap = {
        "Western Australia": "WA",
        "Northern Territory": "NT",
        "South Australia": "SA",
        "Queensland": "QLD",
        "New South Wales": "NSW",
        "Australian Capital Territory": "ACT",
        "Victoria": "VIC",
        "Tasmania": "TAS"
    };
    return nameMap[name] || name;
}

const geoNameToCode = Object.fromEntries(Object.entries(stateNameMap).map(([code, name]) => [name, code]));

// Use a reliable GeoJSON source
const geoJsonUrl = "https://raw.githubusercontent.com/tonywr71/GeoJson-Data/master/australian-states.json";

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
        maxZoom: 8,
        zoomControl: true
    }).setView([-25.3, 133.77], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19
    }).addTo(mapInstance);

    // Add zoom control to bottom right
    mapInstance.zoomControl.setPosition('bottomright');
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
    if (heatLayer) {
        mapInstance.removeLayer(heatLayer);
    }
    
    if (points.length > 0) {
        heatLayer = L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 8,
            minOpacity: 0.35,
            gradient: {
                0.4: 'blue',
                0.6: 'cyan',
                0.7: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        }).addTo(mapInstance);
    }
}

function updateMapLayers(filtered) {
    if (!mapInstance || !geojsonData) {
        console.log("Map instance or GeoJSON data not available");
        return;
    }

    const totals = aggregateByJurisdiction(filtered);
    console.log("Filtered totals:", totals);
    
    const values = Object.values(totals).filter((v) => Number.isFinite(v) && v > 0);
    const min = values.length ? d3.min(values) : 0;
    const max = values.length ? d3.max(values) : 1;
    
    console.log("Value range:", min, max);
    
    mapColorScale.domain([min || 0, max || 1]);

    // Remove existing choropleth layer
    if (choroplethLayer) {
        mapInstance.removeLayer(choroplethLayer);
    }

    // Create new choropleth layer
    choroplethLayer = L.geoJSON(geojsonData, {
        style: (feature) => {
            const stateName = feature.properties?.STATE_NAME || feature.properties?.name;
            const code = normalizeStateName(stateName);
            const value = totals[code] || 0;
            
            console.log(`Styling ${stateName} (${code}): ${value} fines`);
            
            return {
                weight: 2,
                color: "#ffffff",
                fillColor: value ? mapColorScale(value) : "#e8eef7",
                fillOpacity: value ? 0.85 : 0.35,
                opacity: 1
            };
        },
        onEachFeature: (feature, layer) => {
            const stateName = feature.properties?.STATE_NAME || feature.properties?.name;
            const code = normalizeStateName(stateName);
            if (!code) {
                console.log("No code found for:", stateName);
                return;
            }
            
            const value = totals[code] || 0;
            const label = jurisdictionMeta[code]?.name || code;
            
            layer.bindTooltip(
                `<strong>${label}</strong><br>${formatter(value)} fines (filtered range)`,
                { sticky: true }
            );
            
            layer.on({
                mouseover: function(e) {
                    layer.setStyle({ 
                        weight: 3, 
                        color: "#0f6ed6",
                        fillOpacity: 0.9
                    });
                    layer.bringToFront();
                },
                mouseout: function(e) {
                    choroplethLayer.resetStyle(layer);
                }
            });
        }
    }).addTo(mapInstance);

    // Update heat layer points
    const heatPoints = Object.entries(jurisdictionMeta)
        .map(([code, meta]) => {
            const value = totals[code];
            if (!value || value === 0) return null;
            const intensity = max ? Math.min(value / max, 1) : 0;
            return [meta.lat, meta.lng, intensity * 0.8]; // Scale intensity
        })
        .filter(Boolean);

    console.log("Heat points:", heatPoints);
    updateHeatLayer(heatPoints);
    updateMapLegendRange(min || 0, max || 1);
}

async function loadGeoJSON() {
    try {
        console.log("Loading GeoJSON from:", geoJsonUrl);
        const response = await fetch(geoJsonUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const geojson = await response.json();
        console.log("GeoJSON loaded successfully:", geojson);
        console.log("Features:", geojson.features?.map(f => ({
            name: f.properties?.STATE_NAME || f.properties?.name,
            properties: f.properties
        })));
        return geojson;
    } catch (error) {
        console.error("Failed to load GeoJSON:", error);
        // Fallback: create a simple GeoJSON structure
        console.log("Using fallback GeoJSON data");
        return {
            type: "FeatureCollection",
            features: Object.entries(jurisdictionMeta).map(([code, meta]) => ({
                type: "Feature",
                properties: {
                    STATE_NAME: jurisdictionMeta[code].name,
                    code: code
                },
                geometry: {
                    type: "Point",
                    coordinates: [meta.lng, meta.lat]
                }
            }))
        };
    }
}

function updateMapFromChart(filtered) {
    try {
        console.log("Updating map with filtered data:", filtered.length, "records");
        updateMapLayers(filtered);
    } catch (error) {
        console.error("Failed to update map layers", error);
    }
}

function attachEvents() {
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
        console.log("Starting bootstrap...");
        
        const [data, geojson] = await Promise.all([
            d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", (d) => ({
                year: +d.YEAR,
                jurisdiction: d.JURISDICTION,
                fines: +d.FINES
            })),
            loadGeoJSON()
        ]);

        console.log("Data loaded:", data.length, "records");
        
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
        
        console.log("Initializing Leaflet map...");
        initLeaflet();
        populateControls();
        attachEvents();
        updateChart();
        
        console.log("Bootstrap completed successfully");
    } catch (error) {
        console.error("Failed to initialise Q5 view", error);
        annotationsEl.html("<li>Unable to load data or map resources.</li>");
    }
}

// Start the application
bootstrap();
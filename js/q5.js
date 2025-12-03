// ======================================================
// Australia State Heatmap — Fully Fixed + Rewritten
// ======================================================

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

    if (error) {
        console.error("Error loading CSV:", error);
        document.getElementById("loading").innerHTML = "Error loading CSV.";
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

    // Create SVG (responsive via viewBox)
    svg = d3.select("#svganchor")
        .append("svg")
        .attr("viewBox", "0 0 " + w + " " + h)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("width", "100%");

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
                    const pageX = d3.event.pageX || d3.event.clientX + window.scrollX;
                    const pageY = d3.event.pageY || d3.event.clientY + window.scrollY;
                    const containerRect = document.getElementById('container').getBoundingClientRect();
                    let left = pageX - containerRect.left + 10;
                    let top = pageY - containerRect.top - 50;
                    tooltip.style("left", Math.max(5, left) + "px").style("top", Math.max(5, top) + "px");
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
});

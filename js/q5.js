// ======================================================
// Australia State Heatmap – Fully Fixed + Rewritten
// ======================================================

// Global state
let currentYear = 2008;
let isPlaying = false;
let playInterval;
let colorScale;
let svg;
let dataMap = {};

// Dimensions
const w = 520;
const h = 400;

// Projection
const projection = d3.geo.mercator()
    .center([132, -28])
    .translate([w / 2, h / 2])
    .scale(600);

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

    // Color scale - using gradient from mint to dragonfruit
    colorScale = d3.scale.linear()
        .domain([0, maxValue])
        .range(["#BEDEDA", "#E14C70"])
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
                .attr("font-size", "10px")
                .attr("font-weight", "bold")
                .attr("fill", "#1e3a5f")
                .text(d => {
                    const rawName = d.properties.STATE_NAME || d.properties.STE_NAME16;
                    return geoToCsv[rawName];
                });

            // --------------------------------------------------
            // LEGEND - TOP LEFT
            // --------------------------------------------------
            const legendSvg = d3.select("#legendContainer")
                .append("svg")
                .attr("width", 100)
                .attr("height", 120);

            const defs = legendSvg.append("defs");
            const gradient = defs.append("linearGradient")
                .attr("id", "legend-gradient")
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");

            gradient.selectAll("stop")
                .data(colorScale.range())
                .enter()
                .append("stop")
                .attr("offset", (d, i) => i / (colorScale.range().length - 1))
                .attr("stop-color", d => d);

            const legend = legendSvg.append("g")
                .attr("transform", "translate(10, 10)");

            // Vertical rectangle for legend
            legend.append("rect")
                .attr("width", 25)
                .attr("height", 80)
                .style("fill", "url(#legend-gradient)")
                .style("stroke", "#333")
                .style("stroke-width", "1px");

            const legendScale = d3.scale.linear()
                .domain([maxValue, 0])
                .range([0, 80]);

            const legendAxis = d3.svg.axis()
                .scale(legendScale)
                .orient("right")
                .ticks(4)
                .tickFormat(d3.format(".2s"));

            legend.append("g")
                .attr("transform", "translate(25, 0)")
                .attr("class", "legend-axis")
                .style("font-size", "9px")
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
// ======================================================
// Australia State Heatmap – Tooltip position fixed relative to offsetParent
// ======================================================

// Global state
let currentYear = 2008;
let isPlaying = false;
let playInterval;
let colorScale;
let svg;
let dataMap = {};

// Dimensions
const w = 1100; // viewBox width
const h = 700;  // viewBox height

// Projection (d3v3 style)
const projection = d3.geo.mercator()
    .center([132, -28])
    .translate([w / 2, h / 2])
    .scale(1000);

const path = d3.geo.path().projection(projection);

// Tooltip selection
const tooltip = d3.select("#tooltip");

// Geo → CSV codes mapping
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
    .domain([0, maxValue * 0.33, maxValue * 0.66, maxValue])
    .range(["#C8F7F0", "#7DDDE2", "#4AA8E0", "#2F5BA3"])
    .interpolate(d3.interpolateHcl);



    // Create responsive SVG using viewBox
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

                // ---------------------------
                // Robust tooltip positioning:
                // compute position relative to tooltip.offsetParent
                // ---------------------------
                .on("mousemove", function(d) {
                    // 1) centroid in SVG viewBox coordinates
                    const centroid = path.centroid(d); // [x, y] in viewBox coords

                    // 2) find bounding rects
                    const svgNode = svg.node();
                    const svgRect = svgNode.getBoundingClientRect(); // relative to viewport

                    // determine the actual scale factor (width)
                    const actualWidth = svgRect.width;
                    const scale = actualWidth / w; // viewBox width -> actual pixels

                    // centroid in page (document) coordinates:
                    const xInViewport = svgRect.left + centroid[0] * scale;
                    const yInViewport = svgRect.top + centroid[1] * scale;

                    // convert viewport coords to document coords
                    const xInDocument = xInViewport + window.scrollX;
                    const yInDocument = yInViewport + window.scrollY;

                    // 3) compute coordinates relative to tooltip's offsetParent
                    // tooltip.offsetParent is the element that CSS absolute positioning uses
                    const ttNode = tooltip.node();
                    const offsetParent = ttNode.offsetParent || document.body;
                    const parentRect = offsetParent.getBoundingClientRect();
                    const parentDocLeft = parentRect.left + window.scrollX;
                    const parentDocTop = parentRect.top + window.scrollY;

                    // position inside offsetParent (taking its scroll into account)
                    const relativeLeft = xInDocument - parentDocLeft + offsetParent.scrollLeft;
                    const relativeTop = yInDocument - parentDocTop + offsetParent.scrollTop;

                    // measure tooltip size (after content set)
                    const ttW = ttNode.offsetWidth;
                    const ttH = ttNode.offsetHeight;

                    // final position: center horizontally, place above the centroid
                    let finalLeft = relativeLeft - (ttW / 2);
                    let finalTop = relativeTop - ttH - 12; // 12px gap above the centroid

                    // Clamp so tooltip stays inside offsetParent padding
                    const pad = 8;
                    const maxLeft = offsetParent.clientWidth - ttW - pad;
                    if (finalLeft < pad) finalLeft = pad;
                    if (finalLeft > maxLeft) finalLeft = maxLeft;

                    // If finalTop would go above the top of the parent, flip to below centroid
                    const minTop = pad;
                    if (finalTop < minTop) {
                        finalTop = relativeTop + 12; // place below centroid if not enough space
                        // ensure it won't overflow bottom
                        const maxTop = offsetParent.clientHeight - ttH - pad;
                        if (finalTop > maxTop) finalTop = maxTop;
                    }

                    // Apply styles (position is relative to offsetParent)
                    tooltip.style("left", finalLeft + "px")
                           .style("top", finalTop + "px");
                })

                .on("mouseout", function () {
                    tooltip.style("opacity", 0);
                });

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
            // LEGEND
            // --------------------------------------------------
            const legendSvg = d3.select("#legendContainer")
                .append("svg")
                .attr("width", 320)
                .attr("height", 60);

            const defs = legendSvg.append("defs");
            const gradient = defs.append("linearGradient")
                .attr("id", "legend-gradient");

            // -----------------------------
            // LEGEND GRADIENT (4-color scale)
            // -----------------------------
            const legendColors = ["#C8F7F0", "#7DDDE2", "#4AA8E0", "#2F5BA3"];

            gradient.selectAll("stop")
                .data(legendColors)
                .enter()
                .append("stop")
                .attr("offset", (d, i) => i / (legendColors.length - 1))
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
                .ticks(4)
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

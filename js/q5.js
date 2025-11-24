// Global variables
let currentYear = 2014;
let isPlaying = false;
let playInterval;
let colorScale;
let svg;

// Dimensions
const w = 850;
const h = 700;

// Projection
const projection = d3.geo.mercator()
    .center([132, -28])
    .translate([w/2, h/2])
    .scale(1000);

// Path generator
const path = d3.geo.path()
    .projection(projection);

// Tooltip
const tooltip = d3.select("#tooltip");

// Load CSV data
d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", function(error, csvData) {
    if (error) {
        console.error("Error loading CSV:", error);
        return;
    }

    // Parse data
    const data = csvData.map(d => ({
        year: +d.year,
        state: d.state,
        value: +d.value
    }));

    // Create color scale
    const maxValue = d3.max(data, d => d.value);
    colorScale = d3.scale.linear()
        .domain([0, maxValue])
        .range(['#ffffcc', '#800026'])
        .interpolate(d3.interpolateHcl);

    // Create SVG
    svg = d3.select("#svganchor")
        .append("svg")
        .attr("width", w)
        .attr("height", h);

    // Function to get value for state and year
    function getValue(state, year) {
        const record = data.find(d => d.state === state && d.year === year);
        return record ? record.value : 0;
    }

    // Function to update map colors
    function updateMap(year) {
        currentYear = year;
        document.getElementById("yearDisplay").textContent = year;
        document.getElementById("yearSlider").value = year;

        svg.selectAll(".state-path")
            .transition()
            .duration(300)
            .attr("fill", function(d) {
                const state = d.properties.STATE_CODE;
                const value = getValue(state, year);
                return colorScale(value);
            });
    }

    // Load GeoJSON
    d3.json("https://raw.githubusercontent.com/tonywr71/GeoJson-Data/master/australian-states.json", function(json) {
        
        // Draw states
        svg.selectAll("path")
            .data(json.features)
            .enter()
            .append("path")
            .attr("class", "state-path")
            .attr("d", path)
            .attr("fill", function(d) {
                const state = d.properties.STATE_CODE;
                const value = getValue(state, currentYear);
                return colorScale(value);
            })
            .on("mouseover", function(d) {
                const state = d.properties.STATE_CODE;
                const stateName = d.properties.STATE_NAME;
                const value = getValue(state, currentYear);
                
                tooltip.style("opacity", 1)
                    .html(`<strong>${stateName}</strong><br>Year: ${currentYear}<br>Value: ${value.toLocaleString()}`);
            })
            .on("mousemove", function() {
                tooltip.style("left", (d3.event.pageX + 10) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });

        // State labels
        svg.selectAll(".state-label")
            .data(json.features)
            .enter()
            .append("text")
            .attr("class", "state-label")
            .attr("fill", "white")
            .attr("stroke", "black")
            .attr("stroke-width", "0.5px")
            .attr("transform", function(d) {
                return "translate(" + path.centroid(d) + ")";
            })
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .style("pointer-events", "none")
            .text(function(d) {
                return d.properties.STATE_CODE;
            });

        // Add legend
        const legendWidth = 300;
        const legendHeight = 20;
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${w - legendWidth - 50}, ${h - 80})`);

        const legendScale = d3.scale.linear()
            .domain([0, maxValue])
            .range([0, legendWidth]);

        const legendAxis = d3.svg.axis()
            .scale(legendScale)
            .orient("bottom")
            .ticks(5)
            .tickFormat(d3.format(".2s"));

        // Legend gradient
        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "legend-gradient");

        gradient.selectAll("stop")
            .data(colorScale.range())
            .enter()
            .append("stop")
            .attr("offset", (d, i) => i / (colorScale.range().length - 1))
            .attr("stop-color", d => d);

        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)");

        legend.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis);
    });

    // Slider control
    document.getElementById("yearSlider").addEventListener("input", function() {
        if (isPlaying) {
            stopPlay();
        }
        updateMap(parseInt(this.value));
    });

    // Play functionality
    function startPlay() {
        isPlaying = true;
        document.getElementById("playBtn").textContent = "Pause";
        playInterval = setInterval(() => {
            if (currentYear < 2024) {
                updateMap(currentYear + 1);
            } else {
                updateMap(2014);
            }
        }, 1000);
    }

    function stopPlay() {
        isPlaying = false;
        document.getElementById("playBtn").textContent = "Play";
        clearInterval(playInterval);
    }

    document.getElementById("playBtn").addEventListener("click", function() {
        if (isPlaying) {
            stopPlay();
        } else {
            startPlay();
        }
    });

    document.getElementById("resetBtn").addEventListener("click", function() {
        stopPlay();
        updateMap(2014);
    });
});

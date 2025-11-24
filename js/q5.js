// Global variables
let currentYear = 2014;
let isPlaying = false;
let playInterval;
let colorScale;
let svg;
let dataMap = {};

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

// State code mapping (in case GeoJSON uses different codes)
const stateCodeMap = {
    'ACT': 'ACT',
    'NSW': 'NSW', 
    'NT': 'NT',
    'QLD': 'QLD',
    'SA': 'SA',
    'TAS': 'TAS',
    'VIC': 'VIC',
    'WA': 'WA'
};

// Load CSV data
d3.csv("data/Q5_Mobile_phone_enforcement_patterns.csv", function(error, csvData) {
    if (error) {
        console.error("Error loading CSV:", error);
        document.getElementById("loading").innerHTML = "Error loading data. Please check the CSV file path.";
        return;
    }

    console.log("CSV loaded successfully:", csvData.length, "rows");

    // Parse data and create a map for quick lookup
    // Updated to use YEAR, JURISDICTION, and FINES columns
    csvData.forEach(d => {
        const year = +d.YEAR;  // Changed from d.year
        const state = d.JURISDICTION.trim();  // Changed from d.state
        const value = +d.FINES;  // Changed from d.value
        
        if (!dataMap[year]) {
            dataMap[year] = {};
        }
        dataMap[year][state] = value;
    });

    console.log("Data map created:", dataMap);

    // Get all values for color scale
    const allValues = csvData.map(d => +d.FINES);  // Changed from d.value
    const maxValue = d3.max(allValues);
    const minValue = d3.min(allValues);
    
    console.log("Value range:", minValue, "to", maxValue);

    // Create color scale
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
        if (dataMap[year] && dataMap[year][state] !== undefined) {
            return dataMap[year][state];
        }
        return 0;
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
                const stateCode = d.properties.STATE_CODE || d.properties.STATE_NAME;
                const value = getValue(stateCode, year);
                return colorScale(value);
            });
    }

    // Load GeoJSON
    d3.json("https://raw.githubusercontent.com/tonywr71/GeoJson-Data/master/australian-states.json", function(geoError, json) {
        if (geoError) {
            console.error("Error loading GeoJSON:", geoError);
            document.getElementById("loading").innerHTML = "Error loading map data.";
            return;
        }

        console.log("GeoJSON loaded:", json.features.length, "features");
        console.log("Sample feature properties:", json.features[0].properties);
        
        document.getElementById("loading").style.display = "none";

        // Draw states
        svg.selectAll("path")
            .data(json.features)
            .enter()
            .append("path")
            .attr("class", "state-path")
            .attr("d", path)
            .attr("fill", function(d) {
                const stateCode = d.properties.STATE_CODE || d.properties.STATE_NAME;
                const value = getValue(stateCode, currentYear);
                console.log("State:", stateCode, "Value:", value);
                return colorScale(value);
            })
            .on("mouseover", function(d) {
                const stateCode = d.properties.STATE_CODE || d.properties.STATE_NAME;
                const stateName = d.properties.STATE_NAME;
                const value = getValue(stateCode, currentYear);
                
                tooltip.style("opacity", 1)
                    .html(`<strong>${stateName}</strong><br>Year: ${currentYear}<br>Fines: ${value.toLocaleString()}`);
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
                return d.properties.STATE_CODE || d.properties.STATE_NAME;
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
            .style("fill", "url(#legend-gradient)")
            .style("stroke", "#333")
            .style("stroke-width", "1px");

        legend.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis);

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
});

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// FUNCTION import CSV file
async function loadData(filename) {
    try {
        const rawData = await d3.csv(`./data/${filename}.csv`);
        const data = rawData.map(d => ({
            group: d.group,
            marker: d.marker,
            block: d.block,
            genre: d.genre,
            time_s: +d.time_s,
            x_mm: +d.x_mm,
            y_mm: +d.y_mm,
            z_mm: +d.z_mm,
        }));
        return data;
    } catch (error) {
        console.error("Error loading the CSV file:", error);
    }
};

// import data
const NM0001Data = await loadData('NM0001-cleaned');
const NM0004Data = await loadData('NM0004-cleaned');
const NM0011Data = await loadData('NM0011-cleaned');
// NOTE: data keys are following
// ,group,marker,block,time_s,genre,x_mm,y_mm,z_mm

///////////////////////////////////////////////////////

// FUNCTION filter data by marker and genre
function getObjectsByValue(data, marker, genre) {
    if (genre === "silence") {
        // return data.filter(obj => obj["marker"] === marker && obj["genre"] === genre &&  obj["block"] === "1");
        // HAVE TO CHOOSE BLOCK FOR SILENCE
    }
    return data.filter(obj => obj["marker"] === marker && obj["genre"] === genre);
}

// test function
const test = getObjectsByValue(NM0001Data, "S1", "salsa");
console.log(test);

///////////////////////////////////////////////////////

// FUNCTION HELPER to render one axis graph
function renderGraph(data, axes, x, y) {

    const aspectWidth = 500;
    const aspectHeight = 300;

    // Update responsive SVG
    const svg = d3.select(`#${axes}`)
        .attr("viewBox", `0 0 ${aspectWidth} ${aspectHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")   // responsive width
        .style("height", "auto"); // maintain aspect ratio

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const innerWidth = aspectWidth - margin.left - margin.right;
    const innerHeight = aspectHeight - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales based on fixed internal coordinate system
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d[`${x}_mm`]))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d[`${y}_mm`]))
        .range([innerHeight, 0]);

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale));

    g.selectAll(".point")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d[`${x}_mm`]))
        .attr("cy", d => yScale(d[`${y}_mm`]))
        .attr("r", 3)
        .style("fill", "steelblue");
};

// FUNCTION render axes graphs
function renderAxesGraph(data) {
    if (data.length === 0) {
        console.warn("No data found.");
        return;
    };

    const ids = ["xy-top", "yz-side", "xz-front"];

    ids.forEach((id) => {
        renderGraph(data, id, id[0], id[1]);
    });

};


renderAxesGraph(test);
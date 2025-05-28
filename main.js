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

// GLOBAL VARIABLES
let groups = {
    "NM0001": NM0001Data,
    "NM0004": NM0004Data,
    "NM0011": NM0011Data,
};

///////////////////////////////////////////////////////

// FUNCTION filter data by marker and genre
function getObjectsByValue(data, marker, genre) {
    if (genre === "silence") {
      return data.filter(d =>
        d.marker === marker &&
        d.genre  === "silence" &&
        d.block  === "1"
      );
    }
    return data.filter(obj => obj["marker"] === marker && obj["genre"] === genre);
}

///////////////////////////////////////////////////////

// FUNCTION HELPER to render one axis graph
function renderGraph(data, axes, x, y) {

    const aspectWidth = 500;
    const aspectHeight = 300;

    // Update responsive SVG
    const svg = d3.select(`#${axes}`)
        .append("svg")
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
    
    const timeExtent = d3.extent(data, d => d.time_s);
    const colorScale = d3.scaleSequential(d3.interpolateTurbo)
                       .domain(timeExtent);

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale));

    // g.selectAll(".point")
    //     .data(data)
    //     .enter()
    //     .append("circle")
    //     .attr("class", "point")
    //     .attr("cx", d => xScale(d[`${x}_mm`]))
    //     .attr("cy", d => yScale(d[`${y}_mm`]))
    //     .attr("r", 3)
    //     .style("fill", "steelblue");
    
    g.selectAll(".point")
    .data(data)
    .enter().append("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d[`${x}_mm`]))
        .attr("cy", d => yScale(d[`${y}_mm`]))
        .attr("r", 4)
        .style("fill", d => colorScale(d.time_s))
        .style("opacity", 0)
    .transition()
        .delay((d,i) => i)
        .duration(200)
        .style("opacity", 1);                        
    
    g.selectAll(".hover-target")
      .data(data)
      .enter().append("circle")
        .attr("class", "hover-target")
        .attr("cx", d => xScale(d[`${x}_mm`]))
        .attr("cy", d => yScale(d[`${y}_mm`]))
        .attr("r", 8)                 // slightly larger than your visible point
        .attr("fill", "transparent")  // invisible “hit” area
        .on("mouseover", (event, d) => {
          tooltip
            .style("left",  `${event.pageX + 10}px`)
            .style("top",   `${event.pageY - 25}px`)
            .style("display", "block")
            .html(`
              <strong>${x.toUpperCase()}:</strong> ${d[`${x}_mm`].toFixed(1)}<br/>
              <strong>${y.toUpperCase()}:</strong> ${d[`${y}_mm`].toFixed(1)}<br/>
              <strong>time (seconds):</strong> ${d.time_s.toFixed(2)}
            `);
        })
        .on("mousemove", (event) => {
          // move tooltip with mouse
          tooltip
            .style("left",  `${event.pageX + 10}px`)
            .style("top",   `${event.pageY - 25}px`);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });
};

// FUNCTION render axes graphs
function renderAxesGraph(selectedGroup, selectedMarker, selectedGenre) { 
    ["xy-top","yz-side","xz-front"].forEach(id =>
        d3.select(`#${id}`).selectAll("svg").remove()
      ); // Clear existing axes graphs
    const filteredData = getObjectsByValue(groups[selectedGroup], selectedMarker, selectedGenre);
    console.log(filteredData);

    if (!filteredData || filteredData.length === 0) {
        console.warn("No data found.");
        return;
    };

    const ids = ["xy-top", "yz-side", "xz-front"];

    ids.forEach((id) => {
        renderGraph(filteredData, id, id[0], id[1]);
        console.log('rendered one')
    });

    console.log("done rendering");
    renderDispGraph(filteredData);
};

// FUNCTION update graphs for filters
function updateAxesGraph() {
    
    let selectedGroup = d3.select("#group-filter").property("value");
    let selectedMarker = d3.select("#marker-filter").property("value");
    let selectedGenre = d3.select("#genre-filter").property("value");

    renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);

    // filter data by group
    d3.select("#group-filter").on("change", function () {
        selectedGroup = d3.select(this).property("value");
        console.log("Selected group:", selectedGroup);
        renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    });
    
    // filter data by genre
    d3.select("#genre-filter").on("change", function () {
        selectedGenre = d3.select(this).property("value");
        console.log("Selected genre:", selectedGenre);
        renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    });

    // filter data by marker
    d3.select("#marker-filter").on("change", function () {
        selectedMarker = d3.select(this).property("value");
        console.log("Selected marker:", selectedMarker);
        renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    });  
}

updateAxesGraph();

const tooltip = d3.select("body").append("div")
  .attr("class", "d3-tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("padding", "4px 8px")
  .style("background", "rgba(255,255,255,0.9)")
  .style("border", "1px solid #ccc")
  .style("border-radius", "4px")
  .style("font-size", "12px")
  .style("display", "none");

///////////////////////////////////////////////////////

// FUNCTION render displacement graph
function renderDispGraph(data) {
  // clear old
  d3.select('#disp-chart').selectAll('*').remove();
  
  const width  = 900;
  const height = 300;
  const margin = { top: 40, right: 20, bottom: 30, left: 60 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  
  const svg = d3.select('#disp-chart')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', 'auto');
  
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // build displacement array
  const dispData = data.map((d,i,arr) => {
    if (i===0) return { time_s:d.time_s, disp:0 };
    const prev = arr[i-1];
    const dx = d.x_mm - prev.x_mm;
    const dy = d.y_mm - prev.y_mm;
    const dz = d.z_mm - prev.z_mm;
    return { time_s:d.time_s, disp:Math.sqrt(dx*dx+dy*dy+dz*dz) };
  });
  
  const xScale = d3.scaleLinear()
    .domain(d3.extent(dispData, d=>d.time_s))
    .range([0, w]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(dispData, d=>d.disp)])
    .range([h, 0]);

  const xAxis = d3.axisBottom(xScale).ticks(12);
  const yAxis = d3.axisLeft(yScale);
  
  g.append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(0,${h})`)
    .call(xAxis);
  
  g.append('g')
    .attr('class', 'y axis')
    .call(yAxis);
  
  const line = d3.line()
    .x(d=>xScale(d.time_s))
    .y(d=>yScale(d.disp));
  
  g.append('path')
    .datum(dispData)
    .attr('fill', 'none')
    .attr('stroke', 'steelblue')
    .attr('stroke-width', 1.5)
    .attr('d', line);
};
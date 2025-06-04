import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// FUNCTION import CSV file
async function loadData(filename) {
    try {
        const rawData = await d3.csv(`../data/${filename}.csv`);
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
// SANDBOX

///////////////////////////////////////////////////////

// GLOBAL VARIABLES
let groups = {
    "NM0001": NM0001Data,
    "NM0004": NM0004Data,
    "NM0011": NM0011Data,
};

let genreToColor = {
  'silence': d3.interpolateBlues,
  'salsa': d3.interpolateOranges,
  'meditation': d3.interpolateGreens,
  'edm': d3.interpolateReds,
};

// flatten all groups into one array
const allData = [...NM0001Data, ...NM0004Data, ...NM0011Data];

// global time range across every sample
const globalTimeExtent = d3.extent(allData, d => d.time_s);

// one single color scale for every chart
let globalColorScale = d3.scaleSequential(genreToColor['silence'])
                           .domain(globalTimeExtent);

// for animation
let dispPath, dispLength, dispDataGlobal;
let axesPoints = [];

///////////////////////////////////////////////////////

// FUNCTION filter data by marker and genre
function getObjectsByValue(data, selectedGroup, selectedMarker, selectedGenre) {
  if (selectedGenre === "silence") {
    return data.filter(d =>
      d.group  === selectedGroup &&
      d.marker === selectedMarker &&
      d.genre  === "silence" &&
      d.block  === "1"
    );
  };

  globalColorScale = d3.scaleSequential(genreToColor[selectedGenre])
                           .domain(globalTimeExtent);
 
  return data.filter(d =>
    d.group  === selectedGroup &&
    d.marker === selectedMarker &&
    d.genre  === selectedGenre
  );
};
 

///////////////////////////////////////////////////////

// FUNCTION HELPER to render one axis graph
function renderGraph(data, axes, x, y) {

    const aspectWidth = 500;
    const aspectHeight = 500;

    // Update responsive SVG
    const svg = d3.select(`#${axes}`)
        .append("svg")
        .attr("viewBox", `0 0 ${aspectWidth} ${aspectHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")   // responsive width
        .style("height", "auto"); // maintain aspect ratio

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = aspectWidth - margin.left - margin.right;
    const innerHeight = aspectHeight - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales based on fixed internal coordinate system
    const xScale = d3.scaleLinear()
        .domain([-50, 60])
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([-50, 60])
        .range([innerHeight, 0]);

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale));

    g.append("text")
        .attr("class", "x-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 30)
        .attr("text-anchor", "middle")
        .text(`${x}_mm`);

    g.append("text")
        .attr("class", "y-label")
        .attr("x", -innerHeight / 2)
        .attr("y", -25)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text(`${y}_mm`);

    // g.selectAll(".point")
    //     .data(data)
    //     .enter()
    //     .append("circle")
    //     .attr("class", "point")
    //     .attr("cx", d => xScale(d[`${x}_mm`]))
    //     .attr("cy", d => yScale(d[`${y}_mm`]))
    //     .attr("r", 3)
    //     .style("fill", "steelblue");

    const pts = g.selectAll('circle.point')
    .data(data)
    .enter().append('circle')
      .attr('class','point')
      .attr('cx', d => xScale(d[`${x}_mm`]))
      .attr('cy', d => yScale(d[`${y}_mm`]))
      .attr('r', 4)
      .style('fill', d => globalColorScale(d.time_s))
      .style('opacity', 0);

    axesPoints.push(pts);
    
    // g.selectAll(".point")
    // .data(data)
    // .enter().append("circle")
    //     .attr("class", "point")
    //     .attr("cx", d => xScale(d[`${x}_mm`]))
    //     .attr("cy", d => yScale(d[`${y}_mm`]))
    //     .attr("r", 4)
    //     .style("fill", d => globalColorScale(d.time_s))
    //     .style("opacity", 0)
    // .transition()
    //     .delay((d,i) => i)
    //     .duration(200)
    //     .style("opacity", 1);  
    
    // TOOLTIP
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
    const filteredData = getObjectsByValue(groups[selectedGroup], selectedGroup, selectedMarker, selectedGenre);
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
    animateAxesPlots();
    animateDispGraph();
};

// FUNCTION update graphs for filters
function updateAxesGraph() {
  let selectedGroup  = d3.select("#group-filter").property("value");
  let selectedMarker = d3.select("#marker-filter").property("value");
  let selectedGenre  = d3.select("#genre-filter").property("value");
 
 
  // initial draw:
  renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
 
 
  // Whenever group changes:
  d3.select("#group-filter").on("change", function () {
    selectedGroup = d3.select(this).property("value");
    renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    // ALSO re‐draw the “Disp” charts (if that’s what you want):
    updateAllCharts();
  });
 
 
  // Whenever genre changes:
  d3.select("#genre-filter").on("change", function () {
    selectedGenre = d3.select(this).property("value");
    renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    // ALSO re‐draw the “Disp” charts:
    updateAllCharts();
  });
 
 
  // Whenever marker changes:
  d3.select("#marker-filter").on("change", function () {
    selectedMarker = d3.select(this).property("value");
    renderAxesGraph(selectedGroup, selectedMarker, selectedGenre);
    // ALSO re‐draw the “Disp” charts:
    updateAllCharts();
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
  // dimensions & margins
  const width  = 900;
  const height = 300;
  const margin = { top: 40, right: 20, bottom: 40, left: 55 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // clear any old svg in the container
  const container = d3.select('#disp-chart');
  container.selectAll('svg').remove();

  // append a fresh <svg>
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');

  // define gradient stops as before
  svg.select('defs').remove();
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', 'global-disp-gradient')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', margin.left)
    .attr('y1', 0)
    .attr('x2', margin.left + w)
    .attr('y2', 0);

  const stops = 20;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const time = globalTimeExtent[0] + t * (globalTimeExtent[1] - globalTimeExtent[0]);
    grad.append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', globalColorScale(time));
  }

  // compute displacement data
  const dispData = data.map((d, i, arr) => {
    if (i === 0) return { time_s: d.time_s, disp: 0 };
    // const initial = arr[0];
    // const dx = d.x_mm - p.x_mm,
    //       dy = d.y_mm - p.y_mm,
    //       dz = d.z_mm - p.z_mm;
    return { time_s: d.time_s, disp: Math.sqrt(d.x_mm**2 + d.y_mm**2 + d.z_mm**2) };
  });

  // scales
  const xScale = d3.scaleLinear()
    .domain(globalTimeExtent)
    .range([0, w]);
  const yScale = d3.scaleLinear()
    .domain([0, 55])
    .range([h, 0]);

  // drawing group
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // axes
  g.append('g')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(12));
  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5));

  g.append("text")
    .attr("class", "x-label")
    .attr("x", w / 2)
    .attr("y", h + 30)
    .attr("text-anchor", "middle")
    .text('Time (sec)');

  g.append("text")
      .attr("class", "y-label")
      .attr("x", -h / 2)
      .attr("y", -25)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text('Displacement (mm)');

  // line generator
  const line = d3.line()
    .x(d => xScale(d.time_s))
    .y(d => yScale(d.disp));

  dispDataGlobal = dispData;
  dispPath = g.append('path')
    .datum(dispDataGlobal)
    .attr('fill','none')
    .attr('stroke','url(#global-disp-gradient)')
    .attr('stroke-width',3)
    .attr('d', line);

  // const L = path.node().getTotalLength();
  // const T = (dispData.length - 1) + 200;
  // path
  //   .attr('stroke-dasharray', `${L} ${L}`)
  //   .attr('stroke-dashoffset', L)
  //   .transition().duration(T).ease(d3.easeLinear)
  //   .attr('stroke-dashoffset', 0);

  dispLength = dispPath.node().getTotalLength();
  dispPath
    .attr('stroke-dasharray', `${dispLength} ${dispLength}`)
    .attr('stroke-dashoffset', dispLength);

  // tooltip hit‐areas
  g.selectAll('.disp-hover')
    .data(dispData)
    .enter().append('circle')
      .attr('class','disp-hover')
      .attr('cx', d => xScale(d.time_s))
      .attr('cy', d => yScale(d.disp))
      .attr('r', 8)
      .attr('fill','transparent')
      .on('mouseover', (event, d) => {
        tooltip
          .style('display','block')
          .html(`
            <strong>time:</strong> ${d.time_s.toFixed(2)} s<br/>
            <strong>disp:</strong> ${d.disp.toFixed(3)} mm
          `);
      })
      .on('mousemove', event => {
        tooltip
          .style('left',  `${event.pageX+10}px`)
          .style('top',   `${event.pageY-25}px`);
      })
      .on('mouseout', () => tooltip.style('display','none'));
};

///////////////////////////////////////////////////////

// FUNCTION animate plots
function animateAxesPlots() {
  axesPoints.forEach(pts => {
    pts.transition()
      .delay((d, i) => i)
      .duration(400)
      .attr('r', 4)
      .style('opacity', 1);
  });
}

function animateDispGraph() {
  dispPath
    .transition()
    .duration((dispDataGlobal.length - 1) + 400)
    .ease(d3.easeLinear)
    .attr('stroke-dashoffset', 0);
}

// updateAxesGraph();

// ─────────────────────────────────────────────────────────────
// (A) computeDisplacementByGenre: returns [{genre, block, series}, …]
// ─────────────────────────────────────────────────────────────
function computeDisplacementByGenre(data) {
  const byGenre = d3.group(data, d => d.genre);
  const allGenreArrays = [];
 
 
  for (const [genreKey, ptsOfGenre] of byGenre.entries()) {
    const byBlock = d3.group(ptsOfGenre, d => d.block);
    for (const [blockKey, ptsInBlock] of byBlock.entries()) {
      const sortedPts = ptsInBlock.slice().sort((a, b) => d3.ascending(a.time_s, b.time_s));
      const instSeries = sortedPts.map((d, i, arr) => {
        if (i === 0) return { time_s: d.time_s, disp: 0 };
        const prev = arr[i - 1];
        const dx = d.x_mm - prev.x_mm;
        const dy = d.y_mm - prev.y_mm;
        const dz = d.z_mm - prev.z_mm;
        return { time_s: d.time_s, disp: Math.sqrt(dx*dx + dy*dy + dz*dz) };
      });
      allGenreArrays.push({ genre: genreKey, block: blockKey, series: instSeries });
    }
  }
  return allGenreArrays;
 }
 
 
 function computeCumulativeSeriesByGenre(data) {
  // 1) We no longer need a separate annotateRuns(...) step.
  //    Just normalize everything and trust `d.block` as the run ID.
 
 
  // 2) Group all rows by genre:
  const byGenre = d3.group(data, d => d.genre);
  const cumArrays = [];
 
 
  for (const [genreKey, ptsOfGenre] of byGenre.entries()) {
 
 
    // 3) Now group by (group-marker-genre-block).  That block value is already
    //    what you want, e.g. "1" or "2" etc.  We assume each CSV row's d.block
    //    is consistent for those 6k rows of that genre.
    const byRun = d3.group(
      ptsOfGenre,
      d => `${d.group}-${d.marker}-${d.genre}-${d.block}`
    );
 
 
    const eachBlockCum = [];
 
 
    for (const [compositeKey, ptsInBlock] of byRun.entries()) {
 
 
      // 4) Sort those rows by time_s, accumulate displacement from the start of that block:
      const sortedPts = ptsInBlock.slice()
        .sort((a, b) => d3.ascending(a.time_s, b.time_s));
 
 
      const t0 = sortedPts[0].time_s;
      let running = 0;
 
 
      const cumSeries = sortedPts.map((d, i, arr) => {
        if (i === 0) {
          return { time_s: 0, disp: 0 };
        } else {
          const prev = arr[i - 1];
          const dx = d.x_mm - prev.x_mm;
          const dy = d.y_mm - prev.y_mm;
          const dz = d.z_mm - prev.z_mm;
          const instDist = Math.hypot(dx, dy, dz);
          running += instDist;
          return { time_s: d.time_s - t0, disp: running };
        }
      });
 
 
      eachBlockCum.push(cumSeries);
    }
 
 
    // 5) Average all blocks of this one genre together, point‐by‐point:
    const minLen = d3.min(eachBlockCum, s => s.length);
    const averagedCum = [];
 
 
    for (let i = 0; i < minLen; i++) {
      const t = eachBlockCum[0][i].time_s;
      const medianDisp = d3.median(eachBlockCum, s => s[i].disp);
      averagedCum.push({ time_s: t, disp: medianDisp });
    }
 
 
    cumArrays.push({ genre: genreKey, series: averagedCum });
  }
 
 
  return cumArrays;
 }
 
 
 // ─────────────────────────────────────────────────────────────
 // (C) renderMultiLineChart: draws one solid line per genre in `containerId`.
 //     `globalTimeExtent` is shared x‐axis domain.
 // ─────────────────────────────────────────────────────────────
 function renderMultiLineChart(containerId, genreBlocks, globalTimeExtent) {
  // 1) Remove any old <svg> inside that container:
  d3.select(`#${containerId}`).selectAll("svg").remove();
 
 
  // 2) Set up dimensions + margins
  const width  = 900;
  const height = 300;
  const margin = { top: 40, right: 20, bottom: 30, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
 
 
  // 3) Append a fresh <svg> element
  const svg = d3.select(`#${containerId}`)
    .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");
 
 
  // 4) Create a <g> for margins
  const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
 
 
  // 5) X‐scale: always use the shared globalTimeExtent
  const xScale = d3.scaleLinear()
    .domain(globalTimeExtent)
    .range([0, innerW]);
 
 
  // 6) Y‐scale: 0 .. max( disp ) across all genreBlocks
  const yMax = d3.max(genreBlocks, gb => d3.max(gb.series, d => d.disp));
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([innerH, 0]);
 
 
  // 7) Draw the X‐axis
  g.append("g")
    .attr("transform", `translate(0, ${innerH})`)
    .call(d3.axisBottom(xScale).ticks(12))
    .append("text")
      .attr("fill", "#000")
      .attr("x", innerW / 2)
      .attr("y", margin.bottom - 5)
      .attr("text-anchor", "middle")
      .text("Time (seconds)");
 
 
  // 8) Draw the Y‐axis
  g.append("g")
    .call(d3.axisLeft(yScale).ticks(5))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -innerH / 2)
      .attr("text-anchor", "middle")
      .text("Median Displacement (mm)");
 
 
  // 9) Build a color scale (one distinct color per genre)
  const uniqueGenres = Array.from(new Set(genreBlocks.map(d => d.genre)));
  const colorScale = d3.scaleOrdinal()
    .domain(uniqueGenres)
    .range(d3.schemeCategory10);
 
 
  // 10) Create a line generator: x = time_s, y = disp
  const lineGenerator = d3.line()
    .x(d => xScale(d.time_s))
    .y(d => yScale(d.disp));
 
 
  // 11) Draw one <path> per genre—**stroke only**, no fill
  genreBlocks.forEach(gb => {
    g.append("path")
      // Make sure fill="none" comes BEFORE stroke
      .attr("class", "genre-line")   // give each line a class
      .attr("fill", "none")           // attempt to turn off fill
      .attr("stroke", colorScale(gb.genre))
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.8)
      .datum(gb.series)
      .attr("d", lineGenerator);
  });
 
 
  // 12) (Optional) Legend at top‐right showing color→genre
  const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right - 120}, ${margin.top})`);
 
 
  uniqueGenres.forEach((gname, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 20})`);
    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", colorScale(gname));
    row.append("text")
      .attr("x", 16)
      .attr("y", 10)
      .attr("font-size", "12px")
      .text(gname);
  });
 }
 
 
 // ─────────────────────────────────────────────────────────────
 // (D) Draw “All Subjects” immediately (average across everyone)
 // ─────────────────────────────────────────────────────────────
 {
  const cumAll = computeCumulativeSeriesByGenre(allData);
  renderMultiLineChart("disp-all", cumAll, globalTimeExtent);
 }
 
 
 // ─────────────────────────────────────────────────────────────
 // (E) Draw “Selected Group” on demand (average across that group)
 // ─────────────────────────────────────────────────────────────
 function drawSelectedGroupChart(selectedGroup) {
  const groupData = groups[selectedGroup];       // e.g. NM0001Data
  const cumGroup  = computeCumulativeSeriesByGenre(groupData);
  renderMultiLineChart("disp-group", cumGroup, globalTimeExtent);
 }
 
 
 // ─────────────────────────────────────────────────────────────
 // (F) Draw “Selected Participant/Marker” on demand
 //     (average across that participant’s blocks of each genre)
 // ─────────────────────────────────────────────────────────────
 function drawSelectedParticipantChart(selectedGroup, selectedMarker) {
  const groupData = groups[selectedGroup];
  const partData  = groupData.filter(d => d.marker === selectedMarker);
  const cumPt     = computeCumulativeSeriesByGenre(partData);
  renderMultiLineChart("disp-participant", cumPt, globalTimeExtent);
 }
 
 
 // ─────────────────────────────────────────────────────────────
 // (G) Master update function: read dropdowns and redraw group+participant
 // ─────────────────────────────────────────────────────────────
 function updateAllCharts() {
  const selGroup  = d3.select("#group-filter").property("value");
  const selMarker = d3.select("#marker-filter").property("value");
 
 
  drawSelectedGroupChart(selGroup);
  drawSelectedParticipantChart(selGroup, selMarker);
 }
 
 
 // 1) Initial draw on page‐load so defaults show immediately
 // 2) Then re‐draw whenever group‐filter or marker‐filter changes
 updateAllCharts();




 // GLOBAL HEAD VARIABLES
 let projection, path, spherePath, graticulePath, eyes;
 
 // FUNCTION render head sphere
 function renderHead() {
   d3.select('#head').selectAll('svg').remove();
 
   const svg = d3
     .select('#head')
     .append('svg')
     .attr('id', 'vis')
     .attr('viewBox', '0 0 400 400')
     .style('width', '100%')
     .style('height', 'auto');
 
   projection = d3
     .geoOrthographic()
     .scale(150)
     .translate([200, 200])
     .clipAngle(90);
 
   path = d3.geoPath(projection);
   const defs = svg.append('defs');
 
   const grad = defs
     .append('linearGradient')
     .attr('id', 'shade')
     .attr('gradientUnits', 'userSpaceOnUse')
     .attr('x1', 200)
     .attr('y1', 0)
     .attr('x2', 200)
     .attr('y2', 400);
 
   grad.append('stop').attr('offset', '0%').attr('stop-color', '#FFF9C4');
   grad.append('stop').attr('offset', '100%').attr('stop-color', '#FDD835');
 
   const g = svg.append('g');
 
   spherePath = g
     .append('path')
     .datum({type: 'Sphere'})
     .attr('d', path)
     .attr('fill', 'url(#shade)')
     .attr('stroke', '#666');
 
   graticulePath = g
     .append('path')
     .datum(d3.geoGraticule()())
     .attr('d', path)
     .attr('fill', 'none')
     .attr('stroke', '#666')
     .attr('stroke-width', 0.5);
     
   eyes = g
     .selectAll('circle.eye')
     .data([[-25, 10], [25, 10]])
     .join('circle')
     .attr('class', 'eye')
     .attr('r', 15)
     .attr('fill', '#333')
     .attr('cx', d => projection(d)[0])
     .attr('cy', d => projection(d)[1]);
 }
 
 renderHead();
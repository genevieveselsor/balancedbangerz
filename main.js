import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

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
const NM0004Data = await loadData('NM0004-cleaned');
// NOTE: data keys are following
// ,group,marker,block,time_s,genre,x_mm,y_mm,z_mm

///////////////////////////////////////////////////////
// SANDBOX
// console.log('z-maxs')
// console.log(d3.max(NM0001Data, d => d.z_mm))
// console.log(d3.max(NM0004Data, d => d.z_mm))
// console.log(d3.max(NM0011Data, d => d.z_mm))

// function disp(data){
//   const dispData = data.map((d, i, arr) => {
//     if (i === 0) return { time_s: d.time_s, disp: 0 };
//     const p = arr[i - 1];
//     const dx = d.x_mm - p.x_mm,
//           dy = d.y_mm - p.y_mm,
//           dz = d.z_mm - p.z_mm;
//     return { time_s: d.time_s, disp: Math.sqrt(dx*dx + dy*dy + dz*dz) };
//   });

//   return dispData
// };

///////////////////////////////////////////////////////

// GLOBAL VARIABLES

// flatten all groups into one array
const allData = [...NM0004Data];

let genreToColor = {
  'silence': d3.interpolateBlues,
  'salsa': d3.interpolateOranges,
  'meditation': d3.interpolateGreens,
  'edm': d3.interpolateReds,
};

// global time range across every sample
const globalTimeExtent = d3.extent(allData, d => d.time_s);

// one single color scale for every chart (silence as default)
let globalColorScale = d3.scaleSequential(genreToColor['silence']).domain(globalTimeExtent);

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
  }
 
  return data.filter(d =>
    d.group  === selectedGroup &&
    d.marker === selectedMarker &&
    d.genre  === selectedGenre
  );
};

///////////////////////////////////////////////////////

// FUNCTION HELPER to render one axis graph
function renderGraph(data, axes, x, y) {

    const aspectWidth = 300;
    const aspectHeight = 300;

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
        .attr("font-size", "10px")
        .text(`${x}_mm`);

    g.append("text")
        .attr("class", "y-label")
        .attr("x", -innerHeight / 2)
        .attr("y", -25)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
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
function renderAxesGraph(selectedMarker, selectedGenre) { 
    ["xy-top","yz-side","xz-front"].forEach(id =>
        d3.select(`#${id}`).selectAll("svg").remove()
      ); // Clear existing axes graphs
    const filteredData = getObjectsByValue(NM0004Data, 'NM0004', selectedMarker, selectedGenre);
    console.log(filteredData);

    if (!filteredData || filteredData.length === 0) {
        console.warn("No data found.");
        return;
    };

    const ids = ["xy-top", "yz-side", "xz-front"];

    ids.forEach((id) => {
        renderGraph(filteredData, id, id[0], id[1]);
        console.log('rendered')
    });

    console.log("done rendering");
    // renderDispGraph(filteredData);
};

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
  const width = 500;
  const height = 300;
  const margin = { top: 40, right: 20, bottom: 40, left: 55 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // clear any old svg in the container
  const container = d3.select('#intro-graph');
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
  const dispData = data.map((d, i) => {
    if (i === 0) return { time_s: d.time_s, disp: 0 };
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
    .attr("font-size", "10px")
    .text('Time (sec)');

  g.append("text")
      .attr("class", "y-label")
      .attr("x", -h / 2)
      .attr("y", -25)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .text('Displacement (mm)');

  // line generator
const line = d3.line()
    .x(d => xScale(d.time_s))
    .y(d => yScale(d.disp));

  dispDataGlobal = dispData;
  dispPath = g.append('path')
    .datum(dispDataGlobal)
    .attr('fill', 'none')
    .attr('stroke', 'url(#global-disp-gradient)')
    .attr('stroke-width', 3)
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

  animateDispGraph();
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

// ///////////////////////////////////////////////////////

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
    .duration(900)
    .ease(d3.easeLinear)
    .attr('stroke-dashoffset', 0);
}

///////////////////////////////////////////////////////

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

const svg = d3.select('#head svg');
const maxYaw = 10;
const maxPitch = 8;
const cx = 200;
const cy = 200;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;

function handleMouse(event) {
  const [mx,my] = d3.pointer(event, svg.node());
  targetYaw = ((mx - cx)/cx) * maxYaw;
  targetPitch = ((cy - my)/cy) * maxPitch;
}
window.addEventListener('mousemove', handleMouse);

d3.timer(() => {
  currentYaw += (targetYaw - currentYaw) * 0.1;
  currentPitch += (targetPitch - currentPitch) * 0.1;
  projection.rotate([currentYaw, currentPitch]);
  spherePath.attr('d', path);
  graticulePath.attr('d', path);
  eyes
    .attr('cx', d => projection(d)[0])
    .attr('cy', d => projection(d)[1]);
});

function animateHeadTrajectory(headData) {
  const factorX = 5;
  const factorY = 0.01;
  const factorZ = 3;

  // base projection
  const baseTranslate = [200, 200];
  const baseScale = 150;

  const n = headData.length;

  let i = 0;
  const timer = d3.interval(() => {
    if (i < n) {
      const d = headData[i];
      // compute shift & scale
      const dx = d.x_mm * factorX;
      const dy = d.z_mm * factorZ;
      const sc = 1 + d.y_mm * factorY;

      // apply to projection (keeps globe centered and moves around)
      projection.translate([baseTranslate[0] + dx, baseTranslate[1] + dy]);
      projection.scale(baseScale * sc);

      // redraw head
      spherePath.attr('d', path);
      graticulePath.attr('d', path);
      eyes
        .attr('cx', pt => projection(pt)[0])
        .attr('cy', pt => projection(pt)[1]);

      i += 1;
    }
  }, 1);

  // compute how long the axes‐plot “fade‐in” lasts
  const totalAxesTime = (n - 1) + 400;

  // once axes are fully done, stop the interval and reset the head to center/scale
  setTimeout(() => {
    timer.stop();
    return;
    // projection.translate(baseTranslate);
    // projection.scale(baseScale);
    // spherePath.attr('d', path);
    // graticulePath.attr('d', path);
    // eyes
    //   .attr('cx', pt => projection(pt)[0])
    //   .attr('cy', pt => projection(pt)[1]);
  }, totalAxesTime);
}

// scrollytelling script
const scroller = scrollama();
const silenceData = NM0004Data.filter(d =>
    d.group === 'NM0004' && d.marker === 'S5' && d.genre === 'silence'
);
const edmData = NM0004Data.filter(d =>
    d.group === 'NM0004' && d.marker === 'S5' && d.genre === 'edm'
);
scroller
  .setup({
    container: '#scrolly',
    graphic: '#graphic',
    step: '#story .step',
    offset: 0.5,
  })
  .onStepEnter(({index}) => {

    if (index === 1) {
      window.removeEventListener('mousemove', handleMouse);
      targetYaw = 0;
      targetPitch = 0;
      projection.rotate([0,0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', d => projection(d)[0])
        .attr('cy', d => projection(d)[1]);
    } else {
      window.addEventListener('mousemove', handleMouse);
    }

    if (index === 3) { // step: During a minute of complete silence....
        d3.select('#head').style('display', 'none');
        d3.select('#intro-graph').style('display', 'block').selectAll('*').remove();
        globalColorScale = d3.scaleSequential(genreToColor['silence']).domain(globalTimeExtent);
        renderDispGraph(silenceData);

        window.removeEventListener('mousemove', handleMouse);
        targetYaw = 0;
        targetPitch = 0;
        projection.rotate([0,0]);
        spherePath.attr('d', path);
        eyes
          .attr('cx', d => projection(d)[0])
          .attr('cy', d => projection(d)[1]);

    } else if (index === 5) { // step: During music stimuli like EDM....
        d3.select('#head').style('display', 'none');
        d3.select('#intro-graph').style('display', 'block').selectAll('*').remove();
        globalColorScale = d3.scaleSequential(genreToColor['edm']).domain(globalTimeExtent);
        renderDispGraph(edmData);

        window.removeEventListener('mousemove', handleMouse);
        targetYaw = 0;
        targetPitch = 0;
        projection.rotate([0,0]);
        spherePath.attr('d', path);
        eyes
          .attr('cx', d => projection(d)[0])
          .attr('cy', d => projection(d)[1]);

    } else {
        d3.select('#intro-graph').style('display', 'none');
        d3.select('#head').style('display', 'block');
    }

    if (index === 4) {
        window.removeEventListener('mousemove', handleMouse);
        d3.select('#head').style('display', 'block');
        d3.select('#axes-graphs').style('display', 'grid');
        d3.select('#intro-graph').style('display', 'none');
        globalColorScale = d3.scaleSequential(genreToColor['silence']).domain(globalTimeExtent);
        renderAxesGraph('S5', 'silence');
        animateHeadTrajectory(silenceData);
        animateAxesPlots();
    } else if (index === 6) {
        window.removeEventListener('mousemove', handleMouse);
        d3.select('#head').style('display', 'block');
        d3.select('#axes-graphs').style('display', 'grid');
        d3.select('#intro-graph').style('display', 'none');
        globalColorScale = d3.scaleSequential(genreToColor['edm']).domain(globalTimeExtent);
        renderAxesGraph('S5', 'silence');
        animateHeadTrajectory(edmData);
        animateAxesPlots();
    } else {
        d3.select('#axes-graphs').style('display', 'none');
        projection.rotate([0,0]);
        spherePath.attr('d', path);
        eyes
          .attr('cx', d => projection(d)[0])
          .attr('cy', d => projection(d)[1]);
    }
  });
//   .onStepExit(({index}) => {

//     if (index === 4) {
//         renderHead();
//         window.addEventListener('mousemove', handleMouse);
//     }

//   });

const title = document.getElementById('title');
const startArrow = document.getElementById('start-arrow');

startArrow.addEventListener('click', () => {
  title.classList.add('hidden');
});

window.addEventListener('scroll', () => {
  if (!title.classList.contains('hidden')) {
    title.classList.add('hidden');
  }
});

// updateAxesGraph();
  
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// FUNCTION import CSV file
async function loadData(filename) {
  try {
    const rawData = await d3.csv(`./data/${filename}.csv`);
    const data = rawData.map((d) => ({
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
    console.error('Error loading the CSV file:', error);
  }
}

// import data
const NM0004Data = await loadData('NM0004-cleaned');

// GLOBAL VARIABLES
let currentView = 'front';
let filteredData = [];
let groups = {};

let projection;
let path;
let spherePath;
let graticulePath;
let eyes;
let axesPoints = [];
let headTimer = null;
let dispPoints = null;

const allData = [...NM0004Data];

let genreToColor = {
  silence: d3.interpolateBlues,
  salsa: d3.interpolateOranges,
  meditation: d3.interpolateGreens,
  edm: d3.interpolateReds,
};

const globalTimeExtent = d3.extent(allData, (d) => d.time_s);

let globalColorScale = d3
  .scaleSequential(genreToColor['silence'])
  .domain(globalTimeExtent);

// for animation
let dispPath, dispLength, dispDataGlobal;

///////////////////////////////////////////////////////

// FUNCTION filter data by marker and genre
function getObjectsByValue(data, selectedGroup, selectedMarker, selectedGenre) {
  if (selectedGenre === 'silence') {
    return data.filter(
      (d) =>
        d.group === selectedGroup &&
        d.marker === selectedMarker &&
        d.genre === 'silence' &&
        d.block === '1'
    );
  }

  return data.filter(
    (d) =>
      d.group === selectedGroup &&
      d.marker === selectedMarker &&
      d.genre === selectedGenre
  );
}

const tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'd3-tooltip')
  .style('position', 'absolute')
  .style('pointer-events', 'none')
  .style('padding', '4px 8px')
  .style('background', 'rgba(255,255,255,0.9)')
  .style('border', '1px solid #ccc')
  .style('border-radius', '4px')
  .style('font-size', '12px')
  .style('display', 'none');

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
  const svg = container
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');

  // define gradient stops as before
  svg.select('defs').remove();
  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', 'global-disp-gradient')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', margin.left)
    .attr('y1', 0)
    .attr('x2', margin.left + w)
    .attr('y2', 0);

  const stops = 20;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const time =
      globalTimeExtent[0] + t * (globalTimeExtent[1] - globalTimeExtent[0]);
    grad
      .append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', globalColorScale(time));
  }

  // compute displacement data
  const dispData = data.map((d, i) => {
    if (i === 0) return { time_s: d.time_s, disp: 0 };
    return {
      time_s: d.time_s,
      disp: Math.sqrt(d.x_mm ** 2 + d.y_mm ** 2 + d.z_mm ** 2),
    };
  });

  // scales
  const xScale = d3.scaleLinear().domain(globalTimeExtent).range([0, w]);
  const yScale = d3.scaleLinear().domain([0, 55]).range([h, 0]);

  // drawing group
  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // axes
  g.append('g')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(12));
  g.append('g').call(d3.axisLeft(yScale).ticks(5));

  g.append('text')
    .attr('class', 'x-label')
    .attr('x', w / 2)
    .attr('y', h + 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .text('Time (sec)');

  g.append('text')
    .attr('class', 'y-label')
    .attr('x', -h / 2)
    .attr('y', -25)
    .attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .text('Displacement (mm)');

  // line generator
  const line = d3
    .line()
    .x((d) => xScale(d.time_s))
    .y((d) => yScale(d.disp));

  dispDataGlobal = dispData;
  dispPath = g
    .append('path')
    .datum(dispDataGlobal)
    .attr('fill', 'none')
    .attr('stroke', 'url(#global-disp-gradient)')
    .attr('stroke-width', 3)
    .attr('d', line);

  dispLength = dispPath.node().getTotalLength();
  dispPath
    .attr('stroke-dasharray', `${dispLength} ${dispLength}`)
    .attr('stroke-dashoffset', dispLength);

  animateDispGraph();
  // tooltip hit‐areas
  g.selectAll('.disp-hover')
    .data(dispData)
    .enter()
    .append('circle')
    .attr('class', 'disp-hover')
    .attr('cx', (d) => xScale(d.time_s))
    .attr('cy', (d) => yScale(d.disp))
    .attr('r', 8)
    .attr('fill', 'transparent')
    .on('mouseover', (event, d) => {
      tooltip.style('display', 'block').html(`
            <strong>time:</strong> ${d.time_s.toFixed(2)} s<br/>
            <strong>disp:</strong> ${d.disp.toFixed(3)} mm
          `);
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 25}px`);
    })
    .on('mouseout', () => tooltip.style('display', 'none'));
}

/* RENDER HEAD */
function renderHead(containerSelector) {
  d3.select(containerSelector).selectAll('svg').remove();

  const svg = d3
    .select(containerSelector)
    .append('svg')
    .attr('viewBox', '0 0 400 400')
    .style('width', '100%')
    .style('height', 'auto');

  let rotation;
  if (currentView === 'top') rotation = [0, -90, 0];
  else if (currentView === 'side') rotation = [90, 0, 0];
  else rotation = [0, 0, 0];

  projection = d3
    .geoOrthographic()
    .scale(150)
    .translate([200, 200])
    .rotate(rotation)
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

  grad.append('stop').attr('offset', '10%').attr('stop-color', '#FFF9C4');
  grad.append('stop').attr('offset', '90%').attr('stop-color', '#FDD835');

  const g = svg.append('g');

  spherePath = g
    .append('path')
    .datum({ type: 'Sphere' })
    .attr('d', path)
    .attr('fill', 'url(#shade)')
    .attr('stroke', '#666')
    .attr('stroke-width', 1);

  graticulePath = g
    .append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#666')
    .attr('stroke-width', 0.5);

  eyes = g
    .selectAll('circle.eye')
    .data([
      [-25, 10],
      [25, 10],
    ])
    .join('circle')
    .attr('class', 'eye')
    .attr('r', 15)
    .attr('fill', '#333')
    .attr('cx', (d) => projection(d)[0])
    .attr('cy', (d) => projection(d)[1]);
}

/* RENDER AXES PLOT */
function renderAxesPlot(containerId, data, xKey, yKey) {
  return new Promise((resolve) => {
    d3.select(`#${containerId}`).selectAll('svg').remove();
    const aspectWidth = 300;
    const aspectHeight = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = aspectWidth - margin.left - margin.right;
    const innerHeight = aspectHeight - margin.top - margin.bottom;

    const svg = d3
      .select(`#${containerId}`)
      .append('svg')
      .attr('viewBox', `0 0 ${aspectWidth} ${aspectHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([-50, 60]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([-50, 60]).range([innerHeight, 0]);

    svg
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .text(xKey);

    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -margin.left + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .text(yKey);

    svg
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    svg.append('g').call(d3.axisLeft(yScale));

    const genre = data[0]?.genre || 'silence';
    const interp = genreToColor[genre] || d3.interpolateViridis;
    const timeExtent = d3.extent(data, (d) => d.time_s);
    const colorScale = d3.scaleSequential(interp).domain(timeExtent);

    const pts = svg
      .selectAll('circle.point')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', (d) => xScale(d[xKey]))
      .attr('cy', (d) => yScale(d[yKey]))
      .attr('r', 0)
      .attr('fill', (d) => colorScale(d.time_s))
      .style('opacity', 0);

    axesPoints.push(pts);

    svg
      .selectAll('circle.hover-target')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'hover-target')
      .attr('cx', (d) => xScale(d[xKey]))
      .attr('cy', (d) => yScale(d[yKey]))
      .attr('r', 8)
      .attr('fill', 'transparent')
      .on('mouseover', (event, d) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 25}px`)
          .style('display', 'block').html(`
          <strong>time:</strong> ${d.time_s.toFixed(2)} s<br/>
          <strong>${xKey}:</strong> ${d[xKey].toFixed(3)}<br/>
          <strong>${yKey}:</strong> ${d[yKey].toFixed(3)}<br/>
          <strong>distance from (0, 0):</strong>
            ${Math.sqrt(d[`${xKey}`] ** 2 + d[`${yKey}`] ** 2).toFixed(
              3
            )} mm<br/>
        `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 25}px`);
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    resolve();
  });
}

/* RENDER MINI HEAD */
function renderMiniHead(containerSelector, view) {
  d3.select(containerSelector).selectAll('svg').remove();
  const svg = d3
    .select(containerSelector)
    .append('svg')
    .attr('viewBox', '0 0 100 100')
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '50px')
    .style('height', '50px')
    .style('cursor', 'pointer');

  let rotation;
  if (view === 'top') rotation = [0, -90, 0];
  else if (view === 'side') rotation = [90, 0, 0];
  else rotation = [0, 0, 0];

  const miniProj = d3
    .geoOrthographic()
    .scale(30)
    .translate([50, 50])
    .rotate(rotation)
    .clipAngle(90);

  const miniPath = d3.geoPath(miniProj);

  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', `shade-mini-${view}`)
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 50)
    .attr('y1', 0)
    .attr('x2', 50)
    .attr('y2', 100);

  grad.append('stop').attr('offset', '0%').attr('stop-color', '#FFF9C4');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#FDD835');

  const g = svg.append('g');
  g.append('circle')
    .attr('cx', 50)
    .attr('cy', 50)
    .attr('r', 30)
    .attr('fill', `url(#shade-mini-${view})`)
    .attr('stroke', '#aaa')
    .attr('stroke-width', 1);

  g.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', miniPath)
    .attr('fill', 'none')
    .attr('stroke', '#aaa')
    .attr('stroke-width', 0.5);

  g.selectAll('circle.eye-mini')
    .data([
      [-25, 5],
      [25, 5],
    ])
    .join('circle')
    .attr('class', 'eye-mini')
    .attr('r', 4)
    .attr('fill', '#333')
    .attr('cx', (d) => miniProj(d)[0])
    .attr('cy', (d) => miniProj(d)[1]);
}

/* ANIMATION */
function animate(headData) {
  const f = 0.5;
  const baseTranslate = [200, 200];

  if (axesPoints.length > 0) {
    axesPoints.forEach((points) => points.attr('r', 0).style('opacity', 0));
  }
  if (dispPoints) {
    dispPoints.attr('r', 0).style('opacity', 0);
  }
  if (headTimer) headTimer.stop();

  spherePath.attr('d', path);
  graticulePath.attr('d', path);
  eyes.attr('cx', (d) => projection(d)[0]).attr('cy', (d) => projection(d)[1]);

  let i = 0;
  const n = headData.length;
  // const step = 4;
  // const TICK = 10;

  const totalDuration = 4000; // in ms
  const TICK = 7;
  const steps = headData.length;
  const step = Math.ceil(steps / (totalDuration / TICK));

  console.log('step:', step);

  headTimer = d3.interval(() => {
    if (i < n) {
      const d = headData[i];
      let dx = 0;
      let dy = 0;

      if (currentView === 'front') {
        dx = d.x_mm * f;
        dy = -d.z_mm * f;
      } else if (currentView === 'top') {
        dx = d.x_mm * f;
        dy = -d.y_mm * f;
      } else {
        dx = d.y_mm * f;
        dy = -d.z_mm * f;
      }

      projection.translate([baseTranslate[0] + dx, baseTranslate[1] + dy]);
      spherePath.attr('d', path);
      graticulePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);

      if (axesPoints.length > 0) {
        axesPoints.forEach((points) => {
          points
            .filter((_, idx) => idx === i)
            .attr('r', 3)
            .style('opacity', 0.7);
        });
      }
      if (dispPoints) {
        dispPoints
          .filter((_, idx) => idx === i)
          .attr('r', 1.5)
          .style('opacity', 0.7);
      }

      i += step;
    } else {
      headTimer.stop();
    }
  }, TICK);
}

/* VIEW TOGGLE */
function initializeViewToggle() {
  const container = d3.select('#view-toggle');
  container.html('');

  const legend = container
    .append('div')
    .attr('id', 'view-legend')
    .style('display', 'flex')
    .style('gap', '0.5rem')
    .style('justify-content', 'center');

  ['top', 'side', 'front'].forEach((view) => {
    const item = legend
      .append('div')
      .attr('class', 'legend-item')
      .attr('data-view', view)
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('align-items', 'center')
      .style('cursor', 'pointer')
      .on('click', function () {
        currentView = view;
        updateView();
      });

    renderMiniHead(item.node(), view);

    item
      .append('span')
      .text(view[0].toUpperCase() + view.slice(1))
      .style('font-size', '10px')
      .style('margin-top', '2px');
  });

  d3.select('.legend-item[data-view="front"]').classed('active', true);
}

async function updateView() {
  // 1) render the head at the new view
  renderHead('#head');

  // 2) immediately sync the timer vars to that same view
  if (currentView === 'top') {
    targetYaw = 0;
    targetPitch = -90;
  } else if (currentView === 'side') {
    targetYaw = 90;
    targetPitch = 0;
  } else {
    targetYaw = 0;
    targetPitch = 0;
  }
  currentYaw = targetYaw;
  currentPitch = targetPitch;

  axesPoints = [];
  await Promise.all([
    renderAxesPlot('xz-front', filteredData, 'x_mm', 'z_mm'),
    renderAxesPlot('xy-top', filteredData, 'x_mm', 'y_mm'),
    renderAxesPlot('yz-side', filteredData, 'y_mm', 'z_mm'),
  ]);

  renderDispGraph(filteredData);
  animate(filteredData);
}

// /* FILTER AND RENDER */
// function updateAxesGraph() {
//   let selectedGroup = d3.select('#group-filter').property('value');
//   let selectedMarker = d3.select('#marker-filter').property('value');
//   let selectedGenre = d3.select('#genre-filter').property('value');

//   function applyFilters() {
//     filteredData = getObjectsByValue(
//       allData,
//       selectedGroup,
//       selectedMarker,
//       selectedGenre
//     );
//     updateView();

//     updateParticipantChartWithGenres();
//   }

//   applyFilters();

//   d3.select('#group-filter').on('change', function () {
//     selectedGroup = d3.select(this).property('value');
//     applyFilters();
//   });
//   d3.select('#marker-filter').on('change', function () {
//     selectedMarker = d3.select(this).property('value');
//     applyFilters();
//   });
//   d3.select('#genre-filter').on('change', function () {
//     selectedGenre = d3.select(this).property('value');
//     applyFilters();
//   });
// }

//////////////////////////////////////////////////////////

function animateDispGraph() {
  dispPath
    .transition()
    .duration(900)
    .ease(d3.easeLinear)
    .attr('stroke-dashoffset', 0);
}

///////////////////////////////////////////////////////

renderHead('#head');

const maxYaw = 10;
const maxPitch = 8;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;

function handleMouse(event) {
  const svg = d3.select('#head svg');
  const svgNode = svg.node();
  const [mx, my] = d3.pointer(event, svgNode);
  const { width, height } = svgNode.getBoundingClientRect();
  const cx = width / 2;
  const cy = height / 2;

  targetYaw = -((cx - mx) / cx) * maxYaw;
  targetPitch = -((my - cy) / cy) * maxPitch;

  // currentYaw = targetYaw;
  // currentPitch = targetPitch;
}

window.addEventListener('mousemove', handleMouse);

d3.timer(() => {
  currentYaw += (targetYaw - currentYaw) * 0.1;
  currentPitch += (targetPitch - currentPitch) * 0.1;
  projection.rotate([currentYaw, currentPitch]);
  spherePath.attr('d', path);
  graticulePath.attr('d', path);
  eyes.attr('cx', (d) => projection(d)[0]).attr('cy', (d) => projection(d)[1]);
});

// scrollytelling script
const scroller = scrollama();
const silenceData = NM0004Data.filter(
  (d) => d.group === 'NM0004' && d.marker === 'S4' && d.genre === 'silence'
);
const edmData = NM0004Data.filter(
  (d) => d.group === 'NM0004' && d.marker === 'S4' && d.genre === 'edm'
);

filteredData = silenceData;
initializeViewToggle();
// updateAxesGraph();
d3.select('#view-toggle').style('display', 'none');

scroller
  .setup({
    container: '#scrolly',
    graphic: '#graphic',
    step: '#story .step',
    offset: 0.5,
  })
  .onStepEnter(({ index }) => {
    if (index === 0) {
      animateFigureEight();
    }
    if (index === 3) {
      window.removeEventListener('mousemove', handleMouse);
      targetYaw = 0;
      targetPitch = 0;
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
    } else {
      window.addEventListener('mousemove', handleMouse);
    }

    if (index === 5) {
      // step: During a minute of complete silence....
      d3.select('#head').style('display', 'none');
      d3.select('#intro-graph')
        .style('display', 'block')
        .selectAll('*')
        .remove();
      globalColorScale = d3
        .scaleSequential(genreToColor['silence'])
        .domain(globalTimeExtent);
      renderDispGraph(silenceData);

      window.removeEventListener('mousemove', handleMouse);
      targetYaw = 0;
      targetPitch = 0;
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
    } else if (index === 7) {
      // step: During music stimuli like EDM....
      d3.select('#head').style('display', 'none');
      d3.select('#intro-graph')
        .style('display', 'block')
        .selectAll('*')
        .remove();
      globalColorScale = d3
        .scaleSequential(genreToColor['edm'])
        .domain(globalTimeExtent);
      renderDispGraph(edmData);

      window.removeEventListener('mousemove', handleMouse);
      targetYaw = 0;
      targetPitch = 0;
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
    } else {
      d3.select('#intro-graph').style('display', 'none');
      d3.select('#head').style('display', 'block');
    }

    if (index === 6) {
      window.removeEventListener('mousemove', handleMouse);
      d3.select('#head').style('display', 'block');
      d3.select('#axes-graphs').style('display', 'grid');
      d3.select('#intro-graph').style('display', 'none');
      d3.select('#view-toggle').style('display', 'flex');
      globalColorScale = d3
        .scaleSequential(genreToColor['silence'])
        .domain(globalTimeExtent);
      filteredData = silenceData;
      updateView();
    } else if (index === 8) {
      window.removeEventListener('mousemove', handleMouse);
      d3.select('#head').style('display', 'block');
      d3.select('#axes-graphs').style('display', 'grid');
      d3.select('#intro-graph').style('display', 'none');
      d3.select('#view-toggle').style('display', 'flex');
      globalColorScale = d3
        .scaleSequential(genreToColor['edm'])
        .domain(globalTimeExtent);
      filteredData = edmData;
      updateView();
    } else {
      d3.select('#axes-graphs').style('display', 'none');
      d3.select('#view-toggle').style('display', 'none');
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
      currentView = 'front';
      renderHead('#head');
    }

    if (index === 9) {
      animateFigureEight();
    }
  })
  .onStepExit(({ index }) => {
    if (index === 1) {
      headTimer.stop();
    }
    if (index === 6) {
      headTimer.stop();
    }
    if (index === 7) {
      renderHead('#head');
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
    } else if (index === 8) {
      headTimer.stop();
      renderHead('#head');
      projection.rotate([0, 0]);
      spherePath.attr('d', path);
      eyes
        .attr('cx', (d) => projection(d)[0])
        .attr('cy', (d) => projection(d)[1]);
    }
  });

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

function animateFigureEight(loopDuration = 5000) {
  if (headTimer) headTimer.stop();

  // const svgNode = d3.select('#head svg').node();
  const cx = 400 / 2;
  const cy = 400 / 2;
  const A = 20;
  const B = 10;

  headTimer = d3.timer((elapsed) => {
    const t = ((elapsed % loopDuration) / loopDuration) * 2 * Math.PI;
    const x = A * Math.sin(t);
    const y = B * Math.sin(2 * t);

    projection.translate([cx + x, cy + y]);
    spherePath.attr('d', path);
    graticulePath.attr('d', path);
    eyes
      .attr('cx', (d) => projection(d)[0])
      .attr('cy', (d) => projection(d)[1]);
  });
}

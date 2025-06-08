import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

/* GLOBAL VARIABLES */
let currentView = 'front';
let allData = [];
let filteredData = [];
let globalTimeExtent = [0, 0];
let groups = {};

let projection;
let path;
let spherePath;
let graticulePath;
let eyes;
let axesPoints = [];
let headTimer = null;
let dispPoints = null;

/* GENRE COLOR ENCODING */
const genreToColor = {
  silence: d3.interpolateBlues,
  salsa: d3.interpolateOranges,
  meditation: d3.interpolateGreens,
  edm: d3.interpolateReds,
};

const genreLineColor = {
  silence: genreToColor.silence(0.6),
  salsa: genreToColor.salsa(0.6),
  meditation: genreToColor.meditation(0.6),
  edm: genreToColor.edm(0.6),
};

/* TOOLTIP SETUP */
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

/* LOAD DATA */
function loadData(filename) {
  return d3
    .csv(`../data/${filename}.csv`)
    .then((raw) =>
      raw.map((d) => ({
        group: d.group,
        marker: d.marker,
        block: d.block,
        genre: d.genre,
        time_s: +d.time_s,
        x_mm: +d.x_mm,
        y_mm: +d.y_mm,
        z_mm: +d.z_mm,
      }))
    )
    .catch((err) => {
      console.error(`Error loading ${filename}:`, err);
      return [];
    });
}

/* FILTER FUNCTION */
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

/* RENDER HEAD */
function renderHead(containerSelector) {
  d3.select(containerSelector).selectAll('svg').remove();
  const svg = d3
    .select(containerSelector)
    .append('svg')
    .attr('viewBox', '0 0 600 600')
    .style('width', '100%')
    .style('height', 'auto');

  let rotation;
  if (currentView === 'top') rotation = [0, -90, 0];
  else if (currentView === 'side') rotation = [90, 0, 0];
  else rotation = [0, 0, 0];

  projection = d3
    .geoOrthographic()
    .scale(100)
    .translate([300, 300])
    .rotate(rotation)
    .clipAngle(90);

  path = d3.geoPath(projection);

  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', 'shade')
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 300)
    .attr('y1', 0)
    .attr('x2', 300)
    .attr('y2', 600);

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
    .attr('r', 10)
    .attr('fill', '#333')
    .attr('cx', (d) => projection(d)[0])
    .attr('cy', (d) => projection(d)[1]);
}

/* RENDER AXES PLOT */
function renderAxesPlot(containerId, data, xKey, yKey) {
  d3.select(`#${containerId}`).selectAll('svg').remove();
  const aspectWidth = 500;
  const aspectHeight = 500;
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
    .attr('font-size', '10px')
    .text(xKey);

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -margin.left + 12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
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
          <strong>${xKey}:</strong> ${d[xKey].toFixed(3)}<br/>
          <strong>${yKey}:</strong> ${d[yKey].toFixed(3)}<br/>
          <strong>time (s):</strong> ${d.time_s.toFixed(2)}
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
}

/* RENDER DISPLACEMENT GRAPH */
function renderDispGraph(data) {
  d3.select('#disp-chart').selectAll('svg').remove();

  const dispData = data.map((d, i) => ({
    time_s: d.time_s,
    disp: i === 0 ? 0 : Math.sqrt(d.x_mm ** 2 + d.y_mm ** 2 + d.z_mm ** 2),
  }));

  const genre = data[0]?.genre || 'silence';
  const interp = genreToColor[genre] || d3.interpolateViridis;
  const timeExtent = d3.extent(dispData, (d) => d.time_s);
  const colorScale = d3.scaleSequential(interp).domain(timeExtent);

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 900 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3
    .select('#disp-chart')
    .append('svg')
    .attr(
      'viewBox',
      `0 0 ${width + margin.left + margin.right} ${
        height + margin.top + margin.bottom
      }`
    )
    .style('width', '100%')
    .style('height', 'auto')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain(timeExtent).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, 55]).range([height, 0]);

  svg
    .append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(8));

  svg.append('g').call(d3.axisLeft(yScale).ticks(5));

  dispPoints = svg
    .selectAll('circle.disp-point')
    .data(dispData)
    .enter()
    .append('circle')
    .attr('class', 'disp-point')
    .attr('cx', (d) => xScale(d.time_s))
    .attr('cy', (d) => yScale(d.disp))
    .attr('fill', (d) => colorScale(d.time_s))
    .attr('r', 0)
    .style('opacity', 0);

  svg
    .selectAll('circle.disp-hover')
    .data(dispData)
    .enter()
    .append('circle')
    .attr('class', 'disp-hover')
    .attr('cx', (d) => xScale(d.time_s))
    .attr('cy', (d) => yScale(d.disp))
    .attr('r', 8)
    .attr('fill', 'transparent')
    .on('mouseover', (event, d) => {
      tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 25}px`)
        .style('display', 'block').html(`
          <strong>time:</strong> ${d.time_s.toFixed(2)} s<br/>
          <strong>disp:</strong> ${d.disp.toFixed(3)} mm
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

  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .text('Time (s)');

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .text('Displacement (mm)');
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
  const f = 1.5;
  const baseTranslate = [300, 300];

  if (axesPoints.length > 0) {
    axesPoints[0].attr('r', 0).style('opacity', 0);
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
  const step = 2;
  const TICK = 1;

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
        axesPoints[0]
          .filter((_, idx) => idx === i)
          .attr('r', 3)
          .style('opacity', 0.7);
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

  ['front', 'top', 'side'].forEach((view) => {
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

/* UPDATE VIEW */
function updateView() {
  renderHead('#head');

  axesPoints = [];
  if (currentView === 'front') {
    d3.select('#xz-front').style('display', 'block');
    d3.select('#xy-top').style('display', 'none');
    d3.select('#yz-side').style('display', 'none');
    renderAxesPlot('xz-front', filteredData, 'x_mm', 'z_mm');
  } else if (currentView === 'top') {
    d3.select('#xy-top').style('display', 'block');
    d3.select('#xz-front').style('display', 'none');
    d3.select('#yz-side').style('display', 'none');
    renderAxesPlot('xy-top', filteredData, 'x_mm', 'y_mm');
  } else {
    d3.select('#yz-side').style('display', 'block');
    d3.select('#xz-front').style('display', 'none');
    d3.select('#xy-top').style('display', 'none');
    renderAxesPlot('yz-side', filteredData, 'y_mm', 'z_mm');
  }

  renderDispGraph(filteredData);
  animate(filteredData);
}

/* FILTER AND RENDER */
function updateAxesGraph() {
  let selectedGroup = d3.select('#group-filter').property('value');
  let selectedMarker = d3.select('#marker-filter').property('value');
  let selectedGenre = d3.select('#genre-filter').property('value');

  function applyFilters() {
    filteredData = getObjectsByValue(
      allData,
      selectedGroup,
      selectedMarker,
      selectedGenre
    );
    updateView();
  }

  applyFilters();

  d3.select('#group-filter').on('change', function () {
    selectedGroup = d3.select(this).property('value');
    applyFilters();
  });
  d3.select('#marker-filter').on('change', function () {
    selectedMarker = d3.select(this).property('value');
    applyFilters();
  });
  d3.select('#genre-filter').on('change', function () {
    selectedGenre = d3.select(this).property('value');
    applyFilters();
  });
}

/* (A) computeDisplacementByGenre */
function computeDisplacementByGenre(data) {
  const byGenre = d3.group(data, (d) => d.genre);
  const allGenreArrays = [];

  for (const [genreKey, ptsOfGenre] of byGenre.entries()) {
    const byBlock = d3.group(ptsOfGenre, (d) => d.block);
    for (const [blockKey, ptsInBlock] of byBlock.entries()) {
      const sortedPts = ptsInBlock
        .slice()
        .sort((a, b) => d3.ascending(a.time_s, b.time_s));

      const instSeries = sortedPts.map((d, i, arr) => {
        if (i === 0) return { time_s: d.time_s, disp: 0 };
        const prev = arr[i - 1];
        const dx = d.x_mm - prev.x_mm;
        const dy = d.y_mm - prev.y_mm;
        const dz = d.z_mm - prev.z_mm;
        return {
          time_s: d.time_s,
          disp: Math.sqrt(dx * dx + dy * dy + dz * dz),
        };
      });

      allGenreArrays.push({
        genre: genreKey,
        block: blockKey,
        series: instSeries,
      });
    }
  }
  return allGenreArrays;
}

/* (B) computeCumulativeSeriesByGenre */
function computeCumulativeSeriesByGenre(data) {
  const byGenre = d3.group(data, (d) => d.genre);
  const cumArrays = [];

  for (const [genreKey, ptsOfGenre] of byGenre.entries()) {
    const byRun = d3.group(
      ptsOfGenre,
      (d) => `${d.group}-${d.marker}-${d.genre}-${d.block}`
    );
    const eachBlockCum = [];

    for (const [, ptsInBlock] of byRun.entries()) {
      const sortedPts = ptsInBlock
        .slice()
        .sort((a, b) => d3.ascending(a.time_s, b.time_s));
      const t0 = sortedPts[0].time_s;

      const instSeries = sortedPts.map((d) => ({
        time_s: d.time_s - t0,
        disp: Math.sqrt(d.x_mm ** 2 + d.y_mm ** 2 + d.z_mm ** 2),
      }));

      eachBlockCum.push(instSeries);
    }

    const minLen = d3.min(eachBlockCum, (s) => s.length);
    const averagedCum = [];

    for (let i = 0; i < minLen; i++) {
      const t = eachBlockCum[0][i].time_s;
      const medianDisp = d3.mean(eachBlockCum, (s) => s[i].disp);
      averagedCum.push({ time_s: t, disp: medianDisp });
    }

    cumArrays.push({ genre: genreKey, series: averagedCum });
  }
  return cumArrays;
}

/* (C) renderMultiLineChart */
function renderMultiLineChart(
  containerId,
  genreBlocks,
  globalTimeExtent,
  highlightGenre
) {
  // clear old chart
  d3.select(`#${containerId}`).selectAll('svg').remove();

  // dimensions
  const width = 900;
  const height = 300;
  const margin = { top: 40, right: 20, bottom: 30, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // svg + group
  const svg = d3
    .select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // scales
  const xScale = d3.scaleLinear().domain(globalTimeExtent).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, 55]).nice().range([innerH, 0]);

  // axes
  svg
    .append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(12))
    .append('text')
    .attr('fill', '#000')
    .attr('x', innerW / 2)
    .attr('y', margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('Time (seconds)');

  svg
    .append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .append('text')
    .attr('fill', '#000')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 15)
    .attr('x', -innerH / 2)
    .attr('text-anchor', 'middle')
    .text('Displacement (mm)');

  // line generator
  const lineGenerator = d3
    .line()
    .x((d) => xScale(d.time_s))
    .y((d) => yScale(d.disp));

  // draw one path per genreBlock
  genreBlocks.forEach((gb) => {
    svg
      .append('path')
      .classed('genre-line', true)
      .classed('highlight', gb.genre === highlightGenre)
      .attr('fill', 'none')
      .attr('stroke', genreLineColor[gb.genre])
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .datum(gb.series)
      .attr('d', lineGenerator);
  });

  // legend: one swatch per genre present
  const uniqueGenres = Array.from(new Set(genreBlocks.map((d) => d.genre)));
  const legend = svg
    .append('g')
    .attr('transform', `translate(${margin.left + 20},${margin.top - 10})`);

  uniqueGenres.forEach((gname, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 15})`);
    row
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', genreLineColor[gname]);
    row
      .append('text')
      .attr('x', 16)
      .attr('y', 10)
      .attr('font-size', '12px')
      .text(gname);
  });
}

/* (D) and (E) Draw on demand */
function drawSelectedGroupChart(selectedGroup) {
  const groupData = groups[selectedGroup];
  const cumGroup = computeCumulativeSeriesByGenre(groupData);
  renderMultiLineChart('disp-group', cumGroup, globalTimeExtent);
}

function drawSelectedParticipantChart(selectedGroup, selectedMarker) {
  const groupData = groups[selectedGroup];
  const partData = groupData.filter((d) => d.marker === selectedMarker);
  const cumPt = computeCumulativeSeriesByGenre(partData);
  const highlight = d3.select('#genre-filter').property('value');
  renderMultiLineChart('disp-participant', cumPt, globalTimeExtent, highlight);
}

/* (F) Participant-genre toggle */
function updateParticipantChartWithGenres() {
  const selectedGroup = d3.select('#group-filter').property('value');
  const selectedMarker = d3.select('#marker-filter').property('value');
  const activeGenres = d3
    .selectAll('#genre-toggle input:checked')
    .nodes()
    .map((n) => n.value);

  const partData = groups[selectedGroup].filter(
    (d) => d.marker === selectedMarker && activeGenres.includes(d.genre)
  );
  const cumPt = computeCumulativeSeriesByGenre(partData);
  const highlight = d3.select('#genre-filter').property('value');
  renderMultiLineChart('disp-participant', cumPt, globalTimeExtent, highlight);
}

function initParticipantGenreToggle() {
  d3.selectAll('#genre-toggle input').on(
    'change',
    updateParticipantChartWithGenres
  );
  updateParticipantChartWithGenres();
}

/* (G) Master update */
function updateAllCharts() {
  const selGroup = d3.select('#group-filter').property('value');
  const selMarker = d3.select('#marker-filter').property('value');
  drawSelectedGroupChart(selGroup);
  updateParticipantChartWithGenres();
}

/* MAIN INITIALIZATION */
document.addEventListener('DOMContentLoaded', async () => {
  const [data1, data4, data11] = await Promise.all([
    loadData('NM0001-cleaned'),
    loadData('NM0004-cleaned'),
    loadData('NM0011-cleaned'),
  ]);
  allData = [...data1, ...data4, ...data11];

  const cumAll = computeCumulativeSeriesByGenre(allData);
  globalTimeExtent = d3.extent(
    cumAll.flatMap((gb) => gb.series.map((d) => d.time_s))
  );

  renderMultiLineChart('disp-all', cumAll, globalTimeExtent);

  const groupList = Array.from(new Set(allData.map((d) => d.group)));
  groupList.forEach((g) => {
    groups[g] = allData.filter((d) => d.group === g);
  });

  d3.select('#group-filter')
    .selectAll('option')
    .data(groupList)
    .enter()
    .append('option')
    .attr('value', (d) => d)
    .text((d) => d);

  const markerList = Array.from(new Set(allData.map((d) => d.marker)));
  d3.select('#marker-filter')
    .selectAll('option')
    .data(markerList)
    .enter()
    .append('option')
    .attr('value', (d) => d)
    .text((d) => d);

  initializeViewToggle();
  updateAxesGraph();
  initParticipantGenreToggle();
  updateAllCharts();
});

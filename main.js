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
  return data.filter(obj => obj["marker"] === marker).filter(obj => obj["genre"] === genre);
}

// test function
const test = getObjectsByValue(NM0001Data, "S1", "salsa");
console.log(test);

///////////////////////////////////////////////////////
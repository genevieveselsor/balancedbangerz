import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// FUNCTION import CSV file
async function loadData(filename) {
    try {
    const data = await d3.csv(`./data/${filename}.csv`);
    return data;
    } catch (error) {
    console.error("Error loading the CSV file:", error);
    }
};

// import data
const NM0001Data = await loadData('NM0001-cleaned');
const NM0004Data = await loadData('NM0004-cleaned');
const NM0011Data = await loadData('NM0011-cleaned');




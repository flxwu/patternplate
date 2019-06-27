const colors = require("colors/safe");

var start;
var file;
var tag;

function ms(ns) {
	var ms = (ns[0] * 1000000 + ns[1] / 1000) / 1000;
	return Math.round(ms * 100) / 100;
}

function pStart(tagName) {
	var t = process.hrtime();
	tag = tagName;
	start = ms(t);
}

function pEnd() {
	var t = process.hrtime();
	var end = ms(t);
	console.log(colors.cyan(`[${file}, ${tag}] ${(end - start).toFixed(2)}ms`));
}

function init(filename) {
	file = filename.match(/packages.*/g)[0].replace('packages', '');
	return { pStart, pEnd };
}

module.exports = init;
// ==UserScript==
// @name         Facebook Event Exporter
// @namespace    http://boris.joff3.com
// @version      1.3.0
// @description  Export Facebook events
// @author       Boris Joffe
// @match        https://www.facebook.com/*
// @grant        unsafeWindow
// ==/UserScript==
/* jshint -W097 */
/* globals console*/
/* eslint-disable no-console, no-unused-vars */
'use strict';

/*
The MIT License (MIT)

Copyright (c) 2015, 2017 Boris Joffe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/


// Util
var
	qs = document.querySelector.bind(document),
	qsa = document.querySelectorAll.bind(document),
	err = console.error.bind(console),
	log = console.log.bind(console),
	euc = encodeURIComponent;

var DEBUG = false;
function dbg() {
  if (DEBUG)
	  console.log.apply(console, arguments);

  return arguments[0];
}

function qsv(elmStr, parent) {
	var elm = parent ? parent.querySelector(elmStr) : qs(elmStr);
	if (!elm) err('(qs) Could not get element -', elmStr);
	return elm;
}

function qsav(elmStr, parent) {
	var elm = parent ? parent.querySelectorAll(elmStr) : qsa(elmStr);
	if (!elm) err('(qsa) Could not get element -', elmStr);
	return elm;
}

function setProp(parent, path, val) {
	if (!parent || typeof parent !== 'object')
		return;
	path = Array.isArray(path) ? Array.from(path) : path.split('.');
	var child, prop;
	while (path.length > 1) {
		prop = path.shift();
		child = parent[prop];
		if (!child || typeof child !== 'object')
			parent[prop] = {};
		parent = parent[prop];
	}
	parent[path.shift()] = val;
}

function getProp(obj, path, defaultValue) {
	path = Array.isArray(path) ? Array.from(path) : path.split('.');
	var prop = obj;

	while (path.length && obj) {
		prop = obj[path.shift()];
	}

	return prop != null ? prop : defaultValue;
}


// ==== Scrape =====


// == Dates ==

function convertDateString(dateObj) {
	return dateObj.toISOString()
		.replace(/-/g, '')
		.replace(/:/g, '')
		.replace('.000Z', '');
}

	/*
	// Old way to get Date & Time
	// TODO: convert to local time instead of UTC

	var sdElm = qsv('[itemprop="startDate"]', evElm);
	var sdd = new Date(sdElm.getAttribute('content')),
		edd = new Date(sdd);
	edd.setHours(edd.getHours() + 1); // Add one hour as a default
	var evStartDate = convertDateString(sdd);
	var evEndDate = convertDateString(edd);
	*/

function getDates() {
	return qsv('._publicProdFeedInfo__timeRowTitle')
		.getAttribute('content')
		.split(' to ')
		.map(date => new Date(date))
		.map(convertDateString);
}

function getStartDate() { return getDates()[0]; }
function getEndDate() { return getDates()[1]; }


// == Location / Address ==

// old way
	/*
	// Event Summary
	var evElm = qsv('#event_summary');

	// Location
	var locElm = qsv('[data-hovercard]', evElm) || {};
	var addrElm = getProp(locElm, 'nextSibling', {});
	*/


function getLocation() {
	return qsv('[data-hovercard]', qs('#event_summary')).innerText;
}

function getAddress() {
	return qsv('[data-hovercard]', qs('#event_summary')).nextSibling.innerText || 'No Address Specified';
}

function getLocationAndAddress() {
	return getLocation() ?
		(getLocation() + ', ' + getAddress())
		: getAddress();
}

// == Description ==

// old way
	/*
	// Description
	var descElm = qs('#event_description').querySelector('span'),
		desc;

	// use innerText for proper formatting, innerText will ship in Firefox 45
	if (!descElm) {
		desc = '[No description specified]';
	} else if (descElm.innerText) {
		// Show full event text so that innerText sees it
		setProp(qs('.text_exposed_show', descElm), 'style.display', 'inline');
		setProp(qs('.text_exposed_link', descElm), 'style.display', 'none');
		desc = descElm.innerText;
	} else {
		// fallback, HTML encoded entities will appear broken
		desc = descElm.innerHTML
	*/
		              //.replace(/<br>\s*/g, '\n') // fix newlines
	/*
		              .replace(/&nbsp;/g, ' ')
		              .replace(/&amp;/g, '&')
		              .replace(/<a href="([^"]*)"[^>]*>/g, '[$1] ') // show link urls
		              .replace(/<[^>]*>/g, '');  // strip html tags
	}
	*/

function getDescription() {
	return location.href +
		'\n\n' +
		qsv('[data-testid="event-permalink-details"]').innerText;
}


// ==== Make Export URL =====
function makeExportUrl() {
	var ev = {
		title       : document.title,
		startDate   : getStartDate(),
		endDate     : getEndDate(),
		locAndAddr  : getLocationAndAddress(),
		description : getDescription()
	};

	for (var prop in ev) if (ev.hasOwnProperty(prop))
		ev[prop] = euc(dbg(ev[prop], ' - ' + prop));

	// gcal format - http://stackoverflow.com/questions/10488831/link-to-add-to-google-calendar

	// Create link, use UTC timezone to be compatible with toISOString()
	var exportUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=[TITLE]&dates=[STARTDATE]/[ENDDATE]&details=[DETAILS]&location=[LOCATION]&ctz=UTC';

	exportUrl = exportUrl
	                     .replace('[TITLE]', ev.title)
	                     .replace('[STARTDATE]', ev.startDate)
	                     .replace('[ENDDATE]', ev.endDate)
	                     .replace('[LOCATION]', ev.locAndAddr)
	                     .replace('[DETAILS]', ev.description);

	return dbg(exportUrl, ' - Export URL');
}


function addExportLink() {
	log('Event Exporter running');

	var
		evBarElm = qsv('#event_button_bar'),
		exportElmLink = qsv('a', evBarElm),
		exportElmParent = exportElmLink.parentNode;

	exportElmLink = exportElmLink.cloneNode();
	exportElmLink.href = makeExportUrl();
	exportElmLink.textContent = 'Export Event';

	// Disable Facebook event listeners (that are attached due to cloning element)
	exportElmLink.removeAttribute('ajaxify');
	exportElmLink.removeAttribute('rel');

	// Open in new tab
	exportElmLink.target = '_blank';

	exportElmParent.appendChild(exportElmLink);

	var evBarLinks = qsav('a', evBarElm);
	Array.from(evBarLinks).forEach(function (a) {
		// fix styles
		a.style.display = 'inline-block';
	});
}


(function (oldPushState) {
	// monkey patch pushState so that script works when navigating around Facebook
	window.history.pushState = function () {
		dbg('running pushState');
		oldPushState.apply(window.history, arguments);
		setTimeout(addExportLinkWhenLoaded, 1000);
	};
	dbg('monkey patched pushState');
})(window.history.pushState);

window.onpopstate = function () {
	dbg('pop state');
	setTimeout(addExportLinkWhenLoaded, 1000);
};

function addExportLinkWhenLoaded() {
	if (location.href.indexOf('/events/') === -1) {
		dbg('not an event page. skipping...');
		return;
	} else if (!qs('#event_button_bar') || !qs('#event_summary')) {
		// not loaded
		dbg('page not loaded...');
		setTimeout(addExportLinkWhenLoaded, 1000);
	} else {
		// loaded
		dbg('page loaded...adding link');
		addExportLink();
	}
}


window.addEventListener('load', addExportLinkWhenLoaded, true);

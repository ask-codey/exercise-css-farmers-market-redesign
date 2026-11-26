// Checks the market page's redesign: it reads index.html and styles.css the way a browser does, then measures
// the text sizes, line heights, line length, fonts, spacing, contrast, card styles and photo filters your stylesheet
// gives it.
// Run it with: npm test (run npm install once first). You don't need to change this file.
const { test } = require('node:test');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const read = (file) => (existsSync(path.join(__dirname, file)) ? readFileSync(path.join(__dirname, file), 'utf8') : '');
const html = read('index.html');
const css = read('styles.css');

// jsdom, which reads the page for the checks, can't expand a shorthand that holds a custom property, such as
// background: var(--brand). So the checks fill in each custom property's value first, which gives the same result.
function fillCustomProperties(text) {
  const values = {};
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) values[m[1]] = m[2].trim();
  let filled = text;
  for (let i = 0; i < 10 && /var\(/.test(filled); i++) {
    filled = filled.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
      (whole, name, fallback) => values[name] ?? (fallback ?? '').trim());
  }
  return filled;
}

const cssWithoutComments = fillCustomProperties(css.replace(/\/\*[\s\S]*?\*\//g, ''));

// A browser loads styles.css through the link line. The checks have no web server, so they add the file to the page
// themselves, after checking that the link line is there.
const { window } = new JSDOM(html);
const { document } = window;
const sheet = document.createElement('style');
sheet.textContent = cssWithoutComments;
document.head.append(sheet);

const style = (element) => window.getComputedStyle(element);
const all = (selector) => [...document.querySelectorAll(selector)];
const one = (selector) => document.querySelector(selector);
const round = (n, places = 2) => Number(n.toFixed(places));

// Fails a check with a plain message, so the output shows what to fix and no stack trace to scroll past.
function check(passed, message) {
  if (!passed) {
    const problem = new Error(message);
    problem.stack = `Not yet: ${message}`;
    throw problem;
  }
}

// The name a message uses for an element: its tag, its class and the start of its text.
function describe(element) {
  const name = element.tagName.toLowerCase() + (element.className ? `.${String(element.className).split(' ').join('.')}` : '');
  if (element === document.body) return 'body';
  const heading = element.querySelector('h1, h2, h3');
  const text = (heading ?? element).textContent.trim().replace(/\s+/g, ' ');
  return text ? `${name} "${text.length > 40 ? `${text.slice(0, 40)}...` : text}"` : name;
}

// Custom properties (var(--name)) are filled in here, so a stylesheet that uses them is measured correctly too.
function fillVars(element, value) {
  let result = String(value);
  for (let i = 0; i < 10 && /var\(/.test(result); i++) {
    result = result.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (whole, name, fallback) => {
      const found = style(element).getPropertyValue(name).trim();
      return found || (fallback ?? '').trim();
    });
  }
  return result;
}

// Turns any color the stylesheet can write (a name, #2f6b3a, rgb(), hsl()) into red, green, blue and alpha.
// Returns null for a color the checks can't read.
function toRgba(element, value) {
  const filled = fillVars(element, value).trim();
  if (filled === 'transparent') return [0, 0, 0, 0];
  const probe = document.createElement('i');
  probe.style.color = filled;
  if (!probe.style.color) return null;
  element.append(probe);
  const color = style(probe).color;
  probe.remove();
  const parts = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!parts) return null;
  let alpha = parts[4] === undefined ? 1 : parseFloat(parts[4]);
  if (String(parts[4]).endsWith('%')) alpha /= 100;
  return [Number(parts[1]), Number(parts[2]), Number(parts[3]), alpha];
}

const hex = ([r, g, b]) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

// Paints a see-through color over a solid one.
const over = ([r, g, b, a], [r2, g2, b2]) => [r * a + r2 * (1 - a), g * a + g2 * (1 - a), b * a + b2 * (1 - a), 1];

// The contrast ratio of two solid colors, as WCAG works it out: from 1 (the same) to 21 (black on white).
function contrast(first, second) {
  const light = ([r, g, b]) => {
    const channel = (c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [lighter, darker] = [light(first), light(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Splits a value at commas or spaces that aren't inside brackets: "0 1px rgb(0 0 0 / 0.1), 0 4px red".
function splitTopLevel(value, separator) {
  const pieces = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth++;
    if (character === ')') depth--;
    const splits = depth === 0 && (separator === ' ' ? /\s/.test(character) : character === separator);
    if (splits) {
      if (current.trim()) pieces.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

// The colors in a gradient, such as linear-gradient(to bottom, #fdeccf, #fbf8f1).
function gradientColors(element, image) {
  const colors = [];
  const inside = fillVars(element, image).match(/gradient\((.*)\)/);
  if (!inside) return colors;
  for (const stop of splitTopLevel(inside[1], ',')) {
    for (const word of splitTopLevel(stop, ' ')) {
      const color = /^(to|at|circle|ellipse|closest|farthest|-?[\d.])/.test(word) ? null : toRgba(element, word);
      if (color) colors.push(color);
    }
  }
  return colors;
}

// The solid colors that can be behind an element: the page starts white, and every box from <html> down to it
// paints its background on top. A gradient gives several colors, and the text must pass on each of them.
function backgroundsBehind(chain) {
  let behind = [[255, 255, 255, 1]];
  for (const element of chain) {
    const image = style(element).backgroundImage || '';
    const color = toRgba(element, style(element).backgroundColor || 'transparent') ?? [0, 0, 0, 0];
    if (color[3] > 0) behind = behind.map((under) => over(color, under));
    if (/gradient\(/.test(image)) {
      const stops = gradientColors(element, image);
      if (stops.length) behind = stops.flatMap((stop) => behind.map((under) => over(stop, under)));
    }
  }
  return behind;
}

function chainOf(element) {
  const chain = [];
  for (let node = element; node; node = node.parentElement) chain.unshift(node);
  return chain;
}

// The worst contrast an element's text has against what's behind it, opacity included.
function worstContrast(element) {
  const chain = chainOf(element);
  const text = toRgba(element, style(element).color);
  if (!text) return { unreadable: true };
  let pairs = backgroundsBehind(chain).map((bg) => ({ text: over(text, bg), bg }));
  for (let i = chain.length - 1; i >= 0; i--) {
    const opacity = parseFloat(style(chain[i]).opacity);
    if (opacity < 1) {
      const outside = backgroundsBehind(chain.slice(0, i))[0];
      pairs = pairs.map(({ text: t, bg }) => ({ text: over([...t.slice(0, 3), opacity], outside), bg: over([...bg.slice(0, 3), opacity], outside) }));
    }
  }
  return pairs
    .map(({ text: t, bg }) => ({ ratio: contrast(t, bg), text: t, bg }))
    .sort((a, b) => a.ratio - b.ratio)[0];
}

// A length in pixels, from the values the checks read back: "16px", "1.25rem", "min(520px, 100%)".
function pixels(element, value) {
  const filled = fillVars(element, value);
  const px = filled.match(/(-?[\d.]+)px/);
  if (px) return parseFloat(px[1]);
  const rem = filled.match(/(-?[\d.]+)rem/);
  if (rem) return parseFloat(rem[1]) * parseFloat(style(document.documentElement).fontSize || '16');
  const em = filled.match(/(-?[\d.]+)em/);
  if (em) return parseFloat(em[1]) * parseFloat(style(element).fontSize);
  const percent = filled.match(/(-?[\d.]+)%/);
  if (percent) return parseFloat(percent[1]) > 0 ? 1 : 0;
  return parseFloat(filled) || 0;
}

const fontSize = (element) => {
  const value = style(element).fontSize;
  if (!/var\(/.test(value)) return parseFloat(value);
  const probe = document.createElement('i');
  probe.style.fontSize = fillVars(element, value);
  element.parentElement.append(probe);
  const size = parseFloat(style(probe).fontSize);
  probe.remove();
  return size;
};

// A line height as a multiple of the font size: "1.5" stays 1.5, and "24px" on 16px text is 1.5.
function lineHeight(element) {
  const value = fillVars(element, style(element).lineHeight);
  if (!value || value === 'normal') return null;
  if (/px$/.test(value)) return parseFloat(value) / fontSize(element);
  if (/rem$/.test(value)) return (parseFloat(value) * 16) / fontSize(element);
  if (/em$/.test(value)) return parseFloat(value);
  if (/%$/.test(value)) return parseFloat(value) / 100;
  return parseFloat(value);
}

// How many pixels one ch is in an element's font, as the browser works it out.
function chWidth(element) {
  const probe = document.createElement('i');
  probe.style.maxWidth = '100ch';
  probe.style.fontSize = `${fontSize(element)}px`;
  element.append(probe);
  const width = parseFloat(style(probe).maxWidth) / 100;
  probe.remove();
  return width;
}

const firstFont = (element) => fillVars(element, style(element).fontFamily).split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();

test('index.html links styles.css', () => {
  check(html, 'There is no index.html in this folder. Check that you opened the exercise folder, the one with package.json in it.');
  const link = one('link[rel="stylesheet"]');
  check(link && link.getAttribute('href') === 'styles.css',
    'index.html no longer links styles.css. Put this line back inside <head>: <link rel="stylesheet" href="styles.css">');
});

test('requirement 1: body text is at least 1rem, and every font size is in rem', () => {
  const pxSizes = [...cssWithoutComments.matchAll(/font-size\s*:\s*([^;}]*px[^;}]*)/g)].map((m) => m[1].trim());
  check(pxSizes.length === 0,
    `styles.css still sets ${pxSizes.length} font size(s) in px (${pxSizes.slice(0, 3).join(', ')}). Write every font-size in rem, so the page follows the reader's own text setting.`);
  for (const element of all('.about p, .vendor .description')) {
    check(fontSize(element) >= 16,
      `${describe(element)} is ${round(fontSize(element))}px. Body text should be at least 1rem (16px).`);
  }
});

test('requirement 1: h3, h2 and h1 each step up by the same ratio', () => {
  const body = fontSize(one('.about p'));
  const h3 = fontSize(one('h3'));
  const h2 = fontSize(one('h2'));
  const h1 = fontSize(one('h1'));
  check(body < h3 && h3 < h2 && h2 < h1,
    `The sizes don't climb yet: body text ${round(body)}px, h3 ${round(h3)}px, h2 ${round(h2)}px, h1 ${round(h1)}px. Each should be bigger than the one before it.`);
  const ratio = h3 / body;
  check(ratio >= 1.1 && ratio <= 1.6,
    `h3 is ${round(ratio)} times the body text. Pick a ratio between about 1.125 and 1.5 (1.25 is a good start), and make h3 one step up: 1rem times the ratio.`);
  check(Math.abs(h2 / h3 - ratio) <= 0.05,
    `h2 is ${round(h2 / h3)} times h3, but h3 is ${round(ratio)} times the body text. Every step uses the same ratio: h2 is h3 times ${round(ratio)}.`);
  const h1Steps = Math.abs(h1 / h2 - ratio) <= 0.05 || Math.abs(h1 / h2 - ratio * ratio) <= 0.08;
  check(h1Steps,
    `h1 is ${round(h1 / h2)} times h2. Make it one or two more steps up the same scale: h2 times ${round(ratio)}, or times ${round(ratio)} again.`);
});

test('requirement 2: body text has a line height of about 1.5, and headings about 1.1 to 1.3', () => {
  for (const element of [document.body, ...all('.about p, .vendor .description')]) {
    const lh = lineHeight(element);
    check(lh !== null && lh >= 1.4 && lh <= 1.8,
      `${describe(element)} has a line height of ${lh === null ? 'normal (not set)' : round(lh)}. Body text reads best at about 1.5: give body a line-height between 1.4 and 1.8, with no unit.`);
  }
  for (const heading of all('h1, h2, h3')) {
    const lh = lineHeight(heading);
    check(lh !== null && lh >= 1 && lh <= 1.35,
      `${describe(heading)} has a line height of ${lh === null ? 'normal (not set)' : round(lh)}. Headings look best at about 1.1 to 1.3.`);
  }
});

test('requirement 3: the About paragraphs are about 45 to 75 characters wide at most', () => {
  for (const paragraph of all('.about p')) {
    let narrowest = null;
    for (const element of chainOf(paragraph).reverse()) {
      const value = style(element).maxWidth;
      // A percentage alone, such as 100%, depends on the window's width, so it doesn't set a line length.
      if (value && value !== 'none' && !/^[\d.]+%$/.test(value.trim())) {
        const chars = pixels(element, value) / chWidth(element);
        if (narrowest === null || chars < narrowest) narrowest = chars;
      }
    }
    check(narrowest !== null,
      'The About paragraphs have no max-width, so on a wide screen a line runs on and on. Give them a max-width in ch, such as 65ch.');
    check(narrowest >= 45 && narrowest <= 75,
      `The About paragraphs are up to about ${Math.round(narrowest)} characters wide. Aim for 45 to 75: a max-width between 45ch and 75ch.`);
  }
});

test('requirement 4: the page uses two fonts at most', () => {
  const fonts = new Set([document.body, ...all('body *')].filter((e) => e.tagName !== 'IMG').map(firstFont));
  check(fonts.size <= 2,
    `The page uses ${fonts.size} fonts: ${[...fonts].join(', ')}. Choose two at most: one for headings and one for body text.`);
});

test('requirement 5: spacing is in rem, with at least 1rem of padding inside each vendor card', () => {
  const pxSpacing = [...cssWithoutComments.matchAll(/(margin|padding|gap)([\w-]*)\s*:\s*([^;}]*)/g)]
    .filter((m) => /\d(\.\d+)?px/.test(m[3]))
    .map((m) => `${m[1]}${m[2]}: ${m[3].trim()}`);
  check(pxSpacing.length === 0,
    `styles.css still sets ${pxSpacing.length} space(s) in px (${pxSpacing.slice(0, 3).join('; ')}). Write margin, padding and gap in rem, so the spacing grows with the text.`);
  for (const card of all('.vendor')) {
    const padding = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((side) => pixels(card, style(card)[side]));
    check(Math.min(...padding) >= 16,
      `${describe(card)} has ${Math.min(...padding)}px of padding on its narrowest side. Give every vendor card at least 1rem of padding on all four sides, with the padding property.`);
  }
});

test('requirement 6: every piece of text has a contrast ratio of 4.5 to 1 (3 to 1 for large text)', () => {
  const textElements = [...document.body.querySelectorAll('*')].filter((element) =>
    [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()));
  const failures = [];
  for (const element of textElements) {
    const result = worstContrast(element);
    if (result.unreadable) {
      failures.push(`${describe(element)}: its color can't be read. Write colors as names, hex codes, rgb() or hsl().`);
      continue;
    }
    const size = fontSize(element);
    const bold = Number(style(element).fontWeight) >= 700 || style(element).fontWeight === 'bold';
    const large = size >= 24 || (bold && size >= 18.66);
    const needed = large ? 3 : 4.5;
    if (result.ratio < needed) {
      failures.push(`${describe(element)}: ${round(result.ratio)} to 1, needs ${needed} to 1 (text ${hex(result.text)} on ${hex(result.bg)})`);
    }
  }
  check(failures.length === 0,
    `${failures.length} piece(s) of text don't have enough contrast yet:\n  ${failures.slice(0, 5).join('\n  ')}${failures.length > 5 ? `\n  ...and ${failures.length - 5} more` : ''}`);
});

test('requirement 7: vendor cards have rounded corners and a soft shadow', () => {
  for (const card of all('.vendor')) {
    const radius = style(card).borderRadius;
    check(radius && pixels(card, splitTopLevel(radius, ' ')[0]) > 0,
      `${describe(card)} has square corners. Round them with border-radius, such as 0.75rem.`);
    const shadow = fillVars(card, style(card).boxShadow || 'none');
    check(shadow !== 'none' && shadow !== '',
      `${describe(card)} has no shadow yet. Add a soft one with box-shadow.`);
    for (const layer of splitTopLevel(shadow, ',')) {
      const words = splitTopLevel(layer, ' ').filter((word) => word !== 'inset');
      const lengths = words.filter((word) => /^-?[\d.]+(px|rem|em)?$/.test(word));
      const colorWord = words.find((word) => !/^-?[\d.]+(px|rem|em)?$/.test(word));
      const blur = lengths[2] ? pixels(card, lengths[2]) : 0;
      check(blur > 0,
        `The shadow "${layer}" has no blur, so it has a hard edge like a cut-out. Its third length is the blur: give it some, such as 12px.`);
      const color = colorWord ? toRgba(card, colorWord) : [0, 0, 0, 1];
      check(color && color[3] <= 0.35,
        `The shadow "${layer}" is ${color ? `${Math.round(color[3] * 100)}%` : 'an unreadable color,'} solid. A soft shadow is see-through: use a color such as rgb(0 0 0 / 0.1).`);
    }
  }
});

test('requirement 8: the bag notice has a background of its own', () => {
  const notice = one('.notice');
  const own = toRgba(notice, style(notice).backgroundColor) ?? [0, 0, 0, 0];
  const hasGradient = /gradient\(/.test(style(notice).backgroundImage || '');
  check(own[3] > 0 || hasGradient,
    'The bag notice has no background of its own yet, so it blends into the page. Give .notice a background-color from your palette, and some padding.');
  const page = backgroundsBehind(chainOf(notice.parentElement))[0];
  const mine = backgroundsBehind(chainOf(notice))[0];
  check(hasGradient || hex(page) !== hex(mine),
    `The bag notice's background (${hex(mine)}) is the same as the page's. Pick a different color from your palette, such as the market's sunflower.`);
});

// The amount in a filter function, such as saturate(120%) or saturate(1.2), as a number: 1.2. Null when it isn't there.
function filterAmount(filter, name) {
  for (const match of String(filter).matchAll(/([a-z-]+)\(\s*([\d.]+)(%?)\s*\)/g)) {
    if (match[1] === name) return parseFloat(match[2]) / (match[3] === '%' ? 100 : 1);
  }
  return null;
}

const photo = one('.vendor-photo');
const photoFilter = () => fillVars(photo, style(photo).filter || 'none');

test('requirement 9: Green Thumb Farm\'s photo has its colors about 20% stronger, with filter', () => {
  check(photo, 'index.html has changed: Green Thumb Farm\'s card should open with its photo, <img class="vendor-photo">. Download a fresh copy of index.html if you need to.');
  const amount = filterAmount(photoFilter(), 'saturate');
  check(amount !== null,
    `Green Thumb Farm's photo (.vendor-photo) has filter: ${photoFilter()}. Its colors should be stronger: give it a filter with saturate(), such as saturate(120%).`);
  check(amount >= 1.1 && amount <= 1.3,
    `The photo's saturate() is ${Math.round(amount * 100)}%. 100% leaves the colors as they are; about 20% stronger is saturate(120%).`);
});

test('requirement 9: a sold-out vendor\'s photo is drawn in grays, and its card keeps its color', () => {
  const card = photo.closest('.vendor');
  card.classList.add('sold-out');
  try {
    const filter = photoFilter();
    const grays = filterAmount(filter, 'grayscale');
    const saturation = filterAmount(filter, 'saturate');
    check((grays !== null && grays >= 1) || saturation === 0,
      `With the class sold-out on its card, Green Thumb Farm's photo has filter: ${filter}. Write a rule for .sold-out .vendor-photo that draws the photo in grays: filter: grayscale(100%).`);
    const cardFilter = fillVars(card, style(card).filter || 'none');
    check(cardFilter === 'none' || cardFilter === '',
      `A sold-out card has filter: ${cardFilter}, which changes its words and its red label too. Put the filter on the photo (.sold-out .vendor-photo), not on the card.`);
  } finally {
    card.classList.remove('sold-out');
  }
});

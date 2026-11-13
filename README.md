# Exercise: Redesign the Farmers Market Page

Exercise code for the lesson **Exercise: Redesign the Farmers Market Page** in the CSS in Depth course on [ask-codey.com](https://www.ask-codey.com).

The Saturday Farmers Market's event page has everything on it (the vendors, a map, the schedule and a "Bring your own bag" notice), and it looks like a flyer stapled to a telephone pole. You'll redesign it in `styles.css`: a type scale, readable lines, a palette with enough contrast, room to breathe, and soft finishing touches on the vendor cards. Ten checks measure the page as you go, and a checklist covers what only your eyes can judge.

## Before you start

You need VS Code with the Live Server extension, a current Chrome, Edge or Firefox, and Node.js 24 or newer. The chapter *Design Basics for Developers* teaches everything this exercise uses.

## What's here

- `index.html`: the market's page. Every part you'll style has a class: `.label`, `.when`, `.notice`, `.vendor`, `.tag`, `.status`, `.description`, `.booth`, `.sold-out`, `.map`, `.schedule` and `.about`. Ready to use: don't change it. The `.schedule` section holds a table; *Tables for Data: Rows, Columns and Styling Them* (Module 3) shows how to style one.
- `images/map.svg`: the map of the parking lot. Ready to use.
- `styles.css`: the cluttered stylesheet the page has today, with the market's requests and brand colors in a comment at the top. For you to redesign: change, replace or delete any rule in it.
- `page.test.js`: the ten checks. You don't need to change this file.
- `package.json`: tells npm what the checks need (`jsdom`, which reads your page and stylesheet the way a browser does). Ready to use.
- `.gitignore`: keeps the `node_modules` folder that `npm install` makes out of Git. Ready to use.

## What to do

1. **Open this folder in VS Code** (**File > Open Folder**, the folder with `package.json` directly inside it), and open `index.html` with Live Server. Put VS Code and the browser side by side.
2. **Take a "before" screenshot** of the whole page, with the developer tools' **Capture full size screenshot** (Ctrl+Shift+P, then type `screenshot`; in Firefox, right-click the page and choose **Take Screenshot**). You'll want it at the end.
3. **Squint at the page** and write down the first three things you see. Then redesign `styles.css`, one requirement at a time:
   1. **A type scale in rem.** Body text at `1rem` or more. Pick one ratio (1.25 is a good start) and make `h3` one step up from the body text, `h2` one step up from `h3`, and `h1` one or two steps up from `h2`. Every `font-size` in rem.
   2. **Line height.** About 1.5 for body text, and 1.1 to 1.3 for `h1`, `h2` and `h3`, written with no unit.
   3. **Line length.** The paragraphs in `.about` no wider than about 65 characters: a `max-width` in `ch`.
   4. **Two fonts at most.** One for headings and one for everything else (one font in two weights is fine too).
   5. **Spacing in rem.** Every `margin`, `padding` and `gap` in rem (or `0` or `auto`), with at least `1rem` of padding on every side of each vendor card. Keep headings closer to their own section than to the one before.
   6. **A palette that passes contrast.** Every piece of text at a contrast ratio of at least 4.5 to 1 against what's behind it, or 3 to 1 for large text (24 pixels and up, or about 19 pixels and up in bold). Build your palette around the market's green and sunflower.
   7. **Finishing touches.** Vendor cards with rounded corners (`border-radius`) and a soft `box-shadow`: blurred, in a see-through color. Two layers look best.
   8. **The bag notice stands out,** on a background color of its own.
4. **Squint again** and compare with your list from step 3. Then take an "after" screenshot.

## Check your work

Open the terminal in VS Code (**Terminal > New Terminal**). Install what the checks need, once:

```bash
npm install
```

Then run the checks, as often as you like:

```bash
npm test
```

Each check prints ✔ when it passes and ✖ when it doesn't yet. At first the link check passes (the starter already has the link line) and the other nine fail: that's expected, since the page hasn't been redesigned yet. Under **failing tests**, each one has a message that starts **Not yet:** and says what it measured. The contrast check lists the text that doesn't pass yet, with its ratio and its two colors, such as `p.booth "Booth 4": 1.61 to 1, needs 4.5 to 1 (text #cccccc on #ffffff)`. When the last lines say `pass 10` and `fail 0`, every requirement the checks can measure is met.

## The rules

- Write everything in `styles.css`, and leave `index.html` as it is.
- Write colors as names, hex codes, `rgb()` or `hsl()`, so the checks can read them.
- Write spacing with `margin`, `padding` and `gap`. The checks don't read the newer `margin-block` or `padding-inline` properties.
- The contrast check measures text against every color behind it: on a gradient, the text must pass on each of the gradient's colors, and `opacity` counts too, because a faded card fades its text.
- The checklist the checks can't do. Look at the page in the browser and check each one:
  - Squinting, you see the market's name first, then when and where, then the bag notice.
  - Everything in the main column lines up on one left edge.
  - The vendor cards have room inside them and a gap between them.
  - The sold-out vendor is clear without color: the words "Sold out for today" can be read.
  - Your before and after screenshots, side by side, look like two different sites.

## Tips

- Work out your scale first, on paper: with a ratio of 1.25, the steps are 1rem, 1.25rem, 1.563rem, 1.953rem and 2.441rem.
- The developer tools' color picker shows any text's contrast ratio: right-click the text, choose **Inspect**, and click the color square beside its `color` in the **Styles** pane.
- A dark text color on a light background, or the other way around, fixes most contrast problems. Light gray text and white text on a bright color are the usual culprits.
- Start the shadow from `0 4px 12px rgb(0 0 0 / 0.1)`, then add a second, tighter layer after a comma.
- Changed something and the page didn't? `npm test` and the browser both read the saved file: look for a white dot on the file's tab in VS Code, which means it has changes you haven't saved yet.

## Hand it in

When it works, put your solution in a public repo of your own on GitHub, then paste that repo's address into **Submit your exercise** on the lesson page at [ask-codey.com](https://www.ask-codey.com). That's what completes the lesson. You don't need Git: create the repo on GitHub, choose **Add file**, then **Upload files**, and upload everything in this folder except `node_modules` (it's the files `npm install` downloaded, far too many for GitHub's upload, and `npm install` makes it again). The lesson page shows each step, and the lesson *Put Your Page Online for Free* walks through every screen.

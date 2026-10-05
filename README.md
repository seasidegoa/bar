# Sea Side Goa Bar

Bar menu (QR code target). Data comes from the published Google Sheet (URLs at the top of `bar.js`).

- Dry day: tick the checkbox on the "Dry Day" tab. Every section with `x` in the `alcohol` column of the "Sections" tab disappears, and "Alcohol is not served today" shows above the soft drinks.
- Preview locally: `python3 -m http.server` → <http://localhost:8000/> (opening `index.html` as a file doesn't work).
- Test the CSV parser: `node test.mjs`

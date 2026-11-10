/* The catalogue, transcribed from the Green Sun Technologies product catalogue.
   Every card on the Products page and the home page is built from this list. */
(function () {
  const IMG = 'assets/img/products/';
  // Product pictures keep their names, and /assets/img is cached for a week (browsers and Cloudflare's edge). deploy.sh
  // stamps this ?v= with the deploy time, so a replaced picture shows after the next deploy without purging any cache.
  const V = window.GS_IMGV = '?v=1';

  // shared by every semi-integrated street light in the catalogue
  const SI_COMMON = [
    ['LED make', 'OSRAM'],
    ['LED efficacy', '155 lm/W'],
    ['LED life', '50,000 hrs'],
    ['Colour temperature', '5500–6500 K'],
    ['Colour rendering', 'CRI > 70'],
    ['Power factor', '> 0.9'],
    ['Driver', 'Integrated'],
    ['Ingress protection', 'IP66'],
    ['Housing', 'Aluminium, heat-, corrosion- & UV-resistant'],
    ['Operation', 'Dusk to dawn, automatic ON/OFF'],
    ['Dimming', '6 h at 100% + 6 h at 50%'],
    ['Autonomy', '2 days'],
    ['Operating temperature', '−20 °C to 50 °C']
  ];

  function streetLight(watt, volts, ah, panel, optic, img, extra) {
    extra = extra || {};
    return Object.assign({
      id: 'si-' + watt + 'w',
      cat: 'street',
      name: watt + 'W Semi-Integrated Solar Street Light',
      short: watt + 'W Semi-Integrated',
      part: watt + 'W-SI-SOL',
      watt: watt,
      img: IMG + img,
      battery: volts + ' V · ' + ah + ' Ah',
      chem: 'LiFePO₄',
      panel: panel + ' Wp',
      optic: optic,
      ip: 'IP66',
      autonomy: '2 days',
      tags: ['IP66', 'LiFePO₄', optic + ' optic'],
      specs: [
        ['Power', watt + ' W'],
        ['Battery', volts + ' V, ' + ah + ' Ah ' + (extra.chem || 'LiFePO₄')],
        ['Solar panel', 'Polycrystalline ' + panel + ' Wp, 12 V'],
        ['Optic', optic]
      ].concat(SI_COMMON)
    }, extra);
  }

  window.GS_CATEGORIES = [
    { id: 'street', short: 'Street', name: 'Solar Street Lights', blurb: '9 W lanes to 80 W highways. OSRAM LEDs, LiFePO₄ packs, IP66.', img: IMG + 'si-50w.webp' },
    { id: 'mast', short: 'Mast & flood', name: 'High Masts & Floods', blurb: '20 m and 30 m high masts, solar floods for yards and grounds, and LED high bays for sheds.', img: IMG + 'flood-60w.webp' },
    { id: 'traffic', short: 'Traffic', name: 'Traffic & Road Safety', blurb: 'Solar blinkers, push-button pedestrian crossings and aviation obstruction lights.', img: IMG + 'blinker-20w.webp' },
    { id: 'storage', short: 'Energy', name: 'Batteries & Solar Panels', blurb: 'LiFePO₄ packs rated for 5,000 cycles, monocrystalline panels and mounting structures.', img: IMG + 'battery-100ah.webp' },
    { id: 'poles', short: 'Poles', name: 'Poles & Decorative', blurb: 'GI street-light poles, heritage poles and solar lawn lights for parks and campuses.', img: IMG + 'deco-pole.webp' }
  ];

  window.GS_PRODUCTS = [
    streetLight(9, '12.8', 6, 40, 'Lens', 'si-9w.webp', { featured: true }),
    streetLight(15, '12.8', 12, 75, 'Glass', 'si-15w.webp'),
    streetLight(20, '12.8', 15, 80, 'Glass', 'si-20w.webp', { chem: 'Lithium-ion', tags: ['IP66', 'Li-ion', 'Glass optic'] }),
    streetLight(25, '12.8', 18, 80, 'Glass', 'si-25w.webp'),
    streetLight(30, '12.8', 24, 100, 'Glass', 'si-30w.webp', { featured: true }),
    streetLight(40, '12.8', 30, 100, 'Glass', 'si-30w.webp'),
    streetLight(50, '12.8', 36, 125, 'Glass', 'si-45w.webp'),
    streetLight(60, '12.8', 42, 125, 'Glass', 'si-50w.webp', { featured: true }),
    streetLight(80, '12.8', 48, 165, 'Lens', 'si-50w.webp'),
    {
      id: 'si-40w-rms', cat: 'street', featured: true,
      name: '40W Semi-Integrated Solar Street Light with RMS',
      short: '40W with Remote Monitoring',
      part: '40W-SI-SOL · RMS', watt: 40, img: IMG + 'si-50w.webp',
      battery: '12.8 V · 42 Ah', chem: 'LiFePO₄', panel: '125 Wp', optic: 'Glass', ip: 'IP66', autonomy: '2 days',
      tags: ['RMS', 'GSM', 'MPPT'],
      badge: 'Smart',
      specs: [
        ['Power', '40 W'],
        ['Battery', '12.8 V, 42 Ah LiFePO₄'],
        ['Solar panel', 'Polycrystalline 125 Wp, 12 V'],
        ['LED make', 'OSRAM'],
        ['LED life', '50,000 hrs'],
        ['Colour temperature', '5500–6500 K'],
        ['Driver efficiency', '> 90%'],
        ['MPPT efficiency', '> 90%'],
        ['No-load current', '< 30 mA'],
        ['GSM interface', 'Available'],
        ['Remote monitoring', 'Solar V & A · Battery V & A · Load V & A'],
        ['Operating temperature', '0 °C to 85 °C']
      ]
    },
    {
      id: 'dc-20w', cat: 'street',
      name: '20W DC Solar Street Light', short: '20W DC Street Light',
      part: '20W-DSL-SOL', watt: 20, img: IMG + 'dc-20w.webp',
      battery: '12.8 V', chem: 'LiFePO₄ / Lead-acid', panel: '100 Wp', optic: 'Glass', ip: 'IP66', autonomy: '2 days',
      tags: ['IP66', 'DC', 'Glass optic'],
      specs: [
        ['Power', '20 W'],
        ['Battery', '12.8 V, LiFePO₄ or lead-acid'],
        ['Solar panel', 'Polycrystalline 100 Wp, 12 V'],
        ['Optic', 'Glass']
      ].concat(SI_COMMON)
    },
    {
      id: 'aio-20w', cat: 'street', featured: true,
      name: '20W All-in-One Solar Street Light', short: '20W All-in-One',
      part: '20W-ASL-SOL', watt: 20, img: IMG + 'aio-20w.webp',
      battery: '12.8 V · 12 Ah', chem: 'Inbuilt LiFePO₄', panel: '50 Wp', optic: 'Lens', ip: 'IP66', autonomy: '2 days',
      tags: ['All-in-one', 'IP66', 'LiFePO₄'],
      badge: 'All-in-one',
      specs: [
        ['Power', '20 W'],
        ['Battery', '12.8 V, 12 Ah inbuilt LiFePO₄'],
        ['Solar panel', 'Polycrystalline 50 Wp, 12 V'],
        ['Optic', 'Lens']
      ].concat(SI_COMMON)
    },
    {
      id: 'aio-9w', cat: 'street',
      name: '9W All-in-One Solar Street Light', short: '9W All-in-One',
      part: 'All-in-one · 15 V', watt: 9, img: IMG + 'aio-9w.webp',
      key: [['Power', '9 W'], ['Light', 'Warm white'], ['Body', 'Polycarbonate']],
      battery: 'Inbuilt', chem: '', panel: 'Inbuilt', optic: 'Warm white', ip: '', autonomy: '',
      tags: ['All-in-one', 'Warm white', 'Pathways'],
      badge: 'All-in-one',
      specs: [
        ['Power', '9 W'],
        ['Type', 'All-in-one: panel, battery and LED in one unit'],
        ['System voltage', '15 V'],
        ['Light colour', 'Warm white'],
        ['Body', 'Polycarbonate'],
        ['Use', 'Pathways, gardens, homes and campuses']
      ]
    },
    {
      id: 'aio-hybrid', cat: 'street',
      name: 'Hybrid All-in-One Solar Street Light', short: 'Hybrid All-in-One',
      part: 'HYB-AIO-SOL', watt: null, img: IMG + 'aio-hybrid.webp',
      big: 'HYB', key: [['Battery', '12.8 V · 42 Ah'], ['Panel', '100 Wp mono'], ['Backup', '1 day']],
      battery: '12.8 V · 42 Ah', chem: 'LiFePO₄', panel: '100 Wp', optic: 'Lens', ip: 'IP66', autonomy: '1 day',
      tags: ['All-in-one', 'Hybrid', 'Motion sensor'],
      badge: 'Hybrid',
      specs: [
        ['Battery', '12.8 V, 42 Ah LiFePO₄'],
        ['Solar panel', 'Monocrystalline 100 Wp, 12 V'],
        ['Panel size', '1327 × 415 × 30 mm'],
        ['Charge controller', 'Hybrid MPPT'],
        ['LED make', 'OSRAM'],
        ['LED efficacy', '140 lm/W'],
        ['LED life', '50,000 hrs'],
        ['Colour temperature', '5500–6500 K'],
        ['Colour rendering', 'CRI > 70'],
        ['Power factor', '> 0.9'],
        ['Driver', 'Integrated'],
        ['Optic', 'Lens'],
        ['Housing', 'Mild steel, powder-coated; heat-, corrosion- & UV-resistant'],
        ['Ingress protection', 'IP66'],
        ['Motion sensor', 'Yes'],
        ['Operation', 'Hybrid; dusk to dawn, automatic ON/OFF and dimming'],
        ['Autonomy', '1 day'],
        ['Operating temperature', '−20 °C to 50 °C']
      ]
    },
    {
      id: 'mast-20m-100w', cat: 'mast',
      name: '20 m LED High Mast, 4 × 100 W', short: '20 m High Mast · 4 × 100 W',
      part: 'Multi-arm · 4 heads', watt: null, img: IMG + 'mast-20m-100w.webp',
      big: '20m', key: [['Height', '20 m'], ['Lights', '4 × 100 W'], ['Colour', 'Pure white']],
      battery: '—', chem: '', panel: '—', optic: 'Pure white', ip: '', autonomy: '',
      tags: ['20 m', 'Multi-arm', 'Highways'],
      specs: [
        ['Mast height', '20 m'],
        ['Arms', 'Multi-arm'],
        ['Luminaires', '4 × 100 W LED'],
        ['Light colour', 'Pure white'],
        ['Use', 'Highways, intersections, stadiums and large open areas']
      ]
    },
    {
      id: 'mast-30m-150w', cat: 'mast',
      name: '30 m LED High Mast, 6 × 150 W', short: '30 m High Mast · 6 × 150 W',
      part: 'Multi-arm · 6 heads', watt: null, img: IMG + 'mast-30m-150w.webp',
      big: '30m', key: [['Height', '30 m'], ['Lights', '6 × 150 W'], ['Colour', 'Pure white']],
      battery: '—', chem: '', panel: '—', optic: 'Pure white', ip: '', autonomy: '',
      tags: ['30 m', 'Multi-arm', 'Highways'],
      specs: [
        ['Mast height', '30 m'],
        ['Arms', 'Multi-arm'],
        ['Luminaires', '6 × 150 W LED'],
        ['Light colour', 'Pure white'],
        ['Use', 'Highways and wide open spaces']
      ]
    },
    {
      id: 'mast-20m-200w', cat: 'mast',
      name: '20 m LED High Mast, 6 × 200 W', short: '20 m High Mast · 6 × 200 W',
      part: 'Multi-arm · 6 heads', watt: null, img: IMG + 'mast-20m-200w.webp',
      big: '20m', key: [['Height', '20 m'], ['Lights', '6 × 200 W'], ['Colour', 'Cool white']],
      battery: '—', chem: '', panel: '—', optic: 'Cool white', ip: '', autonomy: '',
      tags: ['20 m', 'Multi-arm', 'Highways'],
      specs: [
        ['Mast height', '20 m'],
        ['Arms', 'Multi-arm'],
        ['Luminaires', '6 × 200 W LED'],
        ['Light colour', 'Cool white'],
        ['Use', 'Highways, flyovers, parking lots and industrial zones']
      ]
    },
    {
      id: 'flood-60w', cat: 'mast',
      name: '60W Semi-Integrated Solar Flood Light', short: '60W Solar Flood Light',
      part: '60W-FI-SOL', watt: 60, img: IMG + 'flood-60w.webp',
      battery: '12.8 V · 42 Ah', chem: 'LiFePO₄', panel: '125 Wp', optic: 'Lens', ip: 'IP66', autonomy: '2 days',
      tags: ['Flood', 'IP66', 'LiFePO₄'],
      specs: [
        ['Power', '60 W'],
        ['Battery', '12.8 V, 42 Ah LiFePO₄'],
        ['Solar panel', 'Polycrystalline 125 Wp, 12 V'],
        ['Optic', 'Lens']
      ].concat(SI_COMMON)
    },
    {
      id: 'blinker-20w', cat: 'traffic', featured: true,
      name: '20W Solar Traffic Blinker', short: '20W Traffic Blinker',
      part: '20W-STB-SOL', watt: 20, img: IMG + 'blinker-20w.webp',
      key: [['Battery', '12.8 V · 6 Ah'], ['Panel', '40 Wp'], ['Size', 'Ø 300 mm']],
      battery: '12.8 V · 6 Ah', chem: 'Inbuilt LiFePO₄', panel: '40 Wp', optic: 'Polycarbonate', ip: 'IP66', autonomy: '1 day',
      tags: ['300 mm', 'SMD LEDs', 'IP66'],
      specs: [
        ['Power', '20 W'],
        ['Battery', '12.8 V, 6 Ah inbuilt LiFePO₄'],
        ['Solar panel', 'Polycrystalline 40 Wp, 12 V'],
        ['Diameter', '300 mm'],
        ['LED', 'OSRAM SMD, 155 lm/W'],
        ['LED life', '50,000 hrs'],
        ['Optic', 'Transparent polycarbonate'],
        ['Housing', 'Polycarbonate'],
        ['Ingress protection', 'IP66'],
        ['Power factor', '> 0.9'],
        ['Autonomy', '1 day'],
        ['Operating temperature', '−20 °C to 50 °C']
      ]
    },
    {
      id: 'ped-crossing', cat: 'traffic',
      name: 'Pedestrian Push-Button Road Crossing System', short: 'Push-Button Crossing',
      part: 'Control unit + 2 terminals', watt: null, img: IMG + 'ped-button.webp',
      big: 'WALK', key: [['Units', '1 + 2 buttons'], ['Signals', 'Walk / Wait'], ['Mode', 'Solo or synced']],
      gallery: [IMG + 'ped-signals.webp', IMG + 'ped-site.webp'],
      battery: '—', chem: '', panel: '—', optic: 'WALK / WAIT', ip: '', autonomy: '',
      tags: ['Road safety', 'Schools', 'Junctions'],
      badge: 'Safety',
      specs: [
        ['System', 'One control unit + two push-button terminals'],
        ['Signals', 'Animated WALK and STOP/WAIT figures'],
        ['Vehicle phase', 'Stays green until a pedestrian presses, after a minimum vehicle time'],
        ['Pedestrian time', 'Set to suit the site'],
        ['Modes', 'Standalone or synchronised with a nearby junction'],
        ['Power failure', 'Settings and signal plan restored on restart']
      ]
    },
    {
      id: 'battery-100ah', cat: 'storage', featured: true,
      name: 'Lithium Battery Pack 12.8 V 100 Ah', short: 'LiFePO₄ Pack 100 Ah',
      part: 'ILFP 12100', watt: null, img: IMG + 'battery-100ah.webp',
      big: '100Ah', key: [['Energy', '1280 Wh'], ['Cycles', '5,000'], ['Weight', '10.6 kg']],
      battery: '12.8 V · 100 Ah', chem: 'LiFePO₄', panel: '1280 Wh', optic: '', ip: 'IP54', autonomy: '',
      tags: ['5,000 cycles', '1280 Wh', 'IP54'],
      specs: [
        ['Nominal voltage', '12.8 V'],
        ['Capacity', '100 Ah · 1280 Wh'],
        ['Charging voltage', '14.6 V'],
        ['Discharge cut-off', '10 V'],
        ['Max. discharge current', '100 A'],
        ['Peak current', '200 A (3 s)'],
        ['Cycle life', '5,000 cycles at 80% DoD'],
        ['Protection class', 'IP54'],
        ['Operating temperature', '−5 °C to 65 °C'],
        ['Dimensions', '330 × 175 × 215 mm'],
        ['Weight', '≈ 10.6 kg'],
        ['Safety tested', 'Short circuit, over-charge, over-discharge']
      ]
    },
    {
      id: 'panel-400w', cat: 'storage',
      name: '400 Wp Monocrystalline Solar Panel', short: '400 Wp Mono Panel',
      part: 'Monocrystalline · 24 V', watt: null, img: IMG + 'panel-400w.webp',
      big: '400W', key: [['Power', '400 Wp'], ['Cells', 'Monocrystalline'], ['System', '24 V']],
      battery: '—', chem: '', panel: '400 Wp', optic: '', ip: '', autonomy: '',
      tags: ['Monocrystalline', '24 V', 'Rooftop'],
      specs: [
        ['Rated power', '400 Wp'],
        ['Cell type', 'Monocrystalline'],
        ['Operating voltage', '24 V'],
        ['Use', 'Residential, commercial and industrial solar systems']
      ]
    },
    {
      id: 'deco-pole-heritage', cat: 'poles',
      name: '5 m Heritage Decorative Pole, Double Arm', short: '5 m Heritage Pole',
      part: 'Mild steel · black', watt: null, img: IMG + 'deco-pole-heritage.webp',
      big: '5m', key: [['Height', '5 m'], ['Arms', 'Double'], ['Finish', 'Black']],
      battery: '—', chem: '', panel: '—', optic: '', ip: '', autonomy: '',
      tags: ['Heritage', 'Double arm', 'Parks'],
      specs: [
        ['Pole height', '5 m'],
        ['Style', 'Heritage'],
        ['Arms', 'Double'],
        ['Material', 'Mild steel, mild-steel base'],
        ['Finish', 'Powder-coated, black'],
        ['Use', 'Landscapes, gardens, parks, pathways, campuses and resorts']
      ]
    },
    {
      id: 'dc-12w', cat: 'street',   // from the IndiaMART shop, 2026-11
      name: "12W DC Solar Street Light",
      short: "12W DC Street Light",
      part: "DC · 12 V",
      watt: 12,
      big: "12W",
      key: [["Power", "12 W"], ["System", "12 V DC"], ["Light", "Warm"]],
      battery: "12 V",
      chem: "",
      panel: "",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["DC", "12 V", "Warm light"],
      specs: [
        ["Power", "12 W"],
        ["System voltage", "12 V DC"],
        ["Light colour", "Warm light"],
        ["Body", "Polycarbonate"],
        ["Use", "Streets, gardens, pathways; residential and commercial"]
      ],
      img: IMG + 'dc-12w.webp'
    },
    {
      id: 'pole-gi-tubular-9m', cat: 'poles',   // from the IndiaMART shop, 2026-11
      name: "9 m GI Tubular Pole",
      short: "9 m GI Tubular Pole",
      part: "Round · galvanised",
      watt: null,
      big: "9m",
      key: [["Height", "9 m"], ["Section", "Round"], ["Material", "GI"]],
      battery: "—",
      chem: "",
      panel: "",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["GI", "Round", "Street lights"],
      specs: [
        ["Height", "9 m"],
        ["Section", "Round tubular"],
        ["Material", "Galvanised iron (GI)"],
        ["Finish", "Galvanised, silver"],
        ["Use", "Street lights mounted high for wide coverage"]
      ],
      img: IMG + 'pole-gi-tubular-9m.webp'
    },
    {
      id: 'pole-gi-octagonal-9m', cat: 'poles',   // from the IndiaMART shop, 2026-11
      name: "9 m GI Octagonal Pole, Single Arm",
      short: "9 m GI Octagonal Pole",
      part: "Single arm · galvanised",
      watt: null,
      big: "9m",
      key: [["Height", "9 m"], ["Arm", "Single"], ["Material", "GI"]],
      battery: "—",
      chem: "",
      panel: "",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["GI", "Octagonal", "Street lights"],
      specs: [
        ["Height", "9 m"],
        ["Section", "Octagonal"],
        ["Arm", "Single-arm bracket"],
        ["Material", "Galvanised iron (GI)"],
        ["Finish", "Polished galvanised"],
        ["Use", "Street and public-area lighting"]
      ],
      img: IMG + 'pole-gi-octagonal-9m.webp'
    },
    {
      id: 'aviation-20w', cat: 'traffic',   // from the IndiaMART shop, 2026-11
      name: "20W Solar LED Aviation Obstruction Light",
      short: "20W Aviation Light",
      part: "Red LED · 12 V solar",
      watt: 20,
      big: "20W",
      key: [["Power", "20 W"], ["Light", "Red LED"], ["System", "12 V solar"]],
      battery: "12 V",
      chem: "",
      panel: "Solar",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Aviation", "Red LED", "Solar"],
      specs: [
        ["Power", "20 W"],
        ["Light colour", "Red"],
        ["Housing", "ABS, impact resistant"],
        ["System voltage", "12 V, solar powered"],
        ["Use", "Marking towers and tall structures for aircraft"]
      ],
      img: IMG + 'aviation-20w.webp'
    },
    {
      id: 'aviation-6w', cat: 'traffic',   // from the IndiaMART shop, 2026-11
      name: "6W Solar LED Aviation Obstruction Light",
      short: "6W Aviation Light",
      part: "Twin red · 12 V solar",
      watt: 6,
      big: "6W",
      key: [["Power", "6 W"], ["Heads", "Twin red"], ["System", "12 V solar"]],
      battery: "12 V",
      chem: "",
      panel: "Solar",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Aviation", "Red LED", "Twin head"],
      specs: [
        ["Power", "6 W"],
        ["Light colour", "Red"],
        ["Heads", "Twin"],
        ["Housing", "ABS"],
        ["System voltage", "12 V, solar powered"],
        ["Use", "Marking low and mid-height structures"]
      ],
      img: IMG + 'aviation-6w.webp'
    },
    {
      id: 'panel-300w', cat: 'storage',   // from the IndiaMART shop, 2026-11
      name: "300 Wp Monocrystalline Solar Panel",
      short: "300 Wp Mono Panel",
      part: "Monocrystalline",
      watt: null,
      big: "300W",
      key: [["Power", "300 Wp"], ["Cells", "Monocrystalline"], ["Shape", "Rectangular"]],
      battery: "—",
      chem: "",
      panel: "300 Wp",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Monocrystalline", "Rooftop"],
      specs: [
        ["Rated power", "300 Wp"],
        ["Cell type", "Monocrystalline"],
        ["Shape", "Rectangular"],
        ["Use", "Residential and commercial solar systems"]
      ],
      img: IMG + 'panel-300w.webp'
    },
    {
      id: 'highbay-20w', cat: 'mast',   // from the IndiaMART shop, 2026-11
      name: "20W LED High Bay Light",
      short: "20W High Bay",
      part: "LED · 220 V AC",
      watt: 20,
      big: "20W",
      key: [["Power", "20 W"], ["Supply", "220 V AC"], ["Light", "Warm"]],
      battery: "—",
      chem: "",
      panel: "",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Warehouses", "LED", "220 V"],
      specs: [
        ["Power", "20 W"],
        ["Supply", "220 V AC"],
        ["Light colour", "Warm light"],
        ["Body", "Polycarbonate"],
        ["Use", "Warehouses, factories and halls"]
      ],
      img: IMG + 'highbay-20w.webp'
    },
    {
      id: 'lawn-5w', cat: 'poles',   // from the IndiaMART shop, 2026-11
      name: "5W LED Solar Lawn Light",
      short: "5W Solar Lawn Light",
      part: "Aluminium · solar",
      watt: 5,
      big: "5W",
      key: [["Power", "5 W"], ["Light", "Pure white"], ["Body", "Aluminium"]],
      battery: "",
      chem: "",
      panel: "Solar",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Gardens", "Solar", "Aluminium"],
      specs: [
        ["Power", "5 W"],
        ["Light colour", "Pure white"],
        ["Body", "Aluminium, weather resistant"],
        ["Power source", "Solar"],
        ["Use", "Gardens, lawns and campus walkways"]
      ],
      img: IMG + 'lawn-5w.webp'
    },
    {
      id: 'mount-structure', cat: 'storage',   // from the IndiaMART shop, 2026-11
      name: "Solar Panel Mounting Structure",
      short: "Panel Mounting Structure",
      part: "Aluminium · modular",
      watt: null,
      big: "RACK",
      key: [["Material", "Aluminium"], ["Design", "Modular"], ["Load", "150 kg"]],
      battery: "—",
      chem: "",
      panel: "",
      optic: "",
      ip: "",
      autonomy: "",
      tags: ["Aluminium", "Modular", "Roof or ground"],
      specs: [
        ["Material", "Aluminium"],
        ["Design", "Modular"],
        ["Section", "50 mm"],
        ["Finish", "Polished"],
        ["Load capacity", "150 kg"],
        ["Use", "Rooftop or ground-mounted panels"]
      ],
      img: IMG + 'mount-structure.webp'
    }
  ];

  // sort order inside each category on the Products page
  window.GS_PRODUCTS.forEach(function (p, i) { p.order = i; p.img += V; });
  window.GS_CATEGORIES.forEach(function (c) { c.img += V; });
})();

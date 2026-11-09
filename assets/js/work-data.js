/* Projects and the factory: the content of the Projects and Visit the factory pages. Edit here.
   Every entry marked sample: true is a stand-in that shows a "Sample" tag on the page. Replace them with real ones
   (photos go in assets/img/work/, as .webp or .jpg) and delete the sample line. */

// A project: where it is (lat/lng from Google Maps: right-click the spot → the numbers at the top), what went up, photos.
window.GS_PROJECTS = window.GS_PROJECTS || [   // the console's projects (live.js) take the place of these examples

  {
    id: 'sample-mast-market', sample: true,
    title: 'High mast for a market square', type: 'High mast', year: 2025,
    place: 'Guwahati', district: 'Kamrup Metropolitan', state: 'Assam', lat: 26.14, lng: 91.74,
    lights: 4, products: ['mast-20m-100w'],
    photos: ['assets/img/work/site-mast-20m-100w.webp'],
    text: 'Sample entry. Describe the site, what was installed and anything the client said.'
  },
  {
    id: 'sample-village-road', sample: true,
    title: 'Village road, one side', type: 'Street lights', year: 2025,
    place: 'Hajo', district: 'Kamrup', state: 'Assam', lat: 26.25, lng: 91.53,
    lights: 51, products: ['si-9w'], length: 500,
    photos: ['assets/img/products/si-30w.webp'],
    text: 'Sample entry. 500 m of village road at the standard 10 m spacing.'
  },
  {
    id: 'sample-stadium', sample: true,
    title: 'Six-head mast for a playground', type: 'High mast', year: 2025,
    place: 'Shillong', district: 'East Khasi Hills', state: 'Meghalaya', lat: 25.58, lng: 91.89,
    lights: 6, products: ['mast-30m-150w'],
    photos: ['assets/img/work/site-mast-30m-150w.webp'],
    text: 'Sample entry.'
  },
  {
    id: 'sample-crossing', sample: true,
    title: 'Pedestrian crossing outside a school', type: 'Traffic', year: 2026,
    place: 'Tezpur', district: 'Sonitpur', state: 'Assam', lat: 26.63, lng: 92.8,
    lights: 2, products: ['ped-crossing'],
    photos: ['assets/img/products/ped-site.webp'],
    text: 'Sample entry.'
  },
  {
    id: 'sample-estate', sample: true,
    title: 'Tea estate lines and approach road', type: 'Street lights', year: 2026,
    place: 'Jorhat', district: 'Jorhat', state: 'Assam', lat: 26.75, lng: 94.22,
    lights: 38, products: ['si-25w'], length: 520,
    photos: ['assets/img/products/si-25w.webp'],
    text: 'Sample entry.'
  },
  {
    id: 'sample-junction', sample: true,
    title: 'Highway junction, 20 m mast', type: 'High mast', year: 2026,
    place: 'Itanagar', district: 'Papum Pare', state: 'Arunachal Pradesh', lat: 27.08, lng: 93.6,
    lights: 4, products: ['mast-20m-200w'],
    photos: ['assets/img/work/site-mast-20m-200w.webp'],
    text: 'Sample entry.'
  }
];

// The factory: how a light is made (the steps are written from the catalogue; check them with the owner). Each step shows a
// picture: img (a cut-out product shot) or, with photo: true, a full photo. Then the photos and videos. A video is { type: 'video', src: 'assets/img/work/line.mp4', poster: 'assets/img/work/line.webp' }; keep it short
// (under 20 MB) and muted.
window.GS_FACTORY = {   // the steps live here; the photos and videos come from the console when it has some (live.js)
  steps: [
    { icon: 'ruler', img: 'assets/img/products/pole-gi-octagonal.webp', facts: ['Road width', 'Pole spacing', 'Nights of backup'], title: 'Sized to the site', text: 'Every order starts with the road: its width, the pole spacing and how many nights it must run without sun. That sets the light, the battery and the panel.' },
    { icon: 'chip', img: 'assets/img/products/si-50w.webp', facts: ['OSRAM LEDs', '155 lm/W', '50,000 h'], title: 'The LED engine', text: 'OSRAM LED chips on aluminium boards: 155 lumens a watt, 50,000 hours, 5500–6500 K daylight white.' },
    { icon: 'battery', img: 'assets/img/products/battery-100ah.webp', facts: ['LiFePO₄', '5,000 cycles', 'BMS'], title: 'LiFePO₄ battery packs', text: 'Lithium iron phosphate cells, matched and packed with a battery management system, rated for 5,000 cycles.' },
    { icon: 'sun', img: 'assets/img/products/panel-400w.webp', facts: ['Matched panel', 'Dusk to dawn', 'Charge controller'], title: 'Panel and controller', text: 'The solar panel is matched to the battery; the controller switches the light on at dusk, off at dawn, and stretches the charge on cloudy days.' },
    { icon: 'shield', img: 'assets/img/products/aio-20w.webp', facts: ['IP66', 'Rain', 'Dust'], title: 'Sealed to IP66', text: 'The housing is sealed against rain, dust and hosing: built for the North-East monsoon.' },
    { icon: 'check', img: 'assets/img/products/si-30w.webp', facts: ['Charged', 'Switched on', 'Checked'], title: 'Tested before it leaves', text: 'Lights are charged, switched on and checked before they are packed.' },
    { icon: 'truck', img: 'assets/img/work/site-mast-20m-100w.webp', facts: ['North-East install', 'PAN India supply'], photo: true, title: 'Out to the road', text: 'Our crew installs across the North-East; we ship and support PAN India.' }
  ],
  media: window.GS_FACTORY_MEDIA || [
    { type: 'photo', src: 'assets/img/products/battery-100ah.webp', caption: 'Battery packs', sample: true },
    { type: 'photo', src: 'assets/img/products/si-50w.webp', caption: 'Light heads', sample: true },
    { type: 'photo', src: 'assets/img/products/panel-400w.webp', caption: 'Solar panels', sample: true },
    { type: 'photo', src: 'assets/img/products/pole-gi-octagonal.webp', caption: 'GI poles', sample: true },
    { type: 'photo', src: 'assets/img/products/high-mast.webp', caption: 'High-mast heads', sample: true },
    { type: 'photo', src: 'assets/img/products/blinker-20w.webp', caption: 'Traffic blinkers', sample: true }
  ]
};

/* Green Sun Technologies — everything a non-developer may need to change lives here.
   Address, phone and email are from the company's Udyam (MSME) and GST registrations. */
window.GS_CONFIG = {
  company: 'Green Sun Technologies',
  tagline: 'The best way to power up',

  phone: '+91 96784 56055',
  whatsapp: '919678456055',      // country code + number, digits only
  email: 'greensuntechnologies2024@gmail.com',

  address: [
    'Pub Boragaon, NH-37, Belwali Road',
    'Ward No. 10, Guwahati',
    'Kamrup Metropolitan, Assam 781035'
  ],
  // what Google Maps searches for on the Contact page (a place name, an address or "lat,lng")
  mapQuery: 'Pub Boragaon, Belwali Road, Guwahati, Assam 781035',

  // the Contact page shows the list up to 'PAN India'; 'PAN India' and everything after it appear when the visitor taps More
  serviceAreas: [
    'Guwahati & Kamrup Metro', 'All districts of Assam', 'Arunachal Pradesh', 'Meghalaya', 'Nagaland',
    'Manipur', 'Mizoram', 'Tripura', 'Sikkim',
    'PAN India',
    'Andhra Pradesh', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi',
    'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ],

  // Optional: a form backend that accepts a plain JSON POST, e.g. a Formspree or Getform form URL (Web3Forms needs an
  // access key in the body, which this site doesn't send). Leave empty and the Contact page sends enquiries through
  // WhatsApp or email instead. When you set it, add the service's origin to connect-src in the pages'
  // Content-Security-Policy meta tag, or the browser will block the request.
  formEndpoint: '',

  // Live content from the admin console (the solartech-admin project). Leave false until the console's login (Cloudflare Access)
  // is set up and its first "Import the catalogue" is done: with it on, the Contact page's "Send enquiry" button saves into
  // the console's inbox, and the site reads its products and contact details from /api/public instead of these files.
  liveApi: false,

  // Count page views for the admin console's Visitors page (no cookies; see functions/api/hit.js). Only works on Cloudflare.
  countVisits: true,

  gstin: '18BPLPS0265L1ZB',
  udyam: 'UDYAM-AS-03-0055919',
  founded: '2024-10-23',

  // used for the live "is the sun up in Guwahati?" status on the home page
  geo: { lat: 26.12, lng: 91.68 }
};

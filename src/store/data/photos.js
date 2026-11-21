// Free stock photography from Unsplash (Unsplash License: free for commercial use,
// no permission needed). Served from Unsplash's CDN, which supports on-the-fly sizing.
// To self-host later, download each photo and point `src()` at /img/stock/.

const ID = {
  breathe: '1493657699097-e2b96d30df56', // woman breathing, eyes closed, among trees
  runner: '1640504409849-da005a55cbd3', // young man running in a yellow tee
  trailRun: '1560581666-ace93c0d81a9', // runner on a forest trail
  dadDaughter: '1603367563698-67012943fd67', // father lifting daughter outdoors
  holi: '1790870284417-a9259fb589b9', // man and child covered in Holi colours
  family: '1780329944309-08b392306b49', // family of five
  sea: '1461468611824-46457c0e11fd', // woman facing the sea
  calm: '1518708909080-704599b19972', // hand on chest, calm breath
  armsUp: '1444011283387-7b0f76371f12', // woman raising arms outdoors
  couple: '1690231421673-8882a56ec9c9', // elderly couple walking together
  scientist: '1630959305790-4c956ce6c0b6', // scientist at a microscope
  labPlants: '1580982327559-c1202864eb05', // researchers studying a plant
  womanKurta: '1759840278381-bf7d5e332050', // woman in red kurta smiling
  elder: '1463335361701-e90f4c5045d0', // elderly woman smiling
  restTea: '1520206455633-f4f86d44a8a1', // woman resting on sofa with a mug
  thali: '1742281257687-092746ad6021', // Indian thali
  thali2: '1589778655375-3e622a9fc91c', // steel plate thali
  turmeric: '1768729340164-7d83fe18384d', // turmeric root and powder
  turmericFlower: '1606951444141-e5533feb55be', // turmeric flowers
  friends: '1616137971688-d1d2da194af5', // two friends laughing
  yogaSunset: '1544367567-0f2fcb009e0b', // yoga silhouette at sunset
  sunrise: '1524863479829-916d8e77f114', // stretching on a mountain at sunrise
  seniorWalk: '1658314755561-389d5660ee54', // senior woman on a brisk walk in the park
  sofaRest: '1762160342580-c69e7000c252', // woman relaxing on a sofa at home
  mountainView: '1491485326079-8713ae1e00a9', // man taking in a mountain view
  cycling: '1729791777545-0b2fce485b01', // woman cycling and smiling on a bright street
};

export const photo = (key, w = 1600, h) =>
  `https://images.unsplash.com/photo-${ID[key]}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=72`;

export const PHOTO_KEYS = Object.keys(ID);

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

  // ---- blog covers and in-article images (Nov 2026), picked to match each article's topic ----
  quitFlower: '1773609013189-a619ad9e8ffe', // hand offers a flower, other hand holds a cigarette pack
  noSmoking: '1641536471312-0fb88f392403', // no-smoking sign on a brick wall
  tulsiTea: '1567922045116-2a00fae2ed03', // bowl of herbal tea among green leaves
  oilBottles: '1550159793-14403c6e5d35', // small brown essential-oil bottles
  meditateFloor: '1758272421799-f944661c88f4', // woman meditating cross-legged at home
  meditateHome: '1758273240112-c7724c9bb4a5', // young woman meditating on the floor at home
  meditatePark: '1758274526671-ad18176acb01', // woman meditating in a park
  spices: '1716816211590-c15a328a5ff0', // table of Indian spices
  turmericRoot: '1768729340925-2749ecdc211c', // turmeric root, dried pieces and powder
  oranges: '1611080626919-7cf5a9dbab5b', // pile of fresh oranges
  spinach: '1574316071802-0d684efa7bf5', // fresh spinach leaves
  greenJuice: '1610622930110-3c076902312a', // hand holding a glass of green juice
  mortar: '1492552085122-36706c238263', // grinding herbs in a mortar and pestle
  sunsetWalk: '1771011521821-e3d984f30522', // person walking on a path at sunset
  leafyGreens: '1576045057995-568f588f82fb', // green leafy vegetables
  stomachPain: '1769029174021-b305fa92f0ae', // person holding their stomach in pain
  hotWaterBottle: '1773747608435-0fa80d11a32f', // knitted hot water bottle
  kettleBottle: '1788238025571-31c4310a4f7e', // pouring hot water from a kettle into a bottle
  childPose: '1767611102585-baf80e9be291', // woman in child's pose on a yoga mat
  gingerTea: '1682530016867-6fcc63df0cfb', // tea with lemon and ginger
  forestBreath: '1762112211894-d090fccb74fe', // woman with arms outstretched in a forest
  forestPath: '1790272611990-00e683084b71', // man walking on a forest path
  herbalMug: '1627435601361-ec25f5b1d0e5', // glass mug of herbal tea with green leaves
  manWalking: '1759141925324-917200c64869', // man in a cap walking outside
  cityFog: '1676633042976-c59eae4aa252', // hazy city seen from a hill
  faceMask: '1590383494601-2cd8a29a6d3c', // man wearing a face mask
  houseplants: '1583753075968-1236ccb83c66', // potted houseplants indoors
  openWindow: '1495524455245-b0f961d738a9', // open casement window near plants
  tiredDesk: '1758876022104-368b0f3fb6c9', // woman resting her head on her hand at a desk
  mixedNuts: '1543158181-1274e5362710', // mixed nuts and dried cranberries
  nutBowls: '1477506350614-fcdc29a3b157', // three bowls of nuts
  drinkWater: '1624948465121-96e87ae34a87', // woman drinking a glass of water
  waterGlass: '1534616042650-80f5c9b61f09', // glass filled with water
  leafThali: '1789991894901-440c1f00edb3', // Indian thali with dal, rice, roti and okra on a leaf plate
  stairs: '1476480862126-209bfaa8edc8', // walking up concrete stairs
  dates: '1648288725055-5ba4063355b9', // wooden bowl of dates
  glucose: '1683727186226-910f31a9da45', // blood glucose test with a glucometer
  sleeping: '1758273239813-cecda76c6c19', // young woman sleeping peacefully
  morningSun: '1778317240266-193dac2e6a31', // woman with eyes closed, sun on her face
  footSoak: '1577117633143-a2437fb9bdda', // feet soaking in a bowl
  footCream: '1577482665907-4375ea442792', // taking cream from a jar
  herbPowders: '1633509817627-5a29634475af', // spoons of herbal powders in a circle
  bitterMelon: '1764415438484-b5b28e5234be', // bitter gourd (karela) on the vine
  yogaMat: '1697274769480-3bf50ea59ce2', // woman doing a yoga pose on a mat
  yogaStretch: '1599447333777-a1a168ef94f7', // woman stretching in a yoga pose
  officeTea: '1783780933049-e740cad073ce', // colleagues with mugs in an office kitchen
  cafeFriends: '1790749870680-9f1918813d91', // four friends talking over coffee
  riceDal: '1788603092417-a01e665e0ab2', // bowl of basmati rice and a bowl of dal
  legumes: '1786994060314-eccbdd13066d', // dried legumes arranged in a flower shape
  foxtailMillet: '1789865504636-95a551d48809', // foxtail millet head in a field
  grainTrays: '1705475388190-775066fd69a5', // trays of beans, millets and cereals
};

export const photo = (key, w = 1600, h) =>
  `https://images.unsplash.com/photo-${ID[key]}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=72`;

export const PHOTO_KEYS = Object.keys(ID);

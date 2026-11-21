// Free stock video from Pexels (Pexels License: free for commercial use, no
// attribution required). Files are served from Pexels' CDN. To self-host before
// launch, download each file into public/video/ and update the paths below.
const pexels = (id, size, fps) => `https://videos.pexels.com/video-files/${id}/${id}-${size}_${fps}fps.mp4`;
const still = (id) => `https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&w=1600`;

export const VIDEOS = {
  // Woman with a warm drink by a lake: calm, everyday wellness
  lake: { src: pexels(8456785, 'sd_960_540', 25), poster: still(8456785) },
  // Hands grinding herbs in a stone mortar: ingredients / Ayurveda
  herbs: { src: pexels(5480230, 'sd_960_540', 25), poster: still(5480230) },
  // Botanists examining a plant: science
  lab: { src: pexels(8514329, 'sd_960_540', 24), poster: still(8514329) },
  // Indian family sharing a meal: the brand film
  family: { src: pexels(8811044, 'hd_1280_720', 25), poster: still(8811044) },
};

export interface ScoreboardConfig {
  name: string;
  imageUrl: string;
  fallbackColor: string;
  filter: string;
  textColor: string;
  overlayOpacity: number;
}

export const SCOREBOARDS: ScoreboardConfig[] = [
  {
    name: 'Forbes Field',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Forbes_Field_interior.jpg/1280px-Forbes_Field_interior.jpg',
    fallbackColor: '#1a1a2e',
    filter: 'sepia(0.4) brightness(0.85)',
    textColor: '#F5E642',
    overlayOpacity: 0.55,
  },
  {
    name: 'Wrigley Field',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Wrigley_Field_Scoreboard_%282010%29.jpg/1280px-Wrigley_Field_Scoreboard_%282010%29.jpg',
    fallbackColor: '#0d2b0d',
    filter: 'brightness(0.8) saturate(0.9)',
    textColor: '#FFFFFF',
    overlayOpacity: 0.5,
  },
  {
    name: 'Fenway Park',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Fenway_Park_Green_Monster_scoreboard.jpg/1280px-Fenway_Park_Green_Monster_scoreboard.jpg',
    fallbackColor: '#1a3a1a',
    filter: 'brightness(0.75) saturate(0.8)',
    textColor: '#FFFFFF',
    overlayOpacity: 0.55,
  },
  {
    name: 'Ebbets Field',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Ebbets_Field_-_interior.jpg/1280px-Ebbets_Field_-_interior.jpg',
    fallbackColor: '#1a1a2e',
    filter: 'sepia(0.5) brightness(0.8)',
    textColor: '#F5E642',
    overlayOpacity: 0.6,
  },
  {
    name: 'Crosley Field',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/CrosleyFieldInterior.jpg/1280px-CrosleyFieldInterior.jpg',
    fallbackColor: '#1a1a0e',
    filter: 'sepia(0.6) brightness(0.8)',
    textColor: '#F5E642',
    overlayOpacity: 0.6,
  },
  {
    name: 'Tiger Stadium',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Tiger_stadium_interior_1969.jpg/1280px-Tiger_stadium_interior_1969.jpg',
    fallbackColor: '#1a1206',
    filter: 'sepia(0.4) brightness(0.8)',
    textColor: '#FF6B00',
    overlayOpacity: 0.55,
  },
  {
    name: 'Shibe Park',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Shibe_Park_-_Connie_Mack_Stadium.jpg/1280px-Shibe_Park_-_Connie_Mack_Stadium.jpg',
    fallbackColor: '#0e1a2e',
    filter: 'sepia(0.5) brightness(0.75)',
    textColor: '#F5E642',
    overlayOpacity: 0.6,
  },
];

export function getScoreboardForMode(mode: string): ScoreboardConfig {
  const modeMap: Record<string, number> = {
    quick_nine: 0,
    custom: 1,
    daily: 2,
    sabermetrics: 3,
  };
  const idx = modeMap[mode] ?? Math.floor(Math.random() * SCOREBOARDS.length);
  return SCOREBOARDS[idx % SCOREBOARDS.length];
}

export function getRandomScoreboard(): ScoreboardConfig {
  return SCOREBOARDS[Math.floor(Math.random() * SCOREBOARDS.length)];
}

let currentIndex = 0;
export function getNextScoreboard(): ScoreboardConfig {
  const sb = SCOREBOARDS[currentIndex];
  currentIndex = (currentIndex + 1) % SCOREBOARDS.length;
  return sb;
}

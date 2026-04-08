/**
 * Legacy helper: keyword → Unsplash Source-style URL (avoid for new code — use `getReliableImageUrl` + Pixabay).
 */
export function getImageUrl(keyword: string, style?: string): string {
  const q = encodeURIComponent(keyword.trim().toLowerCase() || 'english learning')
  return `https://source.unsplash.com/featured/800x500?${q}`
}

/**
 * Word-relevant image URL for quiz review cards. Resolves via `/api/quiz-image`:
 * - `type=static`: Pixabay when `PIXABAY_API_KEY` is set; otherwise LoremFlickr (or placeholder SVG).
 * - `type=gif`: GIPHY search when `GIPHY_API_KEY` is set, otherwise an SVG placeholder.
 * `id` changes the variant (e.g. new id on "Try another image").
 */
/**
 * `imageStyle`: QuizQuestion.imageStyle label (e.g. Photo, Cartoon / Illustration, 3D render) — passed to `/api/quiz-image` as `style`.
 * `previousResolvedUrl`: optional last shown image URL — API avoids returning the same asset when changing style/regenerating.
 */
export function getReliableImageUrl(
  keyword: string,
  id?: string,
  type: 'static' | 'gif' = 'static',
  imageSearchQuery?: string,
  imageStyle?: string,
  previousResolvedUrl?: string
): string {
  const q = (keyword.trim().toLowerCase() || 'nature').slice(0, 120)
  const v = (id ?? String(Math.floor(Math.random() * 1e9))).slice(0, 64)
  const params = new URLSearchParams({ q, v, type })
  const sq = imageSearchQuery?.trim()
  if (sq) params.set('sq', sq.slice(0, 300))
  const st = imageStyle?.trim()
  if (st) params.set('style', st.slice(0, 48))
  const prev = previousResolvedUrl?.trim()
  if (prev && !prev.startsWith('/api/')) params.set('prev', prev.slice(0, 800))
  return `/api/quiz-image?${params.toString()}`
}

/**
 * Deterministic quiz cover source for dashboard cards.
 * Priority:
 * 1) Auto-generated topic cover (stable by quiz id + title),
 * 2) first question image URL,
 * 3) neutral inline SVG placeholder.
 */
export function getQuizCardCoverUrl(args: {
  quizId: string
  quizName: string
  coverImageMode?: 'auto' | 'manual'
  manualCoverImageUrl?: string
  fallbackImageUrl?: string
  imageSearchQuery?: string
  imageStyle?: string
}): string {
  if (args.coverImageMode === 'manual' && args.manualCoverImageUrl?.trim()) {
    return args.manualCoverImageUrl.trim()
  }
  const keyword = args.quizName.trim() || 'english learning challenge'
  const generated = getReliableImageUrl(
    keyword,
    `quiz-cover-${args.quizId}`,
    'static',
    args.imageSearchQuery,
    args.imageStyle,
  )
  if (generated) return generated
  if (args.fallbackImageUrl?.trim()) return args.fallbackImageUrl
  const label = encodeURIComponent((args.quizName || 'Quiz').slice(0, 40))
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='%230f1829'/><stop offset='100%' stop-color='%231e293b'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='40' fill='%2364748b'>${label}</text></svg>`
}

/**
 * ESL vocabulary topic map — returns suggestions for a given query.
 * Expanded with more topics and smarter matching.
 */
const vocabTopics: Record<string, string[]> = {
  fruit: ['apple', 'banana', 'orange', 'grape', 'mango', 'strawberry', 'watermelon', 'pineapple', 'peach', 'cherry', 'lemon', 'kiwi'],
  fruits: ['apple', 'banana', 'orange', 'grape', 'mango', 'strawberry', 'watermelon', 'pineapple', 'peach', 'cherry', 'lemon', 'kiwi'],
  vegetable: ['carrot', 'broccoli', 'spinach', 'potato', 'onion', 'tomato', 'cucumber', 'pepper', 'lettuce', 'corn', 'cabbage', 'pea'],
  vegetables: ['carrot', 'broccoli', 'spinach', 'potato', 'onion', 'tomato', 'cucumber', 'pepper', 'lettuce', 'corn', 'cabbage', 'pea'],
  animal: ['dog', 'cat', 'elephant', 'lion', 'tiger', 'rabbit', 'horse', 'cow', 'bear', 'wolf', 'monkey', 'bird'],
  animals: ['dog', 'cat', 'elephant', 'lion', 'tiger', 'rabbit', 'horse', 'cow', 'bear', 'wolf', 'monkey', 'bird'],
  color: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'gray', 'gold'],
  colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'gray', 'gold'],
  colour: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'gray', 'gold'],
  number: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  body: ['head', 'hand', 'foot', 'eye', 'ear', 'nose', 'mouth', 'arm', 'leg', 'finger', 'hair', 'face'],
  weather: ['sunny', 'rainy', 'cloudy', 'windy', 'snowy', 'foggy', 'stormy', 'hot', 'cold', 'warm', 'humid', 'clear'],
  food: ['bread', 'rice', 'pasta', 'pizza', 'burger', 'soup', 'salad', 'cake', 'cookie', 'sandwich', 'egg', 'cheese'],
  foods: ['bread', 'rice', 'pasta', 'pizza', 'burger', 'soup', 'salad', 'cake', 'cookie', 'sandwich', 'egg', 'cheese'],
  drink: ['water', 'juice', 'milk', 'coffee', 'tea', 'soda', 'lemonade', 'smoothie', 'hot chocolate', 'orange juice'],
  drinks: ['water', 'juice', 'milk', 'coffee', 'tea', 'soda', 'lemonade', 'smoothie', 'hot chocolate', 'orange juice'],
  transport: ['car', 'bus', 'train', 'plane', 'bicycle', 'boat', 'truck', 'motorcycle', 'taxi', 'subway', 'helicopter', 'ship'],
  transportation: ['car', 'bus', 'train', 'plane', 'bicycle', 'boat', 'truck', 'motorcycle', 'taxi', 'subway', 'helicopter', 'ship'],
  house: ['bedroom', 'kitchen', 'bathroom', 'living room', 'garden', 'roof', 'door', 'window', 'floor', 'wall', 'stairs', 'garage'],
  home: ['bedroom', 'kitchen', 'bathroom', 'living room', 'garden', 'roof', 'door', 'window', 'floor', 'wall', 'stairs', 'garage'],
  school: ['teacher', 'student', 'book', 'pencil', 'ruler', 'eraser', 'desk', 'board', 'notebook', 'pen', 'classroom', 'homework'],
  clothes: ['shirt', 'pants', 'dress', 'shoes', 'hat', 'jacket', 'socks', 'shorts', 'coat', 'scarf', 'sweater', 'skirt'],
  clothing: ['shirt', 'pants', 'dress', 'shoes', 'hat', 'jacket', 'socks', 'shorts', 'coat', 'scarf', 'sweater', 'skirt'],
  sport: ['soccer', 'basketball', 'tennis', 'swimming', 'running', 'volleyball', 'baseball', 'golf', 'boxing', 'cycling', 'hockey', 'skiing'],
  sports: ['soccer', 'basketball', 'tennis', 'swimming', 'running', 'volleyball', 'baseball', 'golf', 'boxing', 'cycling', 'hockey', 'skiing'],
  flower: ['rose', 'daisy', 'tulip', 'sunflower', 'lily', 'orchid', 'violet', 'daffodil', 'carnation', 'lavender'],
  flowers: ['rose', 'daisy', 'tulip', 'sunflower', 'lily', 'orchid', 'violet', 'daffodil', 'carnation', 'lavender'],
  ocean: ['wave', 'fish', 'shark', 'coral', 'shell', 'sand', 'beach', 'dolphin', 'whale', 'octopus', 'crab', 'starfish'],
  sea: ['wave', 'fish', 'shark', 'coral', 'shell', 'sand', 'beach', 'dolphin', 'whale', 'octopus', 'crab', 'starfish'],
  family: ['mother', 'father', 'sister', 'brother', 'grandmother', 'grandfather', 'uncle', 'aunt', 'cousin', 'baby', 'parents', 'children'],
  job: ['doctor', 'nurse', 'teacher', 'pilot', 'chef', 'engineer', 'artist', 'police', 'farmer', 'driver', 'dentist', 'firefighter'],
  jobs: ['doctor', 'nurse', 'teacher', 'pilot', 'chef', 'engineer', 'artist', 'police', 'farmer', 'driver', 'dentist', 'firefighter'],
  occupation: ['doctor', 'nurse', 'teacher', 'pilot', 'chef', 'engineer', 'artist', 'police', 'farmer', 'driver', 'dentist', 'firefighter'],
  technology: ['phone', 'computer', 'tablet', 'screen', 'keyboard', 'mouse', 'camera', 'headphone', 'charger', 'laptop', 'television', 'radio'],
  tech: ['phone', 'computer', 'tablet', 'screen', 'keyboard', 'mouse', 'camera', 'headphone', 'charger', 'laptop', 'television', 'radio'],
  emotion: ['happy', 'sad', 'angry', 'scared', 'surprised', 'excited', 'bored', 'tired', 'proud', 'worried', 'nervous', 'confused'],
  emotions: ['happy', 'sad', 'angry', 'scared', 'surprised', 'excited', 'bored', 'tired', 'proud', 'worried', 'nervous', 'confused'],
  feeling: ['happy', 'sad', 'angry', 'scared', 'surprised', 'excited', 'bored', 'tired', 'proud', 'worried', 'nervous', 'confused'],
  feelings: ['happy', 'sad', 'angry', 'scared', 'surprised', 'excited', 'bored', 'tired', 'proud', 'worried', 'nervous', 'confused'],
  time: ['morning', 'afternoon', 'evening', 'night', 'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'hour', 'minute'],
  day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  month: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  season: ['spring', 'summer', 'fall', 'winter', 'autumn'],
  seasons: ['spring', 'summer', 'fall', 'winter', 'autumn'],
  furniture: ['chair', 'table', 'sofa', 'bed', 'desk', 'lamp', 'shelf', 'drawer', 'mirror', 'closet', 'couch', 'cabinet'],
  kitchen: ['stove', 'oven', 'fridge', 'sink', 'microwave', 'toaster', 'blender', 'pan', 'pot', 'plate', 'cup', 'fork'],
  classroom: ['desk', 'chair', 'board', 'marker', 'eraser', 'book', 'pencil', 'backpack', 'clock', 'map', 'globe', 'poster'],
  action: ['run', 'walk', 'jump', 'swim', 'eat', 'drink', 'sleep', 'read', 'write', 'play', 'sing', 'dance'],
  actions: ['run', 'walk', 'jump', 'swim', 'eat', 'drink', 'sleep', 'read', 'write', 'play', 'sing', 'dance'],
  verb: ['run', 'walk', 'jump', 'swim', 'eat', 'drink', 'sleep', 'read', 'write', 'play', 'sing', 'dance'],
  verbs: ['run', 'walk', 'jump', 'swim', 'eat', 'drink', 'sleep', 'read', 'write', 'play', 'sing', 'dance'],
  shape: ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star', 'heart', 'diamond', 'hexagon', 'pentagon'],
  shapes: ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star', 'heart', 'diamond', 'hexagon', 'pentagon'],
  place: ['school', 'hospital', 'park', 'library', 'store', 'restaurant', 'airport', 'bank', 'museum', 'zoo', 'beach', 'mountain'],
  places: ['school', 'hospital', 'park', 'library', 'store', 'restaurant', 'airport', 'bank', 'museum', 'zoo', 'beach', 'mountain'],
  country: ['China', 'Japan', 'Korea', 'America', 'England', 'France', 'Germany', 'Italy', 'Spain', 'Brazil', 'Australia', 'Canada'],
  countries: ['China', 'Japan', 'Korea', 'America', 'England', 'France', 'Germany', 'Italy', 'Spain', 'Brazil', 'Australia', 'Canada'],
  toy: ['ball', 'doll', 'car', 'robot', 'puzzle', 'blocks', 'kite', 'teddy bear', 'yo-yo', 'train'],
  toys: ['ball', 'doll', 'car', 'robot', 'puzzle', 'blocks', 'kite', 'teddy bear', 'yo-yo', 'train'],
  insect: ['bee', 'ant', 'butterfly', 'spider', 'fly', 'mosquito', 'ladybug', 'grasshopper', 'beetle', 'dragonfly'],
  insects: ['bee', 'ant', 'butterfly', 'spider', 'fly', 'mosquito', 'ladybug', 'grasshopper', 'beetle', 'dragonfly'],
  bug: ['bee', 'ant', 'butterfly', 'spider', 'fly', 'mosquito', 'ladybug', 'grasshopper', 'beetle', 'dragonfly'],
  bugs: ['bee', 'ant', 'butterfly', 'spider', 'fly', 'mosquito', 'ladybug', 'grasshopper', 'beetle', 'dragonfly'],
  pet: ['dog', 'cat', 'fish', 'bird', 'hamster', 'rabbit', 'turtle', 'snake', 'guinea pig', 'parrot'],
  pets: ['dog', 'cat', 'fish', 'bird', 'hamster', 'rabbit', 'turtle', 'snake', 'guinea pig', 'parrot'],
  musical: ['piano', 'guitar', 'drum', 'violin', 'flute', 'trumpet', 'saxophone', 'harmonica', 'cello', 'ukulele'],
  music: ['piano', 'guitar', 'drum', 'violin', 'flute', 'trumpet', 'saxophone', 'harmonica', 'cello', 'ukulele'],
  instrument: ['piano', 'guitar', 'drum', 'violin', 'flute', 'trumpet', 'saxophone', 'harmonica', 'cello', 'ukulele'],
  instruments: ['piano', 'guitar', 'drum', 'violin', 'flute', 'trumpet', 'saxophone', 'harmonica', 'cello', 'ukulele'],
}

export function getVocabSuggestions(description: string): string[] {
  if (!description || description.length < 2) return []
  
  const lower = description.toLowerCase()
  const words = lower.split(/[\s,.\-;:!?'"()]+/).filter(w => w.length >= 2)
  const suggestions = new Set<string>()
  
  // Direct topic match
  for (const [topic, vocabWords] of Object.entries(vocabTopics)) {
    if (lower.includes(topic)) {
      vocabWords.slice(0, 8).forEach((w) => suggestions.add(w))
    }
  }
  
  // Partial word match (e.g., "fruit" matches "fruits")
  for (const word of words) {
    for (const [topic, vocabWords] of Object.entries(vocabTopics)) {
      if (topic.startsWith(word) || word.startsWith(topic)) {
        vocabWords.slice(0, 6).forEach((w) => suggestions.add(w))
      }
    }
  }
  
  // If still no suggestions, try fuzzy matching
  if (suggestions.size === 0) {
    for (const word of words) {
      if (word.length >= 3) {
        for (const [topic, vocabWords] of Object.entries(vocabTopics)) {
          if (topic.includes(word) || word.includes(topic.slice(0, 3))) {
            vocabWords.slice(0, 4).forEach((w) => suggestions.add(w))
          }
        }
      }
    }
  }
  
  return Array.from(suggestions).slice(0, 12)
}

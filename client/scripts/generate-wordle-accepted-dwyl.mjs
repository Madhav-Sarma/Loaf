import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DWYL_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_dictionary.json'
const MIN_LENGTH = 5
const MAX_LENGTH = 5

const BLOCKED_WORDS = new Set([
  'arsee',
  'arses',
  'bitch',
  'bitchy',
  'blowy',
  'boner',
  'boobs',
  'booby',
  'chink',
  'chode',
  'clits',
  'cocks',
  'cocky',
  'coonz',
  'coons',
  'cunts',
  'dildo',
  'dildos',
  'dykes',
  'faggy',
  'fagot',
  'fucks',
  'fucky',
  'homos',
  'jizzy',
  'kikes',
  'nigga',
  'niggs',
  'nigger',
  'penis',
  'porny',
  'porno',
  'pussy',
  'queef',
  'rape',
  'raped',
  'raper',
  'rapes',
  'rapey',
  'rectum',
  'semen',
  'sexed',
  'sexes',
  'sexxy',
  'shits',
  'shite',
  'sluts',
  'spics',
  'spunk',
  'titty',
  'twats',
  'vulva',
  'whore',
])

function isValidWord(word) {
  return /^[a-z]+$/.test(word) && word.length >= MIN_LENGTH && word.length <= MAX_LENGTH
}

function parseSolutionWords(source) {
  const words = new Set()
  const matches = source.matchAll(/'([a-z]+)'/g)

  for (const match of matches) {
    words.add(match[1])
  }

  return words
}

function buildFile(words) {
  const rows = words.map((word) => `  '${word}',`).join('\n')

  return `// Accepted guess words sourced from DWYL English dictionary.\n// Source: ${DWYL_URL}\n// Auto-generated. Do not edit manually.\n\nexport const ACCEPTED_WORDS: string[] = [\n${rows}\n];\n`
}

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const rootDir = path.resolve(__dirname, '..')

  const solutionPath = path.join(rootDir, 'src', 'games', 'wordle', 'data', 'solutionWords.ts')
  const acceptedPath = path.join(rootDir, 'src', 'games', 'wordle', 'data', 'acceptedWords.ts')

  const response = await fetch(DWYL_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch DWYL dictionary: ${response.status} ${response.statusText}`)
  }

  const dictionary = await response.json()
  const dwylWords = Object.keys(dictionary)

  const solutionSource = await fs.readFile(solutionPath, 'utf8')
  const solutionWords = parseSolutionWords(solutionSource)

  const merged = new Set()

  for (const rawWord of dwylWords) {
    const word = rawWord.toLowerCase()
    if (!isValidWord(word)) {
      continue
    }

    if (BLOCKED_WORDS.has(word)) {
      continue
    }

    merged.add(word)
  }

  for (const word of solutionWords) {
    if (isValidWord(word) && !BLOCKED_WORDS.has(word)) {
      merged.add(word)
    }
  }

  const sortedWords = [...merged].sort((left, right) => left.localeCompare(right))
  await fs.writeFile(acceptedPath, buildFile(sortedWords), 'utf8')

  console.log(`Generated ${sortedWords.length} accepted words (${MIN_LENGTH}-${MAX_LENGTH} letters).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

# 🎮 Guess Me

Guess Me is a multiplayer party game inside the Loaf platform.

Players secretly choose numbers and perform actions while others try to guess the number based on their performance.

---

## Roles

Guesser

* writes the action prompt
* sees other players' guesses
* makes the final guess

Actors

* secretly choose a number
* perform the action

Players

* watch the performance
* guess the actor's number

---

## Game Setup

Players configure settings:

* number range (default 1–10)
* allow duplicate numbers
* guesser selection mode (clockwise or random)
* actors per round
* guessers per round

---

## Round Flow

1. select actors
2. actors secretly choose numbers
3. guesser writes an action prompt
4. actors perform one by one
5. players submit guesses
6. guesser sees guesses
7. guesser makes final guess
8. reveal secret number
9. update scores
10. proceed to next round

---

## Scoring

+2 points for correct guess
+1 point for actor if guessed correctly
+4 points for guesser correct
-1 point for guesser incorrect

---

## UI Goals

* mobile-first interface
* simple screens
* clear instructions
* fun animations
* quick interactions

Use TailwindCSS, shadcn components, and Wigggle UI animations.

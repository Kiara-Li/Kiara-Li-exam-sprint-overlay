export const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'demo';

export const animalTerms = [
  ['Lion', 'Which big cat has a mane and roars?'],
  ['Elephant', 'Which large animal has a long trunk?'],
  ['Giraffe', 'Which animal has a very long neck?'],
  ['Penguin', 'Which black-and-white bird swims but cannot fly?'],
  ['Fish', 'Which animal lives in water and breathes through gills?'],
  ['Frog', 'Which animal starts life as a tadpole?'],
  ['Cow', 'Which farm animal says “moo”?'],
  ['Butterfly', 'What does a caterpillar turn into?'],
];

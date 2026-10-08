import { isDemo, animalTerms } from './demo-data.js';

export const course = {
  folder: 'Modern Art History',
  sets: [
    {
      chapter: 'Chapter 1 · Easy Art Basics',
      subtitle: 'Simple practice set for testing',
      // Term 2 against its three closest neighbours: everyone stalls here.
      hard: { term: 2, distractors: [1, 0, 4] },
      terms: [
        ['Claude Monet', 'The Impressionist artist who painted Impression, Sunrise.'],
        ['Impressionism', 'An art movement known for visible brushstrokes and changing light.'],
        ['Impression, Sunrise', 'A painting by Claude Monet that helped give Impressionism its name.'],
        ['Vincent van Gogh', 'The artist who painted The Starry Night.'],
        ['The Starry Night', 'A famous night-sky painting by Vincent van Gogh.'],
        ['Pablo Picasso', 'An artist closely associated with Cubism.'],
        ['Cubism', 'An art movement that breaks subjects into geometric shapes and multiple viewpoints.'],
        ['Salvador Dalí', 'A Surrealist artist famous for dreamlike paintings and melting clocks.'],
        ['Surrealism', 'An art movement inspired by dreams and the unconscious.'],
        ['Marcel Duchamp', 'The artist associated with the readymade Fountain.'],
        ['Readymade', 'An ordinary manufactured object presented as art.'],
        ['Jackson Pollock', 'An Abstract Expressionist famous for drip paintings.'],
        ['Andy Warhol', 'A Pop artist famous for Campbell’s Soup Cans.'],
        ['Pop Art', 'An art movement that uses images from advertising and popular culture.'],
        ['Bauhaus', 'A German school that brought art, craft, architecture, and design together.'],
      ],
    },
    {
      chapter: 'Chapter 2 · Post-Impressionism to Cubism',
      subtitle: 'Color, expression, and fractured space · 1886–1914',
      hard: { term: 2, distractors: [1, 0, 6] },
      terms: [
        ['Post-Impressionism', 'A broad term for artists after Impressionism who pursued structure, symbolism, expression, or scientific color.'],
        ['Paul Cézanne', 'French painter whose constructive brushwork and shifting viewpoints strongly influenced Cubism.'],
        ['Mont Sainte-Victoire', 'A Provençal mountain that Cézanne painted repeatedly while exploring structure, perception, and pictorial space.'],
        ['Vincent van Gogh', 'Dutch Post-Impressionist whose intensified color and brushwork conveyed emotional and spiritual experience.'],
        ['The Starry Night', 'Van Gogh’s 1889 nocturnal landscape painted while he was at Saint-Rémy.'],
        ['Paul Gauguin', 'French Post-Impressionist associated with Synthetism and Symbolism, and with a colonialist primitivist vision of Tahiti.'],
        ['Georges Seurat', 'French Neo-Impressionist who developed a systematic method of divided color.'],
        ['A Sunday on La Grande Jatte—1884', 'Seurat’s large 1884–86 painting built from small touches of contrasting color.'],
        ['Fauvism', 'An early-20th-century movement known for vivid, non-naturalistic color and simplified form.'],
        ['Henri Matisse', 'A leading Fauvist who used color and flattened space as independent expressive elements.'],
        ['Expressionism', 'An approach that distorts color and form to convey subjective or emotional experience.'],
        ['Les Demoiselles d’Avignon', 'Picasso’s 1907 painting whose fractured figures and space were crucial to the emergence of Cubism.'],
        ['Analytic Cubism', 'The Cubist phase of roughly 1909–12 in which subjects were fragmented into interlocking, muted planes.'],
        ['Synthetic Cubism', 'The Cubist phase beginning around 1912 that used simpler shapes, brighter color, and collage materials.'],
        ['Papier collé', 'A collage technique using pasted paper, introduced into Cubist practice by Georges Braque in 1912.'],
      ],
    },
    {
      chapter: 'Chapter 3 · Dada, Surrealism, and Interwar Art',
      subtitle: 'Anti-art, dreams, and political rupture · 1916–1939',
      hard: { term: 2, distractors: [3, 0, 6] },
      terms: [
        ['Dada', 'An international movement formed during World War I that challenged artistic conventions through chance, absurdity, and irreverence.'],
        ['Cabaret Voltaire', 'The Zurich performance venue where Hugo Ball, Emmy Hennings, and others launched Dada activities in 1916.'],
        ['Readymade', 'A mass-produced object selected and designated as art, a strategy associated with Marcel Duchamp.'],
        ['Fountain', 'Duchamp’s 1917 readymade urinal submitted under the name R. Mutt.'],
        ['Hannah Höch', 'Berlin Dada artist known for photomontages that critiqued gender, politics, and mass media.'],
        ['Cut with the Kitchen Knife', 'Höch’s large 1919–20 photomontage mapping the chaotic politics and culture of Weimar Germany.'],
        ['Photomontage', 'A composition assembled from cut and recombined photographic images, widely used by Berlin Dada artists.'],
        ['Surrealism', 'A movement launched in Paris in 1924 that explored dreams, desire, and the unconscious.'],
        ['André Breton', 'French writer who published the first Surrealist Manifesto in 1924.'],
        ['Psychic automatism', 'Surrealist practice intended to bypass rational control and access unconscious thought.'],
        ['Salvador Dalí', 'Spanish Surrealist known for meticulously rendered dream imagery and the paranoiac-critical method.'],
        ['The Persistence of Memory', 'Dalí’s 1931 painting of soft watches in an uncanny coastal landscape.'],
        ['René Magritte', 'Belgian Surrealist whose deadpan images question language, representation, and reality.'],
        ['The Treachery of Images', 'Magritte’s 1929 painting pairing a pipe with the statement that it is not a pipe.'],
        ['Meret Oppenheim', 'Swiss artist associated with Surrealism; her Object of 1936 is a fur-covered cup, saucer, and spoon.'],
      ],
    },
    {
      chapter: 'Chapter 4 · Abstract Expressionism to Pop',
      subtitle: 'The New York School and mass culture · 1943–1968',
      hard: { term: 2, distractors: [0, 1, 3] },
      terms: [
        ['Abstract Expressionism', 'A diverse American movement of the 1940s and 1950s marked by abstraction, large scale, and emphasis on process or color.'],
        ['New York School', 'A term for the loose network of artists, critics, and poets associated with postwar avant-garde culture in New York.'],
        ['Action painting', 'Harold Rosenberg’s term for painting understood as a record of the artist’s physical and existential act.'],
        ['Jackson Pollock', 'American Abstract Expressionist known for poured and dripped paintings made with the canvas on the floor.'],
        ['Autumn Rhythm (Number 30)', 'Pollock’s 1950 enamel painting structured by layered skeins of poured line.'],
        ['Color field painting', 'An approach using broad areas of color to create immersive, contemplative visual experiences.'],
        ['Mark Rothko', 'Painter known for large canvases of hovering rectangular color fields.'],
        ['Barnett Newman', 'Abstract Expressionist whose color fields are divided by narrow vertical bands he called zips.'],
        ['Woman I', 'Willem de Kooning’s 1950–52 painting combining aggressive brushwork with a fragmented female figure.'],
        ['Pop Art', 'A movement that used imagery and techniques from advertising, comics, consumer goods, and mass media.'],
        ['Richard Hamilton', 'British Pop artist who made the 1956 collage Just what is it that makes today’s homes so different, so appealing?'],
        ['Andy Warhol', 'American Pop artist who used commercial processes such as silkscreen to repeat images of products and celebrities.'],
        ['Campbell’s Soup Cans', 'Warhol’s 1962 installation of 32 canvases, one for each soup variety then sold by Campbell’s.'],
        ['Roy Lichtenstein', 'American Pop artist known for enlarging comic-book imagery and imitating Ben-Day printing dots.'],
        ['Minimalism', 'A 1960s tendency using reduced geometric forms, industrial fabrication, repetition, and literal space.'],
      ],
    },
  ],
};

if (isDemo) {
  course.folder = 'Animal Facts';
  course.subtitle = 'A little animal knowledge';
  const titles = ['Animal Basics', 'Animal Homes', 'Food & Habits', 'Baby Animals'];
  course.sets = titles.map((title, index) => ({
    chapter: `Chapter ${index + 1} · ${title}`,
    subtitle: 'Simple animal facts',
    terms: animalTerms.map(term => [...term]),
  }));
}

import type { GuideArea } from '@blr/engine';

/**
 * What the city guide knows, area by area. Keep answers short, concrete and
 * true: these are read out to visitors as facts about the real city.
 */
export const GUIDE_AREAS: readonly GuideArea[] = [
  {
    id: 'majestic',
    name: 'Majestic',
    aliases: ['kempegowda bus station', 'bus stand', 'kbs', 'city railway station', 'ksr'],
    anchor: 'majestic_bus',
    radius: 420,
    metro: 'majestic_metro',
    blurb:
      'The city’s front door. Buses, trains and the metro all meet here, and so does everyone who has just arrived.',
    topics: [
      {
        id: 'name',
        question: 'Why is it called Majestic?',
        keywords: ['why', 'called', 'name', 'majestic', 'mean'],
        answer:
          'Officially the neighbourhood is Gandhinagar and the bus stand is Kempegowda Bus Station. An old cinema called Majestic stood nearby, and its name stuck to the whole area. Ask for “Majestic” and every driver in the city knows where you mean.',
      },
      {
        id: 'history',
        question: 'What was here before the bus stand?',
        keywords: ['history', 'before', 'old', 'lake', 'built', 'story'],
        answer:
          'A lake. The bus stand sits on the dry bed of Dharmambudhi tank, which once supplied water to the old town. That is why the ground here dips: you are standing in a lake bed.',
      },
      {
        id: 'transport',
        question: 'How do I get out of here?',
        keywords: [
          'bus',
          'train',
          'metro',
          'transport',
          'travel',
          'get',
          'out',
          'leave',
          'station',
          'railway',
        ],
        answer:
          'Three ways. City buses from the BMTC platforms, long-distance buses and trains from next door (KSR Bengaluru City station is across the road), and the metro underneath, where the Purple and Green lines cross. For MG Road, the Purple Line is the quick one.',
      },
      {
        id: 'autos',
        question: 'Any advice on autos?',
        keywords: [
          'auto',
          'autos',
          'rickshaw',
          'fare',
          'meter',
          'bargain',
          'price',
          'driver',
          'haggle',
        ],
        answer:
          'Agree the fare before you sit. Ask for the meter; you will be offered “meter mele twenty” (twenty over the meter). In the rain or late at night expect “one-and-half”. A fair offer, made with a smile, usually lands in the middle.',
      },
    ],
  },
  {
    id: 'kg_road',
    name: 'KG Road',
    aliases: ['kempegowda road', 'gandhinagar', 'mysore bank circle', 'avenue road'],
    anchor: 'kg_road',
    radius: 330,
    blurb:
      'Kempegowda Road: banks, old cinema halls and places to eat standing up, running from Majestic towards the Corporation.',
    topics: [
      {
        id: 'name',
        question: 'Who was Kempegowda?',
        keywords: ['who', 'kempegowda', 'name', 'named', 'kg', 'founder', 'history'],
        answer:
          'The chieftain who founded Bengaluru in 1537, building a mud fort and a market town just south of here. The road, the bus station, the metro station and the airport are all named for him.',
      },
      {
        id: 'eat',
        question: 'Where do I eat around here?',
        keywords: [
          'eat',
          'food',
          'hungry',
          'breakfast',
          'tiffin',
          'dosa',
          'dose',
          'idli',
          'coffee',
          'darshini',
          'lunch',
        ],
        answer:
          'At a darshini. Buy a token at the counter, hand it over, eat standing at a steel table: idli-vade, masala dose, then filter coffee. Ten minutes, under a hundred rupees. Shanthakka’s Hotte Thumba Darshini is right here.',
      },
      {
        id: 'cinema',
        question: 'What is with all the old theatres?',
        keywords: ['theatre', 'theatres', 'cinema', 'film', 'movie', 'movies', 'kannada'],
        answer:
          'Gandhinagar was the home of the Kannada film trade for decades, and this stretch was lined with single-screen cinemas. Many have closed or become malls, but the film business is still called “Gandhinagar”.',
      },
      {
        id: 'books',
        question: 'What is Avenue Road known for?',
        keywords: ['avenue', 'books', 'book', 'textbook', 'shopping', 'buy'],
        answer:
          'Second-hand books. Avenue Road runs south from here towards the market, and generations of students have bought and sold their textbooks on its footpaths.',
      },
    ],
  },
  {
    id: 'kr_market',
    name: 'KR Market',
    aliases: ['city market', 'krishna rajendra market', 'market', 'flower market'],
    anchor: 'kr_market',
    radius: 360,
    blurb:
      'Krishna Rajendra Market, the city’s biggest wholesale market: flowers, vegetables and noise from before dawn.',
    topics: [
      {
        id: 'what',
        question: 'What is sold here?',
        keywords: [
          'what',
          'sold',
          'sell',
          'buy',
          'flowers',
          'flower',
          'vegetables',
          'shopping',
          'mallige',
          'jasmine',
        ],
        answer:
          'Flowers first: marigold, rose and mallige (jasmine) in heaps, sold by weight or by the mola, a forearm’s length of strung blossom. Then vegetables, fruit, spices and hardware in the lanes around. Go early; by mid-morning the best is gone.',
      },
      {
        id: 'history',
        question: 'How old is the market?',
        keywords: ['history', 'old', 'built', 'when', 'named', 'name', 'who', 'electric', 'lights'],
        answer:
          'The market building dates from 1928 and is named for Krishnaraja Wodeyar, a maharaja of Mysore. This part of town is often said to be among the first in Asia to have electric street lights, in 1905.',
      },
      {
        id: 'nearby',
        question: 'What else is close by?',
        keywords: ['nearby', 'near', 'close', 'see', 'visit', 'fort', 'palace', 'tipu'],
        answer:
          'A short walk south are the remains of Bangalore Fort and Tipu Sultan’s Summer Palace, a teak-pillared building from the late 1700s. Both are just beyond the edge of this chapter’s map.',
      },
    ],
  },
  {
    id: 'hudson_circle',
    name: 'Hudson Circle',
    aliases: ['corporation circle', 'corporation', 'town hall', 'bbmp'],
    anchor: 'hudson_circle',
    radius: 330,
    blurb:
      'One of the busiest junctions in the old city, where roads from Majestic, the market, Cubbon Park and the south all cross.',
    topics: [
      {
        id: 'name',
        question: 'Why two names?',
        keywords: ['why', 'name', 'names', 'called', 'hudson', 'corporation', 'church'],
        answer:
          'Hudson Circle is for Hudson Memorial Church on the corner. Corporation Circle is for the city corporation’s head office next to it. Bus boards say Corporation; older residents say Hudson. Both will get you here.',
      },
      {
        id: 'townhall',
        question: 'What is the building with the columns?',
        keywords: ['town', 'hall', 'columns', 'building', 'pillars', 'protest'],
        answer:
          'Town Hall, a little to the south-west: the Sir K. P. Puttanna Chetty Town Hall, opened in 1935. Its front steps are the city’s usual place for protests and rallies.',
      },
      {
        id: 'traffic',
        question: 'Is the traffic always like this?',
        keywords: ['traffic', 'jam', 'busy', 'signal', 'rush', 'peak'],
        answer:
          'Around nine in the morning and from half past five in the evening, yes. In between it moves. If you are driving, this junction and KG Road are the ones to avoid at peak hour; Constable Ravi on the corner will tell you the same.',
      },
    ],
  },
  {
    id: 'vidhana_soudha',
    name: 'Vidhana Soudha',
    aliases: ['vidhan soudha', 'high court', 'attara kacheri', 'legislature', 'assembly'],
    anchor: 'vidhana_soudha',
    radius: 330,
    metro: 'vidhana_soudha',
    blurb:
      'The great granite building where Karnataka’s legislature sits, facing the red High Court.',
    topics: [
      {
        id: 'what',
        question: 'What is this building?',
        keywords: [
          'what',
          'building',
          'this',
          'vidhana',
          'soudha',
          'government',
          'legislature',
          'assembly',
        ],
        answer:
          'Vidhana Soudha, the seat of the state legislature. It was completed in 1956 under chief minister Kengal Hanumanthaiah, in granite, in a style usually described as Neo-Dravidian. Over the entrance is carved “Government’s Work is God’s Work”.',
      },
      {
        id: 'court',
        question: 'And the red building opposite?',
        keywords: ['red', 'opposite', 'court', 'high', 'attara', 'kacheri'],
        answer:
          'Attara Kacheri, home of the Karnataka High Court. It dates from the 1860s, nearly a century older than Vidhana Soudha, and was the government secretariat before it was a court.',
      },
      {
        id: 'visit',
        question: 'Can I go inside?',
        keywords: ['inside', 'visit', 'enter', 'tour', 'photo', 'lights', 'evening', 'when'],
        answer:
          'Not without permission; it is a working government building. Most people see it from the road. It is at its best on Sunday evenings and public holidays, when the whole facade is lit.',
      },
    ],
  },
  {
    id: 'cubbon_park',
    name: 'Cubbon Park',
    aliases: ['cubbon', 'park', 'central library', 'chamarajendra park'],
    anchor: 'cubbon_park',
    radius: 520,
    metro: 'cubbon_metro',
    blurb: 'About three hundred acres of old trees in the middle of the city.',
    topics: [
      {
        id: 'history',
        question: 'How old is the park?',
        keywords: ['history', 'old', 'when', 'name', 'named', 'cubbon', 'who'],
        answer:
          'It was laid out in 1870. The name remembers Sir Mark Cubbon, a long-serving British commissioner of Mysore; officially it is Sri Chamarajendra Park, though almost nobody calls it that.',
      },
      {
        id: 'see',
        question: 'What should I see in it?',
        keywords: [
          'see',
          'do',
          'visit',
          'library',
          'red',
          'building',
          'bandstand',
          'bamboo',
          'walk',
        ],
        answer:
          'The red Seshadri Iyer Memorial Hall, which houses the State Central Library, with a rose garden in front. The bandstand. The bamboo groves. Mostly, the avenues of huge old trees: walk under them and the traffic disappears.',
      },
      {
        id: 'when',
        question: 'When is the best time to come?',
        keywords: ['best', 'time', 'when', 'morning', 'sunday', 'early', 'evening'],
        answer:
          'Early morning, with the walkers and runners, before the heat and the traffic. Sunday mornings are the liveliest: families, dogs, people doing yoga under the trees.',
      },
    ],
  },
  {
    id: 'kasturba_road',
    name: 'Kasturba Road',
    aliases: ['museum', 'museums', 'visvesvaraya museum', 'chinnaswamy', 'stadium', 'cricket'],
    anchor: 'kasturba_road',
    radius: 330,
    metro: 'cubbon_metro',
    blurb:
      'The museum road along the edge of Cubbon Park, with the cricket stadium at its top end.',
    topics: [
      {
        id: 'museums',
        question: 'Which museums are here?',
        keywords: [
          'museum',
          'museums',
          'gallery',
          'art',
          'science',
          'visvesvaraya',
          'see',
          'visit',
        ],
        answer:
          'Three in a row: the Visvesvaraya Industrial and Technological Museum (the science one, full of things to press and crank), the Government Museum, which dates from 1865 and is one of the oldest in the country, and the Venkatappa Art Gallery.',
      },
      {
        id: 'stadium',
        question: 'Is that the cricket stadium?',
        keywords: ['cricket', 'stadium', 'chinnaswamy', 'rcb', 'match', 'ipl'],
        answer:
          'Yes: M. Chinnaswamy Stadium, home of Karnataka cricket and of Royal Challengers Bengaluru. On match days the roads around it close and you can hear the crowd from inside the park.',
      },
      {
        id: 'name',
        question: 'Who is the road named for?',
        keywords: ['name', 'named', 'who', 'kasturba'],
        answer:
          'Kasturba Gandhi, who was married to Mahatma Gandhi. His road, MG Road, starts where hers ends.',
      },
    ],
  },
  {
    id: 'ub_city',
    name: 'Vittal Mallya Road',
    aliases: ['ub city', 'lavelle road', 'mallya road'],
    anchor: 'ub_city',
    radius: 280,
    blurb: 'The expensive end of town: glass towers, luxury shops and valet parking.',
    topics: [
      {
        id: 'what',
        question: 'What are these towers?',
        keywords: ['what', 'tower', 'towers', 'ub', 'city', 'mall', 'building', 'shopping'],
        answer:
          'UB City, a luxury mall and office complex that opened in 2008 on land that belonged to the United Breweries group. It is where the city comes to look at watches it is not going to buy.',
      },
      {
        id: 'eat',
        question: 'Anything to eat that is not expensive?',
        keywords: ['eat', 'food', 'cheap', 'coffee', 'lunch', 'hungry'],
        answer:
          'Not on this road. Walk ten minutes towards Kasturba Road or Hudson Circle and you are back among darshinis and ordinary prices.',
      },
    ],
  },
  {
    id: 'mg_road',
    name: 'MG Road',
    aliases: ['mahatma gandhi road', 'm g road', 'south parade', 'office'],
    anchor: 'mg_road_metro',
    radius: 380,
    metro: 'mg_road_metro',
    blurb: 'Mahatma Gandhi Road: offices, shops and the metro running overhead down the middle.',
    topics: [
      {
        id: 'history',
        question: 'What was MG Road before?',
        keywords: [
          'history',
          'before',
          'old',
          'name',
          'named',
          'south',
          'parade',
          'british',
          'cantonment',
        ],
        answer:
          'South Parade. This was the main street of the British Cantonment, a separate town from the old city around the market. It was renamed for Mahatma Gandhi after independence.',
      },
      {
        id: 'metro',
        question: 'Tell me about the metro here.',
        keywords: ['metro', 'train', 'station', 'purple', 'line', 'namma', 'viaduct'],
        answer:
          'The first stretch of Namma Metro opened in October 2011 and ended right here, at MG Road station. The Purple Line now runs on across the city; Majestic is a few stops west. The promenade under the viaduct is a good place to walk.',
      },
      {
        id: 'do',
        question: 'What is there to do around here?',
        keywords: ['do', 'see', 'visit', 'shopping', 'shop', 'evening', 'eat', 'food', 'coffee'],
        answer:
          'Church Street, one lane south, for books, coffee and people-watching. Brigade Road for shops. Commercial Street, further north, for serious bargaining. In the evening the whole area is on foot.',
      },
    ],
  },
  {
    id: 'church_street',
    name: 'Church Street',
    aliases: ['church st', 'bookshops', 'st marks road'],
    anchor: 'church_street',
    radius: 240,
    metro: 'mg_road_metro',
    blurb: 'A cobbled street of bookshops, cafes and pubs, one lane south of MG Road.',
    topics: [
      {
        id: 'name',
        question: 'Which church is it named for?',
        keywords: ['church', 'name', 'named', 'which', 'cathedral', 'why'],
        answer: 'St. Mark’s Cathedral, at the western end of the street, on MG Road.',
      },
      {
        id: 'books',
        question: 'Where are the bookshops?',
        keywords: [
          'book',
          'books',
          'bookshop',
          'bookshops',
          'read',
          'blossom',
          'bookworm',
          'second',
        ],
        answer:
          'All along it. Blossom Book House and Bookworm are the famous ones: several floors each, new and second-hand, stacked to the ceiling. Imran, who sells books here, will have opinions.',
      },
      {
        id: 'coffee',
        question: 'Where is good for coffee?',
        keywords: ['coffee', 'eat', 'food', 'cafe', 'koshy', 'koshys', 'breakfast'],
        answer:
          'Indian Coffee House on this street, for filter coffee served by waiters in turbans. Koshy’s, around the corner on St. Mark’s Road, has been the meeting place for the city’s writers and lawyers for decades.',
      },
      {
        id: 'street',
        question: 'Why does the road look different?',
        keywords: [
          'road',
          'cobble',
          'cobblestone',
          'footpath',
          'look',
          'different',
          'walk',
          'pedestrian',
        ],
        answer:
          'It was rebuilt a few years ago with cobblestones and wide footpaths, and on some weekends it is closed to traffic altogether. It is one of the few streets in the centre designed for walking.',
      },
    ],
  },
  {
    id: 'brigade_road',
    name: 'Brigade Road',
    aliases: ['brigade'],
    anchor: 'brigade_road',
    radius: 240,
    metro: 'mg_road_metro',
    blurb: 'A sloping shopping street running south from MG Road.',
    topics: [
      {
        id: 'what',
        question: 'What is Brigade Road known for?',
        keywords: [
          'what',
          'known',
          'famous',
          'shopping',
          'shop',
          'new',
          'year',
          'crowd',
          'evening',
        ],
        answer:
          'Shopping, and New Year’s Eve. On the 31st of December the whole road fills with people, shoulder to shoulder, and the police close it to traffic. On an ordinary evening it is clothes, shoes, arcades and neon.',
      },
    ],
  },
  {
    id: 'commercial_street',
    name: 'Commercial Street',
    aliases: ['comm street', 'shivajinagar'],
    anchor: 'commercial_street',
    radius: 280,
    blurb:
      'The old Cantonment bazaar in Shivajinagar: clothes, jewellery and tailors, and lanes off it for everything else.',
    topics: [
      {
        id: 'what',
        question: 'What do people come here for?',
        keywords: [
          'what',
          'shopping',
          'shop',
          'buy',
          'clothes',
          'bargain',
          'tailor',
          'known',
          'famous',
        ],
        answer:
          'Clothes, fabric, jewellery and footwear, in shops that have been here for generations. The side lanes specialise: one for bangles, one for tailors, one for bags. Bargaining is expected off the main street.',
      },
    ],
  },
  {
    id: 'trinity',
    name: 'Trinity Circle',
    aliases: ['trinity', 'trinity church'],
    anchor: 'trinity',
    radius: 300,
    metro: 'trinity',
    blurb: 'The eastern end of MG Road, where the road forks towards Ulsoor and Old Airport Road.',
    topics: [
      {
        id: 'name',
        question: 'Why Trinity?',
        keywords: ['why', 'name', 'named', 'trinity', 'church'],
        answer:
          'For Holy Trinity Church on the junction, built in 1851 for the British garrison. It stands at the opposite end of MG Road from St. Mark’s Cathedral, like a pair of bookends.',
      },
    ],
  },
];

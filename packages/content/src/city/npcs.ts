import type { Condition, NpcScript } from '@blr/engine';

/**
 * The people of the Majestic to MG Road chapter. All of them are invented.
 * They speak the way the city does: English with Kannada folded in.
 *
 * Facts they read and write (see CityMemory.facts):
 *   player.kannada     times the player has tried speaking Kannada
 *   commute.mode       how the player last travelled: metro | bus | auto | self
 *   auto.borrowed      the player has driven off in someone's parked auto
 *   manju.rapport      -3..3, what Manju thinks of the player's haggling
 *   manju.knowsJob     Manju has been told about the MG Road job
 *   saleem.rapport     -3..3, the same for Saleem
 *   shantha.usual      "dosa" | "idli", the order Shanthakka remembers
 *   shantha.jasmine    the player brought her jasmine; coffee is free
 *   coffee.delivered   the flask reached Constable Ravi hot
 *   karthik.told       "right" | "wrong", the directions the player gave
 *   karthik.thanked    Karthik has paid back the favour
 *   karthik.forgiven   Karthik has forgiven the Whitefield business
 *   karthik.grudge     the player doubled down instead of apologising
 */
export interface NpcLook {
  shirt: string;
  trousers: string;
  skin: string;
  hair: string;
  /** Cap colour, for uniformed characters. */
  cap?: string;
}

export interface NpcDef extends NpcScript {
  role: string;
  /** One line shown under the name the first time the player meets them. */
  tagline: string;
  /** Optional video in apps/game/public (e.g. "intros/manju.mp4") played instead of the in-engine intro. */
  introVideo?: string;
  /** Where the character stands: the first entry whose condition holds. */
  places: readonly { when?: Condition; anchor: string }[];
  /** Metres east and south of the anchor, so people sharing a spot do not overlap. */
  offset: readonly [number, number];
  look: NpcLook;
}

const manju: NpcDef = {
  id: 'manju',
  name: 'Manju',
  role: 'Auto driver',
  tagline: 'Twenty-two years at the Majestic stand. The meter has never once worked.',
  places: [{ anchor: 'majestic_auto' }],
  offset: [2.6, 0.8],
  look: { shirt: '#b89a5e', trousers: '#8a744a', skin: '#8d5a3b', hair: '#1c1714' },
  root: 'root',
  haggle: {
    rapportFact: 'manju.rapport',
    open: [
      {
        when: { fact: 'manju.rapport', atLeast: 2 },
        text: '{place} ge? Nimge special rate, guru: ₹{ask}. Bere yaarigu helbedi.',
      },
      {
        when: { fact: 'manju.rapport', below: -1 },
        text: '{place}. ₹{ask}. Ivattu argue maadoke time illa nange.',
      },
      { text: '{place}-aa? ₹{ask} aagutte, saar.' },
    ],
    rain: 'Male nodi! Rain time one-and-half, idu ellarigu gotthu.',
    night: 'Night time, saar. One-and-half aagutte.',
    peak: 'Peak hour, full traffic. Return empty barbeku naanu.',
    counter: 'Ayyo! Petrol rate gottha nimge? Sari, last price: ₹{ask}. Swalpa adjust maadi.',
    dealHappy: 'Super, saar! Kootkolli. ₹{fare}, no tension. Hold tight.',
    dealFine: 'Sari, ₹{fare}. Banni, kootkolli.',
    dealGrumbling:
      '₹{fare}… ella customer nimma haage idre naanu auto maari mane ge hogbeku. Banni, banni.',
    refused: 'Barolla, saar. Bere auto nodi.',
    broke: 'Modalu purse nodi, saar. ₹{fare} nimhatra illa.',
  },
  nodes: {
    root: {
      say: [
        {
          when: { all: [{ mission: 'first_day', is: 'active' }, { met: 'before' }] },
          text: 'Office-aa? Banni banni, nine o’clock olage reach maadsthini. Traffic mele depend, saar.',
        },
        {
          when: { mission: 'night_bus', is: 'active' },
          text: 'Ee male alli? Yelli hogbeku? Bega heli, saar.',
        },
        {
          when: { fact: 'manju.rapport', atLeast: 2 },
          text: 'Ayyo, namma regular customer! Banni guru. Ivattu yelli hogbeku?',
        },
        {
          when: { fact: 'manju.rapport', below: -1 },
          text: 'Neeve-na? Last time hattu rupayi ge ardha ghante argue maadidri. Heli, yenu beku?',
        },
        { when: { raining: true }, text: 'Male bartide, saar! Auto beka? Bega heli, yelli?' },
        { when: { met: 'before' }, text: 'Matte sikkidri! Yelli hogbeku, saar?' },
        { text: 'Banni saar, banni! Auto? Yelli hogbeku?' },
      ],
      choices: [
        { text: 'MG Road.', ride: 'mg_road_auto' },
        { text: 'KR Market.', ride: 'kr_market' },
        { text: 'Vidhana Soudha.', ride: 'vidhana_soudha' },
        {
          text: 'Meter haaki, anna. (Put the meter on.)',
          to: 'meter',
          effects: [{ add: 'player.kannada', by: 1 }],
        },
        { text: 'Just looking around. What is your name?', when: { met: 'never' }, to: 'name' },
        { text: 'How is business, Manju?', when: { met: 'before' }, to: 'business' },
        { text: 'Nothing, boss. Carry on.' },
      ],
    },
    meter: {
      say: [
        {
          when: { fact: 'player.kannada', atLeast: 3 },
          text: 'Kannada chennagi bartide nimge! Aadre meter… meter ide, saar, aadre meter ge traffic gottilla. Meter mele twenty. Nimge maatra.',
        },
        {
          text: 'Meter-aa? (He laughs.) Meter ide, saar. Aadre meter ge traffic gottilla. Meter mele twenty, final.',
        },
      ],
      choices: [
        { text: 'Okay, okay. MG Road?', ride: 'mg_road_auto' },
        { text: 'KR Market, then.', ride: 'kr_market' },
        { text: 'Forget it, I will walk.' },
      ],
    },
    name: {
      say: [
        {
          text: 'Manjunath, saar. Ellaru Manju antaare. Twenty-two years ee stand alli. Nimdu yaava ooru? Bengaluru ge new aa?',
        },
      ],
      choices: [
        {
          text: 'First week. New job on MG Road.',
          to: 'job',
          effects: [{ set: 'manju.knowsJob', to: true }],
        },
        { text: 'Just passing through.', to: 'passing' },
      ],
    },
    job: {
      say: [
        {
          text: 'MG Road-aa! Olle jaaga. Daily bartira? Monthly rate maadbahudu, guru. Beligge eight-thirty ge illi iri, naan iruthini.',
        },
      ],
      effects: [{ note: 'Manju at the Majestic auto stand offered a monthly rate to MG Road.' }],
      choices: [
        { text: 'MG Road, then. How much?', ride: 'mg_road_auto' },
        { text: 'Sigona, Manju.' },
      ],
    },
    passing: {
      say: [
        {
          text: 'Passing through antha ellaru heltaare. Aamele ippattu varsha illi. Bengaluru haage, saar.',
        },
      ],
      choices: [{ text: 'We will see.' }],
    },
    business: {
      say: [
        {
          when: { raining: true },
          text: 'Male bandre business double, traffic triple. Lekka haaki, saar: laabha illa.',
        },
        {
          when: { hours: [8, 10.5] },
          text: 'Ee time alli maathadoke purusottilla, saar. Office crowd. Nine-thirty aadmele banni, coffee kudiyona.',
        },
        {
          when: { hours: [12.5, 15.5] },
          text: 'Madhyahna dull, saar. Oota, swalpa nidde. Sanje matte full busy.',
        },
        {
          when: { fact: 'manju.knowsJob' },
          text: 'Parvagilla. Nimma MG Road office hege ide? Boss thondre kodtidaara?',
        },
        { text: 'Parvagilla, saar. Petrol rate jaasti, customer bargain jaasti. Aadru nadithide.' },
      ],
      choices: [
        { text: 'MG Road. How much?', ride: 'mg_road_auto' },
        { text: 'Hogi barthini, Manju.' },
      ],
    },
  },
};

const saleem: NpcDef = {
  id: 'saleem',
  name: 'Saleem',
  role: 'Auto driver',
  tagline: 'Says one-and-half. Means it.',
  places: [{ anchor: 'mg_road_auto' }],
  offset: [-2.6, 0.8],
  look: { shirt: '#b89a5e', trousers: '#6f6046', skin: '#a26b47', hair: '#2a2420' },
  root: 'root',
  haggle: {
    rapportFact: 'saleem.rapport',
    open: [
      {
        when: { fact: 'saleem.rapport', atLeast: 2 },
        text: '{place}? For you, ₹{ask}, boss. Fixed. No drama today.',
      },
      { text: '{place}. ₹{ask}, boss.' },
    ],
    rain: 'It is raining, boss. Everybody is charging double; I am saying only one-and-half.',
    night: 'Night rate, boss. One-and-half. Board is there, see.',
    peak: 'This time full jam till Majestic. I will come back empty.',
    counter: 'Arre, boss. Gas rate has gone up, traffic has gone up. Okay: ₹{ask}. Last.',
    dealHappy: 'That is how a gentleman does it. ₹{fare}. Sit, sit.',
    dealFine: '₹{fare}. Chalo, sit.',
    dealGrumbling: '₹{fare}. You should be in the vegetable business, boss. Sit.',
    refused: 'Nakko, boss. Find another auto.',
    broke: 'You do not have ₹{fare} on you, boss. Check your pocket first.',
  },
  nodes: {
    root: {
      say: [
        { when: { mission: 'night_bus', is: 'active' }, text: 'In this rain? Where, boss? Fast.' },
        {
          when: { fact: 'saleem.rapport', atLeast: 2 },
          text: 'My good customer! Where today, boss?',
        },
        { when: { met: 'before' }, text: 'Again you. Where, boss?' },
        { text: 'Auto, boss? Where to?' },
      ],
      choices: [
        { text: 'Majestic.', ride: 'majestic_bus' },
        { text: 'KR Market.', ride: 'kr_market' },
        { text: 'Commercial Street.', ride: 'commercial_street' },
        { text: 'Is MG Road always this busy?', to: 'busy' },
        { text: 'Nothing. Carry on.' },
      ],
    },
    busy: {
      say: [
        {
          when: { hours: [21.5, 6] },
          text: 'Now it is quiet. Come back at six in the evening and then ask me.',
        },
        {
          text: 'Always, boss. Offices, shopping, metro crowd. Brigade Road side on a Saturday night you cannot even turn the auto.',
        },
      ],
      choices: [
        { text: 'Majestic, then. How much?', ride: 'majestic_bus' },
        { text: 'Good to know.' },
      ],
    },
  },
};

const shantha: NpcDef = {
  id: 'shantha',
  name: 'Shanthakka',
  role: 'Runs Hotte Thumba Darshini',
  tagline: 'Thirty years behind one counter. Remembers every order.',
  places: [{ anchor: 'kg_road' }],
  offset: [0, 0],
  look: { shirt: '#b3402e', trousers: '#7d2a20', skin: '#9a6444', hair: '#1a1513' },
  root: 'root',
  nodes: {
    root: {
      say: [
        {
          when: { mission: 'bisi_coffee', is: 'active' },
          text: 'Innu illi ideera? Coffee tannagagutte! Hudson Circle, Ravi saar. Bega, bega!',
        },
        {
          when: { all: [{ mission: 'mallige', is: 'active' }, { item: 'jasmine' }] },
          text: 'Aa vasane… mallige tandra?',
        },
        {
          when: { mission: 'mallige', is: 'active' },
          text: 'Mallige sikta? KR Market alli Lakshmi. Nanna hesaru heli.',
        },
        {
          when: { fact: 'shantha.jasmine' },
          text: 'Namma mallige friend bandru! Banni, banni. Coffee nandu, yaavaglu.',
        },
        {
          when: { fact: 'shantha.usual', equals: 'dosa' },
          text: 'Banni! Same aa? Masala dose, strong coffee?',
        },
        {
          when: { fact: 'shantha.usual', equals: 'idli' },
          text: 'Banni! Idli-vade, by-two coffee. Alva?',
        },
        { when: { met: 'before' }, text: 'Matte bandra? Santhosha. Yenu kodli?' },
        {
          when: { hours: [6, 11] },
          text: 'Banni, banni. Tindi aytha? Bisi bisi idli ide, vade ide, masala dose ide.',
        },
        { text: 'Banni. Oota aytha? Yenu kodli? Coffee bisi ide.' },
      ],
      choices: [
        {
          text: 'I got your mallige, Akka.',
          when: { all: [{ mission: 'mallige', is: 'active', step: 'give' }, { item: 'jasmine' }] },
          to: 'jasmine',
        },
        {
          text: 'Same. Masala dose and strong coffee. (₹90)',
          when: { fact: 'shantha.usual', equals: 'dosa' },
          to: 'usual',
          effects: [{ coins: -90 }],
        },
        {
          text: 'Same. Idli-vade and by-two coffee. (₹60)',
          when: { fact: 'shantha.usual', equals: 'idli' },
          to: 'usual',
          effects: [{ coins: -60 }],
        },
        {
          text: 'Masala dose and a strong coffee. (₹90)',
          when: { not: { fact: 'shantha.usual', equals: 'dosa' } },
          to: 'dosa',
          effects: [{ coins: -90 }, { set: 'shantha.usual', to: 'dosa' }],
        },
        {
          text: 'Idli-vade, by-two coffee. (₹60)',
          when: { not: { fact: 'shantha.usual', equals: 'idli' } },
          to: 'idli',
          effects: [{ coins: -60 }, { set: 'shantha.usual', to: 'idli' }],
        },
        {
          text: 'Just a coffee. (₹20)',
          when: { not: { fact: 'shantha.jasmine' } },
          to: 'coffee',
          effects: [{ coins: -20 }],
        },
        { text: 'Just a coffee, Akka.', when: { fact: 'shantha.jasmine' }, to: 'coffee' },
        {
          text: 'Any work going, Akka?',
          when: { all: [{ mission: 'bisi_coffee', is: 'none' }, { met: 'before' }] },
          to: 'flask',
        },
        {
          text: 'One more flask for Ravi saar?',
          when: { mission: 'bisi_coffee', is: 'failed' },
          to: 'flask',
        },
        {
          text: 'Anything else I can do, Akka?',
          when: { all: [{ fact: 'coffee.delivered' }, { mission: 'mallige', is: 'none' }] },
          to: 'pooja',
        },
        { text: 'What is a darshini, exactly?', when: { met: 'never' }, to: 'about' },
        { text: 'Nothing now. Barthini, Akka.' },
      ],
    },
    dosa: {
      say: [
        {
          text: 'Tagolli. Dose crisp ide, chutney ivattu beligge maadiddu. Coffee strong, sakkare kammi: nimma mukha nodidre gotthagutte.',
        },
      ],
      choices: [
        { text: 'Sakkath, Akka.', effects: [{ add: 'player.kannada', by: 1 }] },
        { text: 'What is a darshini, exactly?', to: 'about' },
      ],
    },
    idli: {
      say: [
        {
          text: 'Tagolli. Idli mallige thara soft. Vade bisi. By-two coffee: ardha nimge, ardha yaarigo. Ivattu yaaru illa, full neeve kudiri.',
        },
      ],
      choices: [
        { text: 'Sakkath, Akka.', effects: [{ add: 'player.kannada', by: 1 }] },
        { text: 'What is a darshini, exactly?', to: 'about' },
      ],
    },
    usual: {
      say: [
        {
          when: { fact: 'coffee.delivered' },
          text: 'Nimma order nange baayi paatha. Ravi saar ge coffee kottavru neeve, alva? Tagolli, extra chutney.',
        },
        { text: 'Heloke munche ready. Nimma order nange baayi paatha (by heart). Tagolli.' },
      ],
      choices: [{ text: 'You remembered. Thanks, Akka.' }],
    },
    coffee: {
      say: [
        {
          when: { fact: 'shantha.jasmine' },
          text: 'Nimge coffee free anta helidde, nenapide. Tagolli. Bisi ide, nidhana.',
        },
        { text: 'Filter coffee. Davara alli aarisi kudiri. Bisi ide, nidhana.' },
      ],
      choices: [{ text: 'That is proper coffee.' }],
    },
    about: {
      say: [
        {
          text: 'Darshini andre fast. Token togolli, nintkondu tinni, hogi. AC illa, menu card illa, tips illa. Mooru varsha alla, mooru dashaka inda ee counter nandu.',
        },
      ],
      choices: [{ text: 'Thirty years. Respect, Akka.' }],
    },
    flask: {
      say: [
        {
          when: { mission: 'bisi_coffee', is: 'failed' },
          text: 'Hmm. Innondu flask maadthini. Ee sala tannag aagbardu. Hudson Circle, Constable Ravi. Twenty minutes. Odi!',
        },
        {
          text: 'Ondu help beku. Hudson Circle alli Constable Ravi, namma regular. Duty bittu baroke aagalla avarige. Ee flask kodbeku, bisi iruvaga. Twenty minutes olage. Maadthira?',
        },
      ],
      choices: [
        {
          text: 'Kodi, Akka. I will run.',
          to: 'go',
          effects: [{ give: 'flask' }, { start: 'bisi_coffee' }],
        },
        { text: 'Not right now.' },
      ],
    },
    go: {
      say: [
        {
          text: 'Bega! Nadkond hodre tannag aagutte: odi, illa auto hidiri. Tannag aadre Ravi saar nanna mele complaint baritaare.',
        },
      ],
      choices: [{ text: 'On it.' }],
    },
    pooja: {
      say: [
        {
          text: 'Ravi saar phone maadidru: coffee bisi ittu anta. Olle kelsa. Innondu: sanje pooje ge mallige beku. KR Market alli Lakshmi anta idaale, nanna hesaru heli. Ondu mola tanni.',
        },
      ],
      choices: [
        { text: 'One mola of mallige. Done.', effects: [{ start: 'mallige' }] },
        { text: 'Another day, Akka.' },
      ],
    },
    jasmine: {
      say: [
        {
          text: 'Aha, yenu vasane! Lakshmi olle hoovu kottidaale. Idu togolli. Mattu innu mele nimge illi coffee free. Illa anbedi.',
        },
      ],
      effects: [
        { take: 'jasmine' },
        { set: 'shantha.jasmine', to: true },
        { event: 'gave_jasmine' },
        { note: 'Coffee at Hotte Thumba Darshini is free for you now.' },
      ],
      choices: [{ text: 'Free coffee for life? Deal, Akka.' }],
    },
  },
};

const ravi: NpcDef = {
  id: 'ravi',
  name: 'Constable Ravi',
  role: 'Traffic police',
  tagline: 'One man, one whistle, four roads of traffic.',
  places: [{ anchor: 'hudson_circle' }],
  offset: [0, 0],
  look: { shirt: '#f1efe9', trousers: '#9a8257', skin: '#7f5237', hair: '#15110f', cap: '#9a8257' },
  root: 'root',
  nodes: {
    root: {
      say: [
        {
          when: { all: [{ mission: 'bisi_coffee', is: 'active' }, { item: 'flask' }] },
          text: 'Aa flask… Shanthakka kalsidra?',
        },
        {
          when: { fact: 'auto.borrowed' },
          text: 'Aa auto nimdu alla anta nange gotthu. Owner complaint kotre kathe bere. Tegedukonda jaaga alle vaapas idi. Sari na?',
        },
        {
          when: { any: [{ hours: [8, 10.5] }, { hours: [17.5, 20.5] }] },
          text: 'Signal nodi, signal! … Oh. Heli, yenu beku? Peak hour, bega.',
        },
        { when: { met: 'before' }, text: 'Matte neeve. Yenu samachara?' },
        { text: 'Namaskara. Traffic police, Hudson Circle. Daari beka?' },
      ],
      choices: [
        {
          text: 'Coffee from Shanthakka. Still hot.',
          when: { all: [{ mission: 'bisi_coffee', is: 'active' }, { item: 'flask' }] },
          to: 'coffee',
        },
        { text: 'How bad is the traffic right now?', to: 'traffic' },
        { text: 'Why is it called Hudson Circle?', to: 'name' },
        { text: 'Carry on, sir.' },
      ],
    },
    coffee: {
      say: [
        {
          text: 'Shanthakka coffee! Bisi ide… aaha. Duty alli idu ondhe sukha. Avarige thanks heli. Neevu olle jana.',
        },
      ],
      effects: [
        { take: 'flask' },
        { set: 'coffee.delivered', to: true },
        { event: 'coffee_delivered' },
      ],
      choices: [{ text: 'I will tell her.' }],
    },
    traffic: {
      say: [
        {
          when: { all: [{ raining: true }, { hours: [17, 21] }] },
          text: 'Male plus sanje peak. Mugitu. Ondu kilometre ge ardha ghante. Metro togolli, illa andre chatri hidkond nadkond hogi.',
        },
        {
          when: { hours: [8, 10.5] },
          text: 'Ella office time. Hudson Circle, KG Road, Kasturba Road: full jam. Metro togolli. Auto alli kootre meter odutte, auto odalla.',
        },
        {
          when: { hours: [17.5, 20.5] },
          text: 'Sanje peak. Beligge gintha jaasti. Ellaru ondhe time ge mane ge hogbeku antaare.',
        },
        {
          when: { hours: [22, 6] },
          text: 'Iga khaali. Ee road ishtu agala ide anta raatri maatra gotthagutte.',
        },
        { text: 'Iga parvagilla, free ide. Peak hour alli banni, aaga nodi ee circle na.' },
      ],
      choices: [{ text: 'Thanks for the warning.' }],
    },
    name: {
      say: [
        {
          text: 'Aa corner alli church nodi: Hudson Memorial Church. Adakke Hudson Circle. Pakkadalli Corporation office ide, adakke Corporation Circle antaanu heltaare. Eradu sari.',
        },
      ],
      choices: [{ text: 'Two names, one jam.' }],
    },
  },
};

const karthik: NpcDef = {
  id: 'karthik',
  name: 'Karthik',
  role: 'New in town',
  tagline: 'Arrived from Hubballi this morning. Already lost.',
  places: [{ when: { fact: 'karthik.told' }, anchor: 'church_street' }, { anchor: 'majestic_bus' }],
  offset: [3.2, -1.8],
  look: { shirt: '#3d6fb3', trousers: '#2b2f3a', skin: '#96603f', hair: '#17120f' },
  root: 'root',
  nodes: {
    root: {
      say: [
        {
          when: { mission: 'night_bus', is: 'active' },
          text: 'Why are we standing? Seven o’clock, Majestic! Metro, auto, anything. You decide, I follow.',
        },
        {
          when: { mission: 'night_bus', is: 'done' },
          text: 'Reached Hubballi fine. Next time you come north, benne dose is on me.',
        },
        {
          when: {
            all: [{ fact: 'karthik.told', equals: 'right' }, { not: { fact: 'karthik.thanked' } }],
          },
          text: 'Guru! Majestic! Remember me? Green Line, RV Road, Yellow Line, exactly like you said. Reached with forty minutes to spare. I got the offer!',
        },
        {
          when: {
            all: [
              { fact: 'karthik.told', equals: 'wrong' },
              { not: { fact: 'karthik.forgiven' } },
              { not: { fact: 'karthik.grudge' } },
            ],
          },
          text: 'You. Majestic. “Any bus that says Whitefield.” Do you know where Whitefield is? It is the other side of the city! Two hours in traffic. I reached Silk Board at one o’clock.',
        },
        {
          when: { fact: 'karthik.grudge' },
          text: '(He sees you, checks the map on his phone very deliberately, and says nothing.)',
        },
        {
          when: { mission: 'night_bus', is: 'failed' },
          text: 'Missed it. My fault for leaving late. There is another bus tomorrow… unless you want to try once more?',
        },
        {
          when: { fact: 'karthik.told' },
          text: 'My Majestic friend! Yenu samachara? See, I am learning.',
        },
        {
          when: { mission: 'right_train', is: 'active', step: 'ask' },
          text: 'Any luck? That conductor near the platforms will know.',
        },
        {
          when: { mission: 'right_train', is: 'active' },
          text: 'You are back! Tell me you found out.',
        },
        {
          text: 'Excuse me! Boss, one help. I came from Hubballi this morning, interview near Silk Board at eleven. Everybody here tells a different thing. Which way is Silk Board?',
        },
      ],
      choices: [
        {
          text: 'Metro. Green Line to RV Road, change to the Yellow Line, get down at Central Silk Board.',
          when: {
            all: [{ not: { fact: 'karthik.told' } }, { mission: 'right_train', is: 'none' }],
          },
          to: 'right',
          effects: [{ set: 'karthik.told', to: 'right' }],
        },
        {
          text: 'Just take any bus that says Whitefield.',
          when: {
            all: [{ not: { fact: 'karthik.told' } }, { mission: 'right_train', is: 'none' }],
          },
          to: 'wrong',
          effects: [{ set: 'karthik.told', to: 'wrong' }],
        },
        {
          text: 'No idea, I am new here too. Let me ask someone.',
          when: {
            all: [{ not: { fact: 'karthik.told' } }, { mission: 'right_train', is: 'none' }],
          },
          to: 'wait',
          effects: [{ start: 'right_train' }],
        },
        {
          text: 'Conductor says: Green Line to RV Road, change to Yellow, get down at Central Silk Board.',
          when: { mission: 'right_train', is: 'active', step: 'tell' },
          to: 'right',
          effects: [{ set: 'karthik.told', to: 'right' }, { event: 'told_karthik' }],
        },
        {
          text: 'Congratulations, Karthik!',
          when: {
            all: [{ fact: 'karthik.told', equals: 'right' }, { not: { fact: 'karthik.thanked' } }],
          },
          to: 'treat',
        },
        {
          text: 'I am so sorry. Coffee on me? (₹40)',
          when: {
            all: [
              { fact: 'karthik.told', equals: 'wrong' },
              { not: { fact: 'karthik.forgiven' } },
              { not: { fact: 'karthik.grudge' } },
            ],
          },
          to: 'forgiven',
          effects: [{ coins: -40 }, { set: 'karthik.forgiven', to: true }],
        },
        {
          text: 'In my defence, the bus did say Whitefield.',
          when: {
            all: [
              { fact: 'karthik.told', equals: 'wrong' },
              { not: { fact: 'karthik.forgiven' } },
              { not: { fact: 'karthik.grudge' } },
            ],
          },
          to: 'grudge',
          effects: [{ set: 'karthik.grudge', to: true }],
        },
        {
          text: 'Okay, okay. I am sorry about Whitefield. (₹40 coffee)',
          when: { fact: 'karthik.grudge' },
          to: 'forgiven',
          effects: [
            { coins: -40 },
            { set: 'karthik.forgiven', to: true },
            { set: 'karthik.grudge', to: false },
          ],
        },
        {
          text: 'When is your bus home?',
          when: {
            all: [
              { any: [{ fact: 'karthik.thanked' }, { fact: 'karthik.forgiven' }] },
              {
                any: [
                  { mission: 'night_bus', is: 'none' },
                  { mission: 'night_bus', is: 'failed' },
                ],
              },
            ],
          },
          to: 'bus',
        },
        { text: 'Good luck, Karthik.' },
      ],
    },
    right: {
      say: [
        {
          text: 'Green Line, RV Road, change, Yellow Line, Central Silk Board. Got it! Thank you, guru. If I get this job, the treat is on me.',
        },
      ],
      effects: [{ note: 'You sent Karthik to Silk Board by metro: Green Line, then Yellow.' }],
      choices: [{ text: 'All the best!' }],
    },
    wrong: {
      say: [{ text: 'Whitefield bus. Okay, simple! Thanks, boss!' }],
      effects: [{ note: 'You told Karthik to take “any bus that says Whitefield”. Hm.' }],
      choices: [{ text: '(Say nothing.)' }],
    },
    wait: {
      say: [
        {
          text: 'Please, guru. I will wait here only. Ask that conductor near the platforms, he looks like he knows every bus in Karnataka.',
        },
      ],
      choices: [{ text: 'Two minutes.' }],
    },
    treat: {
      say: [
        {
          text: 'Because of you only. Take this, no, no, take. First salary is not here yet but this much I can do. Church Street has good coffee, I am told.',
        },
      ],
      effects: [
        { coins: 200 },
        { set: 'karthik.thanked', to: true },
        { note: 'Karthik got the job near Silk Board and paid you back.' },
      ],
      choices: [{ text: 'When is your bus home?', to: 'bus' }, { text: 'Well done, guru.' }],
    },
    forgiven: {
      say: [
        {
          text: '…Fine. They moved the interview to tomorrow, so I am alive. But I am taking the metro, and I am asking somebody else for the route.',
        },
      ],
      choices: [{ text: 'When is your bus home?', to: 'bus' }, { text: 'Fair.' }],
    },
    grudge: {
      say: [{ text: '(He stares at you for a long time.)' }],
      choices: [{ text: '(Back away slowly.)' }],
    },
    bus: {
      say: [
        {
          text: 'Seven o’clock from Majestic, and look at that sky. If it rains, the whole city stops. You know the way now; I only know Silk Board. Come with me?',
        },
      ],
      choices: [
        { text: 'Let’s go. Stay close.', effects: [{ start: 'night_bus' }] },
        { text: 'You will manage. Take the metro.' },
      ],
    },
  },
};

const basava: NpcDef = {
  id: 'basava',
  name: 'Basavaraj',
  role: 'BMTC conductor',
  tagline: 'Knows every bus in Karnataka. Has change for none of them.',
  places: [{ anchor: 'majestic_bus' }],
  offset: [-3.4, 1.6],
  look: { shirt: '#a88d58', trousers: '#8f7748', skin: '#84563a', hair: '#201a16', cap: '#8f7748' },
  root: 'root',
  nodes: {
    root: {
      say: [
        { when: { met: 'before' }, text: 'Matte neeve. Yaava bus beku?' },
        { text: 'Ticket, ticket! … Oh, neevu bus alli illa. Heli, yelli hogbeku?' },
      ],
      choices: [
        {
          text: 'How does someone get to Silk Board from here?',
          when: { mission: 'right_train', is: 'active', step: 'ask' },
          to: 'silk',
        },
        { text: 'Which bus goes to MG Road?', to: 'mg' },
        { text: 'And KR Market?', to: 'market' },
        { text: 'Any advice for a new passenger?', to: 'advice' },
        { text: 'Nothing. Thanks, sir.' },
      ],
    },
    silk: {
      say: [
        {
          text: 'Silk Board-aa? Bus alli hodre traffic alle mudukaragthira. Metro togolli: Green Line, RV Road alli iliri, Yellow Line hatti, Central Silk Board. Bus gintha bega.',
        },
      ],
      effects: [
        { event: 'asked_conductor' },
        { note: 'Silk Board from Majestic: Green Line to RV Road, then the Yellow Line.' },
      ],
      choices: [{ text: 'Green, RV Road, Yellow. Got it.' }],
    },
    mg: {
      say: [
        {
          text: 'MG Road board iro bus nodi, illinda horadutte. Hanneradu nimisha ge ondu. Peak hour alli bus kooda traffic alli nintirutte: metro bega, bus kammi rate.',
        },
      ],
      choices: [{ text: 'Metro fast, bus cheap. Understood.' }],
    },
    market: {
      say: [
        {
          text: 'Market ge hattu nimisha ge ondu bus. Hattira ide, aadre Avenue Road kade nadkond hogbedi: jana, gaadi, ella ondhe road alli.',
        },
      ],
      choices: [{ text: 'Thanks.' }],
    },
    advice: {
      say: [
        {
          text: 'Chillre itkolli. Aidu nooru rupayi note kottu hattu rupayi ticket kelidre nanna BP jaasti aagutte. Mattu “swalpa munde hogi” andre hogi. Ashte.',
        },
      ],
      choices: [{ text: 'Carry change, move forward. Yes, sir.' }],
    },
  },
};

const lakshmi: NpcDef = {
  id: 'lakshmi',
  name: 'Lakshmi',
  role: 'Flower seller',
  tagline: 'Sells jasmine by the forearm. Her forearm.',
  places: [{ anchor: 'kr_market' }],
  offset: [0, 0],
  look: { shirt: '#2f8f6a', trousers: '#c9892b', skin: '#8a5a3c', hair: '#141110' },
  root: 'root',
  nodes: {
    root: {
      say: [
        { when: { met: 'before' }, text: 'Banni, banni. Ivattu yenu? Mallige fresh ide.' },
        { text: 'Hoovu beka? Mallige, sevanthige, gulabi! Fresh, beligge bandiddu.' },
      ],
      choices: [
        {
          text: 'Shanthakka from the darshini sent me. One mola of mallige.',
          when: { mission: 'mallige', is: 'active', step: 'buy' },
          to: 'akka',
        },
        {
          text: 'One mola of mallige. (₹40)',
          when: { not: { mission: 'mallige', is: 'active', step: 'buy' } },
          to: 'sold',
          effects: [{ coins: -40 }, { give: 'jasmine' }],
        },
        { text: 'What is a mola?', to: 'mola' },
        { text: 'Just looking.' },
      ],
    },
    akka: {
      say: [
        {
          text: 'Shanthakka-na? KG Road darshini? Avaru nanna hale customer. Avarige olle maale kodthini. Moovatthu rupayi (thirty).',
        },
      ],
      choices: [
        {
          text: 'Here. (₹30)',
          to: 'sold',
          effects: [{ coins: -30 }, { give: 'jasmine' }, { event: 'bought_jasmine' }],
        },
        { text: 'Twenty?', to: 'haggle' },
        { text: 'I will come back.' },
      ],
    },
    haggle: {
      say: [
        {
          text: 'Twenty-aa? Shanthakka hesaru heli bargain maadthira? … Sari, twenty-five. Avarige helbedi.',
        },
      ],
      choices: [
        {
          text: 'Twenty-five. Done. (₹25)',
          to: 'sold',
          effects: [{ coins: -25 }, { give: 'jasmine' }, { event: 'bought_jasmine' }],
        },
        { text: 'I will come back.' },
      ],
    },
    sold: {
      say: [{ text: 'Togolli. Nidhana hogi: bisilu alli hoovu baadutte.' }],
      choices: [{ text: 'Dhanyavadagalu.', effects: [{ add: 'player.kannada', by: 1 }] }],
    },
    mola: {
      say: [
        {
          text: 'Mola andre ishtu: mola kai inda beralu tudi tanaka (elbow to fingertip). Scale beda, kai saaku. Nanna kai chikkadu anta complaint maadbedi.',
        },
      ],
      choices: [{ text: 'A forearm of flowers. Got it.' }],
    },
  },
};

const imran: NpcDef = {
  id: 'imran',
  name: 'Imran',
  role: 'Bookseller',
  tagline: 'Sells books. Opinions are free.',
  places: [{ anchor: 'church_street' }],
  offset: [-3.4, 1.4],
  look: { shirt: '#e6dcc6', trousers: '#4a4136', skin: '#a8734f', hair: '#3a332d' },
  root: 'root',
  nodes: {
    root: {
      say: [
        { when: { met: 'before' }, text: 'Back again. Readers always come back.' },
        {
          text: 'Looking for something, or just looking? Both are allowed. Second-hand upstairs, new downstairs.',
        },
      ],
      choices: [
        { text: 'Tell me about this street.', to: 'street' },
        { text: 'What should someone new to Bengaluru do first?', to: 'new' },
        { text: 'Just looking.' },
      ],
    },
    street: {
      say: [
        {
          text: 'Church Street. Named for the cathedral at the far end, not for any shortage of pubs. They relaid the whole road in cobblestone a few years ago. Bookshops, coffee, music on the footpath on a good evening. MG Road is one lane over and a different planet.',
        },
      ],
      choices: [{ text: 'A good street to get lost on.' }],
    },
    new: {
      say: [
        {
          text: 'Walk Cubbon Park before eight in the morning. Eat standing up at a darshini. Take the metro once at peak hour so you know why people love it. And learn three words of Kannada: the city gets friendlier by about thirty percent.',
        },
      ],
      choices: [{ text: 'Which three?', to: 'words' }, { text: 'That is a good list.' }],
    },
    words: {
      say: [
        {
          text: '“Namaskara” to start. “Swalpa adjust maadi” for everything in between. “Dhanyavadagalu” to finish. You can run a whole day on those.',
        },
      ],
      choices: [{ text: 'Dhanyavadagalu, Imran.', effects: [{ add: 'player.kannada', by: 1 }] }],
    },
  },
};

const deepa: NpcDef = {
  id: 'deepa',
  name: 'Deepa',
  role: 'Your team lead',
  tagline: 'Your team lead. Nine o’clock means nine o’clock.',
  places: [{ anchor: 'mg_road_metro' }],
  offset: [2.4, 2.2],
  look: { shirt: '#6a4fa3', trousers: '#2e2a3a', skin: '#9c6848', hair: '#120f0e' },
  root: 'root',
  nodes: {
    root: {
      say: [
        {
          when: {
            all: [
              { mission: 'first_day', is: 'done' },
              { fact: 'commute.mode', equals: 'metro' },
            ],
          },
          text: 'On time, and not even sweating. Metro? Smart. Half the team still has not figured that out.',
        },
        {
          when: {
            all: [
              { mission: 'first_day', is: 'done' },
              { fact: 'commute.mode', equals: 'auto' },
            ],
          },
          text: 'You came by auto from Majestic at peak hour and still made it? How much did he take from you? No, do not tell me.',
        },
        {
          when: {
            all: [
              { mission: 'first_day', is: 'done' },
              { fact: 'commute.mode', equals: 'self' },
            ],
          },
          text: 'You are on time. I am not going to ask whose auto that is outside. I am really not.',
        },
        {
          when: {
            all: [
              { mission: 'first_day', is: 'done' },
              { fact: 'commute.mode', equals: 'bus' },
            ],
          },
          text: 'On time, by BMTC, at peak hour. Either you are lucky or you left yesterday. Welcome.',
        },
        {
          when: { mission: 'first_day', is: 'done' },
          text: 'On time on day one. Welcome to the team.',
        },
        {
          when: { mission: 'first_day', is: 'failed' },
          text: 'In Bengaluru we call ten minutes late “on time”. Not on your first day, though. Tomorrow, nine sharp.',
        },
        {
          when: { mission: 'first_day', is: 'active' },
          text: 'You are the new joinee? You made it. Go on in.',
        },
        {
          text: 'You must be the new joinee. Day one is nine o’clock sharp, from wherever you are staying. Do not let Majestic swallow you.',
        },
      ],
      choices: [{ text: 'Any tips for the commute?', to: 'tips' }, { text: 'See you inside.' }],
    },
    tips: {
      say: [
        {
          when: { raining: true },
          text: 'In the rain? Metro. Always metro. The autos double their price and the roads halve their speed.',
        },
        {
          text: 'Before ten and after five-thirty, the metro wins. In between, an auto is fine if you agree the fare first. And never trust “two minutes away”.',
        },
      ],
      choices: [{ text: 'Noted.' }],
    },
  },
};

export const NPCS: readonly NpcDef[] = [
  manju,
  karthik,
  basava,
  shantha,
  ravi,
  lakshmi,
  saleem,
  imran,
  deepa,
];

export const NPCS_BY_ID: Readonly<Record<string, NpcDef>> = Object.fromEntries(
  NPCS.map((npc) => [npc.id, npc]),
);

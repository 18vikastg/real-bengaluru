import type { MissionDef } from '@blr/engine';

/**
 * Missions for the Majestic to MG Road chapter. Each is built from real
 * places; how the player gets between them is up to them.
 */
export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'first_day',
    title: 'First day, 9 AM',
    giver: 'Your new job',
    brief:
      'You got off the overnight bus at Majestic at ten past eight. Your first day at the office on MG Road starts at nine sharp. Auto, bus, metro or a borrowed auto: your call.',
    steps: [
      {
        id: 'office',
        text: 'Reach the office by MG Road metro before 9:00',
        goal: { kind: 'reach', anchor: 'mg_road_metro', radius: 40 },
      },
    ],
    reward: 150,
    startHour: 8 + 10 / 60,
    minutes: 50,
    open: true,
    successText: 'In the door before nine. Deepa is at the entrance; go and say hello.',
    failText: 'Nine o’clock came and went. Deepa noticed. Try again from the mission list.',
  },
  {
    id: 'right_train',
    title: 'Which train, guru?',
    giver: 'Karthik',
    brief:
      'Karthik has an interview near Silk Board and no idea how to get there. Neither do you. Someone at the bus stand must know.',
    steps: [
      {
        id: 'ask',
        text: 'Ask Conductor Basavaraj how to reach Silk Board',
        goal: { kind: 'event', name: 'asked_conductor' },
        marker: 'majestic_bus',
      },
      {
        id: 'tell',
        text: 'Go back and tell Karthik',
        goal: { kind: 'event', name: 'told_karthik' },
        marker: 'majestic_bus',
      },
    ],
    reward: 50,
    successText: 'Karthik is on his way, with the right directions.',
    failText: 'Karthik gave up waiting.',
  },
  {
    id: 'bisi_coffee',
    title: 'Bisi bisi',
    giver: 'Shanthakka',
    brief:
      'A flask of filter coffee for Constable Ravi on duty at Hudson Circle. It has to get there while it is still hot.',
    steps: [
      {
        id: 'deliver',
        text: 'Hand the flask to Constable Ravi at Hudson Circle',
        goal: { kind: 'event', name: 'coffee_delivered' },
        marker: 'hudson_circle',
      },
    ],
    reward: 80,
    minutes: 22,
    successText: 'Delivered hot. Shanthakka will hear about it.',
    failText: 'The coffee went cold. Shanthakka will make another flask if you ask.',
  },
  {
    id: 'mallige',
    title: 'Mallige for Akka',
    giver: 'Shanthakka',
    brief:
      'Shanthakka wants a mola of jasmine from KR Market for the evening pooja. Ask for Lakshmi and mention her name.',
    steps: [
      {
        id: 'buy',
        text: 'Buy jasmine from Lakshmi at KR Market',
        goal: { kind: 'event', name: 'bought_jasmine' },
        marker: 'kr_market',
      },
      {
        id: 'give',
        text: 'Bring it back to Shanthakka on KG Road',
        goal: { kind: 'event', name: 'gave_jasmine' },
        marker: 'kg_road',
      },
    ],
    reward: 60,
    successText: 'The darshini smells of jasmine, and your coffee there is free from now on.',
    failText: 'The flowers wilted.',
  },
  {
    id: 'night_bus',
    title: 'The seven o’clock bus',
    giver: 'Karthik',
    brief:
      'Karthik’s bus home to Hubballi leaves Majestic at seven. It is quarter past six, it is raining, and it is peak hour. Get him there.',
    steps: [
      {
        id: 'majestic',
        text: 'Get to the Majestic bus stand before 7:00',
        goal: { kind: 'reach', anchor: 'majestic_bus', radius: 45 },
      },
    ],
    reward: 200,
    startHour: 18.25,
    minutes: 45,
    rain: true,
    successText: 'Karthik is on the bus, waving through a wet window.',
    failText: 'The bus left without him. He will take tomorrow’s.',
  },
];

export const MISSIONS_BY_ID: Readonly<Record<string, MissionDef>> = Object.fromEntries(
  MISSIONS.map((mission) => [mission.id, mission]),
);

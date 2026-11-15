import { NPCS_BY_ID, STATIONS } from '@blr/content';
import type { TransitTrip } from '@blr/engine';
import { formatClock, formatMinutes, planTrip } from '@blr/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRadio } from '../../audio/radio';
import { MISSIONS, PLACE_NAMES, useCity } from '../../state/city';
import { useUi } from '../../state/ui';

const ITEM_NAMES: Readonly<Record<string, string>> = {
  flask: 'Flask of filter coffee',
  jasmine: 'A mola of jasmine',
};

function DialoguePanel() {
  const conversation = useCity((s) => s.conversation);
  const reply = useCity((s) => s.reply);
  const closeTalk = useCity((s) => s.closeTalk);
  if (!conversation) return null;
  const npc = NPCS_BY_ID[conversation.npcId];

  return (
    <section className="city-card talk" aria-live="polite" data-testid="talk">
      <header className="talk-head">
        <h2 className="city-title">{npc?.name ?? 'Someone'}</h2>
        <span className="talk-role">{npc?.role}</span>
        <button type="button" className="talk-close" onClick={closeTalk}>
          Walk away · Esc
        </button>
      </header>
      <p className="talk-text" data-testid="talk-text">
        {conversation.text}
      </p>
      <ol className="talk-choices">
        {conversation.choices.map((choice, index) => (
          <li key={`${conversation.nodeId}:${index}:${choice.text}`}>
            <button
              type="button"
              className="talk-choice"
              disabled={choice.disabled !== undefined}
              onClick={() => reply(index)}
            >
              <span className="city-key">{index + 1}</span>
              <span>{choice.text}</span>
              {choice.disabled && <small>{choice.disabled}</small>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuidePanel() {
  const area = useCity((s) => s.area);
  const areaInside = useCity((s) => s.areaInside);
  const answer = useCity((s) => s.guideAnswer);
  const ask = useCity((s) => s.ask);
  const openPanel = useCity((s) => s.openPanel);
  const [question, setQuestion] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(question);
    setQuestion('');
  };
  const questions = answer ? answer.suggestions : (area?.topics.map((t) => t.question) ?? []);

  return (
    <aside className="city-card panel" data-testid="guide">
      <header className="panel-head">
        <div>
          <p className="city-eyebrow">
            {areaInside ? 'Ask the city · you are in' : 'Ask the city · nearest'}
          </p>
          <h2 className="city-title">{area?.name ?? 'Bengaluru'}</h2>
        </div>
        <button type="button" className="panel-close" onClick={() => openPanel(null)}>
          Close
        </button>
      </header>
      <div className="panel-body">
        <p>{area?.blurb ?? 'Walk somewhere and ask me about it.'}</p>
        {answer && (
          <div className="answer" data-testid="guide-answer">
            <h4>{answer.title}</h4>
            <p>{answer.text}</p>
          </div>
        )}
        {questions.length > 0 && (
          <>
            <h3 className="panel-section">{answer ? 'Ask next' : 'People ask'}</h3>
            <div className="chips">
              {questions.map((text) => (
                <button key={text} type="button" className="chip" onClick={() => ask(text)}>
                  {text}
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className="panel-section">Getting around</h3>
        <div className="chips">
          {['MG Road', 'Majestic', 'Cubbon Park', 'KR Market', 'Church Street']
            .filter((name) => name !== area?.name)
            .map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                onClick={() => ask(`How do I get to ${name}?`)}
              >
                How do I get to {name}?
              </button>
            ))}
        </div>
      </div>
      <form className="ask" onSubmit={submit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this place, or how to get somewhere"
          aria-label="Ask the city a question"
          maxLength={160}
        />
        <button type="submit" className="button" disabled={!question.trim()}>
          Ask
        </button>
      </form>
    </aside>
  );
}

function MissionsPanel() {
  const missions = useCity((s) => s.missions);
  const memory = useCity((s) => s.memory);
  const beginMission = useCity((s) => s.beginMission);
  const openPanel = useCity((s) => s.openPanel);

  const listed = MISSIONS.filter((mission) => mission.open || missions[mission.id]);
  const items = Object.entries(memory.items);

  return (
    <aside className="city-card panel" data-testid="missions">
      <header className="panel-head">
        <div>
          <p className="city-eyebrow">Chapter 1 · Majestic to MG Road</p>
          <h2 className="city-title">Missions</h2>
        </div>
        <button type="button" className="panel-close" onClick={() => openPanel(null)}>
          Close
        </button>
      </header>
      <div className="panel-body">
        {listed.map((mission) => {
          const progress = missions[mission.id];
          const active = progress?.status === 'active';
          return (
            <article key={mission.id} className={`mission${active ? ' is-active' : ''}`}>
              <h4>{mission.title}</h4>
              <p className="mission-by">
                {mission.giver}
                {mission.minutes ? ` · ${formatMinutes(mission.minutes)} limit` : ''} · ₹
                {mission.reward}
              </p>
              <p>{progress && active ? mission.steps[progress.step]?.text : mission.brief}</p>
              <div className="mission-row">
                {active && <span className="tag is-live">In progress</span>}
                {progress?.status === 'done' && <span className="tag is-good">Done</span>}
                {progress?.status === 'failed' && <span className="tag is-bad">Failed</span>}
                {!progress && <span className="tag">Not started</span>}
                {mission.open && !active && (
                  <button type="button" className="button" onClick={() => beginMission(mission.id)}>
                    {progress ? 'Play again' : 'Start'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        <p>More work comes from the people you meet. Talk to them.</p>

        <h3 className="panel-section">Pockets</h3>
        <p>
          ₹{memory.coins}
          {items.map(([id, count]) => ` · ${ITEM_NAMES[id] ?? id}${count > 1 ? ` ×${count}` : ''}`)}
        </p>

        {memory.notes.length > 0 && (
          <>
            <h3 className="panel-section">What you remember</h3>
            <ul className="notes">
              {[...memory.notes].reverse().map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function StationPanel() {
  const stationId = useCity((s) => s.stationId);
  const raining = useCity((s) => s.raining);
  const coins = useCity((s) => s.memory.coins);
  const board = useCity((s) => s.board);
  const openPanel = useCity((s) => s.openPanel);
  const hour = useUi((s) => s.hour);

  const station = STATIONS.find((entry) => entry.id === stationId);
  const trips = useMemo(() => {
    if (!station) return [];
    const found: TransitTrip[] = [];
    for (const line of station.lines) {
      for (const stop of line.stops) {
        const trip = planTrip(line, station.anchor, stop, hour, raining);
        if (trip) found.push(trip);
      }
    }
    return found;
  }, [station, hour, raining]);
  if (!station) return null;

  return (
    <aside className="city-card panel" data-testid="station">
      <header className="panel-head">
        <div>
          <p className="city-eyebrow">
            {station.kind === 'metro' ? 'Namma Metro' : 'BMTC bus stop'}
          </p>
          <h2 className="city-title">{PLACE_NAMES[station.anchor] ?? 'Station'}</h2>
        </div>
        <button type="button" className="panel-close" onClick={() => openPanel(null)}>
          Close
        </button>
      </header>
      <div className="panel-body">
        <p>
          It is {formatClock(hour)}.{' '}
          {station.kind === 'metro'
            ? 'Trains do not care about traffic.'
            : 'Buses are cheap, and sit in the same jam as everyone else.'}
        </p>
        {trips.length === 0 && (
          <p>Nothing is running at this hour. First services start around 5.</p>
        )}
        {station.lines.map((line) => (
          <div key={line.id}>
            <h3 className="panel-section">{line.name}</h3>
            {trips
              .filter((trip) => trip.line.id === line.id)
              .map((trip) => (
                <button
                  key={`${line.id}:${trip.to}`}
                  type="button"
                  className="trip"
                  disabled={trip.fare > coins}
                  onClick={() => board(trip)}
                >
                  <b>{PLACE_NAMES[trip.to] ?? trip.to}</b>
                  <span>
                    {trip.wait < 1 ? 'Leaving now' : `In ${Math.round(trip.wait)} min`} ·{' '}
                    {Math.round(trip.ride)} min ride · arrives {formatClock(trip.arrival)}
                  </span>
                  <em>₹{trip.fare}</em>
                </button>
              ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function IntroCard() {
  const intro = useCity((s) => s.intro);
  const skipIntro = useCity((s) => s.skipIntro);
  const npc = intro ? NPCS_BY_ID[intro.npcId] : undefined;
  if (!npc) return null;
  return (
    <div className="intro" data-testid="intro" onClick={skipIntro}>
      {npc.introVideo && (
        <video
          className="intro-video"
          src={`${import.meta.env.BASE_URL}${npc.introVideo}`}
          autoPlay
          playsInline
          onEnded={skipIntro}
          onError={skipIntro}
        />
      )}
      <div className="intro-bar" />
      <div className="intro-name" key={npc.id}>
        <p className="city-eyebrow">{npc.role}</p>
        <h2 className="city-title">{npc.name}</h2>
        <p className="intro-tagline">{npc.tagline}</p>
      </div>
      <div className="intro-bar intro-bar-low">
        <span>
          <span className="city-key">E</span> skip
        </span>
      </div>
    </div>
  );
}

function RadioPanel() {
  const stations = useRadio((s) => s.stations);
  const stationId = useRadio((s) => s.stationId);
  const status = useRadio((s) => s.status);
  const nowPlaying = useRadio((s) => s.nowPlaying);
  const message = useRadio((s) => s.message);
  const volume = useRadio((s) => s.volume);
  const sounds = useRadio((s) => s.sounds);
  const bundled = useRadio((s) => s.bundled);
  const device = useRadio((s) => s.device);
  const tune = useRadio((s) => s.tune);
  const stop = useRadio((s) => s.stop);
  const skip = useRadio((s) => s.skip);
  const setVolume = useRadio((s) => s.setVolume);
  const setSounds = useRadio((s) => s.setSounds);
  const addFiles = useRadio((s) => s.addFiles);
  const addStream = useRadio((s) => s.addStream);
  const removeStation = useRadio((s) => s.removeStation);
  const openPanel = useCity((s) => s.openPanel);
  const picker = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState('');

  const current = stations.find((station) => station.id === stationId);
  const on = status !== 'off';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const error = addStream(name, url);
    setProblem(error ?? '');
    if (!error) {
      setName('');
      setUrl('');
    }
  };

  return (
    <aside className="city-card panel" data-testid="radio">
      <header className="panel-head">
        <div>
          <p className="city-eyebrow">{on ? `On air · ${current?.band ?? ''}` : 'Radio'}</p>
          <h2 className="city-title">{on ? (current?.name ?? 'Radio') : 'Off'}</h2>
        </div>
        <button type="button" className="panel-close" onClick={() => openPanel(null)}>
          Close
        </button>
      </header>
      <div className="panel-body">
        <div className="radio-now" data-testid="radio-now">
          <span className={`radio-dot is-${status}`} />
          <span>
            {status === 'off' && 'Pick a station.'}
            {status === 'loading' && 'Tuning…'}
            {status === 'playing' && (nowPlaying || 'Playing')}
            {status === 'error' && message}
          </span>
        </div>
        <div className="radio-controls">
          <button type="button" className="button" onClick={() => (on ? stop() : tune(stationId))}>
            {on ? 'Stop' : 'Play'}
          </button>
          <button type="button" className="panel-close" disabled={!on} onClick={skip}>
            Next
          </button>
          <label className="radio-volume">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Radio volume"
            />
          </label>
        </div>

        <h3 className="panel-section">Stations</h3>
        {stations.map((station) => {
          const count =
            station.kind === 'tracks'
              ? bundled.length
              : station.kind === 'device'
                ? device.length
                : -1;
          return (
            <div
              key={station.id}
              className={`station${station.id === stationId && on ? ' is-on' : ''}`}
            >
              <button type="button" className="station-main" onClick={() => tune(station.id)}>
                <em>{station.band}</em>
                <b>{station.name}</b>
                <span>
                  {station.blurb}
                  {count >= 0 && ` ${count} ${count === 1 ? 'song' : 'songs'}.`}
                </span>
              </button>
              {station.kind === 'device' && (
                <button
                  type="button"
                  className="panel-close"
                  onClick={() => picker.current?.click()}
                >
                  Add songs
                </button>
              )}
              {station.band === 'Saved' && (
                <button
                  type="button"
                  className="panel-close"
                  onClick={() => removeStation(station.id)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
        <input
          ref={picker}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <h3 className="panel-section">Add a live station</h3>
        <p>Paste the stream address of any internet radio station, such as a Kannada FM station.</p>
        <form className="radio-add" onSubmit={submit}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Station name"
            aria-label="Station name"
            maxLength={40}
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://… (MP3, AAC or .m3u8)"
            aria-label="Stream address"
            maxLength={300}
          />
          <button type="submit" className="button" disabled={!url.trim()}>
            Add
          </button>
        </form>
        {problem && <p className="radio-problem">{problem}</p>}

        <h3 className="panel-section">City sounds</h3>
        <label className="radio-toggle">
          <input
            type="checkbox"
            checked={sounds}
            onChange={(event) => setSounds(event.target.checked)}
          />
          <span>Traffic, rain, horns and your auto’s engine</span>
        </label>
      </div>
    </aside>
  );
}

function TravelOverlay() {
  const travel = useCity((s) => s.travel);
  if (!travel) return null;
  return (
    <div className="travel" role="status" data-testid="travel">
      <p className="city-eyebrow">On the way</p>
      <h2 className="city-title">{travel.title}</h2>
      <p>{travel.detail}</p>
      <div className="travel-bar">
        <i />
      </div>
    </div>
  );
}

function ToastView() {
  const toast = useCity((s) => s.toast);
  const dismissToast = useCity((s) => s.dismissToast);
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = window.setTimeout(dismissToast, 6500);
    return () => window.clearTimeout(timer);
  }, [id, dismissToast]);
  if (!toast) return null;
  return (
    <div className={`city-card toast is-${toast.tone}`} role="status" data-testid="toast">
      <b>{toast.title}</b>
      <span>{toast.text}</span>
    </div>
  );
}

/** Everything the living city draws over the 3D view while playing. */
export function CityLayer() {
  const panel = useCity((s) => s.panel);
  const travelling = useCity((s) => s.travel !== null);
  return (
    <div className="city">
      {!travelling && <DialoguePanel />}
      {panel === 'guide' && <GuidePanel />}
      {panel === 'missions' && <MissionsPanel />}
      {panel === 'station' && <StationPanel />}
      {panel === 'radio' && <RadioPanel />}
      <ToastView />
      <IntroCard />
      <TravelOverlay />
    </div>
  );
}

import { formatClock, formatMinutes } from '@blr/engine';
import { useMemo } from 'react';
import { useRadio } from '../audio/radio';
import { trackerFor, useCity } from '../state/city';
import { useUi } from '../state/ui';
import { Attribution } from './Attribution';

const HINTS = {
  foot: (
    <>
      <b>WASD</b> walk · <b>Shift</b> run · <b>drag</b> to look · <b>E</b> talk
    </>
  ),
  auto: (
    <>
      <b>W/S</b> drive · <b>A/D</b> steer · <b>E</b> get out
    </>
  ),
  drone: (
    <>
      Drone · <b>WASD</b> fly · <b>Space/Q</b> up/down · <b>F</b> back to the street
    </>
  ),
};

export function Hud() {
  const hour = useUi((s) => s.hour);
  const setHour = useUi((s) => s.setHour);
  const pause = useUi((s) => s.pause);
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const fps = useUi((s) => s.fps);
  const drawCalls = useUi((s) => s.drawCalls);
  const triangles = useUi((s) => s.triangles);
  const world = useUi((s) => s.world);

  const area = useCity((s) => s.area);
  const areaInside = useCity((s) => s.areaInside);
  const mode = useCity((s) => s.mode);
  const coins = useCity((s) => s.memory.coins);
  const raining = useCity((s) => s.raining);
  const jam = useCity((s) => s.jam);
  const sketch = useCity((s) => s.sketch);
  const panel = useCity((s) => s.panel);
  const prompt = useCity((s) => s.prompt);
  const talking = useCity((s) => s.conversation !== null);
  const missions = useCity((s) => s.missions);
  const positions = useCity((s) => s.positions);
  const player = useCity((s) => s.player);
  const openPanel = useCity((s) => s.openPanel);
  const requestInteract = useCity((s) => s.requestInteract);
  const toggleDrone = useCity((s) => s.requestDrone);
  const intro = useCity((s) => s.intro !== null);
  const radioOn = useRadio((s) => s.status === 'playing');
  const radioStation = useRadio((s) => s.stations.find((e) => e.id === s.stationId)?.name);
  const radioNow = useRadio((s) => s.nowPlaying);

  const tracker = useMemo(
    () => trackerFor(missions, positions, player),
    [missions, positions, player],
  );
  const timed = tracker?.minutesLeft !== null && tracker?.minutesLeft !== undefined;

  return (
    <div className="city hud" hidden={intro}>
      <div className="hud-place">
        {area && (
          <div className="city-card hud-area" data-testid="area">
            <p className="city-eyebrow">{areaInside ? 'You are in' : 'Nearest'}</p>
            <h2 className="city-title">{area.name}</h2>
          </div>
        )}
        <p className="city-card hud-hint">{HINTS[mode]}</p>
        {jam && (
          <p className="city-card hud-hint" data-testid="jam">
            <b>Jam</b> · {jam} is crawling
          </p>
        )}
        {world.near && (
          <p className="hud-small" data-testid="near">
            Near {world.near}
          </p>
        )}
      </div>

      <div className="hud-side">
        <div className="city-card hud-status">
          <span className="hud-clock" data-testid="clock">
            {formatClock(hour)}
          </span>
          {raining && <span className="hud-wet">Rain</span>}
          <span className="hud-coins" data-testid="coins">
            ₹{coins}
          </span>
        </div>
        <div className="hud-buttons">
          <button
            type="button"
            className="hud-button"
            aria-pressed={panel === 'guide'}
            onClick={() => openPanel('guide')}
          >
            <span className="city-key">G</span>Ask the city
          </button>
          <button
            type="button"
            className="hud-button"
            aria-pressed={panel === 'missions'}
            onClick={() => openPanel('missions')}
          >
            <span className="city-key">M</span>Missions
          </button>
          <button
            type="button"
            className="hud-button"
            aria-pressed={panel === 'radio'}
            onClick={() => openPanel('radio')}
          >
            <span className="city-key">R</span>Radio
          </button>
          <button
            type="button"
            className="hud-button"
            aria-pressed={mode === 'drone'}
            onClick={toggleDrone}
          >
            <span className="city-key">F</span>Drone
          </button>
          <button type="button" className="hud-button" onClick={() => setAboutOpen(true)}>
            Developer
          </button>
          <button type="button" className="hud-button" aria-label="Pause" onClick={pause}>
            <span className="city-key">Esc</span>Pause
          </button>
        </div>
        {radioOn && !panel && (
          <p className="city-card hud-hint hud-radio" data-testid="hud-radio">
            <b>{radioStation}</b> · {radioNow}
          </p>
        )}
        {tracker && !panel && (
          <div className="city-card tracker" data-testid="tracker">
            <p className="city-eyebrow">Mission</p>
            <h3 className="city-title">{tracker.title}</h3>
            <p>{tracker.step}</p>
            {(timed || tracker.heading) && (
              <div className="tracker-meta">
                <span>{tracker.heading ?? ''}</span>
                {timed && (
                  <span
                    className={`tracker-time${(tracker.minutesLeft ?? 99) < 8 ? ' is-late' : ''}`}
                  >
                    {formatMinutes(tracker.minutesLeft ?? 0)} left
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hud-foot">
        <span className="hud-small">
          <Attribution />
          {sketch && ' · Placeholder streets until the real map is baked'}
          <span data-testid="stats">
            {' '}
            · {fps} FPS · {world.loaded} chunks{world.pending > 0 ? ` (+${world.pending})` : ''} ·{' '}
            {drawCalls} draws · {Math.round(triangles / 1000)}k tris · {Math.round(player.x)},{' '}
            {Math.round(player.z)}
          </span>
        </span>
        <label className="city-card hud-time">
          <span>Time</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.05}
            value={hour}
            disabled={timed}
            onChange={(event) => setHour(Number(event.target.value))}
            aria-label="Time of day"
          />
        </label>
      </div>

      {prompt && !talking && !panel && (
        <button type="button" className="prompt" data-testid="prompt" onClick={requestInteract}>
          <span className="city-key">E</span>
          {prompt.label}
        </button>
      )}
    </div>
  );
}

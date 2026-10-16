import { VEHICLES, vehicleSpec } from '../../game/vehicle/catalog';
import { useApp } from '../../game/state/store';
export function Garage() {
  const settings = useApp(s => s.settings); const update = useApp(s => s.updateSettings);
  const selected = vehicleSpec(settings.vehicle);
  return <section className="garage" aria-label="Vehicle garage">
    <label className="row"><span>Choose your ride</span><select aria-label="Vehicle" value={selected.id} onChange={e => update({ vehicle: vehicleSpec(e.target.value).id })}>
      <optgroup label="Cars">{VEHICLES.filter(v => v.kind === 'car').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
      <optgroup label="Superbikes">{VEHICLES.filter(v => v.kind === 'bike').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
    </select></label>
    <p className="vehicle-description">{selected.description}</p>
    <div className="vehicle-stats"><span>{selected.kind === 'bike' ? '2 wheels' : '4 wheels'}</span><span>{selected.chassis.mass} kg</span><span>{selected.topSpeed} km/h limit</span></div>
    <div className="row"><span>Race distance</span><div className="seg">{[1, 2, 3].map(raceLaps => <button key={raceLaps} className={settings.raceLaps === raceLaps ? 'on' : ''} onClick={() => update({ raceLaps })}>{raceLaps === 1 ? 'Quick · 1 lap' : `${raceLaps} laps`}</button>)}</div></div>
    <small>Pass the highlighted checkpoints, then the finish line. Space: {selected.kind === 'bike' ? 'rear brake' : 'handbrake'}.</small>
  </section>;
}

import type { SplitSettings } from "../../shared/types";
import { CHUNK_OPTIONS, DEFAULT_SETTINGS, OVERLAP_OPTIONS } from "./settingsStore";

interface FieldProps {
  label: string;
  hint: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}

const Field = ({ label, hint, value, options, onChange }: FieldProps) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <span className="field-hint">{hint}</span>
  </label>
);

interface SettingsProps {
  settings: SplitSettings;
  onChange: (settings: SplitSettings) => void;
}

export const Settings = ({ settings, onChange }: SettingsProps) => (
  <section className="settings">
    <h2>Settings</h2>

    <Field
      label="Chunk size"
      hint="How much audio is processed at once. Larger chunks need more memory and can freeze your computer if it runs out."
      value={settings.chunkSize}
      options={CHUNK_OPTIONS}
      onChange={(chunkSize) => onChange({ ...settings, chunkSize })}
    />

    <Field
      label="Overlap"
      hint="How many times each part of the song is processed. Higher values can smooth out rough spots but take longer."
      value={settings.overlap}
      options={OVERLAP_OPTIONS}
      onChange={(overlap) => onChange({ ...settings, overlap })}
    />

    <button className="button ghost small" onClick={() => onChange(DEFAULT_SETTINGS)}>
      Reset to defaults
    </button>
  </section>
);

import { AdminSelect } from "../shared/admin-select";

export function TournamentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded border border-white/10 bg-[#070d0d] px-4 font-bold text-white outline-none focus:border-[#84d8e8]"
      />
    </label>
  );
}

export function TournamentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
        {label}
      </span>
      <AdminSelect
        value={value}
        options={options.map((option) => ({ value: option, label: option }))}
        onChange={onChange}
        ariaLabel={label}
        className="w-full"
      />
    </label>
  );
}






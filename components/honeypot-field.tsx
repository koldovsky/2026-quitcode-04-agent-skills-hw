import { HONEYPOT_FIELD } from "@/lib/honeypot";

// Off-screen, hidden from screen readers and out of the tab order, so people leave it empty; if the
// styles do not load, the label tells them to.
export function HoneypotField({ id }: { id: string }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
      <label htmlFor={id}>Не заповнюйте це поле</label>
      <input id={id} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

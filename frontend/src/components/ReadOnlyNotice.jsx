/** Aviso de módulo en solo lectura (HU19): se ve, pero no se modifica. */
export default function ReadOnlyNotice() {
  return (
    <div role="note" className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
      Tiene acceso de <span className="font-medium">solo lectura</span> en esta sección: puede consultar la información, pero no modificarla.
    </div>
  );
}

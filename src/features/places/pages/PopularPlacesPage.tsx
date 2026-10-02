import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ImageOff, ImageUp, MapPin, Plus } from "lucide-react";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, Table, Toggle, cell, inputClass } from "@/components/Ui";
import {
  checkPlacePhoto,
  popularPlaceImageUrl,
  useCreatePopularPlace,
  useDeletePopularPlace,
  usePopularPlaces,
  useRemovePopularPlaceImage,
  useUpdatePopularPlace,
  useUploadPopularPlaceImage,
} from "../api";
import type { PopularImageRule, PopularPlace } from "../api";

function PlaceForm({ place, onClose }: { place?: PopularPlace; onClose: () => void }) {
  const create = useCreatePopularPlace();
  const update = useUpdatePopularPlace();
  const mutation = place ? update : create;
  const [form, setForm] = useState({
    name: place?.name ?? "",
    secondaryText: place?.secondaryText ?? "",
    city: place?.city ?? "",
    latitude: place ? String(place.latitude) : "",
    longitude: place ? String(place.longitude) : "",
    sortOrder: String(place?.sortOrder ?? 100),
  });
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const sortOrder = Number(form.sortOrder);
    if (form.name.trim().length < 2) return setError("Enter the place name");
    if (form.secondaryText.trim().length < 2) return setError("Enter the locality, e.g. “Sector 32, Noida”");
    if (form.city.trim().length < 2) return setError("Enter the city");
    if (form.latitude.trim() === "" || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return setError("Latitude: −90 to 90");
    if (form.longitude.trim() === "" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return setError("Longitude: −180 to 180");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) return setError("Order: a whole number 0–10000");
    const input = {
      name: form.name.trim(),
      secondaryText: form.secondaryText.trim(),
      city: form.city.trim(),
      latitude,
      longitude,
      sortOrder,
    };
    if (place) update.mutate({ id: place.id, ...input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  }

  return (
    <Modal title={place ? `Edit ${place.name}` : "New popular place"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} maxLength={80} />
          </FormField>
          <FormField label="City" hint="Groups places in this list">
            <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className={inputClass} maxLength={60} />
          </FormField>
        </div>
        <FormField label="Locality" hint="Second line in the app, e.g. “Sector 32, Noida”">
          <input value={form.secondaryText} onChange={(event) => setForm({ ...form, secondaryText: event.target.value })} className={inputClass} maxLength={120} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Latitude" hint="Drop-off point (main gate)">
            <input inputMode="decimal" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Longitude">
            <input inputMode="decimal" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Order" hint="Lower first">
            <input inputMode="numeric" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        <p className="text-xs text-slate-500">
          Riders see active places near them, nearest first; “Order” applies only when a rider’s position is unknown. Tip: in Google Maps, long-press
          the entrance and copy the coordinates.
        </p>
        {(error || mutation.error) && <Notice tone="error">{error ?? mutation.error?.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={mutation.isPending}>
            {place ? "Save" : "Add place"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PhotoCell({ place, rule }: { place: PopularPlace; rule: PopularImageRule }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadPopularPlaceImage();
  const remove = useRemovePopularPlaceImage();
  const [problem, setProblem] = useState<string | null>(null);
  const url = popularPlaceImageUrl(place);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    upload.reset();
    const check = await checkPlacePhoto(file, rule);
    setProblem(check);
    if (!check) upload.mutate({ id: place.id, file });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {url ? <img src={url} alt={`${place.name} photo`} className="h-full w-full object-cover" /> : <MapPin className="h-5 w-5 text-slate-300" aria-hidden />}
      </div>
      <div className="space-y-1 text-xs">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void choose(event)} />
        <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1 font-semibold text-bhagwa-600 hover:underline" disabled={upload.isPending}>
          <ImageUp className="h-3.5 w-3.5" aria-hidden /> {upload.isPending ? "Uploading…" : url ? "Replace" : "Add photo"}
        </button>
        {url && (
          <button type="button" onClick={() => remove.mutate(place.id)} className="flex items-center gap-1 text-slate-500 hover:underline" disabled={remove.isPending}>
            <ImageOff className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        )}
        {(problem || upload.error || remove.error) && <p className="max-w-[12rem] text-red-600">{problem ?? upload.error?.message ?? remove.error?.message}</p>}
      </div>
    </div>
  );
}

export function PopularPlacesPage() {
  const { data, error, isPending } = usePopularPlaces();
  const update = useUpdatePopularPlace();
  const remove = useDeletePopularPlace();
  const [editing, setEditing] = useState<PopularPlace | "new" | null>(null);
  const [deleting, setDeleting] = useState<PopularPlace | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Popular places"
        subtitle="“Popular destinations” on the rider’s Home and Where to? screens. Riders see active places near them, nearest first."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> New place
          </Button>
        }
      />
      {data && <p className="text-xs text-slate-500">Photos: {data.imageRule.hint}.</p>}
      {update.error && <Notice tone="error">{update.error.message}</Notice>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.places.length === 0} emptyText="No popular places yet">
          <Table head={["Place", "Photo", "City", "Location", "Shown", ""]}>
            {data?.places.map((place) => (
              <tr key={place.id} className={place.active ? "" : "bg-slate-50/60"}>
                <td className={cell}>
                  <p className="font-semibold text-slate-900">{place.name}</p>
                  <p className="text-xs text-slate-500">{place.secondaryText}</p>
                </td>
                <td className={cell}>
                  <PhotoCell place={place} rule={data.imageRule} />
                </td>
                <td className={cell}>{place.city}</td>
                <td className={`${cell} font-mono text-xs`}>
                  <a
                    href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-600 hover:underline"
                  >
                    {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                  </a>
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={place.active}
                      label={`Show ${place.name} to riders`}
                      disabled={update.isPending}
                      onChange={(active) => update.mutate({ id: place.id, active })}
                    />
                    {place.active ? <Pill tone="green">Shown</Pill> : <Pill>Hidden</Pill>}
                  </div>
                </td>
                <td className={`${cell} space-x-3 whitespace-nowrap text-right`}>
                  <button type="button" onClick={() => setEditing(place)} className="font-semibold text-bhagwa-600 hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleting(place)} className="font-semibold text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </LoadState>
      </section>

      {editing && <PlaceForm place={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="It disappears from the apps at once, with its photo. To keep it for later, hide it instead."
          confirmLabel="Delete"
          danger
          busy={remove.isPending}
          error={remove.error?.message}
          onCancel={() => {
            remove.reset();
            setDeleting(null);
          }}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        />
      )}
    </div>
  );
}

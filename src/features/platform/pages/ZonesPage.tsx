import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, FormField, LoadState, Notice, PageHeader, Pill, SearchBox, Table, cell, inputClass } from "@/components/Ui";
import { formatDateTime } from "@/lib/format";
import { circleBoundary, useSaveZone, useSetZoneStatus, useZone, useZones } from "../api";
import type { LatLng, Zone } from "../api";

/** Equirectangular outline preview — enough to catch a wrong point or order. */
export function ZoneOutline({ points, height = 220 }: { points: LatLng[]; height?: number }) {
  if (points.length < 2) return <div className="flex h-40 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">No outline yet</div>;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const [minLat, maxLat] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [minLng, maxLng] = [Math.min(...longitudes), Math.max(...longitudes)];
  const cosine = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * cosine, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const width = Math.max(160, Math.min(480, (height * spanX) / spanY));
  const pad = 10;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const project = (point: LatLng) => [pad + (point.longitude - minLng) * cosine * scale, height - pad - (point.latitude - minLat) * scale] as const;
  const path = points.map((point, index) => `${index ? "L" : "M"}${project(point).join(",")}`).join(" ") + " Z";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-md rounded-xl bg-slate-50" role="img" aria-label="Zone outline preview">
      <path d={path} fill="#2a78d61f" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" />
      {points.map((point, index) => {
        const [x, y] = project(point);
        return <circle key={index} cx={x} cy={y} r={index === 0 ? 4 : 2.5} fill={index === 0 ? "#eb6834" : "#2a78d6"} />;
      })}
    </svg>
  );
}

export function ZonesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";
  const status = (["ACTIVE", "INACTIVE"] as const).find((value) => value === params.get("status"));
  const { data, error, isPending, isFetching } = useZones({ page, search, status });

  function update(next: { q?: string; status?: Zone["status"]; page?: number }) {
    const merged = { q: search, status, page: 1, ...next };
    const out: Record<string, string> = {};
    if (merged.q) out.q = merged.q;
    if (merged.status) out.status = merged.status;
    if (merged.page > 1) out.page = String(merged.page);
    setParams(out);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Zones"
        subtitle="Service areas. Once any zone is active, pickups must be inside an active zone; rides are tagged with their zone for reporting."
        actions={
          <Link to="/zones/new" className="inline-flex items-center gap-2 rounded-lg bg-bhagwa-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bhagwa-600">
            <Plus className="h-4 w-4" aria-hidden /> New zone
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<Zone["status"]> label="Zone status" options={[undefined, "ACTIVE", "INACTIVE"]} value={status} onChange={(value) => update({ status: value })} render={(value) => (value ? (value === "ACTIVE" ? "Active" : "Inactive") : "All")} />
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Zone or city" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No zones yet — Tirvona currently serves pickups anywhere.">
          {data && (
            <>
              <Table head={["Zone", "City", "Points", "Status", "Updated", ""]}>
                {data.items.map((zone) => (
                  <tr key={zone.id} className="hover:bg-slate-50">
                    <td className={`${cell} font-semibold text-slate-900`}>{zone.name}</td>
                    <td className={cell}>{zone.city ?? "—"}</td>
                    <td className={`${cell} tabular-nums`}>{zone.vertexCount}</td>
                    <td className={cell}>{zone.status === "ACTIVE" ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}</td>
                    <td className={`${cell} text-slate-500`}>{formatDateTime(zone.updatedAt)}</td>
                    <td className={`${cell} text-right`}>
                      <Link to={`/zones/${zone.id}`} className="font-semibold text-bhagwa-600 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
    </div>
  );
}

const pointsToText = (points: LatLng[]) => points.map((point) => `${point.latitude}, ${point.longitude}`).join("\n");

function parsePoints(text: string): { points: LatLng[]; error?: string } {
  const points: LatLng[] = [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const parts = line.split(/[,\s]+/).filter(Boolean).map(Number);
    if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value)))
      return { points, error: `Line ${index + 1}: write "latitude, longitude"` };
    const [latitude, longitude] = parts;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { points, error: `Line ${index + 1}: out of range` };
    points.push({ latitude, longitude });
  }
  if (points.length < 3) return { points, error: "At least 3 points are needed" };
  return { points };
}

export function ZoneEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useZone(id);
  const save = useSaveZone();
  const setStatus = useSetZoneStatus();
  const [form, setForm] = useState({ name: "", city: "", description: "" });
  const [pointsText, setPointsText] = useState("");
  const [circle, setCircle] = useState({ latitude: "27.5806", longitude: "77.7006", radiusKm: "8" });
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!existing.data) return;
    setForm({ name: existing.data.name, city: existing.data.city ?? "", description: existing.data.description ?? "" });
    setPointsText(pointsToText(existing.data.boundary));
  }, [existing.data]);

  const parsed = useMemo(() => parsePoints(pointsText), [pointsText]);

  function generateCircle() {
    const latitude = Number(circle.latitude);
    const longitude = Number(circle.longitude);
    const radiusKm = Number(circle.radiusKm);
    if (![latitude, longitude, radiusKm].every(Number.isFinite) || radiusKm <= 0 || radiusKm > 100) return;
    setPointsText(pointsToText(circleBoundary({ latitude, longitude }, radiusKm)));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (form.name.trim().length < 2 || parsed.error) return;
    save.mutate(
      { id, name: form.name.trim(), city: form.city.trim() || undefined, description: form.description.trim() || undefined, boundary: parsed.points },
      {
        onSuccess: (zone) => {
          setSaved(true);
          if (!id) navigate(`/zones/${(zone as Zone).id}`, { replace: true });
        },
      },
    );
  }

  const zone = existing.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/zones" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All zones
      </Link>
      <PageHeader
        title={id ? zone?.name ?? "Zone" : "New zone"}
        subtitle={zone ? `Updated ${formatDateTime(zone.updatedAt)}` : "Define the service area by its outline"}
        actions={
          zone && (
            <Button variant={zone.status === "ACTIVE" ? "danger" : "primary"} onClick={() => setToggling(true)}>
              {zone.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </Button>
          )
        }
      />
      {id && existing.error && <Notice tone="error">{existing.error.message}</Notice>}
      {zone && zone.status === "INACTIVE" && <Notice tone="warning">This zone is inactive: it is not used for service availability or ride tagging.</Notice>}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Section title="Details">
          <div className="space-y-4">
            <FormField label="Zone name" error={form.name && form.name.trim().length < 2 ? "At least 2 characters" : undefined}>
              <input value={form.name} maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
            </FormField>
            <FormField label="City">
              <input value={form.city} maxLength={80} onChange={(event) => setForm({ ...form, city: event.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Description">
              <textarea rows={2} maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} />
            </FormField>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">Quick outline: circle around a point</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input aria-label="Centre latitude" value={circle.latitude} onChange={(event) => setCircle({ ...circle, latitude: event.target.value })} className={inputClass} />
                <input aria-label="Centre longitude" value={circle.longitude} onChange={(event) => setCircle({ ...circle, longitude: event.target.value })} className={inputClass} />
                <input aria-label="Radius km" value={circle.radiusKm} onChange={(event) => setCircle({ ...circle, radiusKm: event.target.value })} className={inputClass} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Latitude · longitude · radius (km, up to 100)</p>
              <div className="mt-2">
                <Button variant="secondary" onClick={generateCircle}>
                  Generate outline
                </Button>
              </div>
            </div>
          </div>
        </Section>
        <Section title="Boundary">
          <div className="space-y-3">
            <ZoneOutline points={parsed.points} />
            <FormField label="Points in order around the edge" hint="One “latitude, longitude” per line. The ring closes automatically." error={pointsText ? parsed.error : undefined}>
              <textarea rows={8} value={pointsText} onChange={(event) => setPointsText(event.target.value)} className={`${inputClass} font-mono text-xs`} spellCheck={false} />
            </FormField>
            <p className="text-xs text-slate-500">{parsed.points.length} points. The server also rejects outlines that cross themselves.</p>
          </div>
        </Section>
        <div className="space-y-3 lg:col-span-2">
          {save.error && <Notice tone="error">{save.error.message}</Notice>}
          {saved && !save.isPending && <Notice tone="success">Zone saved.</Notice>}
          <div className="flex justify-end">
            <Button type="submit" busy={save.isPending} disabled={Boolean(parsed.error) || form.name.trim().length < 2}>
              {id ? "Save changes" : "Create zone"}
            </Button>
          </div>
        </div>
      </form>

      {toggling && zone && (
        <ConfirmDialog
          title={zone.status === "ACTIVE" ? `Deactivate ${zone.name}?` : `Activate ${zone.name}?`}
          body={
            zone.status === "ACTIVE"
              ? "Pickups inside it are refused unless another active zone covers them. If no active zone remains, Tirvona serves pickups anywhere."
              : "Pickups inside it become serviceable; if it is the first active zone, pickups outside every active zone are refused."
          }
          confirmLabel={zone.status === "ACTIVE" ? "Deactivate" : "Activate"}
          danger={zone.status === "ACTIVE"}
          reasonLabel={zone.status === "ACTIVE" ? "Reason" : undefined}
          busy={setStatus.isPending}
          error={setStatus.error?.message}
          onCancel={() => {
            setStatus.reset();
            setToggling(false);
          }}
          onConfirm={(reason) =>
            setStatus.mutate({ id: zone.id, status: zone.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason }, { onSuccess: () => setToggling(false) })
          }
        />
      )}
    </div>
  );
}

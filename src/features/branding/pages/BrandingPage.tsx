import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { Section, timeAgo } from "@/components/DetailUi";
import { Button, ConfirmDialog, LoadState, Notice, PageHeader, Pill } from "@/components/Ui";
import defaultSplash from "@/assets/splash-default.png";
import { brandAssetUrl, checkImage, useAdminBranding, useResetBrandAsset, useUploadBrandAsset } from "../api";
import type { BrandAsset, BrandAssetKind, BrandAssetRule } from "../api";
import { defaultLogo } from "../components/BrandLogo";

const DEFAULTS: Record<BrandAssetKind, string> = { logo: defaultLogo, splash: defaultSplash };

export function BrandingPage() {
  const { data, isPending, error } = useAdminBranding();

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" subtitle="The logo and splash screen shown in the Tirvona Ride customer and driver apps" />
      <Notice tone="warning">
        Apps download a new logo or splash the next time they open or come back to the foreground; a new splash screen shows from the
        launch after that. The launcher icon and Android&apos;s own launch screen are part of the app build and change only with an app
        update.
      </Notice>
      <LoadState pending={isPending} error={error}>
        {data && (
          <div className="grid gap-6 xl:grid-cols-2">
            {data.rules.map(({ kind, rule }) => (
              <AssetCard key={kind} kind={kind} rule={rule} current={data[kind]} />
            ))}
          </div>
        )}
      </LoadState>
    </div>
  );
}

interface Pending {
  file: File;
  url: string;
  width: number;
  height: number;
}

function AssetCard({ kind, rule, current }: { kind: BrandAssetKind; rule: BrandAssetRule; current: BrandAsset | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const upload = useUploadBrandAsset();
  const reset = useResetBrandAsset();

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => void (pending && URL.revokeObjectURL(pending.url)), [pending]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSaved(false);
    upload.reset();
    const check = await checkImage(file, rule);
    setProblem(check.problem);
    setPending(check.problem ? null : { file, url: URL.createObjectURL(file), width: check.width, height: check.height });
  }

  function publish() {
    if (!pending) return;
    upload.mutate(
      { kind, file: pending.file },
      {
        onSuccess: () => {
          setPending(null);
          setSaved(true);
        },
      },
    );
  }

  const shown = pending?.url ?? (current ? brandAssetUrl(current) : DEFAULTS[kind]);
  const status = pending ? (
    <Pill tone="amber">Preview — not published</Pill>
  ) : current ? (
    <Pill tone="brand">Custom</Pill>
  ) : (
    <Pill>App default</Pill>
  );

  return (
    <Section title={rule.label} action={status}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 justify-center">{kind === "splash" ? <PhonePreview src={shown} showLoader={Boolean(pending || current)} /> : <LogoPreview src={shown} />}</div>

        <div className="min-w-0 flex-1 space-y-4 text-sm">
          <dl className="space-y-1 text-slate-600">
            {pending ? (
              <p>
                {pending.file.name} · {pending.width} × {pending.height} px · {formatBytes(pending.file.size)}
              </p>
            ) : current ? (
              <>
                <p>
                  {current.width} × {current.height} px · {formatBytes(current.bytes)} · {current.contentType.replace("image/", "").toUpperCase()}
                </p>
                <p className="text-xs text-slate-500">Updated {timeAgo(current.updatedAt)}</p>
              </>
            ) : (
              <p>Showing the {rule.label.toLowerCase()} bundled with the apps.</p>
            )}
          </dl>

          <p className="text-xs text-slate-500">{rule.hint}</p>

          {problem && <Notice tone="error">{problem}</Notice>}
          {upload.error && <Notice tone="error">{upload.error.message}</Notice>}
          {saved && <Notice tone="success">{rule.label} published.</Notice>}

          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void choose(event)} />
          <div className="flex flex-wrap gap-2">
            {pending ? (
              <>
                <Button onClick={publish} busy={upload.isPending}>
                  Publish
                </Button>
                <Button variant="secondary" onClick={() => setPending(null)} disabled={upload.isPending}>
                  Discard
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => input.current?.click()}>
                  <ImageUp className="h-4 w-4" aria-hidden /> Upload new {rule.label.toLowerCase()}
                </Button>
                {current && (
                  <Button variant="secondary" onClick={() => setConfirmReset(true)}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> Use app default
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title={`Reset the ${rule.label.toLowerCase()}?`}
          body={`The apps go back to the ${rule.label.toLowerCase()} bundled with them. You can upload a new one at any time.`}
          confirmLabel="Use app default"
          danger
          busy={reset.isPending}
          error={reset.error?.message}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() =>
            reset.mutate(kind, {
              onSuccess: () => {
                setConfirmReset(false);
                setSaved(false);
              },
            })
          }
        />
      )}
    </Section>
  );
}

function LogoPreview({ src }: { src: string }) {
  // The apps show the logo on white and ivory surfaces.
  return (
    <div className="w-60 space-y-2">
      <div className="flex h-36 items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
        <img src={src} alt="Logo preview on white" className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex h-20 items-center justify-center rounded-xl border border-slate-200 bg-ivory p-3">
        <img src={src} alt="Logo preview on ivory" className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}

/** `showLoader`: the default art has its own loader spot; custom splashes get it in the bottom 15%. */
function PhonePreview({ src, showLoader }: { src: string; showLoader: boolean }) {
  return (
    <div className="relative aspect-[9/19.5] w-48 overflow-hidden rounded-[1.75rem] border-[6px] border-midnight bg-white shadow-sm">
      <img src={src} alt="Splash preview on a phone" className="h-full w-full object-cover" />
      {/* Where the app draws its loading indicator on a custom splash. */}
      {showLoader && (
        <div className="absolute inset-x-0 top-[88%] flex -translate-y-1/2 flex-col items-center gap-1" aria-hidden>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-bhagwa-500" />
          <span className="text-[8px] font-semibold tracking-[0.2em] text-[#12306B]">LOADING…</span>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
